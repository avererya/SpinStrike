import { STARTER_TOPS, getTop } from '../content/tops';
import { DEFAULT_RULESET, deriveTopCombat, deriveTopPhysics, type Ruleset } from '../content/derive';
import { ClassicBowl, DEFAULT_CLASSIC_BOWL } from '../sim/stadium/classicBowl';
import { DEFAULT_COLLISION } from '../sim/collision';
import { DEFAULT_COMBAT, LEGACY_V02_COMBAT, type CombatParams, type TopCombatStats } from '../sim/combat';
import { DEFAULT_LAUNCH } from '../sim/world';
import type { BattleOptions } from '../sim/battle';
import type { TopPhysicsParams } from '../sim/topParams';
import { DEFAULT_STEP_HZ } from '../sim/units';
import {
  DEFAULT_AI_LAUNCH_DISTRIBUTION,
  DEFAULT_LAUNCH_BONUSES,
  DEFAULT_LAUNCH_ZONES,
  aiLaunchQuality,
  makeLaunch,
  type LaunchBonuses,
  type LaunchDistribution,
  type LaunchQuality,
  type LaunchZones,
  type TopLaunch,
} from '../sim/launch';
import type { CollisionParamKey, CombatParamKey, StadiumParamKey, TopOverrideKey } from './params';

/**
 * Current configuration format.
 *   1 = SpinStrike v0.1, 2 = v0.2 (both migrated on import), 3 = v0.3.
 */
export const CONFIG_VERSION = 3;

export type TopOverrides = Partial<Record<TopOverrideKey, number>>;

export interface TopSlotConfig {
  topId: string;
  /** Only parameters the developer changed; others come from the definition. */
  overrides: TopOverrides;
}

export interface PresentationConfig {
  cinematicFinishes: boolean;
  damageNumbers: boolean;
  /** Critical-hit visual feedback (golden numbers, label, stronger sparks). */
  criticalEffects: boolean;
}

/** 'auto' = decided per battle (player: minigame or distribution; opponent: AI distribution). */
export type FixedQuality = 'auto' | LaunchQuality;

export interface LaunchConfig {
  /** Show the timing minigame for the player. Off = bypass (sandbox/testing). */
  minigame: boolean;
  /** Fixed player launch quality ('auto' = minigame, or AI distribution if the minigame is off). */
  playerQuality: FixedQuality;
  /** Fixed opponent launch quality ('auto' = seeded AI distribution). */
  opponentQuality: FixedQuality;
  /** Seconds for the indicator to cross the meter once. */
  sweepTime: number;
  /** Seconds before an unlaunched player gets a Poor launch. */
  timeout: number;
  zones: LaunchZones;
  bonuses: LaunchBonuses;
  aiDistribution: LaunchDistribution;
}

export interface ResultConfig {
  /** Near-simultaneous spin-finish draw window, simulated s. */
  drawWindow: number;
  /** Narrow-victory label threshold (winner stamina fraction). Presentation only. */
  narrowThreshold: number;
}

export interface SandboxConfig {
  version: typeof CONFIG_VERSION;
  /** Stat table and stat → physics mapping. 'v0.2' = legacy (regression). */
  ruleset: Ruleset;
  seed: number;
  /** Maximum simulated battle duration before a timeout, s. */
  maxDuration: number;
  stadium: Record<StadiumParamKey, number>;
  collision: Record<CollisionParamKey, number>;
  combat: Record<CombatParamKey, number> & { knockouts: boolean; criticalHits: boolean };
  launch: LaunchConfig;
  results: ResultConfig;
  presentation: PresentationConfig;
  player: TopSlotConfig;
  opponent: TopSlotConfig;
}

export function combatConfigFrom(c: CombatParams): SandboxConfig['combat'] {
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
    criticalHits: c.criticalHits,
  };
}

export function defaultCombatConfig(): SandboxConfig['combat'] {
  return combatConfigFrom(DEFAULT_COMBAT);
}

export function defaultLaunchConfig(): LaunchConfig {
  return {
    minigame: true,
    playerQuality: 'auto',
    opponentQuality: 'auto',
    sweepTime: 1.25,
    timeout: 8,
    zones: { ...DEFAULT_LAUNCH_ZONES },
    bonuses: { ...DEFAULT_LAUNCH_BONUSES },
    aiDistribution: { ...DEFAULT_AI_LAUNCH_DISTRIBUTION },
  };
}

export const DEFAULT_DRAW_WINDOW = 0.25;
export const DEFAULT_NARROW_THRESHOLD = 0.02;

export function defaultConfig(seed = 1): SandboxConfig {
  return {
    version: CONFIG_VERSION,
    ruleset: DEFAULT_RULESET,
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
    launch: defaultLaunchConfig(),
    results: { drawWindow: DEFAULT_DRAW_WINDOW, narrowThreshold: DEFAULT_NARROW_THRESHOLD },
    presentation: { cinematicFinishes: true, damageNumbers: false, criticalEffects: true },
    player: { topId: STARTER_TOPS[0]!.id, overrides: {} },
    opponent: { topId: STARTER_TOPS[1]!.id, overrides: {} },
  };
}

/**
 * The v0.2 game as a v0.3 configuration: v0.2 stats and stat → physics
 * mapping, v0.2 combat parameters, no critical hits, both launches fixed at
 * Poor (1.00× energy) and no draw window. Reproduces v0.2 battles exactly
 * (see tests/regression.test.ts). Used for Phase A baselines and as the
 * migration target for v0.1/v0.2 configuration files.
 */
export function legacyV02Config(seed = 1): SandboxConfig {
  const c = defaultConfig(seed);
  c.ruleset = 'v0.2';
  c.collision = { restitution: 0.6, energyLoss: 0.6, statSpinDrainWeight: 0.5 };
  c.combat = combatConfigFrom(LEGACY_V02_COMBAT);
  c.launch.minigame = false;
  c.launch.playerQuality = 'poor';
  c.launch.opponentQuality = 'poor';
  c.results.drawWindow = 0;
  return c;
}

export function cloneConfig(c: SandboxConfig): SandboxConfig {
  return JSON.parse(JSON.stringify(c)) as SandboxConfig;
}

/**
 * Rematch (e.g. after a draw): same tops and configuration, a fresh battle
 * seed. The AI launch quality is re-drawn from the new seed and the player
 * launches again. (An exact replay instead keeps the seed and the recorded
 * launches.)
 */
export function rematchConfig(c: SandboxConfig, newSeed: number): SandboxConfig {
  const r = cloneConfig(c);
  r.seed = newSeed >>> 0;
  return r;
}

const COMBAT_OVERRIDE_KEYS = new Set<string>(['maxHealth', 'attack', 'defense', 'critChance', 'critMultiplier']);

/** Effective physics params for a slot: definition-derived values + overrides. */
export function resolveTopParams(slot: TopSlotConfig, ruleset: Ruleset = DEFAULT_RULESET): TopPhysicsParams {
  const base = deriveTopPhysics(getTop(slot.topId), { ruleset });
  const out: TopPhysicsParams = { ...base };
  for (const [k, v] of Object.entries(slot.overrides)) {
    if (COMBAT_OVERRIDE_KEYS.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[k] = v;
  }
  return out;
}

/** Effective combat stats for a slot: derived values + overrides. */
export function resolveTopCombat(slot: TopSlotConfig, ruleset: Ruleset = DEFAULT_RULESET): TopCombatStats {
  const out = deriveTopCombat(getTop(slot.topId), { ruleset });
  const o = slot.overrides as Record<string, number | undefined>;
  for (const k of COMBAT_OVERRIDE_KEYS) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[k] = v;
  }
  return out;
}

export function combatParamsOf(c: SandboxConfig): CombatParams {
  return { ...DEFAULT_COMBAT, ...c.combat };
}

/**
 * Launch qualities for a battle that are decided WITHOUT the minigame:
 * fixed qualities, or the seeded AI distribution for 'auto' slots. Slot i
 * uses stream key (seed, i), so both sides are identically distributed and
 * independent. The player slot's 'auto' only reaches this function when the
 * minigame is bypassed (headless runs, sandbox bypass).
 */
export function autoLaunches(c: SandboxConfig, playerQuality?: LaunchQuality): [TopLaunch, TopLaunch] {
  const L = c.launch;
  const pick = (fixed: FixedQuality, slot: number): TopLaunch =>
    fixed === 'auto'
      ? makeLaunch(aiLaunchQuality(c.seed, slot, L.aiDistribution), L.bonuses, 'ai')
      : makeLaunch(fixed, L.bonuses, 'fixed');
  const player = playerQuality ? makeLaunch(playerQuality, L.bonuses, 'player') : pick(L.playerQuality, 0);
  return [player, pick(L.opponentQuality, 1)];
}

/**
 * Builds everything the simulation needs from a sandbox config. `launches`
 * overrides the automatically decided launches (the player's minigame result,
 * or a recorded launch for an exact replay).
 */
export function buildBattleOptions(c: SandboxConfig, launches?: readonly TopLaunch[]): BattleOptions {
  const stadium = new ClassicBowl({
    ...DEFAULT_CLASSIC_BOWL,
    depth: c.stadium.slope,
    surfaceFriction: c.stadium.surfaceFriction,
    wallRestitution: c.stadium.wallRestitution,
    wallHeight: c.stadium.rimLipHeight,
  });
  const ls = launches ?? autoLaunches(c);
  return {
    stadium,
    tops: [resolveTopParams(c.player, c.ruleset), resolveTopParams(c.opponent, c.ruleset)],
    topCombat: [resolveTopCombat(c.player, c.ruleset), resolveTopCombat(c.opponent, c.ruleset)],
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
    launches: ls,
    launchEnergyMultipliers: ls.map((l) => l.energyMultiplier),
    drawWindow: c.results.drawWindow,
    narrowThreshold: c.results.narrowThreshold,
  };
}
