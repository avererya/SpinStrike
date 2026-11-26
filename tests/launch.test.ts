import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_LAUNCH_DISTRIBUTION,
  DEFAULT_LAUNCH_BONUSES,
  DEFAULT_LAUNCH_ZONES,
  LAUNCH_QUALITIES,
  aiLaunchQuality,
  makeLaunch,
  meterPosition,
  playerLaunchQuality,
  qualityAt,
  sampleQuality,
  validDistribution,
} from '../src/sim/launch';
import { Battle } from '../src/sim/battle';
import { autoLaunches, buildBattleOptions, defaultConfig, rematchConfig } from '../src/config/sandboxConfig';
import { formatBonus, formatHealth, formatStamina } from '../src/ui/format';

function cfg(seed = 7, a = 'phantom', b = 'titan') {
  const c = defaultConfig(seed);
  c.player.topId = a;
  c.opponent.topId = b;
  c.launch.minigame = false;
  return c;
}

describe('launch timing zones', () => {
  it('maps meter positions to qualities with inclusive boundaries toward the better zone', () => {
    const cases: [number, string][] = [
      [0.5, 'perfect'], [0.45, 'perfect'], [0.55, 'perfect'],
      [0.4499, 'great'], [0.5501, 'great'], [0.3, 'great'], [0.7, 'great'],
      [0.2999, 'good'], [0.7001, 'good'], [0.15, 'good'], [0.85, 'good'],
      [0.1499, 'poor'], [0.8501, 'poor'], [0, 'poor'], [1, 'poor'],
    ];
    for (const [pos, q] of cases) expect(qualityAt(pos), `position ${pos}`).toBe(q);
  });

  it('is configurable and treats invalid positions as Poor', () => {
    expect(qualityAt(0.4, { perfect: 0.1, great: 0.2, good: 0.3 })).toBe('perfect');
    expect(qualityAt(0.25, { perfect: 0.1, great: 0.2, good: 0.3 })).toBe('good');
    expect(qualityAt(Number.NaN)).toBe('poor');
    expect(qualityAt(Number.POSITIVE_INFINITY)).toBe('poor');
  });

  it('the indicator sweeps back and forth at constant speed (triangle wave)', () => {
    expect(meterPosition(0, 1.25)).toBe(0);
    expect(meterPosition(0.625, 1.25)).toBeCloseTo(0.5, 12);
    expect(meterPosition(1.25, 1.25)).toBeCloseTo(1, 12);
    expect(meterPosition(1.875, 1.25)).toBeCloseTo(0.5, 12);
    expect(meterPosition(2.5, 1.25)).toBeCloseTo(0, 12);
    for (let t = 0; t < 10; t += 0.013) {
      const p = meterPosition(t, 1.25);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('player launch: a press is graded from the meter; no press until the timeout gives Poor', () => {
    const z = DEFAULT_LAUNCH_ZONES;
    expect(playerLaunchQuality(0.625, 0.625, 1.25, z, 8)).toBe('perfect');
    expect(playerLaunchQuality(0.01, 0.01, 1.25, z, 8)).toBe('poor');
    expect(playerLaunchQuality(null, 7.99, 1.25, z, 8)).toBeNull();
    expect(playerLaunchQuality(null, 8, 1.25, z, 8)).toBe('poor');
    expect(playerLaunchQuality(null, 30, 1.25, z, 8)).toBe('poor');
  });
});

describe('launch energy bonus', () => {
  it('multiplies ROTATIONAL ENERGY by the bonus; ω scales by its square root', () => {
    for (const q of LAUNCH_QUALITIES) {
      const c = cfg(11);
      c.launch.playerQuality = 'poor';
      c.launch.opponentQuality = 'poor';
      const poor = new Battle(buildBattleOptions(c)).world.bodies[0]!;
      c.launch.playerQuality = q;
      const b = new Battle(buildBattleOptions(c)).world.bodies[0]!;
      const m = DEFAULT_LAUNCH_BONUSES[q];
      expect(b.spinEnergy / poor.spinEnergy).toBeCloseTo(m, 10);
      expect(Math.abs(b.omega / poor.omega)).toBeCloseTo(Math.sqrt(m), 10);
      // E = ½·I·ω² holds exactly.
      expect(0.5 * b.inertia * b.omega * b.omega).toBeCloseTo(b.spinEnergy, 12);
      // Perfect is +10 % energy (≈ +4.88 % ω), not +21 % energy.
      if (q === 'perfect') expect(Math.abs(b.omega / poor.omega)).toBeCloseTo(1.0488, 4);
    }
  });

  it('does not change position, velocity, health, attack, defense or critical chance', () => {
    const c = cfg(12);
    c.launch.playerQuality = 'poor';
    const a = new Battle(buildBattleOptions(c)).world.bodies[0]!;
    c.launch.playerQuality = 'perfect';
    const b = new Battle(buildBattleOptions(c)).world.bodies[0]!;
    expect([b.x, b.y, b.vx, b.vy, b.health]).toEqual([a.x, a.y, a.vx, a.vy, a.health]);
    expect(b.combat).toEqual(a.combat);
  });

  it('stamina starts full relative to the energy actually launched (bonus energy is not clamped away)', () => {
    const c = cfg(13);
    c.launch.playerQuality = 'perfect';
    c.launch.opponentQuality = 'poor';
    const bt = new Battle(buildBattleOptions(c));
    const [p, o] = bt.world.bodies;
    expect(p!.staminaFraction).toBe(1);
    expect(o!.staminaFraction).toBe(1);
    expect(p!.launchEnergy / o!.launchEnergy).toBeGreaterThan(1.05);
    expect(p!.launchEnergy).toBeCloseTo(p!.spinEnergy, 12);
  });

  it('labels the bonus separately from the quality', () => {
    expect(formatBonus(1.1)).toBe('+10%');
    expect(formatBonus(1.03)).toBe('+3%');
    expect(formatBonus(1)).toBe('+0%');
    expect(formatBonus(1.075)).toBe('+7.5%');
  });
});

describe('AI launch quality', () => {
  it('validates distributions', () => {
    expect(validDistribution(DEFAULT_AI_LAUNCH_DISTRIBUTION)).toBe(true);
    expect(validDistribution({ poor: 0.5, good: 0.5, great: 0.5, perfect: 0 })).toBe(false);
    expect(validDistribution({ poor: -0.1, good: 0.6, great: 0.4, perfect: 0.1 })).toBe(false);
    expect(validDistribution({ poor: Number.NaN, good: 0.4, great: 0.35, perfect: 0.1 })).toBe(false);
  });

  it('inverse-CDF sampling respects the bins', () => {
    const d = DEFAULT_AI_LAUNCH_DISTRIBUTION;
    expect(sampleQuality(d, 0)).toBe('poor');
    expect(sampleQuality(d, 0.1499)).toBe('poor');
    expect(sampleQuality(d, 0.15)).toBe('good');
    expect(sampleQuality(d, 0.5499)).toBe('good');
    expect(sampleQuality(d, 0.55)).toBe('great');
    expect(sampleQuality(d, 0.9)).toBe('perfect');
    expect(sampleQuality(d, 0.999999)).toBe('perfect');
  });

  it('matches the configured probabilities over many seeds', () => {
    const n = 40000;
    const counts: Record<string, number> = { poor: 0, good: 0, great: 0, perfect: 0 };
    for (let s = 0; s < n; s++) counts[aiLaunchQuality(s, 1)]!++;
    for (const q of LAUNCH_QUALITIES) expect(Math.abs(counts[q]! / n - DEFAULT_AI_LAUNCH_DISTRIBUTION[q])).toBeLessThan(0.01);
  });

  it('is reproducible from the seed and independent per slot', () => {
    for (let s = 1; s < 200; s++) expect(aiLaunchQuality(s, 1)).toBe(aiLaunchQuality(s, 1));
    let differ = 0;
    for (let s = 1; s < 200; s++) if (aiLaunchQuality(s, 0) !== aiLaunchQuality(s, 1)) differ++;
    expect(differ).toBeGreaterThan(80);
    // Both slots are identically distributed.
    const c0: Record<string, number> = { poor: 0, good: 0, great: 0, perfect: 0 };
    const c1: Record<string, number> = { poor: 0, good: 0, great: 0, perfect: 0 };
    for (let s = 0; s < 20000; s++) {
      c0[aiLaunchQuality(s, 0)]!++;
      c1[aiLaunchQuality(s, 1)]!++;
    }
    for (const q of LAUNCH_QUALITIES) expect(Math.abs(c0[q]! - c1[q]!) / 20000).toBeLessThan(0.015);
  });
});

describe('sandbox launch overrides, replay and rematch', () => {
  it('fixed qualities override the AI distribution for each side independently', () => {
    const c = cfg(21);
    c.launch.playerQuality = 'great';
    c.launch.opponentQuality = 'poor';
    const [p, o] = autoLaunches(c);
    expect([p.quality, p.energyMultiplier, p.source]).toEqual(['great', 1.07, 'fixed']);
    expect([o.quality, o.energyMultiplier, o.source]).toEqual(['poor', 1, 'fixed']);
    // A minigame result overrides the player side only.
    const [pm, om] = autoLaunches(c, 'perfect');
    expect([pm.quality, pm.source]).toEqual(['perfect', 'player']);
    expect(om.quality).toBe('poor');
  });

  it('an exact replay reproduces both the launch parameters and the outcome', () => {
    const c = cfg(31, 'inferno', 'phantom');
    const ls = [makeLaunch('perfect', c.launch.bonuses, 'player'), makeLaunch('good', c.launch.bonuses, 'ai')];
    const a = new Battle(buildBattleOptions(c, ls));
    const b = new Battle(buildBattleOptions(c, a.result?.launches ?? a.launches));
    const ra = a.runToEnd();
    const rb = b.runToEnd();
    expect(ra.launches).toEqual(ls);
    expect(rb).toEqual(ra);
  });

  it('a rematch keeps tops and configuration but uses a fresh seed (and so a fresh AI launch draw)', () => {
    const c = cfg(41, 'tempest', 'titan');
    c.player.overrides.attack = 50;
    const r = rematchConfig(c, 987654);
    expect(r.seed).toBe(987654);
    expect(r.player).toEqual(c.player);
    expect(r.opponent).toEqual(c.opponent);
    expect(c.seed).toBe(41);
    let changed = 0;
    for (let s = 0; s < 50; s++) if (aiLaunchQuality(s, 1) !== aiLaunchQuality(s + 1000, 1)) changed++;
    expect(changed).toBeGreaterThan(10);
  });
});

describe('result formatting', () => {
  it('never rounds a nonzero stamina to 0 %', () => {
    expect(formatStamina(0)).toBe('0%');
    expect(formatStamina(0.0004)).toBe('<0.1%');
    expect(formatStamina(0.004)).toBe('0.4%');
    expect(formatStamina(0.0199)).toBe('1.9%');
    expect(formatStamina(0.5)).toBe('50%');
    expect(formatStamina(1)).toBe('100%');
    expect(formatStamina(Number.NaN)).toBe('0%');
  });

  it('never shows 0 health for a top with health left', () => {
    expect(formatHealth(0.2, 600)).toBe('1 / 600');
    expect(formatHealth(0, 600)).toBe('0 / 600');
    expect(formatHealth(599.5, 600)).toBe('600 / 600');
  });
});
