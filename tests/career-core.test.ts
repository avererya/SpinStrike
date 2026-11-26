import { describe, expect, it } from 'vitest';
import {
  BASE_UPGRADE_COSTS,
  MAX_LEVEL,
  RANK_LADDER,
  STARTING_CREDITS,
  UPGRADE_STATS,
  xpToNextLevel,
  zeroRanks,
  DIFFICULTIES,
  type Difficulty,
} from '../src/career/config';
import {
  applyRankWin,
  applyXp,
  calculateReward,
  cumulativeXpForLevel,
  effectiveStats,
  fullUpgradeCost,
  levelForRank,
  maxRankForLevel,
  totalUpgradeCost,
  upgradeCost,
} from '../src/career/progression';
import { STARTER_TOPS, getTop } from '../src/content/tops';

describe('upgrade costs', () => {
  it('matches the approved Common table', () => {
    expect(BASE_UPGRADE_COSTS.map((_, i) => upgradeCost('common', i + 1))).toEqual([100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4500]);
    expect(totalUpgradeCost('common')).toBe(13900);
    expect(fullUpgradeCost('common')).toBe(83400);
  });
  it('hits the approved rarity totals exactly with integer per-rank costs', () => {
    expect(fullUpgradeCost('rare')).toBe(104250);
    expect(fullUpgradeCost('epic')).toBe(125100);
    expect(fullUpgradeCost('legendary')).toBe(166800);
    for (const r of ['rare', 'epic', 'legendary'] as const) for (let k = 1; k <= 10; k++) expect(Number.isInteger(upgradeCost(r, k))).toBe(true);
  });
  it('rejects out-of-range ranks', () => {
    expect(() => upgradeCost('common', 0)).toThrow();
    expect(() => upgradeCost('common', 11)).toThrow();
  });
});

describe('levels and XP', () => {
  it('follows the XP curve', () => {
    expect([1, 5, 10, 20, 29].map(xpToNextLevel)).toEqual([100, 200, 325, 575, 800]);
    expect(cumulativeXpForLevel(30)).toBe(13050);
  });
  it('carries overflow across levels and reports level-ups with unlocked ranks', () => {
    const r = applyXp(1, 50, 400); // 50+400 = 450: L1→2 (100), L2→3 (125), L3→4 (150) = 375, 75 left
    expect(r.level).toBe(4);
    expect(r.xp).toBe(75);
    expect(r.levelUps.map((l) => l.to)).toEqual([2, 3, 4]);
    const toFive = applyXp(4, 0, 175); // L4→5 needs 175
    expect(toFive.level).toBe(5);
    expect(toFive.levelUps[0]!.newMaxRank).toBe(4);
  });
  it('stops at the maximum level', () => {
    const r = applyXp(30, 0, 5000);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.xp).toBe(0);
    expect(r.levelUps).toEqual([]);
    expect(applyXp(29, 0, 100000).level).toBe(30);
  });
  it('gates upgrade ranks by level', () => {
    const t: [number, number][] = [[1, 2], [4, 2], [5, 4], [9, 4], [10, 6], [15, 8], [20, 9], [25, 10], [30, 10]];
    for (const [lvl, max] of t) expect(maxRankForLevel(lvl)).toBe(max);
    expect(levelForRank(3)).toBe(5);
    expect(levelForRank(10)).toBe(25);
  });
});

describe('effective stats', () => {
  it('leaves unupgraded tops exactly at v0.3.1 base stats and 5 % crit', () => {
    for (const d of STARTER_TOPS) {
      const e = effectiveStats(d, zeroRanks());
      expect(e.stats).toEqual(d.stats);
      expect(e.critChance).toBe(0.05);
    }
  });
  it('applies the approved rank-10 bonuses linearly', () => {
    const d = getTop('inferno');
    const max = Object.fromEntries(UPGRADE_STATS.map((k) => [k, 10])) as ReturnType<typeof zeroRanks>;
    const e = effectiveStats(d, max);
    // v0.4.1 Inferno base stats (60/95/35/64/90/50); the rank bonuses are unchanged.
    expect(e.stats.health).toBeCloseTo(60 * 1.5, 6);
    expect(e.stats.attack).toBeCloseTo(95 * 1.4, 6);
    expect(e.stats.defense).toBeCloseTo(35 * 1.4, 6);
    expect(e.stats.stamina).toBeCloseTo(64 * 1.3, 6);
    expect(e.stats.speed).toBeCloseTo(90 * 1.25, 6);
    expect(e.stats.weight).toBe(50);
    expect(e.critChance).toBeCloseTo(0.25, 9);
    const r5 = effectiveStats(d, { ...zeroRanks(), attack: 5, critChance: 3 });
    expect(r5.stats.attack).toBeCloseTo(95 * 1.2, 6);
    expect(r5.critChance).toBeCloseTo(0.11, 9);
  });
});

describe('rewards', () => {
  it('matches the Bronze table with the temporary v0.4.1 difficulty multipliers (0.75/1/1.1/1.2, one half-up rounding)', () => {
    const exp: Record<Difficulty, [number, number]> = { easy: [75, 38], normal: [100, 50], hard: [110, 55], expert: [120, 60] };
    for (const d of DIFFICULTIES) expect(calculateReward('bronze', d, 'win')).toEqual({ credits: exp[d][0], xp: exp[d][1] });
  });
  it('pays 5%/10% for a defeat and 15%/25% for a draw (round half up)', () => {
    expect(calculateReward('bronze', 'normal', 'loss')).toEqual({ credits: 5, xp: 5 });
    expect(calculateReward('bronze', 'normal', 'draw')).toEqual({ credits: 15, xp: 13 });
    expect(calculateReward('bronze', 'expert', 'loss')).toEqual({ credits: 6, xp: 6 });
    expect(calculateReward('bronze', 'easy', 'loss')).toEqual({ credits: 4, xp: 4 }); // 3.75 → 4 (single rounding)
    expect(calculateReward('bronze', 'easy', 'draw')).toEqual({ credits: 11, xp: 9 }); // 11.25 → 11, 9.375 → 9
    expect(calculateReward('master', 'hard', 'win')).toEqual({ credits: 660, xp: 275 });
  });
  it('starting credits constant', () => expect(STARTING_CREDITS).toBe(500));
});

describe('rank ladder', () => {
  it('lists the complete hierarchy', () => {
    expect(RANK_LADDER.map((r) => r.label)).toHaveLength(16);
    expect(RANK_LADDER[0]!.label).toBe('Bronze III');
    expect(RANK_LADDER[15]!.label).toBe('Master');
  });
  it('promotes Bronze III→II after 10 wins, II→I after 20 more, then qualifies after 30 more', () => {
    let s = { id: 'bronze-3', wins: 0, championshipQualified: false };
    for (let i = 0; i < 9; i++) s = applyRankWin(s).state;
    expect(s).toMatchObject({ id: 'bronze-3', wins: 9 });
    let r = applyRankWin(s);
    expect(r.promoted?.id).toBe('bronze-2');
    s = r.state;
    expect(s.wins).toBe(0);
    for (let i = 0; i < 20; i++) s = applyRankWin(s).state;
    expect(s.id).toBe('bronze-1');
    for (let i = 0; i < 29; i++) {
      r = applyRankWin(s);
      s = r.state;
      expect(r.qualifiedNow).toBe(false);
    }
    r = applyRankWin(s);
    expect(r.qualifiedNow).toBe(true);
    expect(r.state).toMatchObject({ id: 'bronze-1', wins: 30, championshipQualified: true });
    r = applyRankWin(r.state); // further wins neither promote nor overflow
    expect(r.state).toMatchObject({ id: 'bronze-1', wins: 30, championshipQualified: true });
    expect(r.promoted).toBeNull();
    expect(r.qualifiedNow).toBe(false);
  });
});
