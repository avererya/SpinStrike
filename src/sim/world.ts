import { TopBody } from './body';
import type { TopPhysicsParams } from './topParams';
import type { StadiumSurface } from './stadium/types';
import { Rng } from './rng';
import { integrateFree, guardBody } from './dynamics';
import { resolveTopPair, resolveWall, wallImpact, type CollisionEvent, type CollisionParams, type ContactState } from './collision';
import { LIMITS } from './units';
import {
  DEFAULT_COMBAT,
  applyContactDamage,
  makeContactReport,
  makeDamageEvent,
  makePairState,
  rimEscape,
  updatePairArming,
  type CombatParams,
  type ContactReport,
  type DamageEvent,
  type PairCombatState,
  type TopCombatStats,
} from './combat';

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
  /** Combat parameters (v0.2). Defaults to DEFAULT_COMBAT. */
  combat?: CombatParams;
  /** Per-top combat stats, same order as `tops`. Defaults to DEFAULT_TOP_COMBAT. */
  topCombat?: readonly TopCombatStats[];
  /**
   * Per-top launch rotational-energy multipliers from launch quality (v0.3).
   * Default 1. The multiplier scales ENERGY; ω follows from ω = √(2E/I).
   */
  launchEnergyMultipliers?: readonly number[];
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
const MAX_PENDING_DAMAGE = 32;

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
  readonly combatParams: CombatParams;
  readonly stepHz: number;
  /** When false, no damage or knockouts are applied (set once a battle is decided). */
  combatEnabled = true;
  /**
   * Spin-finish resolution phase (v0.3 draw window): when true, a top that
   * has stopped spinning takes no further part in top–top contact, so the
   * window measures only the survivor's legitimate remaining endurance.
   */
  excludeStoppedFromContact = false;
  /** Damaging top–top impacts so far; keys the critical-hit rolls. */
  impactCount = 0;
  steps = 0;
  readonly stats: StepStats = { steps: 0, substepsLast: 0, substepsTotal: 0, maxSubsteps: 0, pendingEvents: 0 };
  /** Collision events since last `drainEvents()` (bounded). */
  private pending: CollisionEvent[] = [];
  private readonly contacts: ContactState[] = [];
  private readonly pairCombat: PairCombatState[] = [];
  private readonly report: ContactReport = makeContactReport();
  private readonly damageScratch: DamageEvent = makeDamageEvent();
  private pendingDamage: DamageEvent[] = [];
  private readonly minRadius: number;
  private readonly slopeOut = { x: 0, y: 0 };

  constructor(opts: WorldOptions) {
    this.stadium = opts.stadium;
    this.dt = 1 / opts.stepHz;
    this.seed = opts.seed >>> 0;
    this.collision = opts.collision;
    this.combatParams = opts.combat ?? DEFAULT_COMBAT;
    this.stepHz = opts.stepHz;
    this.bodies = opts.tops.map((p, i) => new TopBody(i, p, opts.topCombat?.[i]));
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.contacts.push({ touching: false });
        this.pairCombat.push(makePairState());
      }
    }
    this.minRadius = Math.min(...this.bodies.map((b) => b.params.radius));
    this.launch(opts.launch, opts.launchEnergyMultipliers);
  }

  /** Places and launches tops using seeded randomness. */
  private launch(l: LaunchParams, multipliers?: readonly number[]): void {
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
      const m = multipliers?.[b.index];
      const mult = typeof m === 'number' && Number.isFinite(m) && m > 0 ? m : 1;
      // Launch quality scales rotational ENERGY (not ω): E = E₀·(1 ± spread)·q.
      const energy = p.launchSpinEnergy * (1 + rng.spread(l.powerSpread)) * mult;
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

    const cp = this.combatParams;
    const w = this.collision.statSpinDrainWeight;
    for (let s = 0; s < n; s++) {
      for (const b of bodies) if (b.eliminated === null) integrateFree(b, this.stadium, h);
      let c = 0;
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const A = bodies[i]!;
          const B = bodies[j]!;
          const contact = this.contacts[c]!;
          const pair = this.pairCombat[c++]!;
          // Burst / knocked-out tops have left play: no further contact.
          if (A.eliminated !== null || B.eliminated !== null) continue;
          if (this.excludeStoppedFromContact && (!A.spinning || !B.spinning)) continue;
          const ev = resolveTopPair(A, B, this.collision, contact, this.steps, this.report);
          if (ev) this.pushEvent(ev);
          if (this.combatEnabled) {
            if (applyContactDamage(A, B, this.report, pair, cp, this.steps, this.stepHz, this.damageScratch, this.seed, this.impactCount)) {
              this.impactCount++;
              this.pushDamage({ ...this.damageScratch });
            }
            updatePairArming(A, B, pair, cp);
          }
        }
      }
      for (const b of bodies) {
        if (b.eliminated !== null) continue;
        const ev = resolveWall(b, this.stadium, this.steps, w);
        if (ev) this.pushEvent(ev);
        if (this.combatEnabled && wallImpact.vn > 0) {
          this.stadium.gradient(b.x, b.y, this.slopeOut);
          const slope = Math.sqrt(this.slopeOut.x * this.slopeOut.x + this.slopeOut.y * this.slopeOut.y);
          const vUp = rimEscape(b, wallImpact.vn, slope, this.stadium.wallHeight, this.steps, this.stepHz, cp);
          if (vUp > 0) {
            b.eliminated = 'knockout';
            b.eliminatedStep = this.steps + 1;
            b.finishIntensity = vUp;
            b.finishDirX = wallImpact.nx;
            b.finishDirY = wallImpact.ny;
            // Exit velocity for the presentation: outward speed restored.
            b.vx = wallImpact.nx * wallImpact.vn;
            b.vy = wallImpact.ny * wallImpact.vn;
          }
        }
      }
    }

    this.steps++;
    for (const b of bodies) {
      if (b.eliminated !== null) {
        // Out of play: frozen for the simulation (the presentation animates it).
        b.px = b.x;
        b.py = b.y;
        continue;
      }
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

  private pushDamage(ev: DamageEvent): void {
    if (this.pendingDamage.length >= MAX_PENDING_DAMAGE) this.pendingDamage.shift();
    this.pendingDamage.push(ev);
  }

  /** Returns and clears pending damage events (for effects / damage numbers). */
  drainDamage(): DamageEvent[] {
    const out = this.pendingDamage;
    this.pendingDamage = [];
    return out;
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
