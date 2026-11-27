/**
 * Effective physical parameters of one top, in internal SI units
 * (see units.ts). These are produced from gameplay stats + part definitions
 * by `src/content/derive.ts` and may then be overridden by developer
 * controls. A future equipment system will modify these values before they
 * reach the engine; the engine itself never reads gameplay stats.
 */
export interface TopPhysicsParams {
  /** Mass, kg. */
  mass: number;
  /** Circular collision radius (battle ring outer radius), m. */
  radius: number;
  /** Radius of gyration about the spin axis, m. I = mass · gyration². */
  gyration: number;
  /** Height of the centre of mass above the tip contact, m. */
  comHeight: number;
  /** Height above the floor at which the battle ring makes contact, m. */
  contactHeight: number;

  /**
   * Effective tip contact radius used for drive coupling, m. A wider tip
   * moves its contact point further from the spin axis when the top leans
   * relative to the surface, converting more spin into lateral motion.
   */
  tipDriveRadius: number;
  /**
   * Rate at which the spin axis settles toward the local surface normal,
   * 1/s. Lower = more gyroscopic lag = stronger drive when crossing slopes.
   */
  axisSettleRate: number;
  /** Tip–floor sliding friction coefficient (traction). */
  tipTraction: number;
  /** Tip pivot (spinning) friction coefficient. */
  tipSpinFriction: number;
  /** Effective radius of the tip contact patch for spinning friction, m. */
  tipSpinRadius: number;
  /** Aerodynamic/bearing spin drag coefficient, N·m·s/rad. */
  airDrag: number;
  /** Multiplier on all passive rotational-energy decay (1 = nominal). */
  spinDecay: number;
  /** Translational rolling resistance, 1/s. */
  rollingResistance: number;

  /** 0–1. Raises the critical spin threshold less, damps wobble faster, resists tilt kicks. */
  stability: number;
  /**
   * Resting axis tilt at full spin, rad. Wide/grippy tips rock more; this
   * tilt precesses and makes the drive direction swing, producing looping
   * paths.
   */
  baseWobble: number;
  /** Scale of wobble growth as spin approaches the critical speed, rad. */
  wobbleIntensity: number;

  /** Per-top restitution factor (multiplied with the global collision restitution). */
  restitution: number;
  /** Battle-ring contact friction coefficient. */
  contactFriction: number;
  /**
   * Fraction of the ring's tangential surface speed converted into a
   * separating "strike" impulse when a new contact begins. Models ring
   * protrusions (blades, teeth) that circular collision shapes otherwise
   * cannot represent. The energy for the strike is taken from spin.
   */
  ringStrike: number;
  /**
   * 0–1: how much of an attacker's blade strike this top's ring surface
   * exposes (v0.3). Smooth, rounded rings deflect blades (low), jagged or
   * winged rings give blades something to catch (≈1). Scales the attacker's
   * rotational (blade) damage term only; impulses are unaffected.
   * Optional: undefined = 1 (v0.2 behaviour).
   */
  bladeExposure?: number;
  /**
   * ≥ 0 (v0.3.1): multiplier on the rotational energy this top loses in
   * impacts. A deflective ring that glances hits scrubs spin on the sliding
   * contact (>1), the price of its structural protection. Optional: undefined = 1.
   */
  impactSpinLossFactor?: number;
  /**
   * >0 (v0.3.1): scales the severity ceiling of hits TAKEN by this top.
   * A rounded, energy-absorbing ring flattens the worst impacts (low) while
   * barely changing glancing or moderate ones. Optional: undefined = 1.
   */
  damageCapFactor?: number;
  /**
   * v0.4.1 contact wander, rad (RMS). The tip's contact orientation is never
   * perfectly steady: tip micro-chatter, precession irregularities and
   * small surface defects shift where (and how far off-axis) the tip touches
   * the floor. Modelled as a smooth, seeded, bounded variation of the contact
   * lean. Because the tip drive is still Coulomb friction opposing slip, it
   * only redirects motion that spin pays for; it never adds energy.
   * Flat tips wander most (restless, sweeping), needles least. Optional:
   * undefined/0 = no wander (v0.4.0).
   */
  contactWander?: number;
  /**
   * v0.4.1: growth of contact wander as spin runs down,
   * amplitude × (1 + gain·(ω_crit/ω)²). Optional, default 0.
   */
  wanderSpinGain?: number;
  /** Scales how much rotational energy this top strips from an opponent on impact. */
  impactSpinDrain: number;
  /** 0–1 fraction of impact spin loss this top ignores. */
  impactSpinResist: number;

  /**
   * v0.5 Directional Boost authority (dimensionless, 1 = nominal): how
   * strongly the tip can dig in and push off. Derived from Speed only (the
   * single place Speed touches Boost). Scales the boost impulse; Δv then
   * follows from the mass. Optional: undefined = 1.
   */
  boostPower?: number;
  /** +1 = right spin (counter-clockwise from above), −1 = left spin. */
  spinDirection: 1 | -1;
  /** Launch rotational kinetic energy, J. */
  launchSpinEnergy: number;
  /** Launch translational speed, m/s. */
  launchSpeed: number;
}

export function inertiaOf(p: TopPhysicsParams): number {
  return p.mass * p.gyration * p.gyration;
}
