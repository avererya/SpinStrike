import { TopBody } from './body';
import type { TopPhysicsParams } from './topParams';
import type { StadiumSurface } from './stadium/types';
import { Rng } from './rng';
import { integrateFree, guardBody } from './dynamics';
import { resolveTopPair, resolveWall, type CollisionEvent, type CollisionParams, type ContactState } from './collision';
import { LIMITS } from './units';

export interface LaunchParams {
  /** Launch distance from the centre as a fraction of stadium radius. */
  radiusFraction: number;
  /** Angle between launch direction and the tangent, toward the centre, rad. */
  inwardAngle: number;
  /** Random spread applied to launch direction, rad (seeded). */
  angleSpread: number;
  /** Relative random spread applied to launch speed and spin (seeded). */
  powerSpread: number;
}

export const DEFAULT_LAUNCH: LaunchParams = {
  radiusFraction: 0.62,
  inwardAngle: 0.35,
  angleSpread: 0.25,
  powerSpread: 0.04,
};

export interface WorldOptions {
  stadium: StadiumSurface;
  tops: readonly TopPhysicsParams[];
  collision: CollisionParams;
  launch: LaunchParams;
  seed: number;
  stepHz: number;
}

export interface StepStats {
  steps: number;
  substepsLast: number;
  substepsTotal: number;
  maxSubsteps: number;
  /** Rolling pending collision events not yet consumed by a presenter. */
  pendingEvents: number;
}

const MAX_PENDING_EVENTS = 64;

/**
 * The physics world: owns top bodies and advances them in fixed steps.
 * Has no knowledge of rendering, DOM, or battle rules.
 */
export class World {
  readonly bodies: TopBody[];
  readonly stadium: StadiumSurface;
  readonly dt: number;
  readonly seed: number;
  readonly collision: CollisionParams;
  steps = 0;
  readonly stats: StepStats = { steps: 0, substepsLast: 0, substepsTotal: 0, maxSubsteps: 0, pendingEvents: 0 };
  /** Collision events since last `drainEvents()` (bounded). */
  private pending: CollisionEvent[] = [];
  private readonly contacts: ContactState[] = [];
  private readonly minRadius: number;

  constructor(opts: WorldOptions) {
    this.stadium = opts.stadium;
    this.dt = 1 / opts.stepHz;
    this.seed = opts.seed >>> 0;
    this.collision = opts.collision;
    this.bodies = opts.tops.map((p, i) => new TopBody(i, p));
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) this.contacts.push({ touching: false });
    }
    this.minRadius = Math.min(...this.bodies.map((b) => b.params.radius));
    this.launch(opts.launch);
  }

  /** Places and launches tops using seeded randomness. */
  private launch(l: LaunchParams): void {
    const rng = new Rng(this.seed);
    const n = this.bodies.length;
    const base = rng.next() * Math.PI * 2;
    const R = this.stadium.boundingRadius;
    for (const b of this.bodies) {
      const p = b.params;
      const a = base + (b.index * Math.PI * 2) / n + rng.spread(0.15);
      const r = R * l.radiusFraction * (1 + rng.spread(0.05));
      b.x = b.px = Math.cos(a) * r;
      b.y = b.py = Math.sin(a) * r;
      // Launch along the direction the tip naturally drives the top around
      // the bowl (counter-clockwise for right spin), angled slightly inward.
      const travelSign = p.spinDirection; // +1 → CCW travel
      const tangent = a + travelSign * Math.PI * 0.5;
      const dir = tangent + travelSign * l.inwardAngle + rng.spread(l.angleSpread);
      const speed = p.launchSpeed * (1 + rng.spread(l.powerSpread));
      b.vx = Math.cos(dir) * speed;
      b.vy = Math.sin(dir) * speed;
      const energy = p.launchSpinEnergy * (1 + rng.spread(l.powerSpread));
      // Right spin is clockwise viewed from above ⇒ negative ω about +z.
      b.omega = -p.spinDirection * Math.sqrt((2 * energy) / b.inertia);
      b.launchEnergy = b.spinEnergy;
      b.angle = b.prevAngle = rng.next() * Math.PI * 2;
      b.tilt = 0.03;
      b.tiltPhase = rng.next() * Math.PI * 2;
    }
  }

  /** Advances the world by exactly one fixed step. */
  step(): void {
    const bodies = this.bodies;
    for (const b of bodies) {
      b.px = b.x;
      b.py = b.y;
      b.prevAngle = b.angle;
    }

    // Choose substeps so no body moves more than ¼ of the smallest radius
    // per substep: prevents tunnelling at high speed.
    let maxDisp = 0;
    for (const b of bodies) maxDisp = Math.max(maxDisp, b.speed * this.dt);
    const n = Math.min(LIMITS.maxSubsteps, Math.max(1, Math.ceil(maxDisp / (0.25 * this.minRadius))));
    const h = this.dt / n;

    for (let s = 0; s < n; s++) {
      for (const b of bodies) integrateFree(b, this.stadium, h);
      let c = 0;
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const ev = resolveTopPair(bodies[i]!, bodies[j]!, this.collision, this.contacts[c++]!, this.steps);
          if (ev) this.pushEvent(ev);
        }
      }
      for (const b of bodies) {
        const ev = resolveWall(b, this.stadium, this.steps);
        if (ev) this.pushEvent(ev);
      }
    }

    this.steps++;
    for (const b of bodies) {
      guardBody(b, this.stadium);
      const sp = b.speed;
      if (sp > b.maxSpeed) b.maxSpeed = sp;
      if (b.spinning && Math.abs(b.omega) <= b.criticalSpin) {
        b.spinning = false;
        b.stoppedStep = this.steps;
      }
    }
    this.stats.steps = this.steps;
    this.stats.substepsLast = n;
    this.stats.substepsTotal += n;
    if (n > this.stats.maxSubsteps) this.stats.maxSubsteps = n;
    this.stats.pendingEvents = this.pending.length;
  }

  get time(): number {
    return this.steps * this.dt;
  }

  private pushEvent(ev: CollisionEvent): void {
    if (this.pending.length >= MAX_PENDING_EVENTS) this.pending.shift();
    this.pending.push(ev);
  }

  /** Returns and clears pending collision events (for effects/debug). */
  drainEvents(): CollisionEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  /** Total mechanical energy (spin + translational + potential), J. Diagnostic. */
  totalEnergy(): number {
    let e = 0;
    for (const b of this.bodies) {
      e += b.spinEnergy + 0.5 * b.params.mass * (b.vx * b.vx + b.vy * b.vy);
      e += b.params.mass * 9.81 * this.stadium.height(b.x, b.y);
    }
    return e;
  }
}
