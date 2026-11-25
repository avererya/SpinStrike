import type { TopPhysicsParams } from './topParams';
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
  /** Cumulative impact energy received (for future damage systems), J. */
  impactEnergyReceived = 0;

  constructor(
    readonly index: number,
    readonly params: TopPhysicsParams,
  ) {
    this.inertia = inertiaOf(params);
    this.invMass = 1 / params.mass;
    this.invInertia = 1 / this.inertia;
    // Higher stability lowers the effective centre of mass (0.5×–1.5×).
    this.effectiveComHeight = params.comHeight * (1.5 - params.stability);
    // Classic "sleeping top" stability criterion: ω² > 4·m·g·l·I⊥ / I².
    const l = this.effectiveComHeight;
    const iPerp = 0.5 * this.inertia + params.mass * l * l;
    this.criticalSpin = Math.sqrt(4 * params.mass * GRAVITY * l * iPerp) / this.inertia;
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
