import { RNG_STREAM, keyedUniform } from './rng';

/**
 * Launch geometry (v0.4.1): where a top starts, which way it heads, and how
 * far its spin axis is tilted at release.
 *
 * A launch is the player's (or AI's) AIM plus small, independently seeded
 * natural VARIATION. Every random value is keyed by (stream, seed, slot,
 * component) so the two slots are drawn independently from identical
 * distributions, nothing depends on draw order, and the other random systems
 * (AI launch quality, critical hits, floor relief) are untouched.
 *
 * Launch quality (timing) is separate: it scales rotational energy only.
 */
export interface LaunchAim {
  /** Heading offset from the default heading, degrees (+ = toward the bowl centre). */
  direction: number;
  /** Spin-axis tilt at release, degrees (0 = upright). */
  tilt: number;
}

/** Supported aim ranges (provisional, see docs/COMBAT_DYNAMICS_v0.4.1.md). */
export const AIM_LIMITS = {
  direction: { min: -45, max: 45 },
  tilt: { min: 0, max: 30 },
} as const;

/** The default aim: the v0.4.0 heading with a small natural release tilt. */
export const DEFAULT_AIM: LaunchAim = Object.freeze({ direction: 0, tilt: 4 });

export function clampAim(a: Partial<LaunchAim> | null | undefined): LaunchAim {
  const d = Number(a?.direction);
  const t = Number(a?.tilt);
  return {
    direction: Number.isFinite(d) ? Math.min(AIM_LIMITS.direction.max, Math.max(AIM_LIMITS.direction.min, d)) : DEFAULT_AIM.direction,
    tilt: Number.isFinite(t) ? Math.min(AIM_LIMITS.tilt.max, Math.max(AIM_LIMITS.tilt.min, t)) : DEFAULT_AIM.tilt,
  };
}

export function isAim(v: unknown): v is LaunchAim {
  return typeof v === 'object' && v !== null && Number.isFinite((v as LaunchAim).direction) && Number.isFinite((v as LaunchAim).tilt);
}

/**
 * Natural launch variation (half-ranges of uniform distributions). Physical
 * meaning: a hand-held launcher is never placed, pointed or pulled exactly
 * the same way twice.
 */
export interface LaunchVariation {
  /** Placement angle around the bowl, rad (each slot independently). */
  position: number;
  /** Placement radius, fraction of the nominal radius. */
  radius: number;
  /** Heading, rad. */
  heading: number;
  /** Translational launch speed, fraction. */
  speed: number;
  /** Release tilt, rad. */
  tilt: number;
  /** Launch rotational energy, fraction (independent of launch quality). */
  energy: number;
}

export const DEFAULT_LAUNCH_VARIATION: LaunchVariation = Object.freeze({
  position: 0.45,
  radius: 0.12,
  heading: 0.1,
  speed: 0.08,
  tilt: 0.025,
  energy: 0.04,
});

/** No variation at all (used by the aiming preview's nominal trajectory). */
export const NO_LAUNCH_VARIATION: LaunchVariation = Object.freeze({ position: 0, radius: 0, heading: 0, speed: 0, tilt: 0, energy: 0 });

/** Nominal (pre-variation) placement of a slot: angle (rad) of its start position. */
export function nominalPlacementAngle(seed: number, slot: number, slots = 2): number {
  return keyedUniform(RNG_STREAM.launchGeometry, seed >>> 0, 0xba5e) * Math.PI * 2 + (slot * Math.PI * 2) / slots;
}

/** Symmetric uniform in [−a, a] for one launch component. */
export function launchJitter(seed: number, slot: number, component: number, amount: number): number {
  if (!(amount > 0)) return 0;
  return (keyedUniform(RNG_STREAM.launchGeometry, seed >>> 0, slot >>> 0, component) * 2 - 1) * amount;
}

/** Launch component keys (stable: changing them changes every battle). */
export const LAUNCH_COMPONENT = {
  position: 1,
  radius: 2,
  heading: 3,
  speed: 4,
  tilt: 5,
  energy: 6,
  spinAngle: 7,
  tiltSide: 8,
} as const;

// ------------------------------------------------------------------ AI aim
/** Seeded AI aiming behaviour (uniform ranges, degrees). Data-driven for future difficulty profiles. */
export interface AiAimProfile {
  direction: { min: number; max: number };
  tilt: { min: number; max: number };
}
export const DEFAULT_AI_AIM: AiAimProfile = Object.freeze({
  direction: { min: -30, max: 30 },
  tilt: { min: 0, max: 14 },
});

/** The AI's aim for a battle: keyed by (seed, slot) on its own stream. */
export function aiAim(seed: number, slot: number, p: AiAimProfile = DEFAULT_AI_AIM): LaunchAim {
  const u1 = keyedUniform(RNG_STREAM.aiAim, seed >>> 0, slot >>> 0, 1);
  const u2 = keyedUniform(RNG_STREAM.aiAim, seed >>> 0, slot >>> 0, 2);
  return clampAim({
    direction: Math.round(p.direction.min + (p.direction.max - p.direction.min) * u1),
    tilt: Math.round(p.tilt.min + (p.tilt.max - p.tilt.min) * u2),
  });
}
