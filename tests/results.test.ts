import { describe, expect, it } from 'vitest';
import { Battle, drawWindowSteps } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig, legacyV02Config, type SandboxConfig } from '../src/config/sandboxConfig';
import { STARTER_TOPS } from '../src/content/tops';
import { describeResult } from '../src/ui/resultText';

function cfg(a: string, b: string, seed = 1, mod?: (c: SandboxConfig) => void) {
  const c = defaultConfig(seed);
  c.player.topId = a;
  c.opponent.topId = b;
  c.launch.minigame = false;
  c.launch.playerQuality = 'good';
  c.launch.opponentQuality = 'good';
  mod?.(c);
  return c;
}

/** Steps until one top stops; then forces the survivor to stop after `delay` more steps. */
function forcedSecondStop(delay: number | null) {
  const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 5, (c) => (c.results.drawWindow = 0.25))));
  const [A, B] = bt.world.bodies;
  // Make A stop on the next step (B keeps spinning).
  A!.omega = Math.sign(A!.omega) * A!.criticalSpin * 0.5;
  bt.step();
  expect(bt.phase).toBe('resolving');
  const first = bt.world.steps;
  if (delay !== null) {
    for (let k = 1; k < delay; k++) bt.step();
    B!.omega = Math.sign(B!.omega) * B!.criticalSpin * 0.5;
  }
  bt.runToEnd();
  return { bt, first, r: bt.result! };
}

describe('spin-finish draw window', () => {
  it('window length is counted in whole simulation steps (inclusive)', () => {
    expect(drawWindowSteps(0.25, 240)).toBe(60);
    expect(drawWindowSteps(0, 240)).toBe(0);
    expect(drawWindowSteps(-1, 240)).toBe(0);
    expect(drawWindowSteps(Number.NaN, 240)).toBe(0);
    expect(drawWindowSteps(0.1, 240)).toBe(24);
  });

  it('a second stop within the window is a near-simultaneous draw', () => {
    const { r } = forcedSecondStop(10);
    expect(r.outcome).toEqual({ kind: 'draw', reason: 'near-simultaneous', finishes: ['spin', 'spin'] });
    expect(r.drawWindow).toMatchObject({ windowSteps: 60, secondStopDelaySteps: 10 });
  });

  it('boundary: a stop exactly at the window edge draws; surviving the whole window wins', () => {
    const edge = forcedSecondStop(60).r;
    expect(edge.outcome.kind).toBe('draw');
    expect(edge.drawWindow!.secondStopDelaySteps).toBe(60);
    const survive = forcedSecondStop(null).r;
    expect(survive.outcome).toMatchObject({ kind: 'win', winner: 1, loser: 0, finish: 'spin' });
    expect(survive.drawWindow).toMatchObject({ windowSteps: 60, secondStopDelaySteps: null });
  });

  it('the decisive time and snapshot are taken when the first top stopped, not at the end of the window', () => {
    const { r, first } = forcedSecondStop(null);
    expect(r.steps).toBe(first);
    expect(r.time).toBeCloseTo(first / 240, 12);
    expect(r.tops[0]!.spinning).toBe(false);
    expect(r.tops[0]!.stamina).toBe(0);
    expect(r.tops[1]!.spinning).toBe(true);
    expect(r.tops[1]!.stamina).toBeGreaterThan(0);
  });

  it('a window of 0 reproduces the v0.2 rule (immediate win)', () => {
    const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 5, (c) => (c.results.drawWindow = 0))));
    const A = bt.world.bodies[0]!;
    A.omega = Math.sign(A.omega) * A.criticalSpin * 0.5;
    bt.step();
    expect(bt.phase).toBe('finished');
    expect(bt.result!.outcome).toMatchObject({ kind: 'win', winner: 1 });
    expect(bt.result!.drawWindow).toBeNull();
  });

  it('no combat after the first stop: no damage, no knockouts, and the stopped top leaves contact', () => {
    const bt = new Battle(buildBattleOptions(cfg('inferno', 'phantom', 9, (c) => (c.results.drawWindow = 2))));
    const [A, B] = bt.world.bodies;
    for (let i = 0; i < 240; i++) bt.step();
    A!.omega = Math.sign(A!.omega) * A!.criticalSpin * 0.5;
    bt.step();
    expect(bt.phase).toBe('resolving');
    const h = [A!.health, B!.health];
    bt.world.drainDamage();
    // Put the survivor right on top of the stopped top, moving into it.
    B!.x = A!.x + 0.03;
    B!.y = A!.y;
    B!.vx = -1;
    B!.vy = 0;
    const collisionsBefore = A!.collisions;
    while (bt.phase === 'resolving') bt.step();
    expect([A!.health, B!.health]).toEqual(h);
    expect(bt.world.drainDamage()).toEqual([]);
    expect(A!.collisions).toBe(collisionsBefore);
    expect(B!.eliminated).toBeNull();
  });

  it('burst and knockout finishes stay decisive (no window)', () => {
    const bt = new Battle(buildBattleOptions(cfg('phantom', 'phantom', 2)));
    const A = bt.world.bodies[0]!;
    A.health = 0;
    A.eliminated = 'burst';
    bt.step();
    expect(bt.phase).toBe('finished');
    expect(bt.result!.outcome).toMatchObject({ kind: 'win', winner: 1, finish: 'burst' });
  });

  it('same-step elimination is still a draw', () => {
    const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 3)));
    for (const b of bt.world.bodies) b.omega = Math.sign(b.omega) * b.criticalSpin * 0.5;
    bt.step();
    expect(bt.result!.outcome).toEqual({ kind: 'draw', reason: 'same-step', finishes: ['spin', 'spin'] });
  });
});

describe('narrow victories and final snapshots', () => {
  it('labels a spin win narrow when the winner stamina is at or below the threshold (presentation only)', () => {
    const run = (threshold: number) => {
      const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 5, (c) => (c.results.narrowThreshold = threshold))));
      const A = bt.world.bodies[0]!;
      A.omega = Math.sign(A.omega) * A.criticalSpin * 0.5;
      return bt.runToEnd();
    };
    const wide = run(0);
    const narrow = run(1);
    expect(wide.outcome).toMatchObject({ kind: 'win', narrow: false });
    expect(narrow.outcome).toMatchObject({ kind: 'win', narrow: true });
    // The label never changes who won or when.
    expect({ ...narrow, outcome: null }).toEqual({ ...wide, outcome: null });
  });

  it('the winner keeps spinning through the finishing presentation and the result never changes', () => {
    const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 5)));
    const A = bt.world.bodies[0]!;
    A.omega = Math.sign(A.omega) * A.criticalSpin * 0.5;
    const r = bt.runToEnd();
    const frozen = JSON.stringify(r);
    for (let i = 0; i < 240 * 6; i++) bt.stepAftermath();
    expect(bt.world.bodies[1]!.spinning).toBe(true);
    expect(JSON.stringify(bt.result)).toBe(frozen);
    expect(Object.isFrozen(r.tops[1])).toBe(true);
  });

  it('result text explains draws and narrow wins', () => {
    const label = (i: number) => (i === 0 ? 'P1' : 'P2');
    const draw = forcedSecondStop(12).r;
    expect(describeResult(draw, label).sub).toMatch(/almost simultaneously \(0\.05 s apart, within the 0\.25 s draw window\)/);
    const bt = new Battle(buildBattleOptions(cfg('titan', 'titan', 5, (c) => (c.results.narrowThreshold = 1))));
    const A = bt.world.bodies[0]!;
    A.omega = Math.sign(A.omega) * A.criticalSpin * 0.5;
    const d = describeResult(bt.runToEnd(), label);
    expect(d.badge).toBe('NARROW VICTORY');
    expect(d.title).toBe('P2 wins!');
  });
});

describe('reported Titan mirror (seed 327532992)', () => {
  it('v0.2 rules: P2 stopped first by a few steps; P1 really was still spinning with nonzero stamina', () => {
    const c = legacyV02Config(327532992);
    c.player.topId = 'titan';
    c.opponent.topId = 'titan';
    const bt = new Battle(buildBattleOptions(c));
    const r = bt.runToEnd();
    expect(r.outcome).toMatchObject({ kind: 'win', winner: 0, loser: 1, finish: 'spin' });
    expect(r.tops[0]!.spinning).toBe(true);
    expect(r.tops[0]!.stamina).toBeGreaterThan(0);
    expect(r.tops[0]!.stamina).toBeLessThan(0.001);
    while (bt.world.bodies[0]!.spinning && bt.world.steps < r.steps + 240) bt.world.step();
    const delay = bt.world.bodies[0]!.stoppedStep - bt.world.bodies[1]!.stoppedStep;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(60);
  });

  it('v0.3 draw window: the same battle is a near-simultaneous draw', () => {
    const c = legacyV02Config(327532992);
    c.player.topId = 'titan';
    c.opponent.topId = 'titan';
    c.results.drawWindow = 0.25;
    const r = new Battle(buildBattleOptions(c)).runToEnd();
    expect(r.outcome).toMatchObject({ kind: 'draw', reason: 'near-simultaneous' });
  });
});

describe('mirror-match fairness', () => {
  it('no starter top shows a systematic P1/P2 bias over 150 seeds (|z| < 3)', () => {
    for (const t of STARTER_TOPS) {
      let p1 = 0;
      let p2 = 0;
      for (let s = 1; s <= 150; s++) {
        const r = new Battle(buildBattleOptions(cfg(t.id, t.id, 7000 + s, (c) => {
          c.launch.playerQuality = 'auto';
          c.launch.opponentQuality = 'auto';
        }))).runToEnd();
        if (r.outcome.kind === 'win') r.outcome.winner === 0 ? p1++ : p2++;
      }
      const n = p1 + p2;
      const z = n ? (p1 - n / 2) / Math.sqrt(n / 4) : 0;
      expect(Math.abs(z), `${t.id}: P1 ${p1} vs P2 ${p2}`).toBeLessThan(3);
    }
  });
});
