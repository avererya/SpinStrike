import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { buildBattleOptions, legacyV02Config } from '../src/config/sandboxConfig';

/**
 * v0.1 movement / energy regression. With combat damage and knockouts off
 * and the v0.1 stat-based spin drain restored (weight 1), v0.2 must
 * reproduce v0.1 battles step for step. Reference values were recorded by
 * running the v0.1 release (commit 164462d) with the same seeds.
 */
const V01 = [
  ['inferno', 'phantom', 1, 6306, 1, [9, 9]],
  ['titan', 'tempest', 2, 10624, 1, [52, 52]],
  ['phantom', 'phantom', 3, 12699, 1, [16, 16]],
  ['tempest', 'inferno', 4, 4400, 0, [20, 20]],
] as const;

describe('v0.1 physics regression', () => {
  for (const [a, b, seed, steps, winner, collisions] of V01) {
    it(`${a} vs ${b} (seed ${seed}) matches v0.1 exactly with combat disabled`, () => {
      // v0.3: the legacy v0.2 ruleset (v0.2 stats + mapping, crits off, Poor launches, no draw window).
      const c = legacyV02Config(seed);
      c.player.topId = a;
      c.opponent.topId = b;
      c.combat.damageScale = 0;
      c.combat.knockouts = false;
      c.collision.statSpinDrainWeight = 1;
      const bt = new Battle(buildBattleOptions(c));
      const r = bt.runToEnd();
      expect(r.steps).toBe(steps);
      expect(r.outcome).toMatchObject({ kind: 'win', winner, finish: 'spin' });
      expect(bt.world.bodies.map((x) => x.collisions)).toEqual(collisions);
    });
  }
});

/**
 * v0.2 combat regression (added in v0.3). With the legacy v0.2 ruleset
 * (critical hits off, both launches Poor = 1.00× energy, draw window 0), v0.3
 * must reproduce v0.2 battles step for step. Reference values were recorded
 * by running the v0.2 release (commit 1e0183c): [a, b, seed, steps, winner
 * (−1 = none), finish/kind, final health of both tops (3 dp)].
 */
const V02: [string, string, number, number, number, string, number[]][] = [
  ["inferno", "inferno", 11, 6896, 1, "spin", [418.75, 424.412]],
  ["inferno", "inferno", 12, 8087, 1, "spin", [600, 600]],
  ["inferno", "titan", 11, 6631, 1, "spin", [499.701, 645.513]],
  ["inferno", "titan", 12, 6476, 1, "spin", [499.316, 631.786]],
  ["inferno", "tempest", 11, 2953, 0, "burst", [450.511, 0]],
  ["inferno", "tempest", 12, 2876, 0, "burst", [449.706, 0]],
  ["inferno", "phantom", 11, 5783, 1, "spin", [383.565, 336.791]],
  ["inferno", "phantom", 12, 6207, 1, "spin", [380.047, 353.025]],
  ["titan", "inferno", 11, 7029, 0, "spin", [612.155, 496.955]],
  ["titan", "inferno", 12, 6197, 0, "spin", [570.466, 473.969]],
  ["titan", "titan", 11, 11733, 0, "spin", [879.559, 879.452]],
  ["titan", "titan", 12, 12023, 1, "spin", [827.358, 828.247]],
  ["titan", "tempest", 11, 12049, 1, "spin", [764.359, 375.053]],
  ["titan", "tempest", 12, 10733, 1, "spin", [753.028, 354.645]],
  ["titan", "phantom", 11, 11715, 0, "spin", [571.421, 481.506]],
  ["titan", "phantom", 12, 10481, 0, "spin", [438.846, 413.878]],
  ["tempest", "inferno", 11, 1900, 1, "burst", [0, 442.712]],
  ["tempest", "inferno", 12, 3326, 1, "burst", [0, 446.144]],
  ["tempest", "titan", 11, 10765, 0, "spin", [180.431, 644.77]],
  ["tempest", "titan", 12, 11193, 0, "spin", [248.953, 684.659]],
  ["tempest", "tempest", 11, 17082, 0, "spin", [600, 600]],
  ["tempest", "tempest", 12, 16184, 1, "spin", [600, 600]],
  ["tempest", "phantom", 11, 6905, 1, "burst", [0, 461.88]],
  ["tempest", "phantom", 12, 11622, 0, "spin", [46.743, 468.7]],
  ["phantom", "inferno", 11, 5306, 0, "spin", [227.814, 304.728]],
  ["phantom", "inferno", 12, 5298, 0, "spin", [166.552, 255.247]],
  ["phantom", "titan", 11, 10285, 1, "spin", [365.607, 341.324]],
  ["phantom", "titan", 12, 11300, 1, "spin", [496.191, 603.829]],
  ["phantom", "tempest", 11, 11830, 1, "spin", [467.739, 48.655]],
  ["phantom", "tempest", 12, 11395, 1, "spin", [462.046, 25.779]],
  ["phantom", "phantom", 11, 12865, 1, "spin", [566.024, 565.785]],
  ["phantom", "phantom", 12, 12399, 1, "spin", [436.723, 440.406]],
];

describe('v0.2 combat regression (legacy ruleset)', () => {
  it('reproduces 32 recorded v0.2 battles exactly (all 16 ordered matchups × 2 seeds)', () => {
    for (const [a, b, seed, steps, winner, finish, health] of V02) {
      const c = legacyV02Config(seed);
      c.player.topId = a;
      c.opponent.topId = b;
      const r = new Battle(buildBattleOptions(c)).runToEnd();
      const got = [r.steps, r.outcome.kind === 'win' ? r.outcome.winner : -1, r.outcome.kind === 'win' ? r.outcome.finish : r.outcome.kind, r.tops.map((t) => Math.round(t.health * 1000) / 1000)];
      expect(got, `${a} vs ${b} seed ${seed}`).toEqual([steps, winner, finish, health]);
    }
  });
});
