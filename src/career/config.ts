/**
 * Career progression configuration (v0.4).
 *
 * Every number here is either APPROVED (design requirement) or PROVISIONAL
 * (balancing value expected to change). The split is documented in
 * docs/PROGRESSION.md. Nothing in this file touches the combat engine.
 */
import type { LaunchDistribution } from '../sim/launch';
import { AIM_LIMITS, DEFAULT_AI_AIM, type AiAimProfile } from '../sim/launchGeometry';

// ------------------------------------------------------------------ rarity
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
/** Upgrade cost multiplier per rarity, in percent (APPROVED). Integer percent keeps rounding exact. */
export const RARITY_COST_PERCENT: Record<Rarity, number> = { common: 100, rare: 125, epic: 150, legendary: 200 };
/** Rarities that may be played in career mode in v0.4 (APPROVED). */
export const CAREER_PLAYABLE_RARITIES: readonly Rarity[] = ['common'];

// ---------------------------------------------------------------- upgrades
/** The six independently upgradeable attributes (weight is intentionally absent). */
export const UPGRADE_STATS = ['health', 'attack', 'defense', 'stamina', 'speed', 'critChance'] as const;
export type UpgradeStat = (typeof UPGRADE_STATS)[number];
export const UPGRADE_STAT_LABEL: Record<UpgradeStat, string> = {
  health: 'Health',
  attack: 'Attack',
  defense: 'Defense',
  stamina: 'Stamina',
  speed: 'Speed',
  critChance: 'Critical Chance',
};
export const MAX_UPGRADE_RANK = 10;

/** Per-attribute upgrade rank (0 = never upgraded). */
export type UpgradeRanks = Record<UpgradeStat, number>;
export function zeroRanks(): UpgradeRanks {
  return { health: 0, attack: 0, defense: 0, stamina: 0, speed: 0, critChance: 0 };
}

/** Common-rarity cost of upgrade rank 1…10 (APPROVED). Total 13,900 per attribute. */
export const BASE_UPGRADE_COSTS: readonly number[] = [100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 4500];

/**
 * Bonus at rank 10, as a fraction of the base stat (APPROVED), applied
 * linearly per rank. critChance is in absolute probability (percentage
 * points / 100) added to the 5 % base chance.
 */
export const MAX_RANK_BONUS: Record<UpgradeStat, number> = {
  health: 0.5,
  attack: 0.4,
  defense: 0.4,
  stamina: 0.3,
  speed: 0.25,
  critChance: 0.2,
};

/**
 * What the rank-10 percentages above are a percentage OF (v0.5):
 *   'percent'   – each top's own base stat (v0.4 rule). High bases gain the
 *                 most points, which made fully upgraded Titan (largest
 *                 Health and Defense) win 63 % of full-vs-full battles.
 *   'reference' – the roster-average base stat (UPGRADE_REFERENCE_STATS),
 *                 so every top gains the same number of points per rank.
 *                 Same percentages and costs; no class modifier.
 */
export type UpgradeBonusBasis = 'percent' | 'reference';
export const UPGRADE_BONUS_BASIS: UpgradeBonusBasis = 'percent';

/** Highest upgrade rank available at a given top level (APPROVED). Sorted by level. */
export const LEVEL_RANK_GATES: readonly { level: number; maxRank: number }[] = [
  { level: 1, maxRank: 2 },
  { level: 5, maxRank: 4 },
  { level: 10, maxRank: 6 },
  { level: 15, maxRank: 8 },
  { level: 20, maxRank: 9 },
  { level: 25, maxRank: 10 },
];

// ------------------------------------------------------------------ levels
export const MAX_LEVEL = 30;
/** XP needed to go from level L to L+1 (APPROVED, provisional curve). */
export function xpToNextLevel(level: number): number {
  return 100 + 25 * (level - 1);
}

// -------------------------------------------------------------------- ranks
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
export interface RankDef {
  id: string;
  tier: RankTier;
  /** 3, 2, 1 (3 = lowest) or 0 for Master. */
  division: number;
  label: string;
  /**
   * Victories needed IN THIS RANK to advance (PROVISIONAL). For the last
   * implemented rank this is the championship qualification requirement.
   */
  winsToAdvance: number | null;
  /** Whether the rank can be played in this release (Bronze only in v0.4). */
  implemented: boolean;
}

const ROMAN: Record<number, string> = { 3: 'III', 2: 'II', 1: 'I' };
const TIERS: RankTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const TIER_LABEL: Record<RankTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond', master: 'Master' };
export { TIER_LABEL };
const BRONZE_WINS: Record<number, number> = { 3: 10, 2: 20, 1: 30 };

/** The complete planned ladder (APPROVED hierarchy; Bronze requirements PROVISIONAL). */
export const RANK_LADDER: readonly RankDef[] = [
  ...TIERS.flatMap((tier) =>
    [3, 2, 1].map<RankDef>((division) => ({
      id: `${tier}-${division}`,
      tier,
      division,
      label: `${TIER_LABEL[tier]} ${ROMAN[division]}`,
      winsToAdvance: tier === 'bronze' ? BRONZE_WINS[division]! : null,
      implemented: tier === 'bronze',
    })),
  ),
  { id: 'master', tier: 'master', division: 0, label: 'Master', winsToAdvance: null, implemented: false },
];
export const STARTING_RANK_ID = 'bronze-3';
export function rankDef(id: string): RankDef | undefined {
  return RANK_LADDER.find((r) => r.id === id);
}
export function rankIndex(id: string): number {
  return RANK_LADDER.findIndex((r) => r.id === id);
}
export function isRankId(id: unknown): id is string {
  return typeof id === 'string' && rankIndex(id) >= 0;
}

// ----------------------------------------------------------------- economy
export const STARTING_CREDITS = 500; // PROVISIONAL

/** Base victory rewards by opponent rank tier (APPROVED). Only Bronze is playable in v0.4. */
export const BASE_REWARDS: Record<RankTier, { credits: number; xp: number }> = {
  bronze: { credits: 100, xp: 50 },
  silver: { credits: 150, xp: 75 },
  gold: { credits: 225, xp: 100 },
  platinum: { credits: 325, xp: 150 },
  diamond: { credits: 450, xp: 200 },
  master: { credits: 600, xp: 250 },
};

import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../ai/difficulty';
export { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty };
/**
 * Reward multiplier in percent. v0.4.1 TEMPORARY values (approved): difficulty
 * currently changes only the AI's launch quality, and simulated win rates
 * barely move with it (≈ 90 % Easy / 89 % Normal / 90 % Expert in v0.4.0),
 * so the v0.4.0 multipliers (50 / 100 / 150 / 200 %) over-rewarded Expert.
 * To be revisited in v0.5 with tactical AI. Applies to Credits and XP.
 */
export const DIFFICULTY_REWARD_PERCENT: Record<Difficulty, number> = { easy: 75, normal: 100, hard: 110, expert: 120 };
/** v0.4.0 multipliers, kept for documentation and comparison only. */
export const V040_DIFFICULTY_REWARD_PERCENT: Readonly<Record<Difficulty, number>> = { easy: 50, normal: 100, hard: 150, expert: 200 };
/**
 * AI launch-quality distributions per difficulty (PROVISIONAL). Difficulty
 * changes only how well the AI launches; it never changes opponent stats.
 * Normal equals the v0.3.1 default distribution.
 */
export const DIFFICULTY_LAUNCH: Record<Difficulty, LaunchDistribution> = {
  easy: { poor: 0.45, good: 0.4, great: 0.13, perfect: 0.02 },
  normal: { poor: 0.15, good: 0.4, great: 0.35, perfect: 0.1 },
  hard: { poor: 0.05, good: 0.25, great: 0.45, perfect: 0.25 },
  expert: { poor: 0, good: 0.1, great: 0.4, perfect: 0.5 },
};
/**
 * v0.5 AI launch-aim skill per difficulty. Easy aims anywhere (often badly),
 * Normal keeps the v0.4.1 profile, Hard and Expert aim close to the aim that
 * suits their top best (v0.4.1 aim evaluation: Inferno and Phantom −45°/0°,
 * Titan +45°/30°, Tempest 0°/15°), with seeded spread. Aim changes no stat.
 */
export const PREFERRED_AIM: Readonly<Record<string, { direction: number; tilt: number }>> = {
  inferno: { direction: -45, tilt: 0 },
  titan: { direction: 45, tilt: 30 },
  tempest: { direction: 0, tilt: 15 },
  phantom: { direction: -45, tilt: 0 },
};
const AIM_SPREAD: Record<'hard' | 'expert', { direction: number; tilt: number }> = {
  hard: { direction: 18, tilt: 8 },
  expert: { direction: 8, tilt: 4 },
};
export function difficultyAiAim(d: Difficulty, topId: string): AiAimProfile {
  if (d === 'easy') return { direction: { min: -45, max: 45 }, tilt: { min: 0, max: 30 } };
  const pref = PREFERRED_AIM[topId];
  if (d === 'normal' || !pref) return { direction: { ...DEFAULT_AI_AIM.direction }, tilt: { ...DEFAULT_AI_AIM.tilt } };
  const sp = AIM_SPREAD[d];
  const clampR = (c: number, w: number, lo: number, hi: number) => ({ min: Math.max(lo, c - w), max: Math.min(hi, c + w) });
  return {
    direction: clampR(pref.direction, sp.direction, AIM_LIMITS.direction.min, AIM_LIMITS.direction.max),
    tilt: clampR(pref.tilt, sp.tilt, AIM_LIMITS.tilt.min, AIM_LIMITS.tilt.max),
  };
}

export const DIFFICULTY_DESCRIPTION: Record<Difficulty, string> = {
  easy: 'Weak launches, careless aim, slow and clumsy with Boost and Brace.',
  normal: 'Typical launches and aim; uses abilities sensibly but makes mistakes.',
  hard: 'Strong launches, good aim, quick and well-timed abilities.',
  expert: 'Near-perfect launches and aim, sharp Brace timing and careful charge use.',
};

export type BattleOutcomeKind = 'win' | 'loss' | 'draw';
/** Share of the calculated Credits / XP awarded per outcome, in percent (APPROVED). */
export const OUTCOME_REWARD_PERCENT: Record<BattleOutcomeKind, { credits: number; xp: number }> = {
  win: { credits: 100, xp: 100 },
  loss: { credits: 5, xp: 10 },
  draw: { credits: 15, xp: 25 },
};

/** Number of recent battle records kept per top (APPROVED). */
export const RECENT_BATTLE_LIMIT = 100;
/** Battle ids remembered for duplicate-claim protection. */
export const CLAIMED_ID_LIMIT = 500;

// --------------------------------------------------------- bronze opponents
/**
 * Bounded, randomised opponent builds per Bronze division (PROVISIONAL):
 * every attribute gets a rank in [min, max] chosen from the battle's
 * opponent seed, so opponents never scale to the player's strength.
 */
export const OPPONENT_BUILDS: Record<string, { min: number; max: number }> = {
  'bronze-3': { min: 0, max: 1 },
  'bronze-2': { min: 0, max: 3 },
  'bronze-1': { min: 1, max: 5 },
};
