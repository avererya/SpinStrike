import { World, type WorldOptions } from './world';

export type BattlePhase = 'running' | 'finished';

export type BattleOutcome =
  | { kind: 'win'; winner: number; loser: number; reason: 'spin-out' }
  | { kind: 'draw'; reason: 'simultaneous-spin-out' }
  | { kind: 'timeout' };

export interface BattleResult {
  outcome: BattleOutcome;
  /** Simulation time at which the battle ended, s. */
  time: number;
  steps: number;
}

export interface BattleOptions extends WorldOptions {
  /** Maximum simulated duration before a timeout result, s. */
  maxDuration: number;
}

/**
 * Battle lifecycle on top of a World. v0.1 uses only the stamina (spin-out)
 * victory condition. Burst/health and knockout conditions come later.
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
    const stoppedNow = w.bodies.filter((b) => !b.spinning);
    if (stoppedNow.length > 0) {
      const time = w.time;
      if (stoppedNow.length >= 2) {
        // Both stopped: if on the same step it's a draw, otherwise the
        // earlier one lost (can only happen with >2 tops; kept for safety).
        const steps = stoppedNow.map((b) => b.stoppedStep);
        const first = Math.min(...steps);
        const firsts = stoppedNow.filter((b) => b.stoppedStep === first);
        if (firsts.length >= 2) {
          this.finish({ kind: 'draw', reason: 'simultaneous-spin-out' }, time);
        } else {
          const loser = firsts[0]!.index;
          const winner = w.bodies.find((b) => b.index !== loser)!.index;
          this.finish({ kind: 'win', winner, loser, reason: 'spin-out' }, time);
        }
      } else {
        const loser = stoppedNow[0]!.index;
        const winner = w.bodies.find((b) => b.index !== loser)!.index;
        this.finish({ kind: 'win', winner, loser, reason: 'spin-out' }, time);
      }
      return false;
    }
    if (w.time >= this.maxDuration - 1e-9) {
      this.finish({ kind: 'timeout' }, w.time);
      return false;
    }
    return true;
  }

  /** Continues stepping the world after the result (for visual run-down). */
  stepAftermath(): void {
    this.world.step();
  }

  private finish(outcome: BattleOutcome, time: number): void {
    this.phase = 'finished';
    this.result = { outcome, time, steps: this.world.steps };
  }

  /** Runs to completion synchronously (headless). */
  runToEnd(): BattleResult {
    while (this.step()) {
      /* keep stepping */
    }
    return this.result!;
  }
}
