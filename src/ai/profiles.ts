/**
 * Tactical AI profiles (v0.5).
 *
 * Two independent layers:
 *   - PERSONALITY (per top, reusable): WHAT the AI tends to want: how much it
 *     values interception, knockouts, centre recovery, evasion, Brace,
 *     stamina conservation. Defaults come from the top's class; a top can
 *     name its own profile (TopDefinition.tacticalProfile), so two tops of
 *     the same class can fight differently.
 *   - SKILL (per difficulty): HOW WELL it does it: decision rate, reaction
 *     latency, prediction error, look-ahead, Brace timing, resource planning
 *     and the chance of a poor decision.
 *
 * Neither layer touches stats, charges, cooldowns or costs: the AI uses the
 * exact same validated commands as the player.
 */
import type { Difficulty } from './difficulty';
import type { TopClass } from '../content/stats';

export interface Personality {
  id: string;
  label: string;
  /** Offensive interception when the opponent is reachable. */
  interception: number;
  /** Knockout attempts against an opponent near the rim. */
  knockout: number;
  /** Breaking long no-contact stretches (passive orbits). */
  orbitBreak: number;
  /** Seconds without contact before an orbit break becomes attractive. */
  orbitPatience: number;
  /** Counter-attacks right after an exchange, when the opponent is close and slow. */
  counter: number;
  /** Recovery toward the centre when drifting to the rim. */
  centerRecovery: number;
  /** Evading incoming attacks. */
  evasion: number;
  /** Willingness to Brace before an impact. */
  brace: number;
  /** Minimum predicted impact speed (m/s) worth a Brace. */
  braceMinImpact: number;
  /** 0–1: how strongly stamina is conserved (lower boost strengths, fewer boosts). */
  conservation: number;
  /** Adapt offence/defence to the current advantage and the opponent's class. */
  adaptive: boolean;
}

export const PERSONALITIES: Readonly<Record<string, Personality>> = {
  striker: {
    id: 'striker',
    label: 'Striker (Attack)',
    interception: 1,
    knockout: 1,
    orbitBreak: 1,
    orbitPatience: 3.5,
    counter: 0.6,
    centerRecovery: 0.35,
    evasion: 0.1,
    brace: 0.45,
    braceMinImpact: 0.35,
    conservation: 0.15,
    adaptive: false,
  },
  bulwark: {
    id: 'bulwark',
    label: 'Bulwark (Defense)',
    interception: 0.3,
    knockout: 0.55,
    orbitBreak: 0.55,
    orbitPatience: 7,
    counter: 1,
    centerRecovery: 1,
    evasion: 0.15,
    brace: 1,
    braceMinImpact: 0.2,
    conservation: 0.5,
    adaptive: false,
  },
  endurer: {
    id: 'endurer',
    label: 'Endurer (Stamina)',
    interception: 0.12,
    knockout: 0.3,
    orbitBreak: 0.15,
    orbitPatience: 14,
    counter: 0.2,
    centerRecovery: 0.7,
    evasion: 1,
    brace: 0.6,
    braceMinImpact: 0.45,
    conservation: 1,
    adaptive: false,
  },
  tactician: {
    id: 'tactician',
    label: 'Tactician (Balance)',
    interception: 0.6,
    knockout: 0.7,
    orbitBreak: 0.6,
    orbitPatience: 6,
    counter: 0.6,
    centerRecovery: 0.6,
    evasion: 0.55,
    brace: 0.7,
    braceMinImpact: 0.3,
    conservation: 0.5,
    adaptive: true,
  },
};

export const CLASS_PERSONALITY: Readonly<Record<TopClass, string>> = {
  Attack: 'striker',
  Defense: 'bulwark',
  Stamina: 'endurer',
  Balance: 'tactician',
};

export function personalityFor(topClass: TopClass, profileId?: string): Personality {
  return PERSONALITIES[profileId ?? ''] ?? PERSONALITIES[CLASS_PERSONALITY[topClass]] ?? PERSONALITIES.tactician!;
}

export interface Skill {
  /** Seconds between evaluations. */
  decisionInterval: number;
  /** Latency between deciding and acting, s (uniform range). */
  reaction: readonly [number, number];
  /** Heading error on predicted relative motion, rad (1σ-like uniform half-range). */
  predictionError: number;
  /** Collision look-ahead, s. */
  horizon: number;
  /** Utility needed to act (higher = fewer actions). */
  threshold: number;
  /** Chance that a boost goes out with a poor direction. */
  mistakeChance: number;
  /** 0–1 Brace timing quality (how tightly Brace is placed before an impact). */
  braceTiming: number;
  /** 0–1 how strictly charges are rationed across the expected battle length. */
  planning: number;
  /** Utility noise amplitude (indecision). */
  noise: number;
  /** Scale on all utilities (how readily the AI uses abilities at all). */
  activity: number;
  /** 0–1 use of learned matchup knowledge (MATCHUP_KNOWLEDGE). */
  knowledge: number;
}

export const SKILLS: Readonly<Record<Difficulty, Skill>> = {
  easy: { knowledge: 0, decisionInterval: 0.7, reaction: [0.35, 0.65], predictionError: 0.55, horizon: 0.45, threshold: 0.7, mistakeChance: 0.35, braceTiming: 0.15, planning: 0.1, noise: 0.35, activity: 0.55 },
  normal: { knowledge: 0.55, decisionInterval: 0.35, reaction: [0.22, 0.38], predictionError: 0.25, horizon: 0.8, threshold: 0.55, mistakeChance: 0.08, braceTiming: 0.5, planning: 0.6, noise: 0.18, activity: 0.8 },
  hard: { knowledge: 0.75, decisionInterval: 0.22, reaction: [0.14, 0.24], predictionError: 0.12, horizon: 1.0, threshold: 0.42, mistakeChance: 0.04, braceTiming: 0.78, planning: 0.8, noise: 0.12, activity: 1 },
  expert: { knowledge: 1, decisionInterval: 0.15, reaction: [0.1, 0.16], predictionError: 0.05, horizon: 1.2, threshold: 0.36, mistakeChance: 0, braceTiming: 0.95, planning: 1, noise: 0.06, activity: 1.05 },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES);

/**
 * Learned matchup knowledge (v0.5): per class pair, how valuable each
 * tactic proved in offline AI-vs-passive simulations (1 = neutral, 0 =
 * harmful, 2 = strongly helpful). Higher difficulties weight it more
 * (Skill.knowledge), the way an experienced player learns matchups. It is
 * public, class-level knowledge: it never reads the battle seed or state the
 * player cannot see. Generated by scripts/tactical-learn.ts (200 battles × 2 slots per
 * variant and class pair, seed 800001); entries within ±0.3 of neutral
 * (about one standard error) are omitted as noise.
 */
export type TacticKind = 'brace' | 'evade' | 'recover' | 'intercept' | 'knockout' | 'orbit' | 'counter' | 'combo';
export const MATCHUP_KNOWLEDGE: Readonly<Partial<Record<TopClass, Partial<Record<TopClass, Partial<Record<TacticKind, number>>>>>>> = {
  Attack: {
    Attack: { brace: 1.61, evade: 0.66, knockout: 0.5 },
    Defense: { intercept: 0.54, knockout: 0.68 },
    Stamina: { knockout: 0.3 },
    Balance: { evade: 0.49, intercept: 1.31, combo: 1.48, knockout: 1.84, orbit: 1.34 },
  },
  Defense: {
    Attack: { knockout: 1.31 },
    Defense: { evade: 0.54, intercept: 0, combo: 0, knockout: 0, orbit: 0, counter: 0 },
    Stamina: { counter: 0.25 },
    Balance: { brace: 1.65, combo: 2, knockout: 0, orbit: 0.36, counter: 0.7 },
  },
  Stamina: {
    Attack: { knockout: 2 },
    Defense: { intercept: 1.48, combo: 1.78 },
    Stamina: { intercept: 0, combo: 0, orbit: 0.35, counter: 0 },
    Balance: { knockout: 1.9, orbit: 0.6, counter: 0.22 },
  },
  Balance: {
    Attack: { evade: 0.68, knockout: 1.44, orbit: 0 },
    Defense: { counter: 0.61 },
    Stamina: { combo: 1.78 },
    Balance: { intercept: 0.09, combo: 0.56, orbit: 0, counter: 0 },
  },
};
