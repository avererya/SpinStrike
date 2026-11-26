import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { runBatch } from '../src/sim/headless';
import { autoLaunches, buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { STARTER_TOPS } from '../src/content/tops';
import { createBattleSetup, buildCareerConfig } from '../src/career/battle';
import { UPGRADE_STATS, zeroRanks, type UpgradeRanks } from '../src/career/config';
import { effectiveStats } from '../src/career/progression';
import { generateOpponent } from '../src/career/opponents';
import { getTop } from '../src/content/tops';

const maxed = (): UpgradeRanks => Object.fromEntries(UPGRADE_STATS.map((k) => [k, 10])) as UpgradeRanks;

describe('career vs v0.3.1 sandbox equivalence', () => {
  it('an unupgraded career top produces identical battles to the sandbox for identical seeds and launches', () => {
    for (const p of STARTER_TOPS) {
      for (const o of STARTER_TOPS) {
        for (const seed of [1, 2, 3]) {
          const sandbox = defaultConfig(seed);
          sandbox.player = { topId: p.id, overrides: {} };
          sandbox.opponent = { topId: o.id, overrides: {} };
          const setup = createBattleSetup({ battleId: 'x', seed, opponentSeed: 1, difficulty: 'normal', playerRankId: 'bronze-3', playerInstanceId: 'i', playerTopId: p.id });
          setup.opponent = { topId: o.id, rankId: 'bronze-3', ranks: zeroRanks() };
          const career = buildCareerConfig(setup, { definitionId: p.id, upgrades: zeroRanks() });
          const a = new Battle(buildBattleOptions(sandbox, autoLaunches(sandbox))).runToEnd();
          const b = new Battle(buildBattleOptions(career, autoLaunches(career))).runToEnd();
          expect(b).toEqual(a);
        }
      }
    }
  });
  it('career battles use a fresh default config: no sandbox override can leak in', () => {
    const setup = createBattleSetup({ battleId: 'x', seed: 9, opponentSeed: 1, difficulty: 'hard', playerRankId: 'bronze-3', playerInstanceId: 'i', playerTopId: 'titan' });
    const c = buildCareerConfig(setup, { definitionId: 'titan', upgrades: zeroRanks() });
    const d = defaultConfig(9);
    expect(c.player.overrides).toEqual({});
    expect(c.opponent.overrides).toEqual({});
    expect({ ...c, player: 0, opponent: 0, launch: 0 }).toEqual({ ...d, player: 0, opponent: 0, launch: 0 });
    expect(c.launch.aiDistribution).toEqual({ poor: 0.05, good: 0.25, great: 0.45, perfect: 0.25 });
    expect(c.ruleset).toBe('v0.3');
  });
  it('difficulty changes only launch distribution, never opponent stats', () => {
    const mk = (d: 'easy' | 'expert') => createBattleSetup({ battleId: 'x', seed: 1, opponentSeed: 77, difficulty: d, playerRankId: 'bronze-2', playerInstanceId: 'i', playerTopId: 'inferno' });
    expect(mk('easy').opponent).toEqual(mk('expert').opponent);
  });
});

describe('upgrades have real combat effects', () => {
  it('upgrade stats reach the engine (health, attack, defense, crit, stamina, speed)', () => {
    const base = getTop('inferno');
    const sandbox = buildBattleOptions(defaultConfig(1));
    const setup = createBattleSetup({ battleId: 'x', seed: 1, opponentSeed: 1, difficulty: 'normal', playerRankId: 'bronze-3', playerInstanceId: 'i', playerTopId: base.id });
    const cfg = buildCareerConfig(setup, { definitionId: base.id, upgrades: maxed() });
    const up = buildBattleOptions(cfg);
    const b = sandbox.topCombat![0]!;
    const u = up.topCombat![0]!;
    expect(u.maxHealth).toBeCloseTo(b.maxHealth * 1.5, 6);
    expect(u.attack).toBeCloseTo(b.attack * 1.4, 6);
    expect(u.critChance).toBeCloseTo(0.25, 9);
    expect(u.critMultiplier).toBe(b.critMultiplier);
    const bp = sandbox.tops[0]!;
    const up0 = up.tops[0]!;
    expect(up0.spinDecay).toBeLessThan(bp.spinDecay); // stamina
    expect(up0.launchSpeed).toBeGreaterThan(bp.launchSpeed); // speed (beyond the old 100 ceiling for Inferno)
    expect(up0.tipTraction).toBeGreaterThan(bp.tipTraction);
    expect(up0.mass).toBe(bp.mass); // weight is not upgradeable
    const defUp = buildBattleOptions(buildCareerConfig(setup, { definitionId: 'titan', upgrades: { ...zeroRanks(), defense: 10 } })).topCombat![0]!;
    expect(defUp.defense).toBeCloseTo(82 * 1.4, 6);
  });
  it('speed keeps scaling past stat 100 (no dead late ranks)', () => {
    const d = getTop('inferno');
    const sp = (r: number) => buildBattleOptions(buildCareerConfig(createBattleSetup({ battleId: 'x', seed: 1, opponentSeed: 1, difficulty: 'normal', playerRankId: 'bronze-3', playerInstanceId: 'i', playerTopId: d.id }), { definitionId: d.id, upgrades: { ...zeroRanks(), speed: r } })).tops[0]!.launchSpeed;
    expect(sp(8)).toBeGreaterThan(sp(7));
    expect(sp(10)).toBeGreaterThan(sp(9));
    expect(effectiveStats(d, { ...zeroRanks(), speed: 10 }).stats.speed).toBeGreaterThan(100);
  });
});

describe('opponent generation', () => {
  it('is deterministic and bounded per Bronze division', () => {
    const bands: Record<string, [number, number]> = { 'bronze-3': [0, 1], 'bronze-2': [0, 3], 'bronze-1': [1, 5] };
    for (const [rank, [lo, hi]] of Object.entries(bands)) {
      const seen = new Set<string>();
      for (let s = 0; s < 300; s++) {
        const o = generateOpponent(rank, s);
        expect(generateOpponent(rank, s)).toEqual(o);
        seen.add(o.topId);
        for (const k of UPGRADE_STATS) {
          expect(o.ranks[k]).toBeGreaterThanOrEqual(lo);
          expect(o.ranks[k]).toBeLessThanOrEqual(hi);
        }
      }
      expect(seen.size).toBe(STARTER_TOPS.length);
    }
  });
});

describe('upgraded-top simulations are stable', () => {
  const runs: [string, UpgradeRanks, string, UpgradeRanks][] = [];
  for (const p of STARTER_TOPS) for (const o of STARTER_TOPS) runs.push([p.id, maxed(), o.id, zeroRanks()], [p.id, maxed(), o.id, maxed()]);
  it('maxed tops: no NaN, no guard trips, no timeouts, valid health', () => {
    for (const [p, pr, o, or] of runs) {
      const make = (seed: number) => {
        const c = defaultConfig(seed);
        const pe = effectiveStats(getTop(p), pr);
        const oe = effectiveStats(getTop(o), or);
        c.player = { topId: p, overrides: {}, stats: pe.stats, critChance: pe.critChance };
        c.opponent = { topId: o, overrides: {}, stats: oe.stats, critChance: oe.critChance };
        return buildBattleOptions(c, autoLaunches(c));
      };
      const b = runBatch(make, 12, 4000);
      expect(b.failures, `${p} vs ${o}: ${b.failureDetails.join(';')}`).toBe(0);
      expect(b.timeouts).toBe(0);
      expect(b.maxDuration).toBeLessThan(180);
      expect(Number.isFinite(b.avgDuration)).toBe(true);
    }
  }, 120000);
  it('upgrades give a meaningful benefit: maxed beats unupgraded most of the time', () => {
    let wins = 0;
    let total = 0;
    for (const p of STARTER_TOPS) {
      for (const o of STARTER_TOPS) {
        const make = (seed: number) => {
          const c = defaultConfig(seed);
          const pe = effectiveStats(getTop(p.id), maxed());
          c.player = { topId: p.id, overrides: {}, stats: pe.stats, critChance: pe.critChance };
          c.opponent = { topId: o.id, overrides: {} };
          return buildBattleOptions(c, autoLaunches(c));
        };
        const b = runBatch(make, 10, 9000);
        wins += b.wins[0];
        total += b.battles;
      }
    }
    expect(wins / total).toBeGreaterThan(0.85);
  }, 120000);
});
