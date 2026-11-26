import { RNG_STREAM, keyedUniform } from './rng';

/**
 * Launch quality (v0.3). The player's timing minigame or the AI's seeded
 * distribution decides a quality per top; the quality multiplies the top's
 * launch ROTATIONAL ENERGY. Angular velocity is then derived physically
 * from ω = √(2E/I), so a +10 % energy bonus is ≈ +4.9 % angular velocity,
 * never a +21 % energy bonus from scaling ω by 10 %.
 *
 * Launch quality never touches health, attack, defense, critical chance or
 * any other stat.
 */
export const LAUNCH_QUALITIES = ['poor', 'good', 'great', 'perfect'] as const;
export type LaunchQuality = (typeof LAUNCH_QUALITIES)[number];

export const LAUNCH_QUALITY_LABEL: Record<LaunchQuality, string> = {
  poor: 'Poor',
  good: 'Good',
  great: 'Great',
  perfect: 'Perfect',
};

export function isLaunchQuality(v: unknown): v is LaunchQuality {
  return typeof v === 'string' && (LAUNCH_QUALITIES as readonly string[]).includes(v);
}

/**
 * Timing zones as normalised half-widths around the meter centre (0.5).
 *   |pos − 0.5| ≤ perfect → Perfect
 *   |pos − 0.5| ≤ great   → Great
 *   |pos − 0.5| ≤ good    → Good
 *   otherwise             → Poor
 * Boundaries are INCLUSIVE toward the better quality: exactly 45 % or 55 %
 * is Perfect, exactly 30 % / 70 % is Great, exactly 15 % / 85 % is Good.
 * Defaults reproduce the spec's 45–55 / 30–70 / 15–85 % zones.
 */
export interface LaunchZones {
  perfect: number;
  great: number;
  good: number;
}

export const DEFAULT_LAUNCH_ZONES: LaunchZones = { perfect: 0.05, great: 0.2, good: 0.35 };

/** Rotational-energy multiplier per quality. */
export type LaunchBonuses = Record<LaunchQuality, number>;
export const DEFAULT_LAUNCH_BONUSES: LaunchBonuses = { poor: 1, good: 1.03, great: 1.07, perfect: 1.1 };

/** AI launch quality probabilities (must sum to 1). Data-driven for future difficulty profiles. */
export type LaunchDistribution = Record<LaunchQuality, number>;
export const DEFAULT_AI_LAUNCH_DISTRIBUTION: LaunchDistribution = { poor: 0.15, good: 0.4, great: 0.35, perfect: 0.1 };

/** Small tolerance so floating-point positions on a boundary resolve deterministically. */
const ZONE_EPS = 1e-9;

/** Launch quality for a meter position in [0, 1]. Non-finite input → Poor. */
export function qualityAt(position: number, zones: LaunchZones = DEFAULT_LAUNCH_ZONES): LaunchQuality {
  if (!Number.isFinite(position)) return 'poor';
  const d = Math.abs(position - 0.5);
  if (d <= zones.perfect + ZONE_EPS) return 'perfect';
  if (d <= zones.great + ZONE_EPS) return 'great';
  if (d <= zones.good + ZONE_EPS) return 'good';
  return 'poor';
}

/**
 * Meter indicator position at time t (s): a triangle wave 0 → 1 → 0 with
 * one full sweep (0 → 1) taking `sweepTime` seconds. Constant speed keeps
 * the zones' widths proportional to their time windows.
 */
export function meterPosition(t: number, sweepTime: number): number {
  const T = Math.max(0.05, sweepTime);
  const u = (Math.max(0, t) / T) % 2;
  return u <= 1 ? u : 2 - u;
}

/** True when the distribution is valid (finite, ≥ 0, sums to 1 ± 1e-6). */
export function validDistribution(d: LaunchDistribution): boolean {
  let sum = 0;
  for (const q of LAUNCH_QUALITIES) {
    const p = d[q];
    if (!Number.isFinite(p) || p < 0) return false;
    sum += p;
  }
  return Math.abs(sum - 1) <= 1e-6;
}

/** Inverse-CDF sample from a distribution with a uniform u in [0, 1). */
export function sampleQuality(d: LaunchDistribution, u: number): LaunchQuality {
  let sum = 0;
  for (const q of LAUNCH_QUALITIES) sum += Math.max(0, d[q]);
  if (!(sum > 0)) return 'poor';
  let acc = 0;
  const x = Math.min(Math.max(u, 0), 0.999999999) * sum;
  for (const q of LAUNCH_QUALITIES) {
    acc += Math.max(0, d[q]);
    if (x < acc) return q;
  }
  return 'perfect';
}

/**
 * Seeded AI launch quality. Uses its own keyed stream (seed, slot), so it is
 * reproducible from the battle seed and independent of the frame rate,
 * critical hits and every other random event.
 */
export function aiLaunchQuality(seed: number, slot: number, d: LaunchDistribution = DEFAULT_AI_LAUNCH_DISTRIBUTION): LaunchQuality {
  return sampleQuality(d, keyedUniform(RNG_STREAM.aiLaunch, seed >>> 0, slot));
}

/** The launch actually used for one top in a battle (recorded for replay). */
export interface TopLaunch {
  readonly quality: LaunchQuality;
  /** Rotational-energy multiplier applied at launch. */
  readonly energyMultiplier: number;
  /** Where the quality came from (presentation / statistics only). */
  readonly source: 'player' | 'ai' | 'fixed';
}

export function makeLaunch(quality: LaunchQuality, bonuses: LaunchBonuses, source: TopLaunch['source']): TopLaunch {
  return Object.freeze({ quality, energyMultiplier: bonuses[quality], source });
}
