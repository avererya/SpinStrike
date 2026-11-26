import type { TopPhysicsParams } from '../sim/topParams';
import { BASE_CRIT_CHANCE, BASE_CRIT_MULTIPLIER, type TopCombatStats } from '../sim/combat';
import { lerp } from '../sim/math';
import { CORES, DISCS, RINGS, TIPS, type CorePart, type DiscPart, type RingPart, type TipPart } from './parts';
import { LEGACY_V02_STATS, type TopDefinition } from './tops';
import type { GameplayStats } from './stats';

/**
 * Maps a top (gameplay stats + parts) to effective physics parameters and
 * combat values. THIS IS THE ONLY PLACE gameplay stats touch physics.
 *
 * Two rulesets exist:
 *   - 'v0.3' (default): the current game.
 *   - 'v0.2': the v0.2 stats and mapping, kept unchanged for regression
 *     comparisons and for configurations migrated from v0.1/v0.2.
 *
 * The derivation takes the stats as an explicit input, so future upgrades
 * and equipment can pass modified stats without engine changes.
 *
 * Every constant below is a PROVISIONAL tuning value, not a confirmed
 * design decision. See README "Stat → physics mapping" for the table.
 */
export type Ruleset = 'v0.2' | 'v0.3';
export const RULESETS: readonly Ruleset[] = ['v0.3', 'v0.2'];
export const DEFAULT_RULESET: Ruleset = 'v0.3';

export interface ResolvedParts {
  core: CorePart;
  ring: RingPart;
  disc: DiscPart;
  tip: TipPart;
}

export function resolveParts(def: TopDefinition): ResolvedParts {
  const core = CORES[def.parts.core];
  const ring = RINGS[def.parts.ring];
  const disc = DISCS[def.parts.disc];
  const tip = TIPS[def.parts.tip];
  if (!core || !ring || !disc || !tip) throw new Error(`Top ${def.id} references unknown parts`);
  return { core, ring, disc, tip };
}

/** Base stats of a top under a ruleset (v0.2 keeps its historical values). */
export function baseStats(def: TopDefinition, ruleset: Ruleset = DEFAULT_RULESET): GameplayStats {
  if (ruleset === 'v0.2') {
    const s = LEGACY_V02_STATS[def.id];
    if (s) return { ...s };
  }
  return { ...def.stats };
}

export interface DeriveOptions {
  ruleset?: Ruleset;
  /** Stats to derive from (e.g. upgraded stats). Defaults to the ruleset's base stats. */
  stats?: GameplayStats;
}

/** Global baseline launch spin energy, J (provisional). */
export const BASE_LAUNCH_SPIN_ENERGY = 2.6;

const t = (v: number) => Math.min(100, Math.max(0, v)) / 100;

/**
 * v0.2 mapping (unchanged):
 *   weight → mass 30–58 g; speed → launch speed, traction ×0.85…×1.2;
 *   stamina → spin decay ×2…×0.75; defense → stability 0.25–0.9,
 *   restitution ×1.2…×0.75, impact spin resist 0–0.6; attack → contact
 *   friction, blade strike ×0.6…×1.4, impact spin drain ×0.5…×1.6.
 */
function derivePhysicsV02(s: GameplayStats, p: ResolvedParts, spinDirection: 1 | -1): TopPhysicsParams {
  const { ring, disc, tip } = p;
  return {
    mass: lerp(0.03, 0.058, t(s.weight)),
    radius: ring.radius,
    gyration: disc.gyration,
    comHeight: 0.016,
    contactHeight: 0.021,
    tipDriveRadius: tip.driveRadius,
    axisSettleRate: 0,
    tipTraction: tip.traction * lerp(0.85, 1.2, t(s.speed)),
    tipSpinFriction: tip.spinFriction,
    tipSpinRadius: tip.spinRadius,
    airDrag: 4e-9,
    spinDecay: lerp(2, 0.75, t(s.stamina)),
    rollingResistance: 0.08,
    stability: lerp(0.25, 0.9, t(s.defense)),
    baseWobble: tip.rock,
    wobbleIntensity: 0.35,
    restitution: lerp(1.2, 0.75, t(s.defense)),
    contactFriction: lerp(0.15, 0.55, t(s.attack)) * ring.frictionFactor,
    ringStrike: ring.strike * lerp(0.6, 1.4, t(s.attack)),
    impactSpinDrain: lerp(0.5, 1.6, t(s.attack)),
    impactSpinResist: lerp(0, 0.6, t(s.defense)),
    spinDirection,
    launchSpinEnergy: BASE_LAUNCH_SPIN_ENERGY,
    launchSpeed: lerp(0.3, 1.1, t(s.speed)),
  };
}

/**
 * v0.3 mapping. Each stat has one responsibility:
 *   health  → structural integrity (max health, deriveTopCombat)
 *   attack  → offensive structural damage (combat formula), ring contact
 *             friction and blade strike
 *   defense → resistance to structural damage (combat formula) and a
 *             modest restitution reduction. It NO LONGER feeds gyroscopic
 *             stability or impact spin resistance.
 *   stamina → rotational endurance: passive spin decay and impact spin
 *             resistance
 *   speed   → movement: launch speed and tip traction
 *   weight  → mass (momentum, displacement resistance) and part of stability
 *   stability ← tip characteristics (TipPart.stability) + weight
 * See PARAMS_V03 for the numbers.
 */
export const PARAMS_V03 = {
  /** Stability = tip.stability + weight term (clamped 0.05–0.95). */
  stabilityWeight: [-0.1, 0.15] as const,
  restitution: [1.1, 0.85] as const,
  impactSpinResist: [0, 0.4] as const,
  spinDecay: [2, 0.75] as const,
  contactFriction: [0.15, 0.55] as const,
  ringStrike: [0.6, 1.4] as const,
  impactSpinDrain: [0.5, 1.6] as const,
};

function derivePhysicsV03(s: GameplayStats, p: ResolvedParts, spinDirection: 1 | -1): TopPhysicsParams {
  const { ring, disc, tip } = p;
  const P = PARAMS_V03;
  const tipStability = tip.stability ?? 0.5;
  const stability = Math.min(0.95, Math.max(0.05, tipStability + lerp(P.stabilityWeight[0], P.stabilityWeight[1], t(s.weight))));
  return {
    mass: lerp(0.03, 0.058, t(s.weight)),
    radius: ring.radius,
    gyration: disc.gyration,
    comHeight: 0.016,
    contactHeight: 0.021,
    tipDriveRadius: tip.driveRadius,
    axisSettleRate: 0,
    tipTraction: tip.traction * lerp(0.85, 1.2, t(s.speed)),
    tipSpinFriction: tip.spinFrictionV03 ?? tip.spinFriction,
    tipSpinRadius: tip.spinRadius,
    airDrag: 4e-9,
    spinDecay: lerp(P.spinDecay[0], P.spinDecay[1], t(s.stamina)),
    rollingResistance: 0.08,
    stability,
    baseWobble: tip.rock,
    wobbleIntensity: 0.35,
    restitution: lerp(P.restitution[0], P.restitution[1], t(s.defense)),
    contactFriction: lerp(P.contactFriction[0], P.contactFriction[1], t(s.attack)) * ring.frictionFactor,
    ringStrike: (ring.strikeV03 ?? ring.strike) * lerp(P.ringStrike[0], P.ringStrike[1], t(s.attack)),
    impactSpinDrain: lerp(P.impactSpinDrain[0], P.impactSpinDrain[1], t(s.attack)),
    impactSpinResist: lerp(P.impactSpinResist[0], P.impactSpinResist[1], t(s.stamina)),
    spinDirection,
    launchSpinEnergy: BASE_LAUNCH_SPIN_ENERGY,
    launchSpeed: lerp(0.3, 1.1, t(s.speed)),
  };
}

export function deriveTopPhysics(def: TopDefinition, opts: DeriveOptions = {}): TopPhysicsParams {
  const ruleset = opts.ruleset ?? DEFAULT_RULESET;
  const stats = opts.stats ?? baseStats(def, ruleset);
  const parts = resolveParts(def);
  return ruleset === 'v0.2' ? derivePhysicsV02(stats, parts, def.spinDirection) : derivePhysicsV03(stats, parts, def.spinDirection);
}

/** Health points per point of the health stat (confirmed: 10 × health stat). */
export const HEALTH_PER_STAT = 10;

/**
 * Combat values. Attack and defense enter the damage formula as-is (the
 * formula in sim/combat.ts normalises them); health is scaled for readable
 * numbers. Every starter has the same base critical chance (5 %) and
 * multiplier (2×). Future equipment/upgrades modify these values the same
 * way they will modify TopPhysicsParams. No class-specific multipliers exist.
 */
export function deriveTopCombat(def: TopDefinition, opts: DeriveOptions = {}): TopCombatStats {
  const s = opts.stats ?? baseStats(def, opts.ruleset ?? DEFAULT_RULESET);
  return {
    maxHealth: Math.max(1, s.health) * HEALTH_PER_STAT,
    attack: Math.max(0, s.attack),
    defense: Math.max(0, s.defense),
    critChance: BASE_CRIT_CHANCE,
    critMultiplier: BASE_CRIT_MULTIPLIER,
  };
}
