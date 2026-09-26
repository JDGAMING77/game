import { BiomeType } from '../types';

export interface BiomeConfig {
  type: BiomeType;
  name: string;
  startDistance: number;
  length: number;
}

export interface ActiveBiomeBlend {
  current: BiomeType;
  next: BiomeType;
  factor: number; // 0.0 (100% current) -> 1.0 (100% next)
  primary: BiomeType;
  inTransition: boolean;
  transitionName?: string;
  // Layer-specific transition progress factors (0.0 to 1.0):
  skyFactor: number;        // Changes first (starts at factor 0.0)
  distantFactor: number;    // Far ocean horizon / cavern silhouette (starts at factor 0.12)
  midFactor: number;        // Dunes, ceiling stalactites, cavern arches, seabirds (starts at factor 0.28)
  envFactor: number;        // Palm trees, rock pillars, crystal clusters (starts at factor 0.42)
  groundFactor: number;     // Ground sand/basalt & platform styling (starts at factor 0.58)
}

export const DEFAULT_BIOME_BLEND: ActiveBiomeBlend = {
  current: 'meadow',
  next: 'meadow',
  factor: 0,
  primary: 'meadow',
  inTransition: false,
  skyFactor: 0,
  distantFactor: 0,
  midFactor: 0,
  envFactor: 0,
  groundFactor: 0
};

// Fixed starting meadow distance so the player thoroughly enjoys the pure starting meadow:
export const START_MEADOW_PURE = 280;
export const TRANSITION_LENGTH = 200;
export const BIOME_PURE_LENGTH = 480;

export interface BiomeSegment {
  type: BiomeType;
  startDist: number;
  pureDist: number;
  transDist: number;
  totalDist: number;
  nextType: BiomeType;
  transitionTitle: string;
}

// Deterministic Pseudo-Random Number Generator for run variations
function createPRNG(seed: number) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const ALL_OTHER_BIOMES: BiomeType[] = ['coastal', 'mountain', 'cave', 'forest', 'temple', 'volcano'];

const TRANSITION_TITLES: Record<string, string> = {
  'meadow->coastal': 'Approaching the Ocean',
  'meadow->mountain': 'Ascending Mountain Slopes',
  'meadow->forest': 'Entering the Deep Forest',
  'meadow->cave': 'Approaching the Caverns',
  'meadow->temple': 'Approaching Ancient Ruins',
  'meadow->volcano': 'Approaching Volcanic Peaks',
  'coastal->mountain': 'Climbing Coastal Cliffs',
  'coastal->cave': 'Entering Sea Caves',
  'coastal->forest': 'Entering Coastal Jungle',
  'coastal->meadow': 'Returning to the Meadows',
  'coastal->temple': 'Ascending to Sunken Temple',
  'coastal->volcano': 'Approaching Volcanic Shore',
  'mountain->forest': 'Descending to the Forest Canopy',
  'mountain->cave': 'Entering Mountain Chasm',
  'mountain->coastal': 'Descending towards the Ocean',
  'mountain->meadow': 'Descending to Sunlit Meadows',
  'mountain->temple': 'Discovering Mountain Sanctuary',
  'mountain->volcano': 'Approaching Active Caldera',
  'forest->cave': 'Entering Hollow Cave Pass',
  'forest->mountain': 'Ascending into the Highlands',
  'forest->coastal': 'Reaching the Coastal Lagoon',
  'forest->meadow': 'Clearing into Open Meadows',
  'forest->temple': 'Uncovering Overgrown Ruins',
  'forest->volcano': 'Approaching Basalt Badlands',
  'cave->mountain': 'Emerging onto Mountain Crags',
  'cave->forest': 'Emerging into Canopy Jungle',
  'cave->coastal': 'Emerging onto Ocean Shoreline',
  'cave->meadow': 'Ascending to Sunlit Meadows',
  'cave->temple': 'Emerging into Temple Vaults',
  'cave->volcano': 'Emerging near Molten Chasm',
  'temple->volcano': 'Approaching Caldera Crags',
  'temple->meadow': 'Exiting Ruins to Open Meadows',
  'temple->mountain': 'Ascending High Mountain Passes',
  'temple->cave': 'Descending into Temple Catacombs',
  'temple->forest': 'Entering the Sacred Grove',
  'temple->coastal': 'Descending to Coastal Shore',
  'volcano->temple': 'Reaching Ancient Sanctuary',
  'volcano->meadow': 'Leaving Caldera for Green Meadows',
  'volcano->mountain': 'Climbing Cool Mountain Ridges',
  'volcano->cave': 'Descending into Volcanic Caverns',
  'volcano->forest': 'Descending to Deep Forest',
  'volcano->coastal': 'Cooling into Ocean Waters'
};

let currentRunSegments: BiomeSegment[] = [];

/**
 * Initialize procedural varied biome schedule for an endless run.
 * Ensures biomes appear at varied distances, never too close to the start,
 * and terrain remains 100% stable during forward or backward movement.
 */
export function initRunBiomes(seed: number = 1337): void {
  const rand = createPRNG(seed);
  const segments: BiomeSegment[] = [];

  let currentDist = 0;
  let currentType: BiomeType = 'meadow';

  // Segment 0: Initial pure Meadow starting area (280m - 330m)
  const startPure = 280 + Math.floor(rand() * 50);
  const startTrans = 190 + Math.floor(rand() * 30);
  let nextType = ALL_OTHER_BIOMES[Math.floor(rand() * ALL_OTHER_BIOMES.length)];

  segments.push({
    type: 'meadow',
    startDist: currentDist,
    pureDist: startPure,
    transDist: startTrans,
    totalDist: startPure + startTrans,
    nextType,
    transitionTitle: TRANSITION_TITLES[`meadow->${nextType}`] || 'Approaching New Lands'
  });

  currentDist += startPure + startTrans;
  currentType = nextType;

  // Generate 60 diverse segments (over 40,000 meters of continuous varied exploration)
  const allBiomes: BiomeType[] = ['meadow', 'coastal', 'mountain', 'cave', 'forest', 'temple', 'volcano'];

  for (let i = 1; i < 60; i++) {
    // Choose next biome different from current
    const available = allBiomes.filter(b => b !== currentType);
    nextType = available[Math.floor(rand() * available.length)];

    // Varied pure length between 420m and 560m
    const pureDist = 420 + Math.floor(rand() * 140);
    // Varied transition length between 190m and 220m
    const transDist = 190 + Math.floor(rand() * 30);

    const titleKey = `${currentType}->${nextType}`;
    const transitionTitle = TRANSITION_TITLES[titleKey] || `Entering ${nextType}`;

    segments.push({
      type: currentType,
      startDist: currentDist,
      pureDist,
      transDist,
      totalDist: pureDist + transDist,
      nextType,
      transitionTitle
    });

    currentDist += pureDist + transDist;
    currentType = nextType;
  }

  currentRunSegments = segments;
}

// Auto-initialize with default varied schedule
initRunBiomes(2026);

/**
 * Smooth Hermite S-curve interpolation between min and max
 */
function smoothRange(val: number, min: number, max: number): number {
  if (val <= min) return 0;
  if (val >= max) return 1;
  const t = (val - min) / (max - min);
  return t * t * (3 - 2 * t);
}

function makeBlend(
  current: BiomeType,
  next: BiomeType,
  factor: number,
  inTransition: boolean,
  transitionName?: string
): ActiveBiomeBlend {
  const f = Math.max(0, Math.min(1, factor));
  return {
    current,
    next,
    factor: f,
    // The LOCATION HUD changes ONLY after Jiro has actually entered the new biome (f >= 0.98)
    // The visual world itself leads the transition while the player continues running!
    primary: f >= 0.98 ? next : current,
    inTransition,
    transitionName,
    skyFactor: inTransition ? smoothRange(f, 0.02, 0.65) : (f >= 0.98 ? 1 : 0),
    distantFactor: inTransition ? smoothRange(f, 0.12, 0.75) : (f >= 0.98 ? 1 : 0),
    midFactor: inTransition ? smoothRange(f, 0.28, 0.85) : (f >= 0.98 ? 1 : 0),
    envFactor: inTransition ? smoothRange(f, 0.42, 0.92) : (f >= 0.98 ? 1 : 0),
    groundFactor: inTransition ? smoothRange(f, 0.55, 1.00) : (f >= 0.98 ? 1 : 0)
  };
}

/**
 * Procedural distance-to-biome mapping with smooth physical travel transitions:
 * - Distance is measured continuously from p.x (1 meter = 22 pixels).
 * - Every transition spans 190-220 meters of walking/running,
 *   allowing the player to witness each environmental layer transform step-by-step.
 */
export function getBiomeAtDistance(distance: number): ActiveBiomeBlend {
  if (!currentRunSegments.length) {
    initRunBiomes();
  }

  const d = Math.max(0, distance);

  // Find corresponding segment
  for (let i = 0; i < currentRunSegments.length; i++) {
    const seg = currentRunSegments[i];
    const segEnd = seg.startDist + seg.totalDist;

    if (d < segEnd || i === currentRunSegments.length - 1) {
      const segOffset = d - seg.startDist;

      if (segOffset < seg.pureDist) {
        // Pure biome section
        return makeBlend(seg.type, seg.type, 0, false);
      } else {
        // Active transition zone to nextType
        const transOffset = segOffset - seg.pureDist;
        const factor = Math.min(1, Math.max(0, transOffset / seg.transDist));
        return makeBlend(seg.type, seg.nextType, factor, true, seg.transitionTitle);
      }
    }
  }

  return makeBlend('meadow', 'meadow', 0, false);
}

/**
 * Given a world X coordinate, approximate distance and get the detailed biome blend.
 */
export function getDetailedBiomeAtX(worldX: number): ActiveBiomeBlend {
  const approximateDistance = Math.max(0, (worldX - 100) / 22);
  return getBiomeAtDistance(approximateDistance);
}

/**
 * Dominant platform/ground styling at worldX
 */
export function getBiomeAtX(worldX: number): BiomeType {
  const blend = getDetailedBiomeAtX(worldX);
  if (!blend.inTransition) return blend.primary;
  // During physical transitions, platforms transition according to groundFactor:
  if (blend.groundFactor < 0.35) return blend.current;
  if (blend.groundFactor > 0.65) return blend.next;
  // In the mid-transition zone, mix platform materials naturally
  return (Math.floor(worldX / 280) % 2 === 0) ? blend.current : blend.next;
}
