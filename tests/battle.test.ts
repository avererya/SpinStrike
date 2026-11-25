import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';

function opts(seed = 3, maxDuration = 180) {
  const c = defaultConfig(seed);
  c.maxDuration = maxDuration;
  return buildBattleOptions(c);
}

describe('battle lifecycle', () => {
  it('terminates with a stamina (spin-out) result', () => {
    const bt = new Battle(opts());
    const r = bt.runToEnd();
    expect(bt.phase).toBe('finished');
    expect(r.outcome.kind).toBe('win');
    if (r.outcome.kind === 'win') {
      expect(bt.world.bodies[r.outcome.loser]!.spinning).toBe(false);
      expect(bt.world.bodies[r.outcome.winner]!.spinning).toBe(true);
    }
  });

  it('reports a timeout (not an invented winner) when max duration is reached', () => {
    const bt = new Battle(opts(3, 5));
    const r = bt.runToEnd();
    expect(r.outcome.kind).toBe('timeout');
    expect(r.time).toBeCloseTo(5, 2);
    expect(bt.world.bodies.every((b) => b.spinning)).toBe(true);
  });

  it('declares a draw when both tops stop on the same physics step', () => {
    const bt = new Battle(opts());
    // Both tops are already below their toppling speed when the next step runs.
    for (const b of bt.world.bodies) b.omega = Math.sign(b.omega) * b.criticalSpin * 0.9;
    bt.step();
    expect(bt.result?.outcome.kind).toBe('draw');
  });

  it('does not step after finishing', () => {
    const bt = new Battle(opts(3, 5));
    bt.runToEnd();
    const steps = bt.world.steps;
    expect(bt.step()).toBe(false);
    expect(bt.world.steps).toBe(steps);
  });
});
