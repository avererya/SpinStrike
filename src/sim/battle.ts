import { World, type WorldOptions } from './world';
import type { FinishKind } from './combat';
import type { TopBody } from './body';
import type { TopLaunch } from './launch';
import { clampAim, type LaunchAim } from './launchGeometry';
import { ATTRIBUTION, type AbilityRequest, type TacticalAgent, type TacticalCommand, type TacticalSummary, type Validation } from './tactics';
import { observe } from './observation';

/**
 * Battle phases:
 *   running    normal combat
 *   resolving  one top has stopped spinning; the draw window is open (v0.3)
 *   finished   the result is frozen
 */
export type BattlePhase = 'running' | 'resolving' | 'finished';

/** Why a draw happened. */
export type DrawReason =
  /** Both tops met an elimination condition on the same physics step. */
  | 'same-step'
  /** Spin finish: the second top stopped within the draw window of the first. */
  | 'near-simultaneous';

export type BattleOutcome =
  | { readonly kind: 'win'; readonly winner: number; readonly loser: number; readonly finish: FinishKind; readonly narrow: boolean }
  | { readonly kind: 'draw'; readonly finishes: readonly FinishKind[]; readonly reason: DrawReason }
  | { readonly kind: 'timeout' };

/** Snapshot of one top at the decisive moment. */
export interface TopResultStats {
  readonly health: number;
  readonly maxHealth: number;
  /**
   * Usable stamina at the decisive moment (0–1): rotational energy above the
   * toppling threshold relative to the energy actually launched. 0 for a top
   * that had stopped. (v0.2 reported raw energy / launch energy, which left
   * ≈0.4 % on a toppled top.)
   */
  readonly stamina: number;
  /** Whether the top was still spinning (upright) at the decisive moment. */
  readonly spinning: boolean;
  readonly damageDealt: number;
  readonly damageReceived: number;
  readonly hitsLanded: number;
  readonly strongestHit: number;
  readonly strongestHitCritical: boolean;
  readonly critsLanded: number;
  readonly critsReceived: number;
  readonly critDamageDealt: number;
  readonly collisions: number;
}

/** Spin-finish draw-window bookkeeping (present when a window was opened). */
export interface DrawWindowInfo {
  /** Window length in whole physics steps (inclusive). */
  readonly windowSteps: number;
  /** Step on which the first top stopped. */
  readonly firstStopStep: number;
  /** Steps between the first and second stop, or null if the survivor kept spinning through the window. */
  readonly secondStopDelaySteps: number | null;
}

export interface BattleResult {
  readonly outcome: BattleOutcome;
  /** Simulation time of the decisive moment, s (for spin finishes: when the first top stopped). */
  readonly time: number;
  /** Physics step of the decisive moment. */
  readonly steps: number;
  readonly seed: number;
  readonly tops: readonly TopResultStats[];
  /** Strongest single damaging hit of the battle (by either top). */
  readonly strongestHit: { readonly damage: number; readonly by: number; readonly critical: boolean };
  /** The launch each top received (quality and energy multiplier). */
  readonly launches: readonly TopLaunch[];
  /** Present when a spin finish opened the draw window. */
  readonly drawWindow: DrawWindowInfo | null;
  /** v0.4.1: launch aim of each top (null under the v0.4.0 launch model, which has no aim). */
  readonly aims: readonly LaunchAim[] | null;
  /** v0.5: tactical ability usage and the replayable command log (null when abilities are off). */
  readonly tactical: TacticalSummary | null;
}

export interface BattleOptions extends WorldOptions {
  /** Maximum simulated duration before a timeout result, s. */
  maxDuration: number;
  /**
   * Near-simultaneous spin-finish window, s (v0.3, default 0 = v0.2 rule:
   * only same-step finishes draw). Counted in simulation steps.
   */
  drawWindow?: number;
  /** Winner usable stamina at or below which a spin win is labelled narrow (presentation only). */
  narrowThreshold?: number;
  /** Launch record of each top (recorded in the result for exact replays). */
  launches?: readonly TopLaunch[];
  /** v0.5: tactical agents per slot (AI); null/undefined = no automatic decisions for that slot. */
  agents?: readonly (TacticalAgent | null | undefined)[];
  /** v0.5: fixed command sequence (replays, reproducible sandbox tests). Applied at each command's tick. */
  script?: readonly TacticalCommand[];
}

/**
 * Deterministic finish classification when ONE top meets several elimination
 * conditions on the same step: burst > knockout > spin. A burst is the
 * decisive structural failure at impact; a knockout requires the top to
 * travel to and over the rim afterwards; a spin finish is the slowest
 * process. (Within a single fixed step this order is a documented rule, not
 * a chronological claim.)
 */
export const FINISH_PRIORITY: readonly FinishKind[] = ['burst', 'knockout', 'spin'];

/** The finish condition a top satisfies right now, or null. */
export function finishOf(b: TopBody): FinishKind | null {
  const conds: FinishKind[] = [];
  if (b.eliminated === 'burst' || b.health <= 0) conds.push('burst');
  if (b.eliminated === 'knockout') conds.push('knockout');
  if (!b.spinning) conds.push('spin');
  for (const f of FINISH_PRIORITY) if (conds.includes(f)) return f;
  return null;
}

/** Whole steps covered by a draw window (inclusive boundary). */
export function drawWindowSteps(window: number, stepHz: number): number {
  if (!(window > 0) || !Number.isFinite(window)) return 0;
  return Math.floor(window * stepHz + 1e-9);
}

/** Presentation-only spin floor for the winner during the aftermath, × critical spin. */
const AFTERMATH_SPIN_FLOOR = 1.15;

/**
 * Battle lifecycle on top of a World. Terminal conditions for BOTH tops are
 * evaluated after the complete physics step, so update order and slot
 * assignment cannot decide a winner. If both tops are eliminated on the
 * same step the battle is a draw.
 *
 * Spin-finish draw window (v0.3): when exactly one top stops spinning (and
 * no burst/knockout happened on that step), the battle enters `resolving`.
 * The decisive-moment snapshot is taken immediately. Combat is disabled
 * (no damage, no knockouts) and the stopped top leaves top–top contact, so
 * the window only measures the survivor's legitimate remaining endurance.
 * If the survivor also stops within `windowSteps` steps (inclusive) the
 * battle is a draw; otherwise the survivor wins by spin finish. Burst and
 * knockout finishes are decisive and never open a window.
 *
 * Once set, the result is frozen and never changes (the world may keep
 * stepping for the finishing presentation, with combat disabled).
 */
export class Battle {
  readonly world: World;
  readonly maxDuration: number;
  readonly windowSteps: number;
  readonly narrowThreshold: number;
  readonly launches: readonly TopLaunch[];
  phase: BattlePhase = 'running';
  result: BattleResult | null = null;
  private pending: { loser: number; step: number; time: number; tops: TopResultStats[] } | null = null;
  private readonly script: readonly TacticalCommand[];
  private scriptAt = 0;
  private readonly agents: readonly (TacticalAgent | null | undefined)[];

  constructor(readonly options: BattleOptions) {
    this.world = new World(options);
    this.script = [...(options.script ?? [])].filter((c) => Number.isInteger(c.tick) && c.tick >= 0).sort((a, b) => a.tick - b.tick);
    this.agents = options.agents ?? [];
    this.maxDuration = options.maxDuration;
    this.windowSteps = drawWindowSteps(options.drawWindow ?? 0, options.stepHz);
    this.narrowThreshold = Math.max(0, options.narrowThreshold ?? 0.02);
    const n = options.tops.length;
    this.launches = Object.freeze(
      Array.from({ length: n }, (_, i) => options.launches?.[i] ?? Object.freeze({ quality: 'poor' as const, energyMultiplier: options.launchEnergyMultipliers?.[i] ?? 1, source: 'fixed' as const })),
    );
  }

  /** Advances one fixed step. No-op once finished. Returns true if not yet finished. */
  step(): boolean {
    if (this.phase === 'finished') return false;
    if (this.phase === 'resolving') return this.stepResolving();
    const w = this.world;
    if (w.tactics.enabled) this.runTactics();
    w.step();
    const finishes = w.bodies.map(finishOf);
    const out = finishes.filter((f) => f !== null).length;
    if (out > 0) {
      if (out >= 2) {
        this.finish(
          { kind: 'draw', reason: 'same-step', finishes: Object.freeze(finishes.filter((f): f is FinishKind => f !== null)) },
          this.snapshot(),
          null,
        );
        return false;
      }
      const loser = finishes.findIndex((f) => f !== null);
      const finish = finishes[loser]!;
      if (finish === 'spin' && this.windowSteps > 0) {
        this.pending = { loser, step: w.steps, time: w.time, tops: this.snapshot() };
        this.phase = 'resolving';
        w.combatEnabled = false;
        w.excludeStoppedFromContact = true;
        return true;
      }
      this.finishWin(loser, finish, this.snapshot(), null);
      return false;
    }
    if (w.time >= this.maxDuration - 1e-9) {
      this.finish({ kind: 'timeout' }, this.snapshot(), null);
      return false;
    }
    return true;
  }

  /** Applies scripted commands and agent decisions due on the current tick (before the physics step). */
  private runTactics(): void {
    const w = this.world;
    const t = w.steps;
    while (this.scriptAt < this.script.length && this.script[this.scriptAt]!.tick < t) this.scriptAt++;
    while (this.scriptAt < this.script.length && this.script[this.scriptAt]!.tick === t) w.applyCommand(this.script[this.scriptAt++]!, true);
    for (let slot = 0; slot < this.agents.length; slot++) {
      const a = this.agents[slot];
      if (!a || !w.bodies[slot]) continue;
      const reqs = a.tick(t, () => observe(w, slot));
      if (reqs) for (const r of reqs) w.applyCommand({ ...r, tick: t, slot }, true);
    }
  }

  /**
   * Live input (the player): validates and applies an ability on the current
   * tick. Rejected while not in normal combat (resolving, finished), and the
   * caller must not submit while paused. Returns the validation result.
   */
  submit(slot: number, req: AbilityRequest): Validation {
    return this.world.applyCommand({ ...req, tick: this.world.steps, slot }, this.phase === 'running');
  }

  private stepResolving(): boolean {
    const w = this.world;
    const p = this.pending!;
    w.step();
    const elapsed = w.steps - p.step;
    const survivor = p.loser === 0 ? 1 : 0;
    const s = w.bodies[survivor]!;
    if (!s.spinning || s.eliminated !== null) {
      // Second stop inside the window (elapsed ≤ windowSteps by construction).
      this.finish(
        { kind: 'draw', reason: 'near-simultaneous', finishes: Object.freeze(['spin', 'spin'] as FinishKind[]) },
        p.tops,
        { windowSteps: this.windowSteps, firstStopStep: p.step, secondStopDelaySteps: elapsed },
        p,
      );
      return false;
    }
    if (elapsed >= this.windowSteps) {
      this.finishWin(p.loser, 'spin', p.tops, { windowSteps: this.windowSteps, firstStopStep: p.step, secondStopDelaySteps: null }, p);
      return false;
    }
    return true;
  }

  /** Continues stepping the world after the result (for the finishing presentation). */
  stepAftermath(): void {
    const w = this.world;
    w.excludeStoppedFromContact = false;
    w.step();
    // Presentation only (the result is frozen): the winner keeps spinning
    // through the finishing presentation instead of toppling a moment after
    // a narrow win.
    const o = this.result?.outcome;
    if (o?.kind === 'win') {
      const b = w.bodies[o.winner]!;
      if (b.active && b.spinning) {
        const floor = b.criticalSpin * AFTERMATH_SPIN_FLOOR;
        if (Math.abs(b.omega) < floor) b.omega = (b.omega >= 0 ? 1 : -1) * floor;
      }
    }
  }

  private snapshot(): TopResultStats[] {
    return this.world.bodies.map((b) =>
      Object.freeze({
        health: b.health,
        maxHealth: b.combat.maxHealth,
        stamina: b.eliminated === null ? b.staminaFraction : 0,
        spinning: b.eliminated === null && b.spinning,
        damageDealt: b.damageDealt,
        damageReceived: b.damageReceived,
        hitsLanded: b.hitsLanded,
        strongestHit: b.strongestHit,
        strongestHitCritical: b.strongestHitCritical,
        critsLanded: b.critsLanded,
        critsReceived: b.critsReceived,
        critDamageDealt: b.critDamageDealt,
        collisions: b.collisions,
      }),
    );
  }

  private finishWin(loser: number, finish: FinishKind, tops: TopResultStats[], dw: DrawWindowInfo | null, at?: { step: number; time: number }): void {
    const winner = loser === 0 ? 1 : 0;
    const narrow = finish === 'spin' && tops[winner]!.stamina <= this.narrowThreshold;
    this.finish({ kind: 'win', winner, loser, finish, narrow }, tops, dw, at);
  }

  private finish(outcome: BattleOutcome, tops: TopResultStats[], dw: DrawWindowInfo | null, at?: { step: number; time: number }): void {
    const w = this.world;
    this.phase = 'finished';
    this.pending = null;
    w.combatEnabled = false;
    w.excludeStoppedFromContact = false;
    let best = { damage: 0, by: -1, critical: false };
    tops.forEach((t, i) => {
      if (t.strongestHit > best.damage) best = { damage: t.strongestHit, by: i, critical: t.strongestHitCritical };
    });
    this.result = Object.freeze({
      outcome: Object.freeze(outcome),
      time: at ? at.time : w.time,
      steps: at ? at.step : w.steps,
      seed: w.seed,
      tops: Object.freeze(tops),
      strongestHit: Object.freeze(best),
      launches: this.launches,
      drawWindow: dw ? Object.freeze(dw) : null,
      aims: this.options.launch.variation ? Object.freeze(this.world.bodies.map((b) => Object.freeze(clampAim(this.options.aims?.[b.index])))) : null,
      tactical: w.tactics.enabled ? this.tacticalSummary(outcome) : null,
    });
  }

  private tacticalSummary(outcome: BattleOutcome): TacticalSummary {
    const w = this.world;
    const hz = w.stepHz;
    const hits = w.telemetry.hitSteps;
    return Object.freeze({
      enabled: true,
      commands: Object.freeze([...w.commandLog]),
      tops: Object.freeze(
        w.abilities.map((st, i) => {
          let ko = false;
          if (outcome.kind === 'win' && outcome.winner === i && outcome.finish === 'knockout') {
            const koStep = w.bodies[outcome.loser]!.eliminatedStep - 1;
            const b0 = st.lastBoostTick;
            ko = koStep - b0 >= 0 && koStep - b0 <= ATTRIBUTION.boostToKnockout * hz && hits.some((h) => h >= b0 && h <= koStep);
          }
          return Object.freeze({
            boostsUsed: st.boostsUsed,
            bracesUsed: st.bracesUsed,
            boostsLeft: st.boostCharges,
            bracesLeft: st.braceCharges,
            boostEnergy: st.boostEnergy,
            boostCost: st.boostCostFraction,
            avgStrength: st.boostsUsed > 0 ? st.boostStrengthSum / st.boostsUsed : 0,
            braceImpacts: st.braceImpacts,
            damagePrevented: st.damagePrevented,
            boostsToHit: st.boostsToHit,
            boostKnockout: ko,
            boostTimes: Object.freeze(st.boostTicks.map((t) => t / hz)),
            braceTimes: Object.freeze(st.braceTicks.map((t) => t / hz)),
            rejected: Object.freeze({ ...st.rejected }),
          });
        }),
      ),
    });
  }

  /** Runs to completion synchronously (headless). */
  runToEnd(): BattleResult {
    while (this.step()) {
      /* keep stepping */
    }
    return this.result!;
  }
}
