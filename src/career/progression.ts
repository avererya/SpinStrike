/** Pure progression rules: costs, level gates, effective stats, XP, rewards, ranks. */
import {
  BASE_REWARDS,
  BASE_UPGRADE_COSTS,
  DIFFICULTY_REWARD_PERCENT,
  LEVEL_RANK_GATES,
  MAX_LEVEL,
  MAX_RANK_BONUS,
  MAX_UPGRADE_RANK,
  OUTCOME_REWARD_PERCENT,
  RANK_LADDER,
  RARITY_COST_PERCENT,
  rankDef,
  rankIndex,
  xpToNextLevel,
  type BattleOutcomeKind,
  type Difficulty,
  type RankDef,
  type RankTier,
  type Rarity,
  type UpgradeRanks,
  type UpgradeStat,
} from './config';
import { BASE_CRIT_CHANCE } from '../sim/combat';
import { DEFAULT_RULESET, baseStats, type Ruleset } from '../content/derive';
import type { GameplayStats } from '../content/stats';
import type { TopDefinition } from '../content/tops';

/** Round-half-up of a non-negative integer ratio a / b without float error. */
export function divRound(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

// ------------------------------------------------------------------ costs
/**
 * Credit cost of buying upgrade `rank` (1-based) for a top of `rarity`.
 * Uses cumulative rounding — cost(r) = round(cum(r)·m) − round(cum(r−1)·m) —
 * so per-rank costs are integers AND the full-upgrade totals are exactly the
 * approved targets (Common 13,900 / Rare 17,375 / Epic 20,850 / Legendary
 * 27,800 per attribute).
 */
export function upgradeCost(rarity: Rarity, rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_UPGRADE_RANK) throw new RangeError(`upgrade rank ${rank} out of range`);
  const pct = RARITY_COST_PERCENT[rarity];
  const cum = (r: number) => divRound(BASE_UPGRADE_COSTS.slice(0, r).reduce((a, b) => a + b, 0) * pct, 100);
  return cum(rank) - cum(rank - 1);
}

export function totalUpgradeCost(rarity: Rarity, ranks: number = MAX_UPGRADE_RANK): number {
  let sum = 0;
  for (let r = 1; r <= ranks; r++) sum += upgradeCost(rarity, r);
  return sum;
}

/** Cost to maximise all six attributes of a top of this rarity. */
export function fullUpgradeCost(rarity: Rarity): number {
  return totalUpgradeCost(rarity) * 6;
}

// ----------------------------------------------------------------- levels
/** Highest upgrade rank a top of `level` may buy. */
export function maxRankForLevel(level: number): number {
  let m = 0;
  for (const g of LEVEL_RANK_GATES) if (level >= g.level) m = g.maxRank;
  return m;
}
/** Lowest level that unlocks upgrade rank `rank`. */
export function levelForRank(rank: number): number {
  const g = LEVEL_RANK_GATES.find((x) => x.maxRank >= rank);
  return g ? g.level : MAX_LEVEL;
}

/** Cumulative XP needed to reach `level` from level 1. */
export function cumulativeXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) sum += xpToNextLevel(l);
  return sum;
}

export interface LevelUp {
  from: number;
  to: number;
  /** New upgrade-rank cap, when this level-up raised it. */
  newMaxRank: number | null;
}
export interface XpResult {
  level: number;
  /** XP into the current level (0 at max level). */
  xp: number;
  gained: number;
  levelUps: LevelUp[];
}

/** Adds XP with overflow carrying across levels. At MAX_LEVEL progression stops. */
export function applyXp(level: number, xp: number, gain: number): XpResult {
  let lvl = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  let cur = Math.max(0, Math.floor(xp));
  let pool = Math.max(0, Math.floor(gain));
  const levelUps: LevelUp[] = [];
  while (pool > 0 && lvl < MAX_LEVEL) {
    const need = xpToNextLevel(lvl) - cur;
    if (pool >= need) {
      pool -= need;
      const before = maxRankForLevel(lvl);
      lvl++;
      cur = 0;
      const after = maxRankForLevel(lvl);
      levelUps.push({ from: lvl - 1, to: lvl, newMaxRank: after > before ? after : null });
    } else {
      cur += pool;
      pool = 0;
    }
  }
  if (lvl >= MAX_LEVEL) cur = 0;
  return { level: lvl, xp: cur, gained: Math.max(0, Math.floor(gain)), levelUps };
}

// -------------------------------------------------------- effective stats
export interface EffectiveStats {
  stats: GameplayStats;
  critChance: number;
}
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Effective stats of a top = base stats of the CURRENT ruleset × linear
 * rank bonuses. Weight is never upgraded. Critical chance adds 2 percentage
 * points per rank on the 5 % base. Rank 0 returns the unmodified v0.3.1
 * base stats, so an unupgraded top is identical to the sandbox starter.
 */
export function effectiveStats(def: TopDefinition, ranks: UpgradeRanks, ruleset: Ruleset = DEFAULT_RULESET): EffectiveStats {
  const b = baseStats(def, ruleset);
  const f = (stat: Exclude<UpgradeStat, 'critChance'>) => round3(b[stat] * (1 + (MAX_RANK_BONUS[stat] * clampRank(ranks[stat])) / MAX_UPGRADE_RANK));
  return {
    stats: { health: f('health'), attack: f('attack'), defense: f('defense'), stamina: f('stamina'), speed: f('speed'), weight: b.weight },
    critChance: round3(BASE_CRIT_CHANCE + (MAX_RANK_BONUS.critChance * clampRank(ranks.critChance)) / MAX_UPGRADE_RANK),
  };
}
export function clampRank(r: number): number {
  return Number.isFinite(r) ? Math.min(MAX_UPGRADE_RANK, Math.max(0, Math.floor(r))) : 0;
}

/** Value of one attribute at a given rank, for "next upgrade" previews. */
export function statValueAtRank(def: TopDefinition, ranks: UpgradeRanks, stat: UpgradeStat, rank: number): number {
  const e = effectiveStats(def, { ...ranks, [stat]: rank });
  return stat === 'critChance' ? e.critChance : e.stats[stat];
}

export function upgradeCompletion(ranks: UpgradeRanks): { purchased: number; total: number } {
  const purchased = (Object.values(ranks) as number[]).reduce((a, b) => a + clampRank(b), 0);
  return { purchased, total: MAX_UPGRADE_RANK * 6 };
}

// ---------------------------------------------------------------- rewards
export interface Reward {
  credits: number;
  xp: number;
}
/**
 * Credits and XP for a completed battle. All arithmetic is done in integer
 * percent and rounded ONCE, half-up: base × difficulty% × outcome% / 10⁴.
 */
export function calculateReward(tier: RankTier, difficulty: Difficulty, outcome: BattleOutcomeKind): Reward {
  const base = BASE_REWARDS[tier];
  const d = DIFFICULTY_REWARD_PERCENT[difficulty];
  const o = OUTCOME_REWARD_PERCENT[outcome];
  return { credits: divRound(base.credits * d * o.credits, 10000), xp: divRound(base.xp * d * o.xp, 10000) };
}

// ------------------------------------------------------------------ ranks
export interface RankState {
  id: string;
  /** Victories earned in the current rank. */
  wins: number;
  /** Reached the end of the implemented ladder (Bronze championship qualification). */
  championshipQualified: boolean;
}
export interface RankProgress {
  rank: RankDef;
  wins: number;
  required: number | null;
  /** Next rank label, or null when the ladder end is reached. */
  nextLabel: string | null;
  qualified: boolean;
  /** True when this rank is the last implemented one. */
  atLimit: boolean;
}

export function nextImplementedRank(id: string): RankDef | null {
  const n = RANK_LADDER[rankIndex(id) + 1];
  return n && n.implemented ? n : null;
}

/** Applies one victory to the rank state. Pure. */
export function applyRankWin(state: RankState): { state: RankState; promoted: RankDef | null; qualifiedNow: boolean } {
  const def = rankDef(state.id);
  if (!def || def.winsToAdvance === null) return { state: { ...state }, promoted: null, qualifiedNow: false };
  const next = nextImplementedRank(def.id);
  if (!next) {
    // Last implemented rank: wins accumulate up to the qualification requirement, then stop.
    const wins = Math.min(def.winsToAdvance, state.wins + 1);
    const qualifiedNow = !state.championshipQualified && wins >= def.winsToAdvance;
    return { state: { id: def.id, wins, championshipQualified: state.championshipQualified || wins >= def.winsToAdvance }, promoted: null, qualifiedNow };
  }
  const wins = state.wins + 1;
  if (wins >= def.winsToAdvance) return { state: { id: next.id, wins: 0, championshipQualified: false }, promoted: next, qualifiedNow: false };
  return { state: { id: def.id, wins, championshipQualified: false }, promoted: null, qualifiedNow: false };
}

export function rankProgress(state: RankState): RankProgress {
  const rank = rankDef(state.id) ?? RANK_LADDER[0]!;
  const next = nextImplementedRank(rank.id);
  return {
    rank,
    wins: state.wins,
    required: rank.winsToAdvance,
    nextLabel: next ? next.label : null,
    qualified: state.championshipQualified,
    atLimit: !next,
  };
}
