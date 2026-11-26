/**
 * Part definitions. A top is assembled from a core, battle ring, weight
 * disc and performance tip. Parts carry both their physical contribution
 * and the procedural-model style used by the renderer. In v0.1 each starter
 * top has fixed parts; the separation exists so interchangeable equipment
 * can be added later without engine changes.
 *
 * All physical values here are PROVISIONAL tuning values (SI units).
 */

export type TipShape = 'flat' | 'ball' | 'sharp' | 'semi-flat';

export interface TipPart {
  id: string;
  name: string;
  shape: TipShape;
  /** Contact offset scale for spin→movement coupling, m. */
  driveRadius: number;
  /** Sliding friction coefficient (traction). */
  traction: number;
  /** Pivot friction coefficient. */
  spinFriction: number;
  /** Pivot contact patch radius, m. */
  spinRadius: number;
  /** Resting rocking tilt at full spin, rad. */
  rock: number;
  /**
   * Base gyroscopic stability contributed by the tip shape (v0.3 ruleset;
   * weight adds a small amount on top). Not used by the v0.2 ruleset.
   */
  stability?: number;
  /** v0.3 pivot friction coefficient, if different from v0.2 (`spinFriction`). */
  spinFrictionV03?: number;
  /** Visual: tip contact radius and length, m. */
  visualRadius: number;
  visualLength: number;
}

export type RingStyle = 'jagged' | 'armored' | 'smooth' | 'winged';

export interface RingPart {
  id: string;
  name: string;
  style: RingStyle;
  /** Outer (collision) radius, m. */
  radius: number;
  /** Multiplier on contact friction from the attack stat. */
  frictionFactor: number;
  /** Blade strike factor: share of ring surface speed turned into strike impulse. */
  strike: number;
  /** v0.3 blade strike factor, if different from v0.2 (`strike`). */
  strikeV03?: number;
  /** Number of blades / lobes for the procedural model. */
  lobes: number;
}

export interface DiscPart {
  id: string;
  name: string;
  /** Radius of gyration contributed by mass distribution, m. */
  gyration: number;
  /** Visual radius, m. */
  radius: number;
  style: 'spoked' | 'solid' | 'rimmed' | 'notched';
}

export interface CorePart {
  id: string;
  name: string;
  emblem: 'flame' | 'shield' | 'leaf' | 'crescent';
}

export const TIPS: Record<string, TipPart> = {
  'rush-flat': {
    id: 'rush-flat',
    stability: 0.45,
    name: 'Rush Flat',
    shape: 'flat',
    driveRadius: 0.006,
    traction: 0.55,
    spinFriction: 0.16,
    spinRadius: 0.0011,
    rock: 0.12,
    visualRadius: 0.0055,
    visualLength: 0.011,
  },
  'bastion-ball': {
    id: 'bastion-ball',
    stability: 0.6,
    name: 'Bastion Ball',
    shape: 'ball',
    driveRadius: 0.003,
    traction: 0.28,
    spinFriction: 0.2,
    spinRadius: 0.0007,
    rock: 0.03,
    visualRadius: 0.0045,
    visualLength: 0.01,
  },
  'needle-point': {
    id: 'needle-point',
    stability: 0.55,
    name: 'Needle Point',
    shape: 'sharp',
    driveRadius: 0.0012,
    traction: 0.12,
    spinFriction: 0.2,
    spinRadius: 0.0005,
    rock: 0.012,
    visualRadius: 0.0012,
    visualLength: 0.012,
  },
  'vector-semi': {
    id: 'vector-semi',
    stability: 0.55,
    name: 'Vector Semi-Flat',
    shape: 'semi-flat',
    driveRadius: 0.0035,
    traction: 0.4,
    spinFriction: 0.22,
    spinRadius: 0.0007,
    rock: 0.06,
    visualRadius: 0.0038,
    visualLength: 0.011,
  },
};

export const RINGS: Record<string, RingPart> = {
  'blaze-fang': { id: 'blaze-fang', name: 'Blaze Fang', style: 'jagged', radius: 0.025, frictionFactor: 1.25, strike: 0.014, lobes: 6 },
  'aegis-wall': { id: 'aegis-wall', name: 'Aegis Wall', style: 'armored', radius: 0.026, frictionFactor: 0.7, strike: 0.004, lobes: 8 },
  'zephyr-halo': { id: 'zephyr-halo', name: 'Zephyr Halo', style: 'smooth', radius: 0.0245, frictionFactor: 0.6, strike: 0.002, lobes: 12 },
  'eclipse-wing': { id: 'eclipse-wing', name: 'Eclipse Wing', style: 'winged', radius: 0.025, frictionFactor: 1, strike: 0.008, lobes: 4 },
};

export const DISCS: Record<string, DiscPart> = {
  'spoke-6': { id: 'spoke-6', name: 'Spoke Six', gyration: 0.0158, radius: 0.019, style: 'spoked' },
  'heavy-solid': { id: 'heavy-solid', name: 'Heavy Solid', gyration: 0.017, radius: 0.0205, style: 'solid' },
  'outer-rim': { id: 'outer-rim', name: 'Outer Rim', gyration: 0.0188, radius: 0.0215, style: 'rimmed' },
  'notch-8': { id: 'notch-8', name: 'Notch Eight', gyration: 0.0168, radius: 0.0198, style: 'notched' },
};

export const CORES: Record<string, CorePart> = {
  'core-flame': { id: 'core-flame', name: 'Flame Core', emblem: 'flame' },
  'core-shield': { id: 'core-shield', name: 'Shield Core', emblem: 'shield' },
  'core-leaf': { id: 'core-leaf', name: 'Leaf Core', emblem: 'leaf' },
  'core-crescent': { id: 'core-crescent', name: 'Crescent Core', emblem: 'crescent' },
};
