import { TopBody } from './body';
import type { TopPhysicsParams } from './topParams';
import type { StadiumSurface } from './stadium/types';
import { RNG_STREAM, Rng, keyedUniform } from './rng';
import { integrateFree, guardBody } from './dynamics';
import { resolveTopPair, resolveWall, wallImpact, type CollisionEvent, type CollisionParams, type ContactState } from './collision';
import { LIMITS } from './units';
import { BattleTelemetry } from './telemetry';
import {
  ATTRIBUTION,
  PASSIVE_TACTICS,
  applyBoost,
  braceActive,
  effectiveTactics,
  makeTacticalState,
  validateCommand,
  type AbilityView,
  type BoostParams,
  type BraceParams,
  type TacticalCommand,
  type TacticalEvent,
  type TacticalModifiers,
  type TacticalParams,
  type TacticalState,
  type Validation,
} from './tactics';
import { DEFAULT_AIM, LAUNCH_COMPONENT, clampAim, launchJitter, nominalPlacementAngle, type LaunchAim, type LaunchVariation } from './launchGeometry';
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
  /**
   * v0.4.1 launch model: per-slot independent keyed variation around the
   * aim (see launchGeometry.ts). Undefined = the v0.4.0 launch, exactly.
   */
  variation?: LaunchVariation;
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
  /** Telemetry trace sampling (steps between trace samples, 0 = no trace). Observation only. */
  traceEvery?: number;
  /** Per-slot launch aim (v0.4.1 launch model only). Default DEFAULT_AIM. */
  aims?: readonly (LaunchAim | undefined)[];
  /** v0.5 tactical abilities. Undefined or disabled = v0.4.1 passive combat. */
  tactics?: TacticalParams;
  /** v0.5: per-slot ability modifiers (future equipment). Unused in v0.5. */
  tacticalModifiers?: readonly (TacticalModifiers | undefined)[];
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
const MAX_TACTICAL_EVENTS = 32;
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
  /** Contact / hit / movement telemetry (v0.4.1). Observation only. */
  readonly telemetry: BattleTelemetry;
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
  // --- tactical abilities (v0.5) ---
  readonly tactics: TacticalParams;
  /** Effective ability parameters per slot (base + modifiers). */
  readonly abilityParams: readonly { boost: BoostParams; brace: BraceParams }[];
  /** Live ability state per slot. */
  readonly abilities: readonly TacticalState[];
  /** Every accepted command, in application order (the replay log). */
  readonly commandLog: TacticalCommand[] = [];
  private tacticalEvents: TacticalEvent[] = [];
  /** Whether the current boost of each slot already led to a hit (attribution). */
  private boostHitCounted: boolean[] = [];

  constructor(opts: WorldOptions) {
    this.stadium = opts.stadium;
    this.dt = 1 / opts.stepHz;
    this.seed = opts.seed >>> 0;
    this.collision = opts.collision;
    this.combatParams = opts.combat ?? DEFAULT_COMBAT;
    this.stepHz = opts.stepHz;
    this.bodies = opts.tops.map((p, i) => new TopBody(i, p, opts.topCombat?.[i]));
    this.telemetry = new BattleTelemetry(opts.stepHz, { traceEvery: opts.traceEvery });
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.contacts.push({ touching: false });
        this.pairCombat.push(makePairState());
      }
    }
    this.minRadius = Math.min(...this.bodies.map((b) => b.params.radius));
    this.tactics = opts.tactics ?? PASSIVE_TACTICS;
    this.abilityParams = this.bodies.map((b) => effectiveTactics(this.tactics, opts.tacticalModifiers?.[b.index]));
    this.abilities = this.abilityParams.map((e) => makeTacticalState(e.boost, e.brace));
    this.boostHitCounted = this.bodies.map(() => true);
    if (opts.launch.variation) this.launchV041(opts.launch, opts.launch.variation, opts.launchEnergyMultipliers, opts.aims);
    else this.launch(opts.launch, opts.launchEnergyMultipliers);
  }

  /**
   * v0.4.1 launch: nominal placement from the seed (slots evenly spaced),
   * the slot's aim (heading offset, release tilt), plus independently keyed
   * natural variation per slot. The release tilt leans the axis so that the
   * tip's contact offset drives the top along its heading (a tilted
   * launcher sends a top running sideways off its tip); the drive is paid
   * for by spin through the normal tip-traction coupling in dynamics.ts.
   */
  private launchV041(l: LaunchParams, v: LaunchVariation, multipliers?: readonly number[], aims?: readonly (LaunchAim | undefined)[]): void {
    const n = this.bodies.length;
    const R = this.stadium.boundingRadius;
    const seed = this.seed;
    const C = LAUNCH_COMPONENT;
    for (const b of this.bodies) {
      const p = b.params;
      const i = b.index;
      const aim = clampAim(aims?.[i] ?? DEFAULT_AIM);
      const a = nominalPlacementAngle(seed, i, n) + launchJitter(seed, i, C.position, v.position);
      const r = R * l.radiusFraction * (1 + launchJitter(seed, i, C.radius, v.radius));
      b.x = b.px = Math.cos(a) * r;
      b.y = b.py = Math.sin(a) * r;
      const travelSign = p.spinDirection;
      const tangent = a + travelSign * Math.PI * 0.5;
      const heading = tangent + travelSign * (l.inwardAngle + (aim.direction * Math.PI) / 180) + launchJitter(seed, i, C.heading, v.heading);
      const speed = p.launchSpeed * (1 + launchJitter(seed, i, C.speed, v.speed));
      b.vx = Math.cos(heading) * speed;
      b.vy = Math.sin(heading) * speed;
      const m = multipliers?.[i];
      const mult = typeof m === 'number' && Number.isFinite(m) && m > 0 ? m : 1;
      const energy = p.launchSpinEnergy * (1 + launchJitter(seed, i, C.energy, v.energy)) * mult;
      b.omega = -p.spinDirection * Math.sqrt((2 * energy) / b.inertia);
      b.launchEnergy = b.spinEnergy;
      b.angle = b.prevAngle = ((launchJitter(seed, i, C.spinAngle, 1) + 1) * Math.PI) % (Math.PI * 2);
      b.tilt = Math.max(0.005, (aim.tilt * Math.PI) / 180 + launchJitter(seed, i, C.tilt, v.tilt));
      // Tip drive force ∝ −ω·(ẑ × c): lean the axis 90° from the heading so the drive points along it.
      b.tiltPhase = heading + (b.omega >= 0 ? 1 : -1) * Math.PI * 0.5;
      b.leanX = 0;
      b.leanY = 0;
      // Contact wander: seeded incommensurate frequencies (0.25–1.1 Hz) and phases.
      const f: number[] = [];
      const ph: number[] = [];
      for (let k = 0; k < 6; k++) {
        f.push(2 * Math.PI * (0.25 + 0.85 * keyedUniform(RNG_STREAM.wander, seed, i, k, 1)));
        ph.push(2 * Math.PI * keyedUniform(RNG_STREAM.wander, seed, i, k, 2));
      }
      b.wander = { f, ph };
    }
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
    if (this.tactics.enabled) this.updateBraceFlags();

    // Choose substeps so no body moves more than ¼ of the smallest radius
    // per substep: prevents tunnelling at high speed.
    let maxDisp = 0;
    for (const b of bodies) maxDisp = Math.max(maxDisp, b.speed * this.dt);
    const n = Math.min(LIMITS.maxSubsteps, Math.max(1, Math.ceil(maxDisp / (0.25 * this.minRadius))));
    const h = this.dt / n;

    const cp = this.combatParams;
    const w = this.collision.statSpinDrainWeight;
    let touchedThisStep = false;
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
          const wasTouching = contact.touching;
          const ev = resolveTopPair(A, B, this.collision, contact, this.steps, this.report);
          if (this.report.active) {
            touchedThisStep = true;
            if (!wasTouching) this.telemetry.onContactBegin(this.steps);
          }
          if (ev) this.pushEvent(ev);
          if (this.combatEnabled) {
            const pa = A.bracePrevented;
            const pb = B.bracePrevented;
            if (applyContactDamage(A, B, this.report, pair, cp, this.steps, this.stepHz, this.damageScratch, this.seed, this.impactCount)) {
              this.impactCount++;
              this.telemetry.onDamagingHit(this.steps);
              this.pushDamage({ ...this.damageScratch });
              if (this.tactics.enabled) this.onTacticalHit(A, B, A.bracePrevented - pa, B.bracePrevented - pb);
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
    if (bodies.length >= 2) this.telemetry.onStep(this.steps, bodies[0]!, bodies[1]!, touchedThisStep);
    this.stats.steps = this.steps;
    this.stats.substepsLast = n;
    this.stats.substepsTotal += n;
    if (n > this.stats.maxSubsteps) this.stats.maxSubsteps = n;
    this.stats.pendingEvents = this.pending.length;
  }

  get time(): number {
    return this.steps * this.dt;
  }

  // ------------------------------------------------------- tactical (v0.5)
  /** Sets each body's Brace effect for the step about to run; reports expiries. */
  private updateBraceFlags(): void {
    const t = this.steps;
    for (const b of this.bodies) {
      const st = this.abilities[b.index]!;
      const on = b.eliminated === null && braceActive(st, t);
      const r = this.abilityParams[b.index]!.brace;
      b.braceKnockback = on ? r.knockbackReduction : 0;
      b.braceDamage = on ? r.damageReduction : 0;
      if (st.braceUntilTick === t && st.braceStartTick >= 0) this.pushTactical({ kind: 'brace-end', slot: b.index, tick: t, x: b.x, y: b.y, dirX: 0, dirY: 0, strength: 0, amount: 0 });
    }
  }

  private onTacticalHit(A: TopBody, B: TopBody, prevA: number, prevB: number): void {
    const t = this.steps;
    const r = this.report;
    for (const [body, prev] of [[A, prevA], [B, prevB]] as const) {
      const st = this.abilities[body.index]!;
      if (prev > 0) {
        st.braceImpacts++;
        st.damagePrevented += prev;
        this.pushTactical({ kind: 'brace-impact', slot: body.index, tick: t, x: r.x, y: r.y, dirX: r.nx, dirY: r.ny, strength: 0, amount: prev });
      }
      if (!this.boostHitCounted[body.index] && t - st.lastBoostTick <= ATTRIBUTION.boostToHit * this.stepHz) {
        this.boostHitCounted[body.index] = true;
        st.boostsToHit++;
      }
    }
  }

  /**
   * Validates and, if valid, applies a tactical command on the current tick
   * (between steps). `running` = the battle is in normal combat. Invalid
   * commands change nothing (no charge, no stamina) and are only counted.
   */
  applyCommand(cmd: TacticalCommand, running: boolean): Validation {
    const t = this.steps;
    const b = this.bodies[cmd.slot];
    let v: Validation;
    if (!this.tactics.enabled) v = { ok: false, reason: 'disabled' };
    else if (!b) v = { ok: false, reason: 'slot' };
    else if (cmd.tick !== t) v = { ok: false, reason: 'tick' };
    else v = validateCommand(cmd, b, this.abilities[cmd.slot]!, this.abilityParams[cmd.slot]!, t, running && this.combatEnabled);
    if (!v.ok) {
      if (b) {
        const st = this.abilities[cmd.slot]!;
        st.rejected[v.reason] = (st.rejected[v.reason] ?? 0) + 1;
      }
      return v;
    }
    const st = this.abilities[cmd.slot]!;
    const eff = this.abilityParams[cmd.slot]!;
    const hz = this.stepHz;
    if (cmd.ability === 'boost') {
      const dv = applyBoost(b!, eff.boost, v.strength, v.dirX, v.dirY, v.cost);
      st.boostCharges--;
      st.boostReadyTick = t + Math.round(eff.boost.cooldown * hz);
      st.boostsUsed++;
      st.boostEnergy += v.cost;
      st.boostCostFraction += b!.launchEnergy > 0 ? v.cost / b!.launchEnergy : 0;
      st.boostStrengthSum += v.strength;
      st.lastBoostTick = t;
      st.boostTicks.push(t);
      this.boostHitCounted[cmd.slot] = false;
      this.pushTactical({ kind: 'boost', slot: cmd.slot, tick: t, x: b!.x, y: b!.y, dirX: v.dirX, dirY: v.dirY, strength: v.strength, amount: dv });
    } else {
      if (v.cost > 0) b!.removeSpinEnergy(v.cost);
      st.braceCharges--;
      st.braceStartTick = t;
      st.braceUntilTick = t + Math.max(1, Math.round(eff.brace.duration * hz));
      st.braceReadyTick = t + Math.round(eff.brace.cooldown * hz);
      st.bracesUsed++;
      st.braceTicks.push(t);
      this.pushTactical({ kind: 'brace-start', slot: cmd.slot, tick: t, x: b!.x, y: b!.y, dirX: 0, dirY: 0, strength: 1, amount: 0 });
    }
    // The log keeps the direction exactly as requested (re-normalising an
    // already normalised vector can change the last bit, which would break
    // bit-exact replays) and the strength as applied (clamped).
    this.commandLog.push(Object.freeze(cmd.ability === 'boost' ? { tick: cmd.tick, slot: cmd.slot, ability: cmd.ability, dirX: cmd.dirX, dirY: cmd.dirY, strength: v.strength } : { tick: cmd.tick, slot: cmd.slot, ability: cmd.ability }));
    return v;
  }

  /** Read-only ability view of a slot for HUD / AI (simulation time only). */
  abilityView(slot: number, running = true): AbilityView {
    const st = this.abilities[slot]!;
    const eff = this.abilityParams[slot]!;
    const b = this.bodies[slot]!;
    const t = this.steps;
    const hz = this.stepHz;
    const active = braceActive(st, t);
    const probe = (ability: 'boost' | 'brace') =>
      validateCommand({ tick: t, slot, ability, dirX: 1, dirY: 0, strength: eff.boost.minStrength }, b, st, eff, t, running && this.combatEnabled && this.tactics.enabled);
    const vb = probe('boost');
    const vr = probe('brace');
    const prog = (ready: number, cd: number) => (cd > 0 ? Math.max(0, Math.min(1, 1 - (ready - t) / (cd * hz))) : 1);
    return {
      boostCharges: st.boostCharges,
      braceCharges: st.braceCharges,
      boostCooldown: Math.max(0, (st.boostReadyTick - t) / hz),
      braceCooldown: Math.max(0, (st.braceReadyTick - t) / hz),
      braceRemaining: active ? (st.braceUntilTick - t) / hz : 0,
      braceActive: active,
      boostCooldownProgress: prog(st.boostReadyTick, eff.boost.cooldown),
      braceCooldownProgress: prog(st.braceReadyTick, eff.brace.cooldown),
      boostAvailable: vb.ok,
      braceAvailable: vr.ok,
      boostBlocked: vb.ok ? null : vb.reason,
      braceBlocked: vr.ok ? null : vr.reason,
    };
  }

  private pushTactical(ev: TacticalEvent): void {
    if (this.tacticalEvents.length >= MAX_TACTICAL_EVENTS) this.tacticalEvents.shift();
    this.tacticalEvents.push(ev);
  }

  /** Returns and clears pending tactical presentation events. */
  drainTacticalEvents(): TacticalEvent[] {
    const out = this.tacticalEvents;
    this.tacticalEvents = [];
    return out;
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
