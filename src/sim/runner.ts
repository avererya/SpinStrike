import type { Battle } from './battle';

export const SIM_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

/**
 * Fixed-timestep driver with an accumulator.
 *
 * Real elapsed time × speed is added to the accumulator and consumed in
 * whole fixed steps. Speed therefore only changes *how quickly* steps are
 * taken in wall-clock time, never the step size, so a seeded battle has
 * exactly the same outcome at every speed.
 */
export class FixedStepRunner {
  speed: number = 1;
  paused = false;
  private accumulator = 0;
  /** Max real seconds accepted per frame (avoids spiral of death after tab switches). */
  maxFrameTime = 0.1;
  /** Max fixed steps per advance() call. */
  maxStepsPerFrame = 64;
  stepsLastFrame = 0;
  /** Keep stepping the world after the battle ends so tops visibly run down. */
  runAftermath = true;

  constructor(public battle: Battle) {}

  /** Advance by real elapsed seconds. Returns interpolation alpha in [0, 1). */
  advance(realDt: number): number {
    const dt = this.battle.world.dt;
    this.stepsLastFrame = 0;
    if (this.paused) return this.alpha;
    this.accumulator += Math.min(Math.max(realDt, 0), this.maxFrameTime) * this.speed;
    while (this.accumulator >= dt && this.stepsLastFrame < this.maxStepsPerFrame) {
      if (this.battle.phase !== 'finished') this.battle.step();
      else if (this.runAftermath && this.battle.world.time < this.battle.result!.time + 6) this.battle.stepAftermath();
      this.accumulator -= dt;
      this.stepsLastFrame++;
    }
    // If we fell behind, drop the backlog (wall-clock only, outcome unaffected).
    if (this.accumulator > dt * this.maxStepsPerFrame) this.accumulator = 0;
    return this.alpha;
  }

  get alpha(): number {
    const dt = this.battle.world.dt;
    return Math.min(this.accumulator / dt, 1);
  }
}
