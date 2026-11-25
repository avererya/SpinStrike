import { describe, expect, it } from 'vitest';
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { runBatch } from '../src/sim/headless';

describe('extended simulations (all 16 matchups)', () => {
  for (const a of STARTER_TOPS) {
    for (const b of STARTER_TOPS) {
      it(`${a.name} vs ${b.name}: 6 seeded battles stay finite, never trip guards and terminate`, () => {
        const stats = runBatch(
          (seed) => {
            const c = defaultConfig(seed);
            c.player.topId = a.id;
            c.opponent.topId = b.id;
            return buildBattleOptions(c);
          },
          6,
          1000,
        );
        expect(stats.failures, stats.failureDetails.join('\n')).toBe(0);
        expect(stats.results.length).toBe(6);
        expect(stats.maxTranslationalSpeed).toBeLessThan(4);
        for (const r of stats.results) expect(r.time).toBeGreaterThan(0);
      });
    }
  }
});
