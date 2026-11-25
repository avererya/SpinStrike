import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';

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
      const c = defaultConfig(seed);
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
