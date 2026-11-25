import { STARTER_TOPS, getTop } from '../content/tops';
import { deriveTopCombat, deriveTopPhysics } from '../content/derive';
import { ClassicBowl, DEFAULT_CLASSIC_BOWL } from '../sim/stadium/classicBowl';
import { DEFAULT_COLLISION } from '../sim/collision';
import { DEFAULT_COMBAT, type CombatParams, type TopCombatStats } from '../sim/combat';
import { DEFAULT_LAUNCH } from '../sim/world';
import type { BattleOptions } from '../sim/battle';
import type { TopPhysicsParams } from '../sim/topParams';
import { DEFAULT_STEP_HZ } from '../sim/units';
import type { CollisionParamKey, CombatParamKey, StadiumParamKey, TopOverrideKey } from './params';

/** Current configuration format. v1 = SpinStrike v0.1 (migrated on import). */
export const CONFIG_VERSION = 2;

export type TopOverrides = Partial<Record<TopOverrideKey, number>>;

export interface TopSlotConfig {
  topId: string;
  /** Only parameters the developer changed; others come from the definition. */
  overrides: TopOverrides;
}

export interface PresentationConfig {
  cinematicFinishes: boolean;
  damageNumbers: boolean;
}

export interface SandboxConfig {
  version: typeof CONFIG_VERSION;
  seed: number;
  /** Maximum simulated battle duration before a timeout, s. */
  maxDuration: number;
  stadium: Record<StadiumParamKey, number>;
  collision: Record<CollisionParamKey, number>;
  combat: Record<CombatParamKey, number> & { knockouts: boolean };
  presentation: PresentationConfig;
  player: TopSlotConfig;
  opponent: TopSlotConfig;
}

export function defaultCombatConfig(): SandboxConfig['combat'] {
  const c = DEFAULT_COMBAT;
  return {
    damageScale: c.damageScale,
    impactScale: c.impactScale,
    rotationalContribution: c.rotationalContribution,
    defenseEffectiveness: c.defenseEffectiveness,
    defenseReference: c.defenseReference,
    attackReference: c.attackReference,
    energyReference: c.energyReference,
    severityExponent: c.severityExponent,
    severityCap: c.severityCap,
    minImpactSpeed: c.minImpactSpeed,
    rearmDistance: c.rearmDistance,
    rearmTime: c.rearmTime,
    rimClimbEfficiency: c.rimClimbEfficiency,
    impactLift: c.impactLift,
    liftWindow: c.liftWindow,
    stabilityLipFactor: c.stabilityLipFactor,
    knockouts: c.knockouts,
  };
}

export function defaultConfig(seed = 1): SandboxConfig {
  return {
    version: CONFIG_VERSION,
    seed,
    maxDuration: 180,
    stadium: {
      slope: DEFAULT_CLASSIC_BOWL.depth,
      surfaceFriction: DEFAULT_CLASSIC_BOWL.surfaceFriction,
      wallRestitution: DEFAULT_CLASSIC_BOWL.wallRestitution,
      rimLipHeight: DEFAULT_CLASSIC_BOWL.wallHeight,
    },
    collision: {
      restitution: DEFAULT_COLLISION.restitution,
      energyLoss: DEFAULT_COLLISION.energyLoss,
      statSpinDrainWeight: DEFAULT_COLLISION.statSpinDrainWeight,
    },
    combat: defaultCombatConfig(),
    presentation: { cinematicFinishes: true, damageNumbers: false },
    player: { topId: STARTER_TOPS[0]!.id, overrides: {} },
    opponent: { topId: STARTER_TOPS[1]!.id, overrides: {} },
  };
}

export function cloneConfig(c: SandboxConfig): SandboxConfig {
  return JSON.parse(JSON.stringify(c)) as SandboxConfig;
}

const COMBAT_OVERRIDE_KEYS = new Set<string>(['maxHealth', 'attack', 'defense']);

/** Effective physics params for a slot: definition-derived values + overrides. */
export function resolveTopParams(slot: TopSlotConfig): TopPhysicsParams {
  const base = deriveTopPhysics(getTop(slot.topId));
  const out: TopPhysicsParams = { ...base };
  for (const [k, v] of Object.entries(slot.overrides)) {
    if (COMBAT_OVERRIDE_KEYS.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[k] = v;
  }
  return out;
}

/** Effective combat stats for a slot: derived values + overrides. */
export function resolveTopCombat(slot: TopSlotConfig): TopCombatStats {
  const out = deriveTopCombat(getTop(slot.topId));
  const o = slot.overrides;
  if (typeof o.maxHealth === 'number' && Number.isFinite(o.maxHealth)) out.maxHealth = o.maxHealth;
  if (typeof o.attack === 'number' && Number.isFinite(o.attack)) out.attack = o.attack;
  if (typeof o.defense === 'number' && Number.isFinite(o.defense)) out.defense = o.defense;
  return out;
}

export function combatParamsOf(c: SandboxConfig): CombatParams {
  return { ...DEFAULT_COMBAT, ...c.combat };
}

/** Builds everything the simulation needs from a sandbox config. */
export function buildBattleOptions(c: SandboxConfig): BattleOptions {
  const stadium = new ClassicBowl({
    ...DEFAULT_CLASSIC_BOWL,
    depth: c.stadium.slope,
    surfaceFriction: c.stadium.surfaceFriction,
    wallRestitution: c.stadium.wallRestitution,
    wallHeight: c.stadium.rimLipHeight,
  });
  return {
    stadium,
    tops: [resolveTopParams(c.player), resolveTopParams(c.opponent)],
    topCombat: [resolveTopCombat(c.player), resolveTopCombat(c.opponent)],
    collision: {
      restitution: c.collision.restitution,
      energyLoss: c.collision.energyLoss,
      statSpinDrainWeight: c.collision.statSpinDrainWeight,
    },
    combat: combatParamsOf(c),
    launch: DEFAULT_LAUNCH,
    seed: c.seed,
    stepHz: DEFAULT_STEP_HZ,
    maxDuration: c.maxDuration,
  };
}
