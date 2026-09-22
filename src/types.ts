export type GameState = 'start' | 'controls' | 'playing' | 'paused' | 'gameover' | 'victory' | 'shop' | 'settings';

export type BiomeType = 'meadow' | 'coastal' | 'cave' | 'mountain' | 'forest';

export interface PlayerUpgrades {
  speed: number;
  jump: number;
  magnet: number;
  shield: number;
}

export type NPCType = 'mira' | 'bolt' | 'nova';

export interface NPC {
  id: number;
  type: NPCType;
  x: number;
  y: number;
  width: number;
  height: number;
  dialogue: string;
  name: string;
  animTimer: number;
  facingRight: boolean;
  pointedDirection?: 'up' | 'right' | 'up-right';
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  accel: number;
  friction: number;
  maxSpeed: number;
  gravity: number;
  jumpForce: number;
  isGrounded: boolean;
  facingRight: boolean;
  runFrame: number;
  invulnerableTimer: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  lives: number;
  score: number;
  coins: number;
  timeElapsed: number;
  distance: number;
  respawnX: number;
  respawnY: number;
  // Power-up states
  speedBoostTimer: number;
  shield: boolean;
  coinMagnetTimer: number;
  superJumpTimer: number;
}

export type PowerUpType = 'speed' | 'shield' | 'life' | 'magnet' | 'jump';

export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  animOffset: number;
}

export interface GameNotification {
  text: string;
  subtext?: string;
  color: string;
  timer: number;
  maxTimer: number;
  y: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ground' | 'platform';
  moving?: boolean;
  originX?: number;
  originY?: number;
  range?: number;
  dir?: number;
  speed?: number;
  biome?: BiomeType;
}

export interface Spring {
  x: number;
  y: number;
  width: number;
  height: number;
  power: number;
}

export interface Checkpoint {
  id: number;
  x: number;
  y: number;
  reached: boolean;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  animOffset: number;
}

export type EnemyType = 'sprout' | 'bumble' | 'crawler' | 'chonker' | 'hopper' | 'starstrider';

export interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  minX: number;
  maxX: number;
  alive: boolean;
  squishTimer: number;
  animFrame: number;
  originY: number;
  jumpCooldown?: number;
}

export interface Boss {
  active: boolean;
  state: 'idle' | 'warning' | 'chasing' | 'escaped' | 'defeated';
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  animFrame: number;
  warningTimer: number;
  chaseDistance: number;
  escapeGoal: number;
  hitCooldown: number;
  name: string;
  roarTimer?: number;
  hazardTimer?: number;
  hazardTheme?: 'spikes' | 'tremors' | 'barriers' | 'mixed';
  footstepTimer?: number;
}

export type BossHazardType = 'ground_spikes' | 'falling_debris' | 'moving_barrier' | 'danger_zone';

export interface BossHazard {
  id: number;
  type: BossHazardType;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'telegraph' | 'active' | 'cooldown' | 'done';
  timer: number;
  duration: number;
  targetY?: number;
  vy?: number;
  vx?: number;
  minX?: number;
  maxX?: number;
  color?: string;
  cleared?: boolean;
}

export interface RunStats {
  bestDistance: number;
  bestScore: number;
  bestCoins: number;
  totalRuns: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  decay: number;
}

export interface SceneryItem {
  x: number;
  y: number;
  radius?: number;
  height?: number;
  width?: number;
  speed?: number;
  color?: string;
  type?: number;
}

export interface FinishFlag {
  x: number;
  y: number;
  width: number;
  height: number;
  reached: boolean;
}

