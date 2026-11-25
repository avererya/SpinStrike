import { World, type WorldOptions } from './world';
import type { FinishKind } from './combat';
import type { TopBody } from './body';

export type BattlePhase = 'running' | 'finished';

export type BattleOutcome =
  | { readonly kind: 'win'; readonly winner: number; readonly loser: number; readonly finish: FinishKind }
  | { readonly kind: 'draw'; readonly finishes: readonly FinishKind[] }
  | { readonly kind: 'timeout' };

/** Snapshot of one top at the moment the result was decided. */
export interface TopResultStats {
  readonly health: number;
  readonly maxHealth: number;
  /** Remaining rotational energy as a fraction of launch energy (0–1). */
  readonly stamina: number;
  readonly damageDealt: number;
  readonly damageReceived: number;
  readonly hitsLanded: number;
  readonly strongestHit: number;
  readonly collisions: number;
}

export interface BattleResult {
  readonly outcome: BattleOutcome;
  /** Simulation time at which the battle ended, s. */
  readonly time: number;
  readonly steps: number;
  readonly seed: number;
  readonly tops: readonly TopResultStats[];
  /** Strongest single damaging hit of the battle (by either top). */
  readonly strongestHit: { readonly damage: number; readonly by: number };
}

export interface BattleOptions extends WorldOptions {
  /** Maximum simulated duration before a timeout result, s. */
  maxDuration: number;
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

/**
 * Battle lifecycle on top of a World. Terminal conditions for BOTH tops are
 * evaluated after the complete physics step, so update order and slot
 * assignment cannot decide a winner. If both tops are eliminated on the
 * same step the battle is a draw. Once set, the result is frozen and never
 * changes (the world may keep stepping for the finishing presentation, with
 * combat disabled).
 */
export class Battle {
  readonly world: World;
  readonly maxDuration: number;
  phase: BattlePhase = 'running';
  result: BattleResult | null = null;

  constructor(readonly options: BattleOptions) {
    this.world = new World(options);
    this.maxDuration = options.maxDuration;
  }

  /** Advances one fixed step. No-op once finished. Returns true if still running. */
  step(): boolean {
    if (this.phase === 'finished') return false;
    const w = this.world;
    w.step();
    const finishes = w.bodies.map(finishOf);
    const out = finishes.filter((f) => f !== null).length;
    if (out > 0) {
      if (out >= 2) {
        this.finish({ kind: 'draw', finishes: Object.freeze(finishes.filter((f): f is FinishKind => f !== null)) });
      } else {
        const loser = finishes.findIndex((f) => f !== null);
        const winner = loser === 0 ? 1 : 0;
        this.finish({ kind: 'win', winner, loser, finish: finishes[loser]! });
      }
      return false;
    }
    if (w.time >= this.maxDuration - 1e-9) {
      this.finish({ kind: 'timeout' });
      return false;
    }
    return true;
  }

  /** Continues stepping the world after the result (for the finishing presentation). */
  stepAftermath(): void {
    this.world.step();
  }

  private finish(outcome: BattleOutcome): void {
    const w = this.world;
    this.phase = 'finished';
    w.combatEnabled = false;
    const tops = w.bodies.map((b) =>
      Object.freeze({
        health: b.health,
        maxHealth: b.combat.maxHealth,
        stamina: b.spinning ? Math.max(0, Math.min(1, b.spinFraction)) : 0,
        damageDealt: b.damageDealt,
        damageReceived: b.damageReceived,
        hitsLanded: b.hitsLanded,
        strongestHit: b.strongestHit,
        collisions: b.collisions,
      }),
    );
    let best = { damage: 0, by: -1 };
    tops.forEach((t, i) => {
      if (t.strongestHit > best.damage) best = { damage: t.strongestHit, by: i };
    });
    this.result = Object.freeze({
      outcome: Object.freeze(outcome),
      time: w.time,
      steps: w.steps,
      seed: w.seed,
      tops: Object.freeze(tops),
      strongestHit: Object.freeze(best),
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
