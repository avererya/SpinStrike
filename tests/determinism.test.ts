import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { FixedStepRunner, SIM_SPEEDS } from '../src/sim/runner';

function battle(seed: number, a = 'inferno', b = 'phantom') {
  const c = defaultConfig(seed);
  c.player.topId = a;
  c.opponent.topId = b;
  return new Battle(buildBattleOptions(c));
}

function snapshot(bt: Battle) {
  return bt.world.bodies.map((b) => [b.x, b.y, b.vx, b.vy, b.omega, b.tilt, b.collisions]);
}

describe('seeded reproducibility', () => {
  it('same seed ⇒ bit-identical simulation and result', () => {
    const a = battle(42);
    const b = battle(42);
    const ra = a.runToEnd();
    const rb = b.runToEnd();
    expect(ra).toEqual(rb);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('different seeds ⇒ different launches', () => {
    const a = battle(1);
    const b = battle(2);
    expect(snapshot(a)).not.toEqual(snapshot(b));
  });
});

describe('simulation speed independence', () => {
  it('produces identical outcomes at 0.25×, 0.5×, 1× and 2× with irregular frame times', () => {
    const results = SIM_SPEEDS.map((speed) => {
      const bt = battle(99, 'titan', 'inferno');
      const runner = new FixedStepRunner(bt);
      runner.speed = speed;
      runner.runAftermath = false;
      // Irregular wall-clock frame times (deterministic pattern).
      const frames = [1 / 60, 1 / 144, 1 / 30, 0.05, 1 / 90, 0.2];
      let i = 0;
      while (bt.phase === 'running') runner.advance(frames[i++ % frames.length]!);
      return { result: bt.result, state: snapshot(bt) };
    });
    for (const r of results.slice(1)) {
      expect(r.result).toEqual(results[0]!.result);
      expect(r.state).toEqual(results[0]!.state);
    }
  });

  it('pausing does not advance the simulation', () => {
    const bt = battle(5);
    const runner = new FixedStepRunner(bt);
    runner.paused = true;
    for (let i = 0; i < 100; i++) runner.advance(1 / 60);
    expect(bt.world.steps).toBe(0);
  });

  it('a long frame hitch never runs more than the per-frame step cap', () => {
    const bt = battle(5);
    const runner = new FixedStepRunner(bt);
    runner.advance(5);
    expect(runner.stepsLastFrame).toBeLessThanOrEqual(runner.maxStepsPerFrame);
  });
});
