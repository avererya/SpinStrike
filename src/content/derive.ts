import type { TopPhysicsParams } from '../sim/topParams';
import type { TopCombatStats } from '../sim/combat';
import { lerp } from '../sim/math';
import { CORES, DISCS, RINGS, TIPS, type CorePart, type DiscPart, type RingPart, type TipPart } from './parts';
import type { TopDefinition } from './tops';

/**
 * Maps a top definition (gameplay stats + parts) to effective physics
 * parameters. THIS IS THE ONLY PLACE gameplay stats touch physics.
 *
 * Every constant below is a PROVISIONAL tuning value, not a confirmed
 * design decision. Mapping summary (t = stat / 100):
 *
 *   weight   → mass                      30 g … 58 g
 *   speed    → launch speed, tip traction ×0.85…×1.2
 *   stamina  → passive spin-decay multiplier ×1.5 … ×0.55
 *   defense  → stability, impact spin resistance, lower restitution
 *   attack   → ring contact friction, blade strike, impact spin drain, higher restitution
 *   health   → maximum health (× HEALTH_PER_STAT), via deriveTopCombat()
 *   attack / defense also feed the combat formula directly (deriveTopCombat).
 *
 * Part properties (tip shape, ring radius, disc gyration) supply the
 * remaining physical character.
 */
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

/** Global baseline launch spin energy, J (provisional). */
export const BASE_LAUNCH_SPIN_ENERGY = 2.6;

export function deriveTopPhysics(def: TopDefinition): TopPhysicsParams {
  const { ring, disc, tip } = resolveParts(def);
  const s = def.stats;
  const t = (v: number) => Math.min(100, Math.max(0, v)) / 100;

  const mass = lerp(0.03, 0.058, t(s.weight));
  return {
    mass,
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
    spinDirection: def.spinDirection,
    launchSpinEnergy: BASE_LAUNCH_SPIN_ENERGY,
    launchSpeed: lerp(0.3, 1.1, t(s.speed)),
  };
}

/** Health points per point of the health stat (provisional). */
export const HEALTH_PER_STAT = 10;

/**
 * Combat values. Attack and defense enter the damage formula as-is (the
 * formula in sim/combat.ts normalises them); health is scaled for readable
 * numbers. Future equipment/upgrades modify these values the same way they
 * will modify TopPhysicsParams. No class-specific multipliers exist.
 */
export function deriveTopCombat(def: TopDefinition): TopCombatStats {
  const s = def.stats;
  return {
    maxHealth: Math.max(1, s.health) * HEALTH_PER_STAT,
    attack: Math.max(0, s.attack),
    defense: Math.max(0, s.defense),
  };
}
