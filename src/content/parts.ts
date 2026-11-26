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
  /**
   * v0.4.1 ruleset tip behaviour (reusable physical properties; any top
   * wearing this tip gets them). Values here replace the v0.3 values above
   * for the v0.4.1 ruleset only, so v0.4.0 battles stay reproducible.
   */
  v041?: {
    driveRadius?: number;
    traction?: number;
    spinFriction?: number;
    spinRadius?: number;
    rock?: number;
    stability?: number;
    /** Translational rolling resistance, 1/s. High = settles toward the centre (ball tips). */
    rollingResistance: number;
    /** RMS contact wander, rad (see TopPhysicsParams.contactWander). */
    contactWander: number;
    /** Growth of contact wander as spin runs down. */
    wanderSpinGain: number;
    /**
     * Rate at which the spin axis re-aligns with the local surface normal,
     * 1/s (gyroscopic self-righting of the tip). High = the tip stops
     * "steering" along the slope and the top recovers to the centre.
     */
    axisSettleRate?: number;
  };
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
  /** v0.3: share of an opposing blade strike this ring's surface exposes (0–1, default 1). */
  bladeExposure?: number;
  /** v0.3.1: multiplier on impact spin loss of the wearer (default 1). Deflective profiles scrub spin (>1). */
  impactSpinLossFactor?: number;
  /** v0.3.1: scales the severity ceiling of hits taken (default 1). Low = the hardest impacts are flattened. */
  damageCapFactor?: number;
  /** Number of blades / lobes for the procedural model. */
  lobes: number;
  /** v0.4.1 ruleset overrides of this ring's physical values. */
  v041?: { frictionFactor?: number; strike?: number; bladeExposure?: number; impactSpinLossFactor?: number; damageCapFactor?: number };
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
    spinFrictionV03: 0.1,
    spinRadius: 0.0011,
    rock: 0.12,
    visualRadius: 0.0055,
    visualLength: 0.011,
    v041: { rollingResistance: 0.05, contactWander: 0.04, wanderSpinGain: 1 },
  },
  'bastion-ball': {
    id: 'bastion-ball',
    stability: 0.64,
    name: 'Bastion Ball',
    shape: 'ball',
    driveRadius: 0.003,
    traction: 0.28,
    spinFriction: 0.2,
    spinFrictionV03: 0.238,
    spinRadius: 0.0007,
    rock: 0.03,
    visualRadius: 0.0045,
    visualLength: 0.01,
    v041: { rollingResistance: 0.5, contactWander: 0.04, wanderSpinGain: 0.6, axisSettleRate: 1.5 },
  },
  'needle-point': {
    id: 'needle-point',
    stability: 0.55,
    name: 'Needle Point',
    shape: 'sharp',
    driveRadius: 0.0012,
    traction: 0.12,
    spinFriction: 0.2,
    spinFrictionV03: 0.207,
    spinRadius: 0.0005,
    rock: 0.012,
    visualRadius: 0.0012,
    visualLength: 0.012,
    v041: { rollingResistance: 0.12, contactWander: 0.025, wanderSpinGain: 0.5 },
  },
  'vector-semi': {
    id: 'vector-semi',
    stability: 0.59,
    name: 'Vector Semi-Flat',
    shape: 'semi-flat',
    driveRadius: 0.0035,
    traction: 0.4,
    spinFriction: 0.22,
    spinRadius: 0.0007,
    rock: 0.06,
    visualRadius: 0.0038,
    visualLength: 0.011,
    v041: { rollingResistance: 0.1, contactWander: 0.035, wanderSpinGain: 0.8 },
  },
};

export const RINGS: Record<string, RingPart> = {
  'blaze-fang': { id: 'blaze-fang', name: 'Blaze Fang', style: 'jagged', radius: 0.025, frictionFactor: 1.25, strike: 0.014, strikeV03: 0.0176, lobes: 6 },
  'aegis-wall': { id: 'aegis-wall', name: 'Aegis Wall', style: 'armored', radius: 0.026, frictionFactor: 0.7, strike: 0.004, lobes: 8 },
  'zephyr-halo': {
    id: 'zephyr-halo',
    name: 'Zephyr Halo',
    style: 'smooth',
    radius: 0.0245,
    frictionFactor: 0.6,
    strike: 0.002,
    bladeExposure: 0.37,
    damageCapFactor: 0.45,
    impactSpinLossFactor: 1.5,
    lobes: 12,
    // v0.4.1: weaker structural protection (Tempest must stay vulnerable to
    // aggressive structural damage) and less spin scrub on glancing contact.
    v041: { bladeExposure: 0.55, damageCapFactor: 0.7, impactSpinLossFactor: 1.3 },
  },
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
