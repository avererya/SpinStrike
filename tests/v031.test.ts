import { describe, expect, it } from 'vitest';
import { buildBattleOptions, defaultConfig, DEFAULT_DRAW_WINDOW, legacyV02Config } from '../src/config/sandboxConfig';
import { Battle, drawWindowSteps } from '../src/sim/battle';
import { computeDamage, DEFAULT_COMBAT } from '../src/sim/combat';
import { deriveTopPhysics } from '../src/content/derive';
import { RINGS } from '../src/content/parts';
import { getTop } from '../src/content/tops';
import { runBatch } from '../src/sim/headless';

describe('v0.3.1 draw window', () => {
  it('defaults to 0.10 s (24 steps at 240 Hz); the legacy ruleset stays at 0', () => {
    expect(DEFAULT_DRAW_WINDOW).toBe(0.1);
    expect(defaultConfig(1).results.drawWindow).toBe(0.1);
    expect(drawWindowSteps(0.1, 240)).toBe(24);
    expect(legacyV02Config(1).results.drawWindow).toBe(0);
  });

  it('keeps mirror fairness: no slot bias in decisive Titan/Tempest mirrors', () => {
    for (const id of ['titan', 'tempest']) {
      const cfg = defaultConfig(1);
      cfg.player.topId = id;
      cfg.opponent.topId = id;
      cfg.launch.minigame = false;
      let p0 = 0;
      let p1 = 0;
      for (let i = 0; i < 120; i++) {
        const c = defaultConfig(5000 + i);
        c.player.topId = id;
        c.opponent.topId = id;
        c.launch.minigame = false;
        const o = new Battle(buildBattleOptions(c)).runToEnd().outcome;
        if (o.kind === 'win') (o.winner === 0 ? p0++ : p1++);
      }
      const n = p0 + p1;
      expect(Math.abs(p0 - n / 2) / Math.sqrt(n / 4)).toBeLessThan(3.5);
    }
  });
});

describe('v0.3.1 reusable ring characteristics', () => {
  it('damageCapFactor flattens only the hardest hits taken, for any attacker', () => {
    const p = DEFAULT_COMBAT;
    const small = 0.0002;
    const big = 0.2;
    const lightRatio = computeDamage(small, 70, 50, p, 0.45) / computeDamage(small, 70, 50, p);
    const heavyRatio = computeDamage(big, 70, 50, p, 0.45) / computeDamage(big, 70, 50, p);
    expect(lightRatio).toBeGreaterThan(0.85);
    expect(heavyRatio).toBeLessThan(lightRatio - 0.15);
    // identical for different attackers with equal inputs; invalid factors fall back to 1
    expect(computeDamage(big, 70, 50, p, Number.NaN)).toBe(computeDamage(big, 70, 50, p));
    expect(computeDamage(big, 70, 50, p, -1)).toBe(computeDamage(big, 70, 50, p));
  });

  it('Zephyr Halo carries the deflective profile and its spin-scrubbing cost; others stay neutral', () => {
    const t = deriveTopPhysics(getTop('tempest'), { ruleset: 'v0.3' });
    expect(t.damageCapFactor).toBe(RINGS['zephyr-halo']!.damageCapFactor);
    expect(t.damageCapFactor).toBeLessThan(1);
    expect(t.impactSpinLossFactor).toBeGreaterThan(1);
    for (const id of ['inferno', 'titan', 'phantom']) {
      const p = deriveTopPhysics(getTop(id), { ruleset: 'v0.3' });
      expect(p.damageCapFactor).toBe(1);
      expect(p.impactSpinLossFactor).toBe(1);
    }
    // legacy ruleset is untouched
    const v2 = deriveTopPhysics(getTop('tempest'), { ruleset: 'v0.2' });
    expect(v2.damageCapFactor).toBeUndefined();
    expect(v2.impactSpinLossFactor).toBeUndefined();
  });

  it('Inferno vs Tempest stays inside a 55–90 % band over 200 seeds (regression guard, not a tuning target)', () => {
    const make = (seed: number) => {
      const c = defaultConfig(seed);
      c.player.topId = 'inferno';
      c.opponent.topId = 'tempest';
      c.launch.minigame = false;
      return buildBattleOptions(c);
    };
    const r = runBatch(make, 200, 1);
    const rate = r.wins[0] / r.battles;
    expect(rate).toBeGreaterThan(0.55);
    expect(rate).toBeLessThan(0.9);
  });
});
