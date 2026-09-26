import { Platform, Spring, Checkpoint, Coin, Enemy, SceneryItem, PowerUp, EnemyType, PowerUpType, NPC, NPCType, BiomeType } from '../types';
import { getBiomeAtX, getBiomeAtDistance, ActiveBiomeBlend } from './biome';

export const LEVEL_HEIGHT = 650;

export interface WorldData {
  platforms: Platform[];
  springs: Spring[];
  checkpoints: Checkpoint[];
  coins: Coin[];
  powerups: PowerUp[];
  enemies: Enemy[];
  npcs: NPC[];
  hills: SceneryItem[];
  trees: SceneryItem[];
  clouds: SceneryItem[];
  nextGenX: number;
  lastCheckpointDistance: number;
  nextPowerupId: number;
  nextCheckpointId: number;
}

// Helpers for chunk generation
let powerupCounter = 1;
let checkpointCounter = 1;
let npcCounter = 1;

export function createInitialWorld(): WorldData {
  powerupCounter = 1;
  checkpointCounter = 1;
  npcCounter = 1;

  const world: WorldData = {
    platforms: [],
    springs: [],
    checkpoints: [],
    coins: [],
    powerups: [],
    enemies: [],
    npcs: [],
    hills: [],
    trees: [],
    clouds: [],
    nextGenX: 0,
    lastCheckpointDistance: 0,
    nextPowerupId: 1,
    nextCheckpointId: 1
  };

  // Initial clouds across the starting sky
  for (let x = -400; x < 2400; x += 320) {
    world.clouds.push({
      x: x + Math.random() * 80,
      y: 50 + Math.random() * 110,
      width: 90 + Math.random() * 70,
      height: 36 + Math.random() * 16,
      speed: 0.15 + Math.random() * 0.15
    });
  }

  // Generate safe starting tutorial plains
  generateStartingSection(world);

  // Generate initial forward buffer
  while (world.nextGenX < 3200) {
    generateNextChunk(world, 0);
  }

  return world;
}

function addGround(world: WorldData, x: number, w: number, y = 470, h = 180, explicitBiome?: BiomeType) {
  const biome = explicitBiome || getBiomeAtX(x);
  world.platforms.push({ x, y, width: w, height: h, type: 'ground', biome });
  // Add background scenery along this ground
  const numTrees = Math.floor(w / 260);
  for (let i = 0; i < numTrees; i++) {
    if (Math.random() > 0.25) {
      world.trees.push({
        x: x + 60 + i * 240 + (Math.random() - 0.5) * 40,
        y: y,
        height: 65 + Math.random() * 45,
        type: Math.floor(Math.random() * 6)
      });
    }
  }

  // Hills behind
  const numHills = Math.floor(w / 300);
  for (let i = 0; i < numHills; i++) {
    world.hills.push({
      x: x + 80 + i * 290 + (Math.random() - 0.5) * 50,
      y: y + 20,
      radius: 170 + Math.random() * 80,
      color: Math.random() > 0.5 ? '#73c36b' : '#64b65c'
    });
  }
}

function addPlatform(world: WorldData, x: number, y: number, w: number, h = 22, moving = false, range = 0, explicitBiome?: BiomeType) {
  const biome = explicitBiome || getBiomeAtX(x);
  world.platforms.push({
    x, y, width: w, height: h,
    type: 'platform',
    moving,
    originX: x,
    originY: y,
    range,
    dir: 1,
    speed: 1.2,
    biome
  });
}

function addCoinRow(world: WorldData, startX: number, y: number, count: number, spacing = 36) {
  for (let i = 0; i < count; i++) {
    world.coins.push({
      x: startX + i * spacing,
      y,
      collected: false,
      animOffset: Math.random() * Math.PI * 2
    });
  }
}

function addCoinArc(world: WorldData, startX: number, baseY: number, count = 5, span = 180, height = 48) {
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const cx = startX + t * span;
    const cy = baseY - Math.sin(t * Math.PI) * height;
    world.coins.push({
      x: cx,
      y: cy,
      collected: false,
      animOffset: t * 2
    });
  }
}

function addPowerUp(world: WorldData, type: PowerUpType, x: number, y: number) {
  world.powerups.push({
    id: powerupCounter++,
    type,
    x,
    y,
    width: 28,
    height: 28,
    collected: false,
    animOffset: Math.random() * Math.PI * 2
  });
}

export function getRandomPowerUpType(preferred?: PowerUpType): PowerUpType {
  // If preferred type was requested, 50% chance to respect it, 50% chance to pick from balanced pool
  if (preferred && Math.random() < 0.5) {
    return preferred;
  }
  const allTypes: PowerUpType[] = ['speed', 'shield', 'magnet', 'jump', 'life'];
  const weights: Record<PowerUpType, number> = {
    speed: 22,
    shield: 20,
    magnet: 20,
    jump: 20,
    life: 18
  };
  let r = Math.random() * 100;
  for (const t of allTypes) {
    if (r < weights[t]) return t;
    r -= weights[t];
  }
  return 'life';
}

export function spawnSafeRandomPowerUp(
  world: WorldData,
  minX: number,
  maxX: number,
  preferredType?: PowerUpType
): boolean {
  const minSpacing = 350;

  // Find all static, safe candidate platforms in this section
  const candidatePlatforms = world.platforms.filter(plat => {
    // Only static platforms (no moving platforms so powerup never hangs in midair)
    if (plat.moving) return false;
    const platRight = plat.x + plat.width;
    if (platRight < minX + 30 || plat.x > maxX - 30) return false;
    if (plat.width < 64) return false;
    if (plat.y < 130 || plat.y > 510) return false;

    // Check if there is another solid platform directly above with low clearance
    const hasLowCeiling = world.platforms.some(other =>
      other !== plat &&
      other.y < plat.y &&
      plat.y - (other.y + other.height) < 46 &&
      !(other.x + other.width < plat.x + 10 || other.x > plat.x + plat.width - 10)
    );
    if (hasLowCeiling) return false;

    return true;
  });

  if (candidatePlatforms.length === 0) {
    return false;
  }

  // Shuffle platforms to vary selection across runs
  const shuffled = [...candidatePlatforms].sort(() => Math.random() - 0.5);

  for (const plat of shuffled) {
    const safeLeft = Math.max(plat.x + 22, minX + 16);
    const safeRight = Math.min(plat.x + plat.width - 48, maxX - 16);

    if (safeRight < safeLeft) continue;

    // Attempt multiple random positions on this platform
    for (let attempt = 0; attempt < 6; attempt++) {
      const candX = safeLeft + Math.random() * (safeRight - safeLeft);
      // Place directly above platform surface (width 28, height 28)
      const candY = plat.y - 34;

      // Clearance from springs
      const nearSpring = world.springs.some(s => Math.abs((s.x + s.width / 2) - (candX + 14)) < 45);
      if (nearSpring) continue;

      // Clearance from checkpoints
      const nearCheckpoint = world.checkpoints.some(cp => Math.abs(cp.x - candX) < 70);
      if (nearCheckpoint) continue;

      // Clearance from enemies
      const nearEnemy = world.enemies.some(e => Math.abs(e.x - candX) < 65 && Math.abs(e.y - candY) < 55);
      if (nearEnemy) continue;

      // Clearance from other power-ups
      const nearPowerUp = world.powerups.some(pu => Math.abs(pu.x - candX) < minSpacing);
      if (nearPowerUp) continue;

      // Safe spot found!
      const chosenType = getRandomPowerUpType(preferredType);
      addPowerUp(world, chosenType, Math.round(candX), Math.round(candY));
      return true;
    }
  }

  return false;
}

function addNPC(
  world: WorldData,
  type: NPCType,
  x: number,
  y: number,
  dialogue: string,
  name: string,
  pointedDirection?: 'up' | 'right' | 'up-right'
) {
  world.npcs.push({
    id: npcCounter++,
    type,
    x,
    y,
    width: type === 'bolt' ? 24 : 26,
    height: type === 'bolt' ? 26 : 38,
    dialogue,
    name,
    animTimer: Math.random() * Math.PI * 2,
    facingRight: true,
    pointedDirection
  });
}

function addEnemy(world: WorldData, type: EnemyType, x: number, y: number, minX: number, maxX: number, speed = 1.3) {
  // Density & Clustering Guard: Avoid enemy clusters, ensure at least 220px spacing
  const tooClose = world.enemies.some(e => Math.abs(e.x - x) < 220);
  if (tooClose) {
    return;
  }

  let w = 32;
  let h = 28;
  if (type === 'bumble') {
    w = 30;
    h = 26;
  } else if (type === 'chonker') {
    w = 40;
    h = 36;
  } else if (type === 'hopper') {
    w = 28;
    h = 30;
  } else if (type === 'starstrider') {
    w = 26;
    h = 42;
  }

  world.enemies.push({
    type,
    x,
    y,
    width: w,
    height: h,
    vx: speed,
    minX,
    maxX,
    alive: true,
    squishTimer: 0,
    animFrame: 0,
    originY: y,
    jumpCooldown: Math.floor(Math.random() * 60) + 40
  });
}

// Explicit minimum and maximum gap distance limits calibrated to Jiro's physics
// Jiro jump physics: jumpForce = -12.4, gravity = 0.52 -> max airtime ~47f, max run horizontal jump ~330px, standing/low-speed jump ~180px
export const GAP_LIMITS = {
  // Tier 0 (0 - 500m): Safe, introductory terrain with authentic, varied jumpable gaps (115-145px)
  tier0: {
    minGap: 115,
    maxGap: 145,
    maxStepHeight: 70
  },
  // Tier 1 (500 - 1000m): Moderate platforming with clean canyons and elevated moving ledges (135-175px)
  tier1: {
    minGap: 135,
    maxGap: 175,
    maxStepHeight: 80
  },
  // Tier 2 (1000 - 1500m): Intermediate challenges with varied stepping spans (155-210px)
  tier2: {
    minGap: 155,
    maxGap: 210,
    maxStepHeight: 85
  },
  // Tier 3 (1500 - 2500m): Multi-route chasms with intentional elevated wooden platforms (175-240px)
  tier3: {
    minGap: 175,
    maxGap: 240,
    maxStepHeight: 90
  },
  // Tier 4 (2500m+): Advanced sky islands with fair, exciting jumps (190-260px)
  tier4: {
    minGap: 190,
    maxGap: 260,
    maxStepHeight: 95
  }
};

// 1. Initial Starting Meadow (0 to 3450)
// Safe, continuous, and comfortable starting section with gradual gap introduction
function generateStartingSection(world: WorldData) {
  // Safe, unbroken runway for the starting section!
  // Solid ground extending from -500 to 1600px ensures no pits near spawn or behind left boundary
  addGround(world, -500, 2100);

  // Comfortable elevated platforms immediately available right from the beginning
  // First platform at x = 200 (only 60px above ground), effortlessly reachable
  addPlatform(world, 200, 410, 110);
  addPlatform(world, 340, 350, 120);
  addPlatform(world, 500, 290, 120);

  // Starting coin row leading directly into first platform
  addCoinRow(world, 130, 430, 2);
  addCoinArc(world, 190, 370, 4, 110, 35);
  addCoinArc(world, 330, 310, 4, 120, 38);
  addCoinRow(world, 510, 250, 3);

  // Friendly companion Mira cheering Jiro on the starting elevated route
  addNPC(world, 'mira', 350, 312, "Go Jiro! Smash that speed record!", 'Mira');

  // First gentle ground enemy (sprout) placed at safe distance (x = 680)
  addEnemy(world, 'sprout', 680, 442, 560, 820, 1.2);

  // Secondary elevated platforms on the continuous starting ground
  addPlatform(world, 880, 380, 120);
  addPlatform(world, 1060, 310, 120);

  // Helper Robot Bolt offering tips on the solid starting section
  addNPC(world, 'bolt', 1070, 272, "Coins in the sky! Hold Jump for max air!", 'Bolt', 'up-right');

  addCoinArc(world, 880, 340, 5, 120, 40);
  addCoinRow(world, 1070, 270, 3);
  addCoinRow(world, 1250, 430, 3);

  // Second ground enemy with generous spacing (> 500px from first sprout)
  addEnemy(world, 'sprout', 1180, 442, 1020, 1340, 1.3);
  // Aerial bumble stays well clear of the gap at 1600
  addEnemy(world, 'bumble', 1420, 240, 1320, 1480, 1.4);

  // Powerups safely positioned in the starting meadow, including restored Heart/Life!
  spawnSafeRandomPowerUp(world, 240, 750, 'speed');
  spawnSafeRandomPowerUp(world, 800, 1450, 'life');

  // --- GRADUAL GAP INTRODUCTION ---
  // Gap 1: Clean, authentic introductory gap (from 1600 to 1745, gap = 145px)
  // Fair, reachable jump with Jiro's physics (clears 250-370px).
  // True empty space below: no floating ground or filler platform in the gap!
  const gap1 = 145;
  addCoinArc(world, 1560, 420, 5, 190, 46);

  // Second continuous ground block (1745 to 2595) - 850px long
  const g2Start = 1600 + gap1;
  const g2Len = 850;
  addGround(world, g2Start, g2Len);

  addPlatform(world, g2Start + 160, 380, 120);
  addPlatform(world, g2Start + 360, 300, 130);
  addCoinRow(world, g2Start + 80, 430, 3);
  addCoinArc(world, g2Start + 350, 260, 4, 130, 40);
  addCoinRow(world, g2Start + 580, 430, 4);

  // Single enemy on second ground block, well spaced away from landing edge (>240px)
  addEnemy(world, 'sprout', g2Start + 400, 442, g2Start + 260, g2Start + 640, 1.3);
  spawnSafeRandomPowerUp(world, g2Start + 100, g2Start + g2Len - 100, 'shield');

  // Gap 2: Varied, slightly larger gap (from 2595 to 2770, gap = 175px)
  // Gradually increasing challenge. True empty space below the gap.
  // Elevated wooden platform high in the air (y = 335) provides an intentional aerial bonus route!
  const gap2 = 175;
  const gap2Start = g2Start + g2Len;
  addPlatform(world, gap2Start + 35, 335, 105);
  addCoinRow(world, gap2Start + 45, 285, 3);
  addCoinArc(world, gap2Start - 15, 420, 5, 205, 48);

  // Third continuous ground block (2770 to 3570) - 800px long
  const g3Start = gap2Start + gap2;
  const g3Len = 800;
  addGround(world, g3Start, g3Len);

  addPlatform(world, g3Start + 180, 370, 120);
  addPlatform(world, g3Start + 380, 290, 130);
  addPlatform(world, g3Start + 560, 370, 110);
  addCoinRow(world, g3Start + 80, 430, 3);
  addCoinRow(world, g3Start + 400, 250, 3);

  // Single bumble patrol on third ground block, well clear of landing edge
  addEnemy(world, 'bumble', g3Start + 420, 240, g3Start + 260, g3Start + 580, 1.4);
  spawnSafeRandomPowerUp(world, g3Start + 100, g3Start + g3Len - 100, 'life');

  world.nextGenX = g3Start + g3Len;
}

// Procedural Chunk Generator: takes current distance and selects from balanced templates
export function generateNextChunk(world: WorldData, currentDistance: number) {
  const startX = world.nextGenX;

  // Determine difficulty tier
  let tier = 0;
  if (currentDistance >= 2500) tier = 4;
  else if (currentDistance >= 1500) tier = 3;
  else if (currentDistance >= 1000) tier = 2;
  else if (currentDistance >= 500) tier = 1;

  // Milestone Checkpoint check: every 700 - 900m
  const shouldPlaceCheckpoint = (currentDistance - world.lastCheckpointDistance >= 700);

  if (shouldPlaceCheckpoint) {
    // Generate a calm milestone rest sanctuary chunk with a Checkpoint!
    const chunkLength = 800;
    addGround(world, startX, chunkLength);

    const cpX = startX + 280;
    const cpY = 470; // Firmly on the ground
    world.checkpoints.push({
      id: checkpointCounter++,
      x: cpX,
      y: cpY,
      reached: false
    });
    world.lastCheckpointDistance = currentDistance;

    // Pleasant reward coins & power-up at checkpoint
    addCoinArc(world, startX + 80, 420, 5, 160, 55);
    addCoinRow(world, startX + 380, 430, 4);

    // Floating scenic ledge
    addPlatform(world, startX + 460, 340, 130);
    addCoinRow(world, startX + 480, 290, 3);

    // Give a useful strategic powerup at the checkpoint at a safe, varied location
    const pTypes: PowerUpType[] = ['shield', 'life', 'magnet'];
    const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
    spawnSafeRandomPowerUp(world, startX + 340, startX + 760, pType);

    // Supportive companion or helper robot greeting Jiro at the checkpoint!
    if (Math.random() > 0.45) {
      const miraQuotes = [
        "Awesome run, Jiro! Keep the rhythm!",
        "Checkpoint secured! You're flying!",
        "Looking super fast, Jiro!",
        "Pace yourself! Great momentum!"
      ];
      const q = miraQuotes[Math.floor(Math.random() * miraQuotes.length)];
      addNPC(world, 'mira', startX + 480, 302, q, 'Mira');
    } else {
      const boltQuotes = [
        "Shields absorb one hit without life loss!",
        "Coin Magnet pulls every coin in sight!",
        "Hold Jump on springs for astronomical air!",
        "Scan ahead! Watch out for Gorgonix!"
      ];
      const q = boltQuotes[Math.floor(Math.random() * boltQuotes.length)];
      addNPC(world, 'bolt', startX + 480, 304, q, 'Bolt', 'up-right');
    }

    world.nextGenX = startX + chunkLength;
    return;
  }

  // Regular Procedural Chunks according to tier and location
  const patternIndex = Math.floor(Math.random() * 4);
  const approxDistance = Math.max(0, (startX - 100) / 22);
  const blend = getBiomeAtDistance(approxDistance);

  // If inside an active physical transition zone, generate transitional terrain!
  if (blend.inTransition) {
    generateTransitionChunk(world, startX, tier, blend, patternIndex);
    return;
  }

  // Pure location thematic chunk generators
  if (blend.primary === 'coastal') {
    generateCoastalChunk(world, startX, tier, patternIndex);
    return;
  } else if (blend.primary === 'cave') {
    generateCaveChunk(world, startX, tier, patternIndex);
    return;
  } else if (blend.primary === 'temple') {
    generateTempleChunk(world, startX, tier, patternIndex);
    return;
  } else if (blend.primary === 'volcano') {
    generateVolcanoChunk(world, startX, tier, patternIndex);
    return;
  }

  switch (tier) {
    case 0: // 0 - 500m: Gentle, comfortable introductory terrain
      generateTier0Chunk(world, startX, patternIndex);
      break;
    case 1: // 500 - 1000m: Moderate platforming, gentle gaps, first bumble patrols
      generateTier1Chunk(world, startX, patternIndex);
      break;
    case 2: // 1000 - 1500m: Moving ledges, springboards, crawlers, coin magnets
      generateTier2Chunk(world, startX, patternIndex);
      break;
    case 3: // 1500 - 2500m: Multi-tiered routes, hoppers, chonkers, super jumps
      generateTier3Chunk(world, startX, patternIndex);
      break;
    default: // 2500m+: Advanced sky islands, rapid patrols, starstriders, high rewards
      generateTier4Chunk(world, startX, patternIndex);
      break;
  }
}

// ----------------------------------------------------
// DEDICATED LOCATION TRANSITION GENERATOR
// Smoothly mingles terrain, platforms, and ground styling across the transition zone
// ----------------------------------------------------
function generateTransitionChunk(
  world: WorldData,
  startX: number,
  tier: number,
  blend: ActiveBiomeBlend,
  pattern: number
) {
  const f = blend.factor;
  const curB = blend.current;
  const nxtB = blend.next;
  const len = 780;

  if (f < 0.30) {
    // Stage 1: Mostly current biome ground with introducing next biome platforms
    addGround(world, startX, len, 470, 180, curB);
    addPlatform(world, startX + 160, 375, 120, 22, false, 0, curB);
    addPlatform(world, startX + 370, 305, 125, 22, false, 0, nxtB);
    addPlatform(world, startX + 570, 365, 115, 22, false, 0, nxtB);
  } else if (f < 0.65) {
    // Stage 2 & 3: Split ground transition where terrain switches from curB to nxtB
    const splitX = Math.floor(len * (1 - (f - 0.3) / 0.35));
    const sX = Math.max(80, Math.min(len - 80, splitX));
    addGround(world, startX, sX, 470, 180, curB);
    addGround(world, startX + sX, len - sX, 470, 180, nxtB);

    addPlatform(world, startX + 160, 370, 120, 22, false, 0, nxtB);
    addPlatform(world, startX + 370, 300, 130, 22, false, 0, nxtB);
    addPlatform(world, startX + 570, 360, 120, 22, false, 0, nxtB);
  } else {
    // Stage 4: Leading fully into the next biome
    addGround(world, startX, len, 470, 180, nxtB);
    addPlatform(world, startX + 170, 370, 125, 22, false, 0, nxtB);
    addPlatform(world, startX + 380, 295, 130, 22, false, 0, nxtB);
    addPlatform(world, startX + 580, 360, 120, 22, false, 0, nxtB);
  }

  addCoinRow(world, startX + 80, 430, 3);
  addCoinArc(world, startX + 180, 335, 5, 170, 45);
  addCoinRow(world, startX + 390, 250, 4);

  const enemyType = (nxtB === 'cave' || nxtB === 'volcano') ? 'crawler' : 'sprout';
  addEnemy(world, enemyType, startX + 280, 442, startX + 80, startX + 680, 1.3);
  const powerUpType = (nxtB === 'temple') ? 'magnet' : (nxtB === 'volcano' ? 'shield' : 'speed');
  spawnSafeRandomPowerUp(world, startX, startX + len, powerUpType);
  world.nextGenX = startX + len;
}

// ----------------------------------------------------
// ANCIENT TEMPLE RUINS LOCATION GENERATOR
// Weathered colonnades, carved ashlar platforms, hanging vines, rune monoliths
// ----------------------------------------------------
function generateTempleChunk(world: WorldData, startX: number, tier: number, pattern: number) {
  const templeBiome: BiomeType = 'temple';

  if (pattern === 0) {
    // Grand Colonnade Procession - Continuous carved flagstone ground with stepped altar ledges
    const len = 780 + tier * 40;
    addGround(world, startX, len, 470, 180, templeBiome);
    addPlatform(world, startX + 160, 370, 120, 22, false, 0, templeBiome);
    addPlatform(world, startX + 360, 290, 130, 22, false, 0, templeBiome);
    addPlatform(world, startX + 560, 360, 120, 22, false, 0, templeBiome);

    addCoinRow(world, startX + 70, 430, 3);
    addCoinArc(world, startX + 180, 320, 5, 170, 45);
    addCoinRow(world, startX + 380, 240, 4);

    addEnemy(world, 'sprout', startX + 280, 442, startX + 80, startX + 680, 1.3);
    if (tier >= 2) {
      addEnemy(world, 'bumble', startX + 460, 210, startX + 320, startX + 620, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + len, 'magnet');

    world.nextGenX = startX + len;
  } else if (pattern === 1) {
    // Sunken Sanctuary Chasm (reachable gap 160-220px) with floating carved frieze slab
    const g1 = 380;
    const gap = Math.min(220, 160 + tier * 18);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, templeBiome);
    addPlatform(world, startX + 160, 360, 110, 22, false, 0, templeBiome);

    // Suspended temple frieze platform over the sunken courtyard
    addPlatform(world, startX + g1 + 20, 330, gap - 40 > 70 ? gap - 40 : 80, 22, false, 0, templeBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, templeBiome);
    addPlatform(world, startX + g1 + gap + 160, 370, 120, 22, false, 0, templeBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);

    addEnemy(world, 'sprout', startX + 180, 442, startX + 60, startX + 340, 1.2);
    if (tier >= 1) {
      addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'speed');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Ceremonial Springboard to High Temple Terrace
    const len = 760;
    addGround(world, startX, len, 470, 180, templeBiome);
    addPlatform(world, startX + 240, 345, 120, 22, false, 0, templeBiome);
    addPlatform(world, startX + 430, 255, 130, 22, false, 0, templeBiome);

    world.springs.push({ x: startX + 170, y: 454, width: 34, height: 16, power: -15.2 });
    addCoinArc(world, startX + 170, 420, 6, 210, 92);
    addCoinRow(world, startX + 450, 205, 4);

    addEnemy(world, 'crawler', startX + 460, 442, startX + 320, startX + 660, 1.4);
    spawnSafeRandomPowerUp(world, startX, startX + len, 'jump');

    world.nextGenX = startX + len;
  } else {
    // Oscillating Ancient Limestone Slab & Runic Gateway
    const g1 = 360;
    const gap = Math.min(235, 175 + tier * 16);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, templeBiome);

    // Moving ancient slab
    addPlatform(world, startX + g1 + 25, 350, 95, 22, true, 45, templeBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, templeBiome);
    addPlatform(world, startX + g1 + gap + 150, 315, 120, 22, false, 0, templeBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    if (tier >= 2) {
      addEnemy(world, 'starstrider', startX + g1 + gap + 220, 428, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    } else {
      addEnemy(world, 'sprout', startX + 180, 442, startX + 60, startX + 320, 1.2);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'shield');

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// ----------------------------------------------------
// VOLCANIC AREA LOCATION GENERATOR
// Hardened basalt ridges, glowing magma cracks, suspended crags, steam springs
// ----------------------------------------------------
function generateVolcanoChunk(world: WorldData, startX: number, tier: number, pattern: number) {
  const volcanoBiome: BiomeType = 'volcano';

  if (pattern === 0) {
    // Continuous hardened basalt ridge with elevated volcanic rock slabs
    const len = 780 + tier * 40;
    addGround(world, startX, len, 470, 180, volcanoBiome);
    addPlatform(world, startX + 170, 370, 120, 22, false, 0, volcanoBiome);
    addPlatform(world, startX + 370, 295, 125, 22, false, 0, volcanoBiome);
    addPlatform(world, startX + 570, 365, 115, 22, false, 0, volcanoBiome);

    addCoinRow(world, startX + 70, 430, 3);
    addCoinArc(world, startX + 180, 320, 5, 170, 45);
    addCoinRow(world, startX + 380, 245, 4);

    addEnemy(world, 'crawler', startX + 280, 442, startX + 80, startX + 680, 1.4);
    if (tier >= 2) {
      addEnemy(world, 'chonker', startX + 480, 434, startX + 350, startX + 700, 1.2);
    }
    spawnSafeRandomPowerUp(world, startX, startX + len, 'shield');

    world.nextGenX = startX + len;
  } else if (pattern === 1) {
    // Caldera Magma Chasm (fair reachable gap 165-225px)
    const g1 = 380;
    const gap = Math.min(230, 165 + tier * 18);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, volcanoBiome);
    addPlatform(world, startX + 170, 360, 110, 22, false, 0, volcanoBiome);

    // Suspended basalt crag platform over magma trench
    addPlatform(world, startX + g1 + 20, 325, gap - 40 > 70 ? gap - 40 : 80, 22, false, 0, volcanoBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, volcanoBiome);
    addPlatform(world, startX + g1 + gap + 160, 370, 120, 22, false, 0, volcanoBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);

    addEnemy(world, 'crawler', startX + 160, 442, startX + 50, startX + 340, 1.3);
    addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'speed');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Thermal Geyser Springboard Launch onto High Basalt Pinnacle
    const len = 760;
    addGround(world, startX, len, 470, 180, volcanoBiome);
    addPlatform(world, startX + 250, 340, 120, 22, false, 0, volcanoBiome);
    addPlatform(world, startX + 440, 250, 130, 22, false, 0, volcanoBiome);

    world.springs.push({ x: startX + 170, y: 454, width: 34, height: 16, power: -15.4 });
    addCoinArc(world, startX + 170, 420, 6, 220, 95);
    addCoinRow(world, startX + 450, 200, 4);

    addEnemy(world, 'crawler', startX + 480, 442, startX + 320, startX + 680, 1.4);
    spawnSafeRandomPowerUp(world, startX, startX + len, 'jump');

    world.nextGenX = startX + len;
  } else {
    // Moving Basalt Magma Island across lava cleft
    const g1 = 360;
    const gap = Math.min(235, 175 + tier * 16);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, volcanoBiome);

    // Floating basalt magma platform
    addPlatform(world, startX + g1 + 25, 345, 95, 22, true, 42, volcanoBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, volcanoBiome);
    addPlatform(world, startX + g1 + gap + 150, 310, 120, 22, false, 0, volcanoBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 54);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    if (tier >= 2) {
      addEnemy(world, 'starstrider', startX + g1 + gap + 220, 428, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    } else {
      addEnemy(world, 'hopper', startX + 180, 440, startX + 60, startX + 320, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'life');

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// ----------------------------------------------------
// ORIGINAL COASTAL LOCATION GENERATOR
// Shorelines, sandy dunes, driftwood steps, tidal islands, and ocean breeze
// ----------------------------------------------------
function generateCoastalChunk(world: WorldData, startX: number, tier: number, pattern: number) {
  const coastalBiome: BiomeType = 'coastal';

  if (pattern === 0) {
    // Continuous sandy shoreline dune with driftwood arches
    const len = 780 + tier * 40;
    addGround(world, startX, len, 470, 180, coastalBiome);
    addPlatform(world, startX + 160, 380, 120, 22, false, 0, coastalBiome);
    addPlatform(world, startX + 360, 300, 130, 22, false, 0, coastalBiome);
    addPlatform(world, startX + 560, 370, 120, 22, false, 0, coastalBiome);

    addCoinRow(world, startX + 70, 430, 3);
    addCoinArc(world, startX + 180, 330, 5, 170, 44);
    addCoinRow(world, startX + 380, 250, 4);

    addEnemy(world, 'sprout', startX + 280, 442, startX + 80, startX + 680, 1.3);
    if (tier >= 2) {
      addEnemy(world, 'bumble', startX + 460, 220, startX + 320, startX + 620, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + len, 'speed');

    world.nextGenX = startX + len;
  } else if (pattern === 1) {
    // Shoreline chasm / Tidal inlet with sea spray jump (fair, reachable gap 160-220px)
    const g1 = 380;
    const gap = Math.min(220, 160 + tier * 18);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, coastalBiome);
    addPlatform(world, startX + 160, 360, 110, 22, false, 0, coastalBiome);

    // Floating driftwood platform over the inlet to give dual-level routing
    addPlatform(world, startX + g1 + 20, 330, gap - 40 > 70 ? gap - 40 : 80, 22, false, 0, coastalBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, coastalBiome);
    addPlatform(world, startX + g1 + gap + 160, 370, 120, 22, false, 0, coastalBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);

    addEnemy(world, 'sprout', startX + 180, 442, startX + 60, startX + 340, 1.2);
    if (tier >= 1) {
      addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'shield');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Coral springboard launch onto raised reef steps
    const len = 760;
    addGround(world, startX, len, 470, 180, coastalBiome);
    addPlatform(world, startX + 240, 350, 120, 22, false, 0, coastalBiome);
    addPlatform(world, startX + 430, 260, 130, 22, false, 0, coastalBiome);

    world.springs.push({ x: startX + 170, y: 454, width: 34, height: 16, power: -15.0 });
    addCoinArc(world, startX + 170, 420, 6, 210, 90);
    addCoinRow(world, startX + 450, 210, 4);

    addEnemy(world, 'crawler', startX + 460, 442, startX + 320, startX + 660, 1.4);
    spawnSafeRandomPowerUp(world, startX, startX + len, 'magnet');

    world.nextGenX = startX + len;
  } else {
    // Coastal moving driftwood raft
    const g1 = 360;
    const gap = Math.min(235, 175 + tier * 16);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, coastalBiome);

    // Smooth horizontal moving raft
    addPlatform(world, startX + g1 + 25, 360, 95, 22, true, 45, coastalBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, coastalBiome);
    addPlatform(world, startX + g1 + gap + 150, 320, 120, 22, false, 0, coastalBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    if (tier >= 2) {
      addEnemy(world, 'starstrider', startX + g1 + gap + 220, 428, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    } else {
      addEnemy(world, 'sprout', startX + 180, 442, startX + 60, startX + 320, 1.2);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'life');

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// ----------------------------------------------------
// ORIGINAL CRYSTAL CAVERN LOCATION GENERATOR
// Basalt rock, luminous amethyst crystals, subterranean chasms, and mineral ledges
// ----------------------------------------------------
function generateCaveChunk(world: WorldData, startX: number, tier: number, pattern: number) {
  const caveBiome: BiomeType = 'cave';

  if (pattern === 0) {
    // Solid basalt cavern corridor with elevated crystal ledges
    const len = 780 + tier * 40;
    addGround(world, startX, len, 470, 180, caveBiome);
    addPlatform(world, startX + 170, 370, 120, 22, false, 0, caveBiome);
    addPlatform(world, startX + 370, 290, 125, 22, false, 0, caveBiome);
    addPlatform(world, startX + 570, 360, 115, 22, false, 0, caveBiome);

    addCoinRow(world, startX + 70, 430, 3);
    addCoinArc(world, startX + 180, 320, 5, 170, 45);
    addCoinRow(world, startX + 380, 240, 4);

    addEnemy(world, 'crawler', startX + 280, 442, startX + 80, startX + 680, 1.4);
    if (tier >= 2) {
      addEnemy(world, 'chonker', startX + 480, 434, startX + 350, startX + 700, 1.2);
    }
    spawnSafeRandomPowerUp(world, startX, startX + len, 'shield');

    world.nextGenX = startX + len;
  } else if (pattern === 1) {
    // Deep mineral abyss leap (fair, reachable gap 165-225px)
    const g1 = 380;
    const gap = Math.min(230, 165 + tier * 18);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, caveBiome);
    addPlatform(world, startX + 170, 360, 110, 22, false, 0, caveBiome);

    // Suspended crystal platform in upper air over the abyss
    addPlatform(world, startX + g1 + 20, 325, gap - 40 > 70 ? gap - 40 : 80, 22, false, 0, caveBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, caveBiome);
    addPlatform(world, startX + g1 + gap + 160, 370, 120, 22, false, 0, caveBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);

    addEnemy(world, 'crawler', startX + 160, 442, startX + 50, startX + 340, 1.3);
    addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'jump');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Glowing spring crystal launch into high cavern stalactite route
    const len = 760;
    addGround(world, startX, len, 470, 180, caveBiome);
    addPlatform(world, startX + 250, 340, 120, 22, false, 0, caveBiome);
    addPlatform(world, startX + 440, 250, 130, 22, false, 0, caveBiome);

    world.springs.push({ x: startX + 170, y: 454, width: 34, height: 16, power: -15.2 });
    addCoinArc(world, startX + 170, 420, 6, 220, 95);
    addCoinRow(world, startX + 450, 200, 4);

    addEnemy(world, 'crawler', startX + 480, 442, startX + 320, startX + 680, 1.4);
    spawnSafeRandomPowerUp(world, startX, startX + len, 'magnet');

    world.nextGenX = startX + len;
  } else {
    // Floating mineral geode platform with vertical hover
    const g1 = 360;
    const gap = Math.min(235, 175 + tier * 16);
    const g2 = 420;
    addGround(world, startX, g1, 470, 180, caveBiome);

    // Floating geode platform
    addPlatform(world, startX + g1 + 25, 345, 95, 22, false, 0, caveBiome);

    addGround(world, startX + g1 + gap, g2, 470, 180, caveBiome);
    addPlatform(world, startX + g1 + gap + 150, 310, 120, 22, false, 0, caveBiome);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 54);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    if (tier >= 2) {
      addEnemy(world, 'starstrider', startX + g1 + gap + 220, 428, startX + g1 + gap + 80, startX + g1 + gap + 380, 1.6);
    } else {
      addEnemy(world, 'hopper', startX + 180, 440, startX + 60, startX + 320, 1.5);
    }
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'speed');

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// Tier 0: 0 - 500m (Gentle, comfortable introductory terrain)
function generateTier0Chunk(world: WorldData, startX: number, pattern: number) {
  if (pattern === 0) {
    // Continuous meadow with floating arches (solid ground, 0 gap)
    const len = 780;
    addGround(world, startX, len);
    addPlatform(world, startX + 160, 380, 120);
    addPlatform(world, startX + 360, 300, 120);
    addPlatform(world, startX + 540, 370, 110);

    addCoinRow(world, startX + 80, 430, 3);
    addCoinArc(world, startX + 180, 330, 5, 160, 45);
    addCoinRow(world, startX + 380, 250, 3);

    addEnemy(world, 'sprout', startX + 280, 442, startX + 80, startX + 680, 1.2);
    if (Math.random() < 0.5) spawnSafeRandomPowerUp(world, startX, startX + len, Math.random() < 0.5 ? 'life' : 'magnet');

    world.nextGenX = startX + len;
  } else if (pattern === 1) {
    // Clean introductory gap (gap = 160px)
    const g1 = 430;
    const gap = 160;
    const g2 = 450;
    addGround(world, startX, g1);
    addPlatform(world, startX + 190, 370, 110);

    // True empty space below: no low filler platform or floating ground inside the gap
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 25, 420, 5, gap + 50, 48);
    addCoinRow(world, startX + g1 + gap + 100, 430, 4);

    addEnemy(world, 'sprout', startX + 150, 442, startX + 50, startX + 350, 1.2);
    addEnemy(world, 'bumble', startX + g1 + gap + 200, 260, startX + g1 + gap + 90, startX + g1 + gap + 390, 1.4);

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Spring launch over elevated stone steps (solid ground, 0 gap)
    const len = 750;
    addGround(world, startX, len);
    addPlatform(world, startX + 260, 350, 120);
    addPlatform(world, startX + 440, 270, 130);

    world.springs.push({ x: startX + 180, y: 454, width: 34, height: 16, power: -14.5 });
    addCoinArc(world, startX + 180, 420, 6, 220, 85);
    addCoinRow(world, startX + 460, 220, 3);
    spawnSafeRandomPowerUp(world, startX, startX + len, Math.random() < 0.5 ? 'life' : 'speed');

    addEnemy(world, 'sprout', startX + 480, 442, startX + 350, startX + 660, 1.3);
    world.nextGenX = startX + len;
  } else {
    // Varied stepped gap (gap = 145px) with elevated steps
    const g1 = 410;
    const gap = 145;
    const g2 = 430;
    addGround(world, startX, g1);
    addPlatform(world, startX + 180, 380, 110);
    // True empty space below the gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 140, 370, 120);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 45);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);

    addEnemy(world, 'sprout', startX + 200, 442, startX + 80, startX + 360, 1.3);
    addEnemy(world, 'sprout', startX + g1 + gap + 220, 442, startX + g1 + gap + 100, startX + g1 + gap + 380, 1.3);

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// Tier 1: 500 - 1000m (Moderate platforming, gentle gaps)
function generateTier1Chunk(world: WorldData, startX: number, pattern: number) {
  if (pattern === 0) {
    // Staggered Canyon with moving ledge (gap = 190px total)
    const g1 = 380;
    const gap = 190;
    const g2 = 420;
    addGround(world, startX, g1);
    // Intentional elevated moving wooden platform at y = 355 (clearly elevated above the canyon)
    addPlatform(world, startX + g1 + 45, 355, 90, 22, true, 25);
    // True empty space below the gap down to the pit
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    addCoinRow(world, startX + g1 + gap + 100, 430, 4);

    addEnemy(world, 'crawler', startX + 180, 442, startX + 60, startX + 320, 1.4);
    addEnemy(world, 'bumble', startX + g1 + gap + 200, 250, startX + g1 + gap + 90, startX + g1 + gap + 380, 1.6);
    if (Math.random() < 0.45) spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'shield');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 1) {
    // High Sky Walkway with varied ground gap (gap = 165px)
    const g1 = 370;
    const gap = 165;
    const g2 = 430;
    addGround(world, startX, g1);
    addPlatform(world, startX + 140, 370, 110);
    addPlatform(world, startX + 290, 290, 130);
    addPlatform(world, startX + g1 + 15, 210, 125);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);

    world.springs.push({ x: startX + 220, y: 454, width: 34, height: 16, power: -15.0 });
    addCoinArc(world, startX + 220, 420, 6, 210, 90);
    addCoinRow(world, startX + g1 + gap + 100, 430, 3);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, Math.random() < 0.5 ? 'life' : 'speed');

    addEnemy(world, 'sprout', startX + 180, 442, startX + 80, startX + 330, 1.5);
    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Deep canyon crossed by an intentional elevated wooden platform (100% empty space below, no floating ground)
    const g1 = 360;
    const gap = 285;
    const g2 = 380;

    addGround(world, startX, g1);
    // Intentional elevated wooden platform centered over the empty chasm
    addPlatform(world, startX + g1 + 95, 360, 95);
    // Ground resumes after the gap with true empty space below the platform
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 15, 420, 4, 110, 42);
    addCoinArc(world, startX + g1 + 175, 350, 4, 110, 42);

    addEnemy(world, 'bumble', startX + g1 + gap + 200, 230, startX + g1 + gap + 90, startX + g1 + gap + 360, 1.6);
    if (Math.random() < 0.45) spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, Math.random() < 0.5 ? 'life' : 'magnet');

    world.nextGenX = startX + g1 + gap + g2;
  } else {
    // Crawler patrol terrace (solid ground, 0 gap)
    const len = 750;
    addGround(world, startX, len);
    addPlatform(world, startX + 150, 380, 140);
    addPlatform(world, startX + 350, 300, 140);
    addPlatform(world, startX + 550, 380, 120);

    addCoinRow(world, startX + 80, 430, 3);
    addCoinRow(world, startX + 370, 250, 3);
    addCoinRow(world, startX + 570, 330, 3);

    addEnemy(world, 'crawler', startX + 370, 272, startX + 350, startX + 470, 1.3);
    addEnemy(world, 'sprout', startX + 500, 442, startX + 350, startX + 700, 1.4);

    world.nextGenX = startX + len;
  }
}

// Tier 2: 1000 - 1500m
function generateTier2Chunk(world: WorldData, startX: number, pattern: number) {
  if (pattern === 0) {
    // Dual intentional elevated wooden stepping platforms over deep canyon (100% empty space below, no floating ground)
    const g1 = 320;
    const gap = 350;
    const g2 = 380;
    addGround(world, startX, g1);
    // First elevated wooden stepping platform
    addPlatform(world, startX + g1 + 35, 365, 85);
    // Second elevated moving wooden platform
    addPlatform(world, startX + g1 + 195, 345, 85, 22, true, 20);
    // True empty space below both platforms: no ground in the canyon
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 10, 420, 4, 90, 40);
    addCoinArc(world, startX + g1 + 115, 360, 4, 90, 40);
    addCoinArc(world, startX + g1 + 255, 340, 4, 95, 40);
    addCoinRow(world, startX + g1 + gap + 90, 430, 4);

    addEnemy(world, 'crawler', startX + 150, 442, startX + 40, startX + 260, 1.5);
    addEnemy(world, 'bumble', startX + g1 + gap + 200, 240, startX + g1 + gap + 80, startX + g1 + gap + 360, 1.7);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, Math.random() < 0.5 ? 'life' : 'jump');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 1) {
    // Chonker intro with direct single gap (gap = 205px, reachable and exciting)
    const g1 = 360;
    const gap = 205;
    const g2 = 420;
    addGround(world, startX, g1);
    addPlatform(world, startX + 160, 360, 120);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 160, 360, 120);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);
    addCoinRow(world, startX + g1 + gap + 220, 310, 3);

    // Chonker stationed safely beyond landing edge (>230px margin)
    addEnemy(world, 'chonker', startX + g1 + gap + 230, 434, startX + g1 + gap + 120, startX + g1 + gap + 390, 1.1);
    if (Math.random() < 0.5) spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, Math.random() < 0.5 ? 'life' : 'shield');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Mega spring launch to high canopy
    const len = 820;
    addGround(world, startX, len);
    addPlatform(world, startX + 200, 350, 110);
    addPlatform(world, startX + 380, 240, 130);
    addPlatform(world, startX + 560, 160, 140);

    world.springs.push({ x: startX + 280, y: 454, width: 34, height: 16, power: -16.0 });
    addCoinArc(world, startX + 280, 420, 6, 260, 100);
    addCoinRow(world, startX + 580, 110, 4);
    spawnSafeRandomPowerUp(world, startX, startX + len, 'magnet');

    addEnemy(world, 'crawler', startX + 400, 212, startX + 380, startX + 490, 1.4);
    addEnemy(world, 'bumble', startX + 650, 250, startX + 500, startX + 780, 1.8);

    world.nextGenX = startX + len;
  } else {
    // Hopper bounce sequence with varied gap (gap = 185px)
    const g1 = 360;
    const gap = 185;
    const g2 = 400;
    addGround(world, startX, g1);
    addPlatform(world, startX + 160, 370, 120);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 140, 370, 120);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 48);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 100, startX + g1 + gap + 380, 1.3);
    addEnemy(world, 'sprout', startX + 180, 442, startX + 60, startX + 320, 1.5);

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// Tier 3: 1500 - 2500m
function generateTier3Chunk(world: WorldData, startX: number, pattern: number) {
  if (pattern === 0) {
    // Multi-tiered Route: High speed route vs low ground gap (gap = 215px)
    const g1 = 380;
    const gap = 215;
    const g2 = 420;
    addGround(world, startX, g1);
    addPlatform(world, startX + 120, 350, 130);
    addPlatform(world, startX + 280, 260, 140);
    addPlatform(world, startX + 460, 180, 140);
    addPlatform(world, startX + 640, 260, 120);
    // True empty space below ground gap
    addGround(world, startX + g1 + gap, g2);

    // High route rewards
    addCoinRow(world, startX + 300, 210, 4);
    addCoinRow(world, startX + 480, 130, 4);
    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, Math.random() < 0.5 ? 'life' : 'speed');

    // Mysterious Star Runner Nova appearing on the high celestial platform!
    if (Math.random() < 0.6) {
      addNPC(world, 'nova', startX + 510, 142, "The stars illuminate your speed...", 'Nova');
    }

    // Ground hazards safely spaced
    addEnemy(world, 'chonker', startX + 180, 434, startX + 60, startX + 340, 1.2);
    addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 100, startX + g1 + gap + 390, 1.4);
    addEnemy(world, 'bumble', startX + 500, 260, startX + 350, startX + 650, 1.8);

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 1) {
    // Three elevated wooden platforms spanning wide canyon (gap = 430px, 100% empty space below)
    const g1 = 280;
    const gap = 430;
    const g2 = 340;
    addGround(world, startX, g1);
    addPlatform(world, startX + g1 + 30, 375, 80);
    addPlatform(world, startX + g1 + 165, 310, 85, 22, true, 25);
    addPlatform(world, startX + g1 + 305, 375, 80);
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 15, 420, 4, 115, 48);
    addCoinArc(world, startX + g1 + 110, 350, 4, 120, 50);
    addCoinArc(world, startX + g1 + 250, 380, 4, 120, 48);

    addEnemy(world, 'crawler', startX + 140, 442, startX + 40, startX + 240, 1.6);
    addEnemy(world, 'bumble', startX + g1 + gap + 200, 200, startX + g1 + gap + 80, startX + g1 + gap + 320, 1.8);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'jump');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Spring assault with dual crawlers and varied gap (gap = 195px)
    const g1 = 360;
    const gap = 195;
    const g2 = 420;
    addGround(world, startX, g1);
    addPlatform(world, startX + 180, 360, 130);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 160, 280, 140);

    world.springs.push({ x: startX + 220, y: 454, width: 34, height: 16, power: -15.5 });
    addCoinArc(world, startX + 220, 420, 6, 220, 85);
    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'shield');

    addEnemy(world, 'crawler', startX + 140, 442, startX + 40, startX + 280, 1.5);
    addEnemy(world, 'hopper', startX + g1 + gap + 220, 440, startX + g1 + gap + 100, startX + g1 + gap + 390, 1.5);

    world.nextGenX = startX + g1 + gap + g2;
  } else {
    // Chonker & Hopper team with varied gap (gap = 220px)
    const g1 = 340;
    const gap = 220;
    const g2 = 440;
    addGround(world, startX, g1);
    addPlatform(world, startX + 160, 370, 120);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 160, 370, 120);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 52);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    addEnemy(world, 'chonker', startX + 180, 434, startX + 60, startX + 300, 1.2);
    addEnemy(world, 'hopper', startX + g1 + gap + 240, 440, startX + g1 + gap + 120, startX + g1 + gap + 410, 1.5);

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// Tier 4: 2500m+ (Advanced master sections with starstriders)
function generateTier4Chunk(world: WorldData, startX: number, pattern: number) {
  if (pattern === 0) {
    // Floating Sky Islands with Starstrider (gap = 450px, intentional elevated platforms, 100% empty space below)
    const g1 = 280;
    const gap = 450;
    const g2 = 320;
    addGround(world, startX, g1);
    addPlatform(world, startX + g1 + 30, 380, 80, 22, true, 20);
    addPlatform(world, startX + g1 + 165, 305, 90, 22, true, 25);
    addPlatform(world, startX + g1 + 310, 370, 80, 22, true, 20);
    addGround(world, startX + g1 + gap, g2);

    addCoinArc(world, startX + g1 - 15, 420, 4, 110, 52);
    addCoinArc(world, startX + g1 + 105, 335, 4, 115, 52);
    addCoinArc(world, startX + g1 + 250, 375, 4, 115, 50);
    addCoinRow(world, startX + g1 + gap + 90, 430, 4);

    addEnemy(world, 'starstrider', startX + 140, 428, startX + 40, startX + 240, 1.6);
    addEnemy(world, 'bumble', startX + g1 + gap + 180, 180, startX + g1 + gap + 60, startX + g1 + gap + 300, 2.0);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'speed');

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 1) {
    // High Altitude Gauntlet with Dual Springs and direct gap (gap = 230px)
    const g1 = 360;
    const gap = 230;
    const g2 = 450;
    addGround(world, startX, g1);
    addPlatform(world, startX + 150, 360, 120);
    addPlatform(world, startX + 300, 270, 130);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 120, 260, 120);

    world.springs.push({ x: startX + 180, y: 454, width: 34, height: 16, power: -15.5 });
    addCoinArc(world, startX + 180, 420, 6, 200, 85);
    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 54);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'shield');

    addEnemy(world, 'crawler', startX + 140, 442, startX + 40, startX + 280, 1.6);
    addEnemy(world, 'hopper', startX + g1 + gap + 240, 440, startX + g1 + gap + 120, startX + g1 + gap + 420, 1.6);

    world.nextGenX = startX + g1 + gap + g2;
  } else if (pattern === 2) {
    // Double Chonker + Bumble Sky Hive with varied gap (gap = 215px)
    const g1 = 360;
    const gap = 215;
    const g2 = 440;
    addGround(world, startX, g1);
    addPlatform(world, startX + 180, 370, 130);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 160, 370, 130);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 50);
    addCoinRow(world, startX + g1 + gap + 80, 430, 4);

    addEnemy(world, 'chonker', startX + 180, 434, startX + 60, startX + 320, 1.2);
    addEnemy(world, 'chonker', startX + g1 + gap + 240, 434, startX + g1 + gap + 120, startX + g1 + gap + 410, 1.2);
    addEnemy(world, 'bumble', startX + 400, 200, startX + 280, startX + 550, 1.9);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'magnet');

    world.nextGenX = startX + g1 + gap + g2;
  } else {
    // Fast sprint corridor with wide chasm leap (gap = 240px, thrilling & fully reachable with Jiro's physics)
    const g1 = 330;
    const gap = 240;
    const g2 = 430;
    addGround(world, startX, g1);
    addPlatform(world, startX + 160, 360, 110);
    // True empty space below gap
    addGround(world, startX + g1 + gap, g2);
    addPlatform(world, startX + g1 + gap + 160, 320, 120);

    addCoinArc(world, startX + g1 - 20, 420, 5, gap + 40, 55);
    addCoinRow(world, startX + g1 + gap + 80, 430, 3);
    spawnSafeRandomPowerUp(world, startX, startX + g1 + gap + g2, 'jump');

    addEnemy(world, 'starstrider', startX + g1 + gap + 240, 428, startX + g1 + gap + 120, startX + g1 + gap + 400, 1.7);
    addEnemy(world, 'hopper', startX + 180, 440, startX + 60, startX + 300, 1.5);

    world.nextGenX = startX + g1 + gap + g2;
  }
}

// Cleanup of distant offscreen entities behind camera
export function cleanOldEntities(world: WorldData, minCamX: number) {
  const threshold = minCamX - 800;

  world.platforms = world.platforms.filter(p => p.x + p.width >= threshold);
  world.springs = world.springs.filter(s => s.x + s.width >= threshold);
  world.checkpoints = world.checkpoints.filter(cp => cp.x >= threshold);
  world.coins = world.coins.filter(c => c.x >= threshold);
  world.powerups = world.powerups.filter(p => p.x + p.width >= threshold);
  world.enemies = world.enemies.filter(e => e.x + e.width >= threshold);
  world.npcs = world.npcs.filter(n => n.x + n.width >= threshold);
  world.hills = world.hills.filter(h => h.x + (h.radius || 150) >= threshold);
  world.trees = world.trees.filter(t => t.x + 60 >= threshold);
  world.clouds = world.clouds.filter(c => c.x + (c.width || 100) >= threshold);
}
