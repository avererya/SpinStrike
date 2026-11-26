import type { TopPhysicsParams } from './topParams';
import { DEFAULT_TOP_COMBAT, type FinishKind, type TopCombatStats } from './combat';
import { inertiaOf } from './topParams';
import { GRAVITY } from './units';

/**
 * Mutable simulation state for a single top. Plain numeric fields (no
 * vector objects) keep the physics loop allocation-free.
 */
export class TopBody {
  // --- translational state ---
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Previous fixed-step position, for render interpolation. */
  px = 0;
  py = 0;

  // --- rotational state ---
  /** Spin angle about the top's own axis, rad (wrapped to [0, 2π)). */
  angle = 0;
  prevAngle = 0;
  /** Signed angular velocity about the axis, rad/s. */
  omega = 0;

  // --- tilt / wobble state ---
  /** Tilt magnitude of the spin axis away from vertical, rad. */
  tilt = 0;
  /** Direction the axis leans toward (precession phase), rad. */
  tiltPhase = 0;
  /**
   * Slow "settling" lean of the axis (horizontal vector, rad) that lags
   * behind the local surface normal. The difference between the surface
   * lean and this settled lean is what offsets the tip contact.
   */
  leanX = 0;
  leanY = 0;

  // --- derived constants ---
  readonly inertia: number;
  readonly invMass: number;
  readonly invInertia: number;
  /** Spin speed below which the top can no longer stay upright, rad/s. */
  readonly criticalSpin: number;
  /** Effective centre-of-mass height after stability adjustment, m. */
  readonly effectiveComHeight: number;
  /** Rotational energy at the critical (toppling) spin, J. */
  readonly criticalEnergy: number;

  // --- bookkeeping ---
  launchEnergy = 0;
  spinning = true;
  /** Simulation step on which the top stopped spinning (−1 while spinning). */
  stoppedStep = -1;
  collisions = 0;
  wallHits = 0;
  maxSpeed = 0;
  /** Count of numerical-guard interventions (should stay 0). */
  guardTrips = 0;
  /** Cumulative impact energy received, J. */
  impactEnergyReceived = 0;

  // --- combat (v0.2) ---
  /** Structural integrity. Independent of rotational energy (stamina). */
  health: number;
  damageDealt = 0;
  damageReceived = 0;
  /** Damaging impacts in which this top dealt damage. */
  hitsLanded = 0;
  /** Largest single damaging hit this top dealt. */
  strongestHit = 0;
  /** True when {@link strongestHit} was a critical hit. */
  strongestHitCritical = false;
  // --- critical hits (v0.3) ---
  critsLanded = 0;
  /** Impacts in which this top dealt any damage (> 0), i.e. critical-hit roll opportunities. */
  damagingHits = 0;
  critsReceived = 0;
  /** Total damage dealt by this top's critical hits (applied health loss). */
  critDamageDealt = 0;
  /** Set when the top burst or was knocked out (it then leaves active physics). */
  eliminated: Exclude<FinishKind, 'spin'> | null = null;
  eliminatedStep = -1;
  /** Index of the top that caused the burst (−1 = none). */
  finishSource = -1;
  /** Burst: damage of the decisive hit. Knockout: upward exit speed, m/s. */
  finishIntensity = 0;
  /** Direction of the decisive impact / exit (unit vector, sim plane). */
  finishDirX = 0;
  finishDirY = 0;
  /** Step of the most recent damaging top–top impact and its Δv (for rim lift). */
  lastImpactStep = -1e9;
  lastImpactDv = 0;
  readonly combat: TopCombatStats;

  constructor(
    readonly index: number,
    readonly params: TopPhysicsParams,
    combat: TopCombatStats = DEFAULT_TOP_COMBAT,
  ) {
    this.combat = { ...combat };
    this.health = Math.max(0, combat.maxHealth);
    this.inertia = inertiaOf(params);
    this.invMass = 1 / params.mass;
    this.invInertia = 1 / this.inertia;
    // Higher stability lowers the effective centre of mass (0.5×–1.5×).
    this.effectiveComHeight = params.comHeight * (1.5 - params.stability);
    // Classic "sleeping top" stability criterion: ω² > 4·m·g·l·I⊥ / I².
    const l = this.effectiveComHeight;
    const iPerp = 0.5 * this.inertia + params.mass * l * l;
    this.criticalSpin = Math.sqrt(4 * params.mass * GRAVITY * l * iPerp) / this.inertia;
    this.criticalEnergy = 0.5 * this.inertia * this.criticalSpin * this.criticalSpin;
  }

  /** Health as a fraction of maximum (0–1). */
  get healthFraction(): number {
    return this.combat.maxHealth > 0 ? Math.max(0, Math.min(1, this.health / this.combat.maxHealth)) : 0;
  }

  /** True while the top is still a physical participant (not burst / knocked out). */
  get active(): boolean {
    return this.eliminated === null;
  }

  get speed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  /** Current rotational kinetic energy, J. */
  get spinEnergy(): number {
    return 0.5 * this.inertia * this.omega * this.omega;
  }

  /** Rotational energy remaining as a fraction of launch energy (0–1). */
  get spinFraction(): number {
    return this.launchEnergy > 0 ? this.spinEnergy / this.launchEnergy : 0;
  }

  /**
   * Usable stamina (0–1): rotational energy above the toppling threshold,
   * relative to the energy actually launched (launch bonus included).
   * 1 at launch, exactly 0 when the top can no longer stay upright. This is
   * what the HUD stamina bar and result statistics show (v0.3).
   */
  get staminaFraction(): number {
    if (!this.spinning) return 0;
    const span = this.launchEnergy - this.criticalEnergy;
    if (!(span > 0)) return 0;
    const f = (this.spinEnergy - this.criticalEnergy) / span;
    return f > 1 ? 1 : f > 0 ? f : 0;
  }

  get tiltX(): number {
    return this.tilt * Math.cos(this.tiltPhase);
  }

  get tiltY(): number {
    return this.tilt * Math.sin(this.tiltPhase);
  }

  /** Set the tilt from a horizontal tilt vector. */
  setTiltVector(tx: number, ty: number): void {
    const t = Math.sqrt(tx * tx + ty * ty);
    if (t > 1e-9) this.tiltPhase = Math.atan2(ty, tx);
    this.tilt = t;
  }

  /** Removes up to `energy` joules of rotational energy without flipping spin direction. */
  removeSpinEnergy(energy: number): void {
    if (energy <= 0) return;
    const e = Math.max(0, this.spinEnergy - energy);
    const mag = Math.sqrt((2 * e) / this.inertia);
    this.omega = this.omega >= 0 ? mag : -mag;
  }
}
