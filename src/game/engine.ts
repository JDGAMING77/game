import { GameState, Player, Platform, Spring, Checkpoint, Coin, Enemy, Particle, SceneryItem, FinishFlag, PowerUp, GameNotification, Boss, BossHazard, BossHazardType, RunStats, PlayerUpgrades, BiomeType } from '../types';
import { createInitialWorld, generateNextChunk, cleanOldEntities, WorldData, LEVEL_HEIGHT } from './level';
import { getBiomeAtDistance, ActiveBiomeBlend, DEFAULT_BIOME_BLEND, initRunBiomes } from './biome';
import { sound } from './audio';
import {
  GAME_W,
  GAME_H,
  drawBackground,
  drawPlatforms,
  drawCheckpoints,
  drawFinishFlag,
  drawCoins,
  drawPowerUps,
  drawEnemies,
  drawBoss,
  drawBossHazards,
  drawJiro,
  renderParticles,
  drawHUD,
  drawStartScreen,
  drawShopScreen,
  drawControlsScreen,
  drawSettingsScreen,
  drawPauseScreen,
  drawGameOverScreen,
  drawVictoryScreen
} from './renderer';

// Minimum playable X boundary: aligns naturally with the start of the course
export const MIN_PLAYABLE_X = 24;

export class GameEngine {
  public state: GameState = 'start';
  public player!: Player;
  public world!: WorldData;
  public platforms: Platform[] = [];
  public springs: Spring[] = [];
  public checkpoints: Checkpoint[] = [];
  public coins: Coin[] = [];
  public powerups: PowerUp[] = [];
  public notifications: GameNotification[] = [];
  public enemies: Enemy[] = [];
  public hills: SceneryItem[] = [];
  public trees: SceneryItem[] = [];
  public clouds: SceneryItem[] = [];
  public finishFlag!: FinishFlag;
  public particles: Particle[] = [];
  public boss!: Boss;
  public bossHazards: BossHazard[] = [];
  public runStats: RunStats = { bestScore: 0, bestDistance: 0, bestCoins: 0, totalRuns: 0 };
  public upgrades: PlayerUpgrades = {
    speed: 0,
    jump: 0,
    magnet: 0,
    shield: 0
  };
  public coinBank: number = 0;
  public shopMessage: string = '';
  public settingsResetConfirm: boolean = false;
  public nextBossDistance: number = 800 + Math.floor(Math.random() * 250);
  public lastMilestone: number = 0;
  private cleanTimer: number = 0;
  public currentBiome: ActiveBiomeBlend = { ...DEFAULT_BIOME_BLEND };
  public lastNotifiedBiome: BiomeType = 'meadow';

  // Polished 2D side-scrolling platformer camera:
  // Native 1:1 scale, comfortable left-middle framing with ~710px lookahead, and subtle vertical follow
  public camera = {
    x: 0,
    y: -30,
    targetX: 0,
    targetY: -30,
    zoom: 1.0,
    targetZoom: 1.0,
    shake: 0,
    lookAhead: 20
  };
  public keys = { left: false, right: false, jump: false, jumpBuffered: false };

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private lastTime: number = performance.now();
  private dpr: number = 1;
  private renderScale: number = 2; // High-resolution super-sampling factor

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.updateDpr();
    this.loadStats();
    this.resetGame();
  }

  public updateDpr() {
    if (typeof window !== 'undefined') {
      const deviceDpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const displayW = rect.width > 0 ? rect.width : GAME_W;
      // Calculate how many physical screen pixels correspond to each logical game unit (GAME_W = 960)
      const physicalScale = (displayW / GAME_W) * deviceDpr;
      // Clamp between 1.5x (budget mobile) and 3.5x (Retina / 4K monitors)
      const targetScale = Math.min(3.5, Math.max(1.5, Math.round(physicalScale * 10) / 10));
      const targetW = Math.round(GAME_W * targetScale);
      const targetH = Math.round(GAME_H * targetScale);

      if (this.dpr !== targetScale || this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.dpr = targetScale;
        this.renderScale = targetScale;
        this.canvas.width = targetW;
        this.canvas.height = targetH;

        // Ensure high-quality image smoothing for crisp clean downscaling
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
      }
    }
  }

  private loadStats() {
    try {
      const saved = localStorage.getItem('jiro_speed_adventure_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          this.runStats = {
            bestScore: typeof parsed.bestScore === 'number' && Number.isFinite(parsed.bestScore) ? parsed.bestScore : 0,
            bestDistance: typeof parsed.bestDistance === 'number' && Number.isFinite(parsed.bestDistance) ? parsed.bestDistance : 0,
            bestCoins: typeof parsed.bestCoins === 'number' && Number.isFinite(parsed.bestCoins) ? parsed.bestCoins : 0,
            totalRuns: typeof parsed.totalRuns === 'number' && Number.isFinite(parsed.totalRuns) ? parsed.totalRuns : 0
          };
        }
      }
      const savedUpgrades = localStorage.getItem('jiro_speed_adventure_upgrades');
      if (savedUpgrades) {
        const parsedUpgrades = JSON.parse(savedUpgrades);
        if (parsedUpgrades && typeof parsedUpgrades === 'object') {
          this.upgrades = { ...this.upgrades, ...parsedUpgrades };
        }
      }
      const savedCoins = localStorage.getItem('jiro_speed_adventure_coins');
      if (savedCoins !== null && savedCoins !== undefined && savedCoins !== '') {
        const parsed = parseInt(savedCoins, 10);
        this.coinBank = Number.isFinite(parsed) && !isNaN(parsed) && parsed >= 0 ? parsed : 0;
      } else {
        this.coinBank = 0;
      }
    } catch {
      this.coinBank = 0;
    }
  }

  public saveBankCoins() {
    try {
      if (!Number.isFinite(this.coinBank) || isNaN(this.coinBank) || this.coinBank < 0) {
        this.coinBank = 0;
      }
      localStorage.setItem('jiro_speed_adventure_coins', Math.floor(this.coinBank).toString());
    } catch {
      // Ignore local storage error in iframe sandbox if restricted
    }
  }

  public addCoins(amount = 1) {
    if (!Number.isFinite(amount) || isNaN(amount) || amount <= 0) return;
    if (this.player) {
      this.player.coins += amount;
    }
    const currentBank = Number.isFinite(this.coinBank) && !isNaN(this.coinBank) && this.coinBank >= 0 ? this.coinBank : 0;
    this.coinBank = currentBank + amount;
    this.saveBankCoins();
  }

  public saveUpgrades() {
    try {
      localStorage.setItem('jiro_speed_adventure_upgrades', JSON.stringify(this.upgrades));
    } catch {
      // Ignore local storage error
    }
    this.saveBankCoins();
  }

  public saveStats() {
    if (!this.player) return;
    this.runStats.totalRuns++;
    if (this.player.score > this.runStats.bestScore) this.runStats.bestScore = this.player.score;
    const currentDist = Math.floor(this.player.distance);
    if (currentDist > this.runStats.bestDistance) this.runStats.bestDistance = currentDist;
    if (this.player.coins > this.runStats.bestCoins) this.runStats.bestCoins = this.player.coins;

    try {
      localStorage.setItem('jiro_speed_adventure_stats', JSON.stringify(this.runStats));
    } catch {
      // Ignore local storage error
    }
    this.saveBankCoins();
  }

  private syncWorldEntities() {
    this.platforms = this.world.platforms;
    this.springs = this.world.springs;
    this.checkpoints = this.world.checkpoints;
    this.coins = this.world.coins;
    this.powerups = this.world.powerups;
    this.enemies = this.world.enemies;
    this.hills = this.world.hills;
    this.trees = this.world.trees;
    this.clouds = this.world.clouds;
  }

  public showNotification(text: string, subtext?: string, color = '#38bdf8', duration = 2.4) {
    this.notifications.push({
      text,
      subtext,
      color,
      timer: duration,
      maxTimer: duration,
      y: 90
    });
  }

  public collectPowerUp(pow: PowerUp) {
    // Prevent double collection or duplicate life counting
    if (pow.collected) return;

    const p = this.player;

    if (pow.type === 'speed') {
      p.speedBoostTimer = 7.0;
      p.maxSpeed = 12.0;
      p.accel = 0.95;
      p.score += 200;
      sound.playPowerUp();
      this.showNotification('⚡ SPEED BOOST!', '+40% Max Velocity for 7s', '#facc15');
      this.spawnConfetti(pow.x + pow.width / 2, pow.y + pow.height / 2, 14);
      // Remove from world only after successful registration
      pow.collected = true;
    } else if (pow.type === 'shield') {
      p.shield = true;
      p.score += 200;
      sound.playShield();
      this.showNotification('🛡️ SHIELD ACTIVE!', 'Protected from 1 enemy hit', '#38bdf8');
      this.spawnConfetti(pow.x + pow.width / 2, pow.y + pow.height / 2, 14);
      // Remove from world only after successful registration
      pow.collected = true;
    } else if (pow.type === 'life') {
      sound.playExtraLife();
      if (p.lives < 5) {
        // Immediately increase life count by exactly 1, capped at 5
        p.lives = Math.min(5, p.lives + 1);
        this.showNotification('❤️ EXTRA LIFE!', `+1 Life (Total: ${p.lives}/5)`, '#f43f5e');
      } else {
        // Existing fallback behavior when at maximum (5) lives: 500 bonus points
        p.score += 500;
        this.showNotification('❤️ LIFE BONUS!', '+500 Points (Max Lives)', '#f43f5e');
      }
      this.spawnConfetti(pow.x + pow.width / 2, pow.y + pow.height / 2, 14);
      // Remove from world only after successful registration
      pow.collected = true;
    } else if (pow.type === 'magnet') {
      p.coinMagnetTimer = 8.0;
      p.score += 200;
      sound.playPowerUp();
      this.showNotification('🧲 COIN MAGNET!', 'Attracting nearby coins for 8s', '#c084fc');
      this.spawnConfetti(pow.x + pow.width / 2, pow.y + pow.height / 2, 14);
      // Remove from world only after successful registration
      pow.collected = true;
    } else if (pow.type === 'jump') {
      p.superJumpTimer = 7.0;
      p.jumpForce = -15.8;
      p.score += 200;
      sound.playPowerUp();
      this.showNotification('🔥 SUPER JUMP!', 'Higher jump & air control for 7s', '#fb923c');
      this.spawnConfetti(pow.x + pow.width / 2, pow.y + pow.height / 2, 14);
      // Remove from world only after successful registration
      pow.collected = true;
    }
  }

  public resetGame() {
    initRunBiomes(Date.now() + Math.random() * 10000);
    this.player = {
      x: 100,
      y: 428,
      width: 32,
      height: 42,
      vx: 0,
      vy: 0,
      accel: 0.65,
      friction: 0.84,
      maxSpeed: 7.8,
      gravity: 0.52,
      jumpForce: -12.4,
      isGrounded: true,
      facingRight: true,
      runFrame: 0,
      invulnerableTimer: 0,
      coyoteTimer: 6,
      jumpBufferTimer: 0,
      lives: 3,
      score: 0,
      coins: 0,
      distance: 0,
      timeElapsed: 0,
      respawnX: 100,
      respawnY: 428,
      speedBoostTimer: 0,
      shield: false,
      coinMagnetTimer: 0,
      superJumpTimer: 0
    };

    this.world = createInitialWorld();
    this.syncWorldEntities();
    this.notifications = [];
    this.finishFlag = { x: -9999, y: -9999, width: 36, height: 90, reached: false };
    this.particles = [];
    this.bossHazards = [];
    this.currentBiome = { ...DEFAULT_BIOME_BLEND };
    this.lastNotifiedBiome = 'meadow';
    this.camera.x = 0;
    this.camera.y = -30;
    this.camera.targetX = 0;
    this.camera.targetY = -30;
    this.camera.zoom = 1.0;
    this.camera.targetZoom = 1.0;
    this.camera.shake = 0;
    this.camera.lookAhead = 20;

    // Procedural randomized boss encounter distance per run (Never spawn near start, minimum 800m)
    this.nextBossDistance = 800 + Math.floor(Math.random() * 250);
    this.lastMilestone = 0;
    this.cleanTimer = 0;

    this.boss = {
      active: false,
      x: 0,
      y: 350,
      width: 96,
      height: 92,
      vx: 0,
      vy: 0,
      health: 3,
      maxHealth: 3,
      animFrame: 0,
      state: 'idle',
      warningTimer: 0,
      name: 'GorgonX',
      chaseDistance: 0,
      escapeGoal: 200,
      hitCooldown: 0,
      hazardTimer: 2.0,
      roarTimer: 0,
      hazardTheme: 'mixed'
    };
  }

  /**
   * Validates whether a candidate coordinate (candX, candY) is supported solidly
   * by an existing platform in this.platforms without overlapping gaps or pits.
   */
  public checkPlatformSupport(candX: number, candY: number): Platform | null {
    const p = this.player;
    const footY = candY + p.height;
    for (const plat of this.platforms) {
      if (plat.y < 160 || plat.y > 510) continue;
      // Vertically, foot must align with the top surface of the platform
      if (Math.abs(footY - plat.y) <= 4) {
        // Horizontally, player body must be fully supported with a safe margin
        if (candX >= plat.x + 8 && candX + p.width <= plat.x + plat.width - 8) {
          return plat;
        }
      }
    }
    return null;
  }

  /**
   * Finds a guaranteed safe, solid ground/platform position for Jiro's respawn:
   * 1. Never over an empty gap
   * 2. Never inside a platform
   * 3. Never below the ground
   * 4. Aligns Jiro's feet perfectly with the top of the ground/platform
   * 5. Uses latest safe platform position before the pitfall with generous edge clearance
   */
  public findSafeRespawnPosition(): { x: number; y: number } {
    const p = this.player;

    // 1. Check if the player's recorded respawn position is solidly supported by an active platform
    const currentSupport = this.checkPlatformSupport(p.respawnX, p.respawnY);
    if (currentSupport && !currentSupport.moving) {
      const minX = Math.max(MIN_PLAYABLE_X, currentSupport.x + 24);
      const maxX = currentSupport.x + currentSupport.width - p.width - 32;

      if (maxX >= minX) {
        // Step back from the edge of any gap
        let safeX = Math.max(minX, Math.min(maxX, p.respawnX - 50));
        if (currentSupport.width > 250) {
          safeX = Math.max(minX, Math.min(maxX - 40, p.respawnX - 70));
        }

        const enemyNear = this.enemies.some(
          e => e.alive && Math.abs(e.x - safeX) < 65 && Math.abs(e.y - (currentSupport.y - p.height)) < 45
        );
        if (!enemyNear) {
          return {
            x: Math.max(MIN_PLAYABLE_X, safeX),
            y: currentSupport.y - p.height
          };
        } else {
          // Shift to opposite side of platform away from the enemy
          const altX = (safeX - minX < maxX - safeX) ? maxX : minX;
          if (!this.enemies.some(e => e.alive && Math.abs(e.x - altX) < 60)) {
            return { x: Math.max(MIN_PLAYABLE_X, altX), y: currentSupport.y - p.height };
          }
        }
      }
    }

    // 2. If respawnX / respawnY is invalid or unsafe:
    // Search active platforms in this.platforms to find the best safe platform.
    const validPlatforms = this.platforms.filter(plat =>
      !plat.moving &&
      plat.width >= 64 &&
      plat.y >= 180 &&
      plat.y <= 490
    );

    if (validPlatforms.length > 0) {
      // Prioritize solid ground and platforms behind the player's position
      const behindOrNear = validPlatforms.filter(plat => plat.x + plat.width <= Math.max(MIN_PLAYABLE_X + 100, p.x + 40));
      let chosenPlat: Platform;

      if (behindOrNear.length > 0) {
        // Pick the platform behind the player whose right edge is closest to player's X
        behindOrNear.sort((a, b) => (b.x + b.width) - (a.x + a.width));
        chosenPlat = behindOrNear[0];
      } else {
        // Otherwise pick the platform closest to the player's X
        validPlatforms.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
        chosenPlat = validPlatforms[0];
      }

      // Determine a safe X on this platform with generous edge margins
      const minX = Math.max(MIN_PLAYABLE_X, chosenPlat.x + 24);
      const maxX = chosenPlat.x + chosenPlat.width - p.width - 32;

      let safeX = (minX + maxX) / 2;
      if (maxX >= minX) {
        if (chosenPlat.width > 200) {
          // On wide ground runway, place securely back from the gap edge
          safeX = Math.max(minX, Math.min(maxX - 30, p.x - 90));
        } else {
          // On smaller elevated platform, center the player
          safeX = chosenPlat.x + (chosenPlat.width - p.width) / 2;
        }
      } else {
        safeX = chosenPlat.x + 12;
      }

      // Check if an enemy is close to safeX on this platform, adjust if needed
      const enemyClose = this.enemies.some(
        e => e.alive && Math.abs(e.x - safeX) < 65 && Math.abs(e.y - (chosenPlat.y - p.height)) < 45
      );
      if (enemyClose && maxX > minX + 60) {
        safeX = (safeX < (minX + maxX) / 2) ? maxX : minX;
      }

      const safeY = chosenPlat.y - p.height;
      return {
        x: Math.max(MIN_PLAYABLE_X, safeX),
        y: safeY
      };
    }

    // 3. Fallback: absolute safe default on starting runway ground
    return {
      x: 120,
      y: 470 - p.height
    };
  }

  public respawnPlayer() {
    const safePos = this.findSafeRespawnPosition();

    // 1. Reset Jiro's position to guaranteed valid ground/platform
    this.player.x = safePos.x;
    this.player.y = safePos.y;
    this.player.respawnX = safePos.x;
    this.player.respawnY = safePos.y;

    // 2. Reset vertical and horizontal velocity
    this.player.vx = 0;
    this.player.vy = 0;

    // 3. Align feet and reset falling/death state flags
    this.player.isGrounded = true;
    this.player.coyoteTimer = 6;
    this.player.jumpBufferTimer = 0;
    this.keys.jumpBuffered = false;

    // 4. Generous respawn invulnerability (120 frames / 2 full seconds)
    this.player.invulnerableTimer = 120;

    // 5. Clear temporary active power-ups on respawn
    this.player.speedBoostTimer = 0;
    this.player.shield = false;
    this.player.coinMagnetTimer = 0;
    this.player.superJumpTimer = 0;
    this.player.maxSpeed = 7.8;
    this.player.jumpForce = -12.4;
    this.player.accel = 0.65;

    // 6. Push any nearby enemy safely away from the respawn zone
    this.enemies.forEach(e => {
      if (e.alive && Math.abs(e.x - this.player.x) < 90) {
        e.x = this.player.x + (e.x >= this.player.x ? 120 : -120);
      }
    });

    // 7. Prevent camera from staying at an invalid below-world position
    this.camera.targetX = this.player.x - 220;
    if (this.camera.targetX < 0) this.camera.targetX = 0;
    this.camera.x = this.camera.targetX;

    const targetY = Math.max(-40, Math.min(60, (this.player.y - 360) * 0.35));
    this.camera.targetY = targetY;
    this.camera.y = targetY;

    // 8. Ensure GorgonX and hazards do not immediately camp the safe respawn
    if (this.boss.active && this.boss.state === 'chasing') {
      if (this.boss.x > this.player.x - 240) {
        this.boss.x = this.player.x - 280;
        this.boss.vy = 0;
      }
      this.bossHazards = this.bossHazards.filter(h => Math.abs(h.x - this.player.x) > 120);
    }

    sound.playHurt();
    this.spawnDust(this.player.x + this.player.width / 2, this.player.y + this.player.height, 8, '#ffffff');
  }

  public spawnDust(x: number, y: number, count = 5, color = 'rgba(255, 255, 255, 0.7)') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 0.5,
        radius: Math.random() * 3 + 2,
        alpha: 1,
        color: color,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  public spawnCoinSparkle(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 2,
        alpha: 1,
        color: '#ffd700',
        decay: 0.03
      });
    }
  }

  public spawnConfetti(x: number, y: number, count = 20) {
    const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        radius: Math.random() * 4 + 2,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: 0.015
      });
    }
  }

  public update(dt: number) {
    if (this.state !== 'playing') return;

    const p = this.player;
    p.timeElapsed += dt;

    // Horizontal Input
    if (this.keys.left) {
      p.vx -= p.accel;
      p.facingRight = false;
    } else if (this.keys.right) {
      p.vx += p.accel;
      p.facingRight = true;
    } else {
      p.vx *= p.friction;
      if (Math.abs(p.vx) < 0.1) p.vx = 0;
    }

    // Clamp speed
    if (p.vx > p.maxSpeed) p.vx = p.maxSpeed;
    if (p.vx < -p.maxSpeed) p.vx = -p.maxSpeed;

    // Running dust
    if (p.isGrounded && Math.abs(p.vx) > 3.5 && Math.random() < 0.25) {
      this.spawnDust(p.x + p.width / 2, p.y + p.height, 2, 'rgba(230, 240, 255, 0.6)');
    }

    // Speed boost particle trail
    if (p.speedBoostTimer > 0 && Math.abs(p.vx) > 3 && Math.random() < 0.4) {
      this.spawnDust(p.x + (p.facingRight ? 2 : p.width - 2), p.y + p.height - 6, 2, '#fde047');
    }

    // Super jump foot flame trail when airborne
    if (p.superJumpTimer > 0 && !p.isGrounded && Math.random() < 0.3) {
      this.spawnDust(p.x + p.width / 2 + (Math.random() - 0.5) * 8, p.y + p.height - 2, 1, '#fb923c');
    }

    // --- POWER-UP TIMERS & EXPIRATION ---
    if (p.speedBoostTimer > 0) {
      p.speedBoostTimer -= dt;
      if (p.speedBoostTimer <= 0) {
        p.speedBoostTimer = 0;
        p.maxSpeed = 7.8;
        p.accel = 0.65;
        sound.playPowerExpire();
      }
    }

    if (p.coinMagnetTimer > 0) {
      p.coinMagnetTimer -= dt;
      if (p.coinMagnetTimer <= 0) {
        p.coinMagnetTimer = 0;
        sound.playPowerExpire();
      }
    }

    if (p.superJumpTimer > 0) {
      p.superJumpTimer -= dt;
      if (p.superJumpTimer <= 0) {
        p.superJumpTimer = 0;
        p.jumpForce = -12.4;
        sound.playPowerExpire();
      }
    }

    // --- NOTIFICATION TIMERS ---
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const n = this.notifications[i];
      n.timer -= dt;
      n.y -= dt * 10;
      if (n.timer <= 0) {
        this.notifications.splice(i, 1);
      }
    }

    // Jump Buffering & Coyote Time
    if (p.isGrounded) {
      p.coyoteTimer = 6;
    } else {
      if (p.coyoteTimer > 0) p.coyoteTimer--;
    }

    if (this.keys.jumpBuffered) {
      p.jumpBufferTimer = 6;
      this.keys.jumpBuffered = false;
    } else {
      if (p.jumpBufferTimer > 0) p.jumpBufferTimer--;
    }

    if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
      p.vy = p.jumpForce;
      p.isGrounded = false;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      sound.playJump();
      this.spawnDust(p.x + p.width / 2, p.y + p.height, 6);
    }

    // Gravity
    p.vy += p.gravity;
    if (p.vy > 14) p.vy = 14;

    // Moving platforms
    this.platforms.forEach(plat => {
      if (plat.moving && plat.range && plat.dir && plat.speed && plat.originX !== undefined) {
        plat.x += plat.speed * plat.dir;
        if (plat.x > plat.originX + plat.range) {
          plat.x = plat.originX + plat.range;
          plat.dir = -1;
        } else if (plat.x < plat.originX - plat.range) {
          plat.x = plat.originX - plat.range;
          plat.dir = 1;
        }
      }
    });

    // Horizontal Movement & Wall Collision
    p.x += p.vx;

    // Safe Left Boundary Clamp:
    // Prevent player from moving beyond the valid left boundary of the starting area
    if (p.x < MIN_PLAYABLE_X) {
      p.x = MIN_PLAYABLE_X;
      if (p.vx < 0) p.vx = 0;
    }

    for (const plat of this.platforms) {
      if (plat.type === 'ground') {
        if (
          p.x < plat.x + plat.width &&
          p.x + p.width > plat.x &&
          p.y < plat.y + plat.height &&
          p.y + p.height > plat.y + 10
        ) {
          if (p.vx > 0) {
            p.x = plat.x - p.width;
            p.vx = 0;
          } else if (p.vx < 0) {
            p.x = plat.x + plat.width;
            p.vx = 0;
          }
        }
      }
    }

    // Vertical Movement & Platform Landing
    p.y += p.vy;
    p.isGrounded = false;

    for (const plat of this.platforms) {
      const overlapX = p.x + p.width > plat.x + 4 && p.x < plat.x + plat.width - 4;
      if (overlapX) {
        const prevBottom = p.y + p.height - p.vy;
        if (prevBottom <= plat.y + 8 && p.y + p.height >= plat.y) {
          p.y = plat.y - p.height;
          p.vy = 0;
          p.isGrounded = true;
          if (plat.moving && plat.speed && plat.dir) {
            p.x += plat.speed * plat.dir;
            if (p.x < MIN_PLAYABLE_X) {
              p.x = MIN_PLAYABLE_X;
              if (p.vx < 0) p.vx = 0;
            }
          }
        } else if (plat.type === 'ground' && p.vy < 0 && p.y <= plat.y + plat.height && p.y - p.vy >= plat.y + plat.height - 8) {
          p.y = plat.y + plat.height;
          p.vy = 0;
        }
      }
    }

    // Safe Ground Position Tracking:
    // When Jiro is safely standing on a solid, valid platform, record it as a valid safe respawn location
    if (p.isGrounded && p.vy === 0 && p.y >= 120 && p.y <= 480) {
      for (const plat of this.platforms) {
        const footY = p.y + p.height;
        if (
          Math.abs(footY - plat.y) <= 4 &&
          p.x >= plat.x + 16 &&
          p.x + p.width <= plat.x + plat.width - 16 &&
          plat.width >= 56
        ) {
          const enemyNear = this.enemies.some(
            e => e.alive && Math.abs(e.x - p.x) < 50 && Math.abs(e.y - p.y) < 40
          );
          if (!enemyNear) {
            p.respawnX = p.x;
            p.respawnY = plat.y - p.height;
          }
          break;
        }
      }
    }

    // Springs
    this.springs.forEach(s => {
      if (
        p.x + p.width > s.x &&
        p.x < s.x + s.width &&
        p.y + p.height >= s.y &&
        p.y + p.height <= s.y + s.height + 12 &&
        p.vy >= 0
      ) {
        p.vy = s.power;
        p.isGrounded = false;
        sound.playJump();
        this.spawnDust(s.x + s.width / 2, s.y + s.height, 10, '#ff9500');
      }
    });

    // Checkpoints
    this.checkpoints.forEach(cp => {
      if (!cp.reached && Math.abs(p.x - cp.x) < 40 && Math.abs(p.y - cp.y) < 70) {
        cp.reached = true;
        p.respawnX = cp.x;
        p.respawnY = cp.y - p.height;
        sound.playCheckpoint();
        this.spawnConfetti(cp.x, cp.y - 40, 15);
      }
    });

    // Coins
    this.coins.forEach(c => {
      if (!c.collected) {
        // Coin Magnet Pull
        if (p.coinMagnetTimer > 0) {
          const px = p.x + p.width / 2;
          const py = p.y + p.height / 2;
          const mDist = Math.hypot(px - c.x, py - c.y);
          if (mDist < 240 && mDist > 4) {
            c.x += (px - c.x) * 0.12;
            c.y += (py - c.y) * 0.12;
          }
        }

        const dx = (p.x + p.width / 2) - c.x;
        const dy = (p.y + p.height / 2) - c.y;
        if (Math.hypot(dx, dy) < 26) {
          c.collected = true;
          this.addCoins(1);
          p.score += 100;
          sound.playCoin();
          this.spawnCoinSparkle(c.x, c.y);
        }
      }
    });

    // Power-Ups Collection (Reliable multi-directional collection for Heart and all powerups)
    this.powerups.forEach(pow => {
      if (!pow.collected) {
        // Center of power-up accounting for floating animation oscillation
        const time = performance.now() * 0.004;
        const floatOffsetY = Math.sin(time * 3 + pow.animOffset) * 5;
        const powCenterX = pow.x + pow.width / 2;
        const powCenterY = pow.y + pow.height / 2 + floatOffsetY;

        // Closest point on Jiro's rectangular body to the power-up center
        const closestX = Math.max(p.x, Math.min(powCenterX, p.x + p.width));
        const closestY = Math.max(p.y, Math.min(powCenterY, p.y + p.height));
        const distToBox = Math.hypot(powCenterX - closestX, powCenterY - closestY);

        // Generous touch radius (visual radius is ~14-16px + 8px grace margin = 22px)
        const touchRadius = 22;

        // Expanded AABB overlap with 6px grace margin for fast horizontal/vertical dashes
        const aabbOverlap =
          p.x + p.width >= pow.x - 6 &&
          p.x <= pow.x + pow.width + 6 &&
          p.y + p.height >= pow.y + floatOffsetY - 6 &&
          p.y <= pow.y + floatOffsetY + pow.height + 6;

        if (distToBox <= touchRadius || aabbOverlap) {
          this.collectPowerUp(pow);
        }
      }
    });

    // Enemies
    this.enemies.forEach(e => {
      if (!e.alive) {
        if (e.squishTimer > 0) e.squishTimer--;
        return;
      }

      e.animFrame += 0.1;
      if (e.type === 'bumble') {
        e.y = e.originY + Math.sin(e.animFrame) * 22;
        e.x += e.vx;
      } else {
        e.x += e.vx;
      }

      if (e.x < e.minX) {
        e.x = e.minX;
        e.vx = Math.abs(e.vx);
      } else if (e.x > e.maxX) {
        e.x = e.maxX;
        e.vx = -Math.abs(e.vx);
      }

      const playerBottom = p.y + p.height;
      const enemyTop = e.y;
      const isOverlapX = p.x + p.width > e.x && p.x < e.x + e.width;
      const isOverlapY = p.y + p.height > e.y && p.y < e.y + e.height;

      if (isOverlapX && isOverlapY) {
        const isStomp = p.vy > 0 && playerBottom - p.vy <= enemyTop + 14;
        if (isStomp) {
          e.alive = false;
          e.squishTimer = 20;
          p.vy = -9.2;
          p.score += 250;
          sound.playDefeat();
          this.spawnDust(e.x + e.width / 2, e.y + e.height / 2, 8, '#ffcc00');
        } else if (p.shield) {
          // Shield absorbs the blow!
          p.shield = false;
          p.invulnerableTimer = 60;
          p.vy = -6;
          p.vx = p.facingRight ? -4 : 4;
          sound.playShieldBreak();
          this.spawnDust(p.x + p.width / 2, p.y + p.height / 2, 16, '#38bdf8');
          this.showNotification('🛡️ SHIELD BROKEN!', 'Protected you from damage', '#38bdf8', 2.0);
        } else if (p.invulnerableTimer <= 0) {
          p.lives--;
          if (p.lives <= 0) {
            sound.playHurt();
            this.state = 'gameover';
            this.saveStats();
          } else {
            p.invulnerableTimer = 90;
            p.vy = -6;
            p.vx = p.facingRight ? -5 : 5;
            sound.playHurt();
          }
        }
      }
    });

    // Invulnerability
    if (p.invulnerableTimer > 0) {
      p.invulnerableTimer--;
    }

    // Distance progression & score calculation
    const curDist = Math.max(0, (p.x - 100) / 22);
    if (curDist > p.distance) {
      const distDiff = curDist - p.distance;
      p.distance = curDist;
      p.score += Math.floor(distDiff * 2.5);
    }

    // 100m Milestone Audio & Bonus Notifications
    const m100 = Math.floor(p.distance / 100) * 100;
    if (m100 > this.lastMilestone && m100 > 0) {
      this.lastMilestone = m100;
      sound.playMilestone();
      this.showNotification(`🚩 MILESTONE: ${m100}m REACHED!`, '+250 Milestone Points', '#38bdf8', 2.5);
      p.score += 250;
    }

    // Dynamic Biome update based on player's current physical position:
    // Uses curDist so moving backward near a transition smoothly reverses the transition!
    this.currentBiome = getBiomeAtDistance(curDist);
    if (this.currentBiome.primary !== this.lastNotifiedBiome && p.distance >= 350) {
      const prev = this.lastNotifiedBiome;
      this.lastNotifiedBiome = this.currentBiome.primary;
      if (this.currentBiome.primary === 'coastal') {
        this.showNotification('🌊 ENTERING: OCEAN', 'Open ocean horizon, coastal waves & tropical palms ahead!', '#38bdf8', 3.5);
      } else if (this.currentBiome.primary === 'cave') {
        this.showNotification('💎 ENTERING: CAVE', 'Subterranean rock walls, luminous stalactites & minerals!', '#c084fc', 3.5);
      } else if (this.currentBiome.primary === 'mountain') {
        this.showNotification('⛰️ ENTERING: MOUNTAIN', 'High alpine cliffs, rocky ledges & snowy peaks ahead!', '#e2e8f0', 3.5);
      } else if (this.currentBiome.primary === 'forest') {
        this.showNotification('🌲 ENTERING: FOREST', 'Dense ancient trees, jungle canopy & mossy vines!', '#22c55e', 3.5);
      } else if (this.currentBiome.primary === 'temple') {
        this.showNotification('🏛️ ENTERING: ANCIENT TEMPLE RUINS', 'Sunlit stone pillars, ivy-covered arches & forgotten ruins!', '#f59e0b', 3.5);
      } else if (this.currentBiome.primary === 'volcano') {
        this.showNotification('🌋 ENTERING: VOLCANIC AREA', 'Dark volcanic crags, glowing magma fissures & smoky embers!', '#ef4444', 3.5);
      } else if (this.currentBiome.primary === 'meadow' && prev !== 'meadow') {
        this.showNotification('🌿 ENTERING: MEADOW', 'Vibrant rolling hills & lush open skies!', '#4ade80', 3.5);
      }
    }

    // Procedural Endless Generation Chunk Trigger
    if (p.x + 1600 > this.world.nextGenX) {
      generateNextChunk(this.world, p.distance);
      this.syncWorldEntities();
    }

    // Periodic Cleanup of Far-Left Entities
    this.cleanTimer += dt;
    if (this.cleanTimer > 4.0) {
      this.cleanTimer = 0;
      cleanOldEntities(this.world, this.camera.x - 800);
      this.syncWorldEntities();
    }

    // --- BOSS ENCOUNTER SYSTEM ("GorgonX") ---
    if (!this.boss.active && p.distance >= this.nextBossDistance) {
      // Find safe upcoming terrain before spawning to ensure player has a continuous reachable path
      const hasUpcomingPath = this.platforms.some(plat => plat.x > p.x && plat.x < p.x + 500 && plat.y < LEVEL_HEIGHT);
      if (hasUpcomingPath && p.isGrounded) {
        this.boss.active = true;
        this.boss.state = 'warning';
        this.boss.warningTimer = 2.6;
        this.boss.health = 3;
        this.boss.maxHealth = 3;
        this.boss.chaseDistance = 0;
        this.boss.escapeGoal = 180 + Math.floor(Math.random() * 80) + Math.min(100, Math.floor(p.distance / 250) * 20);
        this.boss.name = 'GorgonX';
        this.boss.width = 96;
        this.boss.height = 92;

        // Find ground/platform surface behind player for natural, grounded entrance inside camera view
        const spawnX = p.x - 240;
        let groundY = 470;
        for (const plat of this.platforms) {
          if (spawnX + this.boss.width * 0.7 >= plat.x && spawnX + this.boss.width * 0.3 <= plat.x + plat.width) {
            if (plat.y >= 200 && plat.y <= 480) {
              if (plat.y < groundY) groundY = plat.y;
            }
          }
        }
        this.boss.x = spawnX;
        this.boss.y = groundY - this.boss.height;
        this.boss.vx = p.vx > 0 ? p.vx : 5.8;
        this.boss.vy = 0;
        this.boss.hazardTimer = 1.6;
        this.boss.roarTimer = 0;
        const themes: Array<'spikes' | 'tremors' | 'barriers' | 'mixed'> = ['spikes', 'tremors', 'barriers', 'mixed'];
        this.boss.hazardTheme = themes[Math.floor(Math.random() * themes.length)];
        this.bossHazards = [];
        this.camera.targetZoom = 0.83; // Slightly wider dramatic cinematic view during boss chase!

        sound.playBossWarning();
        this.showNotification('⚠️ GORGONX APPROACHING!', 'GorgonX is on the hunt! Outrun the beast & avoid hazards!', '#ef4444', 3.2);
      }
    }

    if (this.boss.active) {
      const b = this.boss;
      if (b.state === 'warning') {
        b.warningTimer -= dt;
        // Keep GorgonX smoothly pacing behind player inside camera view during warning
        const targetX = p.x - 240;
        b.vx = p.vx > 0 ? p.vx : 5.8;
        b.x += (targetX - b.x) * 0.12;
        let warningGroundY = 470;
        for (const plat of this.platforms) {
          if (b.x + b.width * 0.7 >= plat.x && b.x + b.width * 0.3 <= plat.x + plat.width) {
            if (plat.y >= 200 && plat.y <= 480) {
              if (plat.y < warningGroundY) warningGroundY = plat.y;
            }
          }
        }
        b.y = warningGroundY - b.height;

        if (b.warningTimer <= 0) {
          b.state = 'chasing';
          b.x = p.x - 240;
          let chaseGroundY = 470;
          for (const plat of this.platforms) {
            if (b.x + b.width * 0.7 >= plat.x && b.x + b.width * 0.3 <= plat.x + plat.width) {
              if (plat.y >= 200 && plat.y <= 480) {
                if (plat.y < chaseGroundY) chaseGroundY = plat.y;
              }
            }
          }
          b.y = chaseGroundY - b.height;
          b.vy = 0;
          b.roarTimer = 0;
          this.camera.shake = 5;
          sound.playBossRoar();
          this.showNotification('💥 GORGONX HAS ARRIVED!', 'Leap over incoming hazards and survive the pursuit!', '#f97316', 3.0);
        }
      } else if (b.state === 'chasing') {
        if (b.hitCooldown > 0) b.hitCooldown -= dt;

        // Periodic roar & screen tremor
        b.roarTimer = (b.roarTimer || 0) + dt;
        if (b.roarTimer > 4.6) {
          b.roarTimer = 0;
          sound.playBossRoar();
          this.camera.shake = Math.min(8, this.camera.shake + 3);
        }

        // Dynamic chase speed matching difficulty tier
        const baseSpeed = 6.2 + Math.min(3.4, p.distance / 320);
        b.vx = baseSpeed;
        if (p.x - b.x > 250) {
          b.vx = Math.max(b.vx + 2.0, p.vx + 1.2);
        } else if (p.x - b.x < 130) {
          b.vx = Math.max(3.2, b.vx - 1.2);
        }
        b.x += b.vx;

        // Prevent boss from ever falling behind camera view or clipping left screen edge
        const minBossX = this.camera.x + 36;
        if (b.x < minBossX) b.x = minBossX;
        if (p.x - b.x > 265) b.x = p.x - 265;

        // Boss ground landing & gravity (firmly anchored to ground/platform level)
        b.vy += 0.52;
        b.y += b.vy;
        let landed = false;
        for (const plat of this.platforms) {
          if (b.x + b.width * 0.7 > plat.x && b.x + b.width * 0.3 < plat.x + plat.width) {
            if (b.y + b.height >= plat.y && b.y + b.height - b.vy <= plat.y + 24) {
              b.y = plat.y - b.height;
              b.vy = 0;
              landed = true;
              break;
            }
          }
        }
        if (!landed && b.y + b.height >= 470) {
          b.y = 470 - b.height;
          b.vy = 0;
        }

        // Footstep ground dust
        b.footstepTimer = (b.footstepTimer || 0) + dt;
        if (b.footstepTimer > 0.2) {
          b.footstepTimer = 0;
          this.spawnDust(b.x + b.width * 0.35, b.y + b.height, 3, 'rgba(100, 116, 139, 0.6)');
        }

        // Procedural Hazards Generation
        b.hazardTimer = (b.hazardTimer || 2.0) - dt;
        if (b.hazardTimer <= 0) {
          b.hazardTimer = 3.6 + Math.random() * 1.6;
          this.spawnProceduralBossHazard(p, b);
        }

        // Track escape progress
        b.chaseDistance += (b.vx * dt) * 0.85;

        // Check Escape Success
        if (b.chaseDistance >= b.escapeGoal) {
          b.state = 'escaped';
          b.active = false;
          sound.playEscapeSuccess();
          p.score += 1500;
          this.addCoins(10);
          this.nextBossDistance = p.distance + 460 + Math.floor(Math.random() * 200);
          this.saveStats();
          this.camera.targetZoom = 0.86;
          this.clearBossHazards();
          this.showNotification('🏃 OUTRAN GORGONX!', '+1,500 Escape Bonus & 10 Coins!', '#22c55e', 3.5);
        }

        // Collision with Player
        const overlapX = p.x + p.width > b.x + 8 && p.x < b.x + b.width - 8;
        const overlapY = p.y + p.height > b.y && p.y < b.y + b.height;
        if (overlapX && overlapY) {
          const isHeadStomp = p.vy > 0 && (p.y + p.height - p.vy) <= b.y + 26;
          if (isHeadStomp && b.hitCooldown <= 0) {
            b.health--;
            b.hitCooldown = 0.6;
            p.vy = -12.8;
            sound.playEnemyHit();
            this.spawnDust(b.x + b.width / 2, b.y, 16, '#f43f5e');
            if (b.health <= 0) {
              b.state = 'defeated';
              b.active = false;
              sound.playBossDefeated();
              p.score += 3000;
              this.addCoins(25);
              this.spawnConfetti(b.x + b.width / 2, b.y + b.height / 2, 40);
              this.nextBossDistance = p.distance + 520 + Math.floor(Math.random() * 220);
              this.saveStats();
              this.camera.targetZoom = 0.86;
              this.clearBossHazards();
              this.showNotification('👑 GORGONX DEFEATED!', '+3,000 pts & 25 Coins Earned!', '#facc15', 4.0);
            } else {
              this.showNotification(`💎 HEAD STOMP! (${b.health}/${b.maxHealth})`, 'Stomp head crystal again to defeat!', '#facc15', 1.5);
            }
          } else if (b.hitCooldown <= 0) {
            if (p.shield) {
              p.shield = false;
              p.invulnerableTimer = 60;
              p.vy = -6;
              p.vx = 8;
              sound.playShieldBreak();
              this.spawnDust(p.x + p.width / 2, p.y + p.height / 2, 16, '#38bdf8');
              this.showNotification('🛡️ SHIELD BROKEN!', 'Saved you from GorgonX attack!', '#38bdf8', 2.0);
            } else if (p.invulnerableTimer <= 0) {
              p.lives--;
              if (p.lives <= 0) {
                sound.playHurt();
                this.state = 'gameover';
                this.saveStats();
              } else {
                p.invulnerableTimer = 90;
                p.vy = -6;
                p.vx = 8;
                sound.playHurt();
              }
            }
          }
        }
      }
    }

    // Update Boss Hazards
    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const h = this.bossHazards[i];

      if (h.state === 'telegraph') {
        h.timer -= dt;
        if (h.timer <= 0) {
          h.state = 'active';
          h.timer = h.duration;
        }
      } else if (h.state === 'active') {
        h.timer -= dt;

        if (h.type === 'falling_debris') {
          const targetGroundY = h.targetY || 400;
          if (h.y < targetGroundY) {
            h.y += (h.vy || 7.2);
            if (h.y >= targetGroundY) {
              h.y = targetGroundY;
              this.spawnDust(h.x + h.width / 2, h.y, 10, '#f97316');
              sound.playEnemyHit();
              this.camera.shake = Math.min(8, this.camera.shake + 2.5);
            }
          }
        } else if (h.type === 'moving_barrier') {
          h.x += (h.vx || 2.2);
          if (h.maxX && h.x >= h.maxX) {
            h.vx = -Math.abs(h.vx || 2.2);
          } else if (h.minX && h.x <= h.minX) {
            h.vx = Math.abs(h.vx || 2.2);
          }
        }

        // Check fair collision with player
        const hitX = p.x + p.width > h.x + 6 && p.x < h.x + h.width - 6;
        let hitY = false;
        if (h.type === 'ground_spikes') {
          hitY = p.y + p.height >= h.y - h.height && p.y + p.height <= h.y + 14;
        } else if (h.type === 'falling_debris') {
          hitY = p.y + p.height > h.y && p.y < h.y + h.height;
        } else if (h.type === 'moving_barrier') {
          hitY = p.y + p.height > h.y && p.y < h.y + h.height;
        } else if (h.type === 'danger_zone') {
          hitY = p.y + p.height >= h.y - h.height && p.y <= h.y + 8;
        }

        if (hitX && hitY) {
          if (p.shield) {
            p.shield = false;
            p.invulnerableTimer = 60;
            p.vy = -6;
            sound.playShieldBreak();
            this.spawnDust(p.x + p.width / 2, p.y + p.height / 2, 16, '#38bdf8');
            this.showNotification('🛡️ SHIELD BLOCKED HAZARD!', 'Saved by your energy shield!', '#38bdf8', 2.0);
            h.state = 'done';
          } else if (p.invulnerableTimer <= 0) {
            p.lives--;
            if (p.lives <= 0) {
              sound.playHurt();
              this.state = 'gameover';
              this.saveStats();
            } else {
              p.invulnerableTimer = 90;
              p.vy = -7;
              p.vx = -4;
              sound.playHurt();
              this.showNotification('⚠️ HIT BY HAZARD!', 'Watch your step during boss pursuit!', '#ef4444', 1.8);
            }
          }
        }

        if (h.timer <= 0) {
          h.state = 'done';
        }
      }

      // Cleanup finished or offscreen hazards
      if (h.state === 'done' || h.x < p.x - 350) {
        this.bossHazards.splice(i, 1);
      }
    }

    // Gap pitfall / Below-world fall recovery
    if (p.y > LEVEL_HEIGHT + 20) {
      p.lives--;
      if (p.lives <= 0) {
        sound.playHurt();
        this.state = 'gameover';
        this.saveStats();
      } else {
        this.respawnPlayer();
      }
    }

    // 2D Side-Scrolling Platformer Camera Framing:
    // 1. Strictly frame Jiro around 35–40% from the LEFT edge during forward movement (GAME_W = 960).
    //    35% is 336px, 37.5% is 360px, 40% is 384px.
    // 2. Open up 60%–65% (over 600px!) of the upcoming world on the RIGHT side.
    // 3. Smooth horizontal look-ahead that responds to movement velocity:
    //    - Normal forward running shifts look-ahead rightward (+24px), bringing Jiro towards 340px (35.4%).
    //    - Moving backward smoothly reverses look-ahead (-20px), shifting Jiro towards 384px (40.0%) to reveal the path behind.
    // 4. Vertical framing shows slightly more vertical world/terrain while keeping ground clearly visible.
    // 5. Strict boundary clamping: never reveals empty/out-of-bounds space.
    const speedRatio = Math.max(-1.0, Math.min(1.0, p.vx / 6.5));
    const targetLookAhead = speedRatio >= 0 ? speedRatio * 24 : speedRatio * 20;

    // Smooth look-ahead interpolation
    this.camera.lookAhead += (targetLookAhead - this.camera.lookAhead) * 0.08;

    // Desired on-screen X position for Jiro:
    // - Full forward run: 364 - 24 = 340px (~35.4%)
    // - Idle: 364px (~37.9%)
    // - Full backward run: 364 - (-20) = 384px (~40.0%)
    const desiredScreenX = 364 - this.camera.lookAhead;
    this.camera.targetX = Math.max(0, p.x - desiredScreenX);

    // Responsive camera easing to track target position smoothly without lag:
    const camDiff = this.camera.targetX - this.camera.x;
    this.camera.x += camDiff * 0.16;

    // Guardrail: guarantee Jiro stays strictly within 35%–40% (336px to 384px) during forward movement
    if (this.camera.x > 0) {
      const currentScreenX = p.x - this.camera.x;
      if (p.vx > 0.3) {
        if (currentScreenX > 384) {
          this.camera.x = p.x - 384;
        } else if (currentScreenX < 336) {
          this.camera.x = p.x - 336;
        }
      } else if (p.vx < -0.3) {
        if (currentScreenX > 388) {
          this.camera.x = p.x - 388;
        } else if (currentScreenX < 336) {
          this.camera.x = p.x - 336;
        }
      }
    }

    // Boundary protection: Never reveal empty/out-of-bounds space to the left of the start (x <= 0)
    if (this.camera.x < 0) this.camera.x = 0;

    // Vertical framing:
    // Base targetY = 0 keeps 70px of rich ground terrain visible at the bottom of the screen.
    // When Jiro jumps or ascends elevated platforms (p.y < 360), smoothly adjust vertical camera
    // by up to -45px to reveal higher platforms and airspace, while ground remains fully visible.
    let targetCamY = 0;
    if (p.y < 360) {
      const climb = (360 - p.y) * 0.28;
      targetCamY = -Math.min(45, climb);
    }
    this.camera.targetY = targetCamY;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.06;

    // Stable zoom easing (maintains crisp 1:1 scale at 1.0)
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.05;

    // Screen shake decay
    if (this.camera.shake > 0.05) {
      this.camera.shake *= 0.9;
    } else {
      this.camera.shake = 0;
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.vy += 0.1;
      part.alpha -= part.decay;
      if (part.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Clouds drift
    this.clouds.forEach(c => {
      c.x += c.speed || 0.2;
      if (c.x > this.camera.x + GAME_W + 300) c.x = this.camera.x - 300;
    });
  }

  private spawnProceduralBossHazard(p: Player, b: Boss) {
    if (!this.boss.active || this.boss.state !== 'chasing') return;

    // Pick hazard type based on theme
    const theme = b.hazardTheme || 'mixed';
    let type: BossHazardType = 'ground_spikes';
    const roll = Math.random();

    if (theme === 'spikes') {
      type = 'ground_spikes';
    } else if (theme === 'tremors') {
      type = 'falling_debris';
    } else if (theme === 'barriers') {
      type = 'moving_barrier';
    } else {
      // mixed
      if (roll < 0.35) type = 'ground_spikes';
      else if (roll < 0.68) type = 'falling_debris';
      else if (roll < 0.88) type = 'moving_barrier';
      else type = 'danger_zone';
    }

    if (type === 'ground_spikes') {
      // Find a safe flat platform ahead with plenty of run-up and landing room
      const aheadPlats = this.platforms.filter(
        plat => plat.x > p.x + 300 && plat.x < p.x + 650 && plat.width >= 150 && plat.y < LEVEL_HEIGHT - 30
      );
      if (aheadPlats.length > 0) {
        const plat = aheadPlats[Math.floor(Math.random() * aheadPlats.length)];
        const spikeW = Math.min(80, Math.floor(plat.width * 0.45));
        // Center the spike bed so player has plenty of space to jump before and land after
        const spikeX = plat.x + Math.floor((plat.width - spikeW) * 0.5);

        const alreadyHasHazard = this.bossHazards.some(h => Math.abs(h.x - spikeX) < 120);
        if (!alreadyHasHazard) {
          this.bossHazards.push({
            id: Date.now() + Math.random(),
            type: 'ground_spikes',
            x: spikeX,
            y: plat.y,
            width: spikeW,
            height: 24,
            state: 'telegraph',
            timer: 1.4,
            duration: 2.4
          });
        }
      }
    } else if (type === 'falling_debris') {
      // Seismic tremor causing volcanic falling rubble/obstacle
      const aheadPlats = this.platforms.filter(
        plat => plat.x > p.x + 280 && plat.x < p.x + 600 && plat.width >= 120 && plat.y < LEVEL_HEIGHT - 30
      );
      if (aheadPlats.length > 0) {
        const plat = aheadPlats[Math.floor(Math.random() * aheadPlats.length)];
        const targetX = plat.x + Math.floor(plat.width * 0.5) - 16;
        const alreadyHasHazard = this.bossHazards.some(h => Math.abs(h.x - targetX) < 100);
        if (!alreadyHasHazard) {
          this.camera.shake = Math.min(8, this.camera.shake + 3);
          sound.playBossRoar();
          this.bossHazards.push({
            id: Date.now() + Math.random(),
            type: 'falling_debris',
            x: targetX,
            y: -50,
            width: 32,
            height: 32,
            targetY: plat.y,
            vy: 7.2,
            state: 'telegraph',
            timer: 1.3,
            duration: 2.2
          });
        }
      }
    } else if (type === 'moving_barrier') {
      // Hovering laser barrier over a platform leaving safe jumping or sliding clearance
      const aheadPlats = this.platforms.filter(
        plat => plat.x > p.x + 320 && plat.x < p.x + 650 && plat.width >= 180 && plat.y < LEVEL_HEIGHT - 40
      );
      if (aheadPlats.length > 0) {
        const plat = aheadPlats[Math.floor(Math.random() * aheadPlats.length)];
        const bW = 34;
        const bH = 46;
        const alreadyHasHazard = this.bossHazards.some(h => Math.abs(h.x - plat.x) < 140);
        if (!alreadyHasHazard) {
          this.bossHazards.push({
            id: Date.now() + Math.random(),
            type: 'moving_barrier',
            x: plat.x + 30,
            y: plat.y - bH - 32, // Leaves 32px safe underpass or room to leap over
            width: bW,
            height: bH,
            vx: 2.2,
            minX: plat.x + 20,
            maxX: plat.x + plat.width - bW - 20,
            state: 'active',
            timer: 4.2,
            duration: 4.2
          });
        }
      }
    } else if (type === 'danger_zone') {
      const aheadPlats = this.platforms.filter(
        plat => plat.x > p.x + 320 && plat.x < p.x + 600 && plat.width >= 160 && plat.y < LEVEL_HEIGHT - 30
      );
      if (aheadPlats.length > 0) {
        const plat = aheadPlats[Math.floor(Math.random() * aheadPlats.length)];
        const zW = Math.min(90, Math.floor(plat.width * 0.4));
        const zX = plat.x + 25;
        this.bossHazards.push({
          id: Date.now() + Math.random(),
          type: 'danger_zone',
          x: zX,
          y: plat.y,
          width: zW,
          height: 38,
          state: 'telegraph',
          timer: 1.3,
          duration: 1.8
        });
      }
    }
  }

  private clearBossHazards() {
    for (const h of this.bossHazards) {
      this.spawnDust(h.x + h.width / 2, h.y, 6, '#fde047');
    }
    this.bossHazards = [];
  }

  public triggerBossEncounter() {
    if (!this.boss.active && this.state === 'playing') {
      const p = this.player;
      this.boss.active = true;
      this.boss.state = 'warning';
      this.boss.warningTimer = 2.6;
      this.boss.health = 3;
      this.boss.maxHealth = 3;
      this.boss.chaseDistance = 0;
      this.boss.escapeGoal = 200;
      this.boss.name = 'GorgonX';
      this.boss.width = 96;
      this.boss.height = 92;
      this.boss.x = p.x - 240;
      this.boss.y = 470 - this.boss.height;
      this.boss.vx = p.vx > 0 ? p.vx : 5.8;
      this.boss.vy = 0;
      this.boss.hazardTimer = 1.6;
      this.boss.roarTimer = 0;
      this.boss.hazardTheme = 'mixed';
      this.bossHazards = [];
      this.camera.targetZoom = 0.83;
      sound.playBossWarning();
      this.showNotification('⚠️ GORGONX APPROACHING!', 'GorgonX is on the hunt! Outrun the beast & avoid hazards!', '#ef4444', 3.2);
    }
  }

  public render() {
    this.updateDpr();
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.scale(this.dpr, this.dpr);

    // Apply 2D side-scrolling camera view (native 1:1 crisp platformer view with gentle vertical offset)
    this.ctx.save();
    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;

    this.ctx.translate(shakeX, shakeY - this.camera.y);

    drawBackground(this.ctx, this.camera.x, this.clouds, this.hills, this.trees, this.currentBiome);
    drawCheckpoints(this.ctx, this.camera.x, this.checkpoints);
    drawPlatforms(this.ctx, this.camera.x, this.platforms, this.springs);
    drawBossHazards(this.ctx, this.camera.x, this.bossHazards);
    drawCoins(this.ctx, this.camera.x, this.coins);
    drawPowerUps(this.ctx, this.camera.x, this.powerups, this.platforms);
    drawEnemies(this.ctx, this.camera.x, this.enemies, this.platforms);
    drawBoss(this.ctx, this.camera.x, this.boss, this.camera.y);
    drawJiro(this.ctx, this.camera.x, this.player, this.platforms);
    renderParticles(this.ctx, this.camera.x, this.particles);

    this.ctx.restore(); // Restore world camera transform

    // HUD and Screens rendered on screen space for crisp, unscaled overlay
    if (this.state === 'playing' || this.state === 'paused') {
      drawHUD(this.ctx, this.player, this.notifications, this.boss, this.currentBiome);
    }

    if (this.state === 'start') drawStartScreen(this.ctx, this.runStats, this.coinBank);
    else if (this.state === 'shop') drawShopScreen(this.ctx, this.coinBank, this.upgrades, this.shopMessage);
    else if (this.state === 'controls') drawControlsScreen(this.ctx);
    else if (this.state === 'settings') drawSettingsScreen(this.ctx, sound.enabled, this.runStats, this.settingsResetConfirm);
    else if (this.state === 'paused') drawPauseScreen(this.ctx);
    else if (this.state === 'gameover') drawGameOverScreen(this.ctx, this.player, this.runStats, this.coinBank);
    else if (this.state === 'victory') drawVictoryScreen(this.ctx, this.player, this.coinBank);

    this.ctx.restore();
  }

  public handleCanvasClick(mx: number, my: number) {
    sound.init();
    const inBox = (bx: number, by: number, bw: number, bh: number) =>
      mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;

    if (this.state === 'start') {
      if (inBox(GAME_W / 2 - 130, 304, 260, 46)) {
        this.resetGame();
        this.state = 'playing';
      } else if (inBox(GAME_W / 2 - 130, 356, 260, 42)) {
        this.shopMessage = '';
        this.state = 'shop';
      } else if (inBox(GAME_W / 2 - 130, 404, 260, 42)) {
        this.state = 'controls';
      } else if (inBox(GAME_W / 2 - 130, 452, 260, 40)) {
        this.settingsResetConfirm = false;
        this.state = 'settings';
      }
    } else if (this.state === 'shop') {
      const costs: Record<keyof PlayerUpgrades, number[]> = {
        speed: [100, 250, 500, 800],
        jump: [100, 250, 500, 800],
        magnet: [150, 300, 600, 900],
        shield: [200, 400, 750, 1000]
      };
      const items: Array<{ key: keyof PlayerUpgrades; title: string }> = [
        { key: 'speed', title: 'SPEED ACCELERATOR' },
        { key: 'jump', title: 'SUPER SPRING JUMP' },
        { key: 'magnet', title: 'COIN MAGNET RADIUS' },
        { key: 'shield', title: 'SHIELD GENERATOR' }
      ];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const cardY = 136 + idx * 76;
        const cardW = 760;
        const cardH = 68;
        const cardX = GAME_W / 2 - cardW / 2;
        const btnW = 140;
        const btnH = 42;
        const btnX = cardX + cardW - btnW - 14;
        const btnY = cardY + 13;

        if (inBox(btnX, btnY, btnW, btnH) || inBox(cardX, cardY, cardW, cardH)) {
          const currentLevel = this.upgrades[item.key];
          if (currentLevel >= 4) {
            this.shopMessage = `★ ${item.title} is already MAXED!`;
            sound.playHurt();
            return;
          }
          const cost = costs[item.key][currentLevel];
          if (this.coinBank >= cost) {
            this.coinBank -= cost;
            this.upgrades[item.key]++;
            this.saveUpgrades();
            sound.playExtraLife();
            this.shopMessage = `✓ ${item.title} upgraded to Level ${this.upgrades[item.key]}!`;
          } else {
            sound.playHurt();
            this.shopMessage = `Need 🪙 ${cost - this.coinBank} more coins for ${item.title}!`;
          }
          return;
        }
      }

      if (inBox(GAME_W / 2 - 110, 474, 220, 44)) {
        this.shopMessage = '';
        this.state = 'start';
      }
    } else if (this.state === 'controls') {
      if (inBox(GAME_W / 2 - 110, 468, 220, 44)) {
        this.state = 'start';
      }
    } else if (this.state === 'settings') {
      const cW = 520;
      const startY = 130;
      const btnX = GAME_W / 2 + cW / 2 - 170;
      if (inBox(btnX, startY + 16, 146, 44)) {
        sound.enabled = !sound.enabled;
      } else if (inBox(btnX, startY + 92 + 16, 146, 44)) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (inBox(btnX, startY + 184 + 16, 146, 44)) {
        if (!this.settingsResetConfirm) {
          this.settingsResetConfirm = true;
        } else {
          this.runStats = { bestScore: 0, bestDistance: 0, bestCoins: 0, totalRuns: 0 };
          try {
            localStorage.removeItem('jiro_speed_adventure_stats');
          } catch {}
          this.settingsResetConfirm = false;
        }
      } else if (inBox(GAME_W / 2 - 110, 465, 220, 44)) {
        this.settingsResetConfirm = false;
        this.state = 'start';
      }
    } else if (this.state === 'paused') {
      if (inBox(GAME_W / 2 - 120, 185, 240, 48)) {
        this.state = 'playing';
      } else if (inBox(GAME_W / 2 - 120, 245, 240, 44)) {
        this.state = 'controls';
      } else if (inBox(GAME_W / 2 - 120, 301, 240, 44)) {
        this.resetGame();
        this.state = 'playing';
      } else if (inBox(GAME_W / 2 - 120, 357, 240, 44)) {
        this.state = 'start';
      }
    } else if (this.state === 'gameover') {
      if (inBox(GAME_W / 2 - 130, 282, 260, 48)) {
        this.resetGame();
        this.state = 'playing';
      } else if (inBox(GAME_W / 2 - 130, 340, 260, 44)) {
        this.shopMessage = '';
        this.state = 'shop';
      } else if (inBox(GAME_W / 2 - 130, 396, 260, 44)) {
        this.state = 'start';
      }
    } else if (this.state === 'victory') {
      if (inBox(GAME_W / 2 - 130, 345, 260, 48)) {
        this.resetGame();
        this.state = 'playing';
      } else if (inBox(GAME_W / 2 - 130, 403, 260, 44)) {
        this.shopMessage = '';
        this.state = 'shop';
      } else if (inBox(GAME_W / 2 - 130, 457, 260, 42)) {
        this.state = 'start';
      }
    }
  }

  public start() {
    this.lastTime = performance.now();
    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
      this.lastTime = currentTime;

      this.update(dt);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
