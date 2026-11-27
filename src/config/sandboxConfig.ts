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
import type { GameplayStats } from '../content/stats';
import type { CollisionParamKey, CombatParamKey, MovementParamKey, StadiumParamKey, TopOverrideKey } from './params';
import { DEFAULT_AI_AIM, DEFAULT_AIM, DEFAULT_LAUNCH_VARIATION, aiAim, clampAim, type AiAimProfile, type LaunchAim } from '../sim/launchGeometry';
import { RNG_STREAM, hashKey } from '../sim/rng';
import { DEFAULT_BOOST, DEFAULT_BRACE, type BoostParams, type BraceParams, type TacticalCommand } from '../sim/tactics';
import { TacticalAI } from '../ai/tacticalAi';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';
import type { TacticalAgent } from '../sim/tactics';

/**
 * Current configuration format.
 *   1 = SpinStrike v0.1, 2 = v0.2 (both migrated on import),
 *   3 = v0.3 – v0.4.0 (migrated: movement variability off), 4 = v0.4.1
 *   (migrated: tactical abilities off), 5 = v0.5.
 */
export const CONFIG_VERSION = 5;

/** Who controls a slot's tactical abilities. 'player' = live input (headless: none). */
export type TacticalController = 'player' | 'ai' | 'passive';
export const TACTICAL_CONTROLLERS: readonly TacticalController[] = ['player', 'ai', 'passive'];

export interface TacticalSlotConfig {
  controller: TacticalController;
  /** AI difficulty (used when controller = 'ai'). */
  difficulty: Difficulty;
}

/** v0.5 tactical abilities (Directional Boost, Defensive Brace). */
export interface TacticalConfig {
  enabled: boolean;
  boost: BoostParams;
  brace: BraceParams;
  player: TacticalSlotConfig;
  opponent: TacticalSlotConfig;
  /** Fixed command sequence applied at each command's tick (reproducible experiments). */
  script: TacticalCommand[];
}

/** Tactical abilities OFF (the v0.4.1 game): the engine default and every migrated older file. */
export function passiveTacticalConfig(): TacticalConfig {
  return {
    enabled: false,
    boost: { ...DEFAULT_BOOST },
    brace: { ...DEFAULT_BRACE },
    player: { controller: 'player', difficulty: 'normal' },
    opponent: { controller: 'ai', difficulty: 'normal' },
    script: [],
  };
}

/** v0.5 default tactical setup: abilities on, the player controls slot 0, a Normal AI slot 1. */
export function defaultTacticalConfig(): TacticalConfig {
  return { ...passiveTacticalConfig(), enabled: true };
}

export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

export type TopOverrides = Partial<Record<TopOverrideKey, number>>;

export interface TopSlotConfig {
  topId: string;
  /** Only parameters the developer changed; others come from the definition. */
  overrides: TopOverrides;
  /**
   * Career (v0.4): explicit effective stats replacing the definition's base
   * stats (upgrades). Undefined for every sandbox configuration.
   */
  stats?: GameplayStats;
  /** Career (v0.4): effective critical chance (0–1). Undefined = base chance. */
  critChance?: number;
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
  /** v0.4.1: the player's launch aim (heading offset and release tilt, degrees). */
  playerAim: LaunchAim;
  /** v0.4.1: opponent aim; 'auto' = seeded AI aim from `aiAim`. */
  opponentAim: LaunchAim | 'auto';
  /** v0.4.1: AI aiming behaviour. */
  aiAim: AiAimProfile;
}

/** v0.4.1 movement variability (see MOVEMENT_PARAMS). */
export type MovementConfig = Record<MovementParamKey, number> & {
  /** Master switch: off = v0.4.0 launch (no aim), perfect floor, steady tip contact. */
  naturalVariation: boolean;
};

export function defaultMovementConfig(): MovementConfig {
  const v = DEFAULT_LAUNCH_VARIATION;
  return {
    naturalVariation: true,
    positionVariation: v.position,
    radiusVariation: v.radius,
    headingVariation: v.heading,
    speedVariation: v.speed,
    tiltVariation: v.tilt,
    energyVariation: v.energy,
    floorRelief: 0.00015,
    floorFrictionVariation: 0.05,
    contactWanderScale: 1,
  };
}

/** The v0.4.0 movement model (no variability). */
export function legacyMovementConfig(): MovementConfig {
  return { ...defaultMovementConfig(), naturalVariation: false, floorRelief: 0, floorFrictionVariation: 0, contactWanderScale: 0 };
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
  /** v0.4.1 natural movement variability. */
  movement: MovementConfig;
  results: ResultConfig;
  presentation: PresentationConfig;
  player: TopSlotConfig;
  opponent: TopSlotConfig;
  /** v0.5 tactical abilities. */
  tactical: TacticalConfig;
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
    playerAim: { ...DEFAULT_AIM },
    opponentAim: 'auto',
    aiAim: { direction: { ...DEFAULT_AI_AIM.direction }, tilt: { ...DEFAULT_AI_AIM.tilt } },
  };
}

/**
 * v0.3 collision defaults (Phase C tuning). The engine's DEFAULT_COLLISION
 * keeps the v0.1/v0.2 values, which the legacy configuration and the
 * physics unit tests use.
 */
export const V03_COLLISION = {
  restitution: DEFAULT_COLLISION.restitution,
  energyLoss: 0.59,
  statSpinDrainWeight: 0.63,
} as const;

/** v0.4.0 collision values (frozen for the baseline path). */
export const V040_COLLISION = { restitution: 0.6, energyLoss: 0.59, statSpinDrainWeight: 0.63 } as const;
/** v0.4.0 combat values (frozen for the baseline path). */
export const V040_COMBAT: CombatParams = Object.freeze({
  damageScale: 54,
  impactScale: 1,
  rotationalContribution: 9.4,
  energyReference: 0.005,
  severityExponent: 0.4,
  severityCap: 2.45,
  attackReference: 65,
  defenseEffectiveness: 0.5,
  defenseReference: 100,
  minImpactSpeed: 0.03,
  rearmDistance: 0.001,
  rearmTime: 0.08,
  knockouts: true,
  rimClimbEfficiency: 0.8,
  impactLift: 0.7,
  liftWindow: 0.25,
  stabilityLipFactor: 0.5,
  criticalHits: true,
});

export const DEFAULT_DRAW_WINDOW = 0.1;
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
    collision: { ...V03_COLLISION },
    combat: defaultCombatConfig(),
    launch: defaultLaunchConfig(),
    movement: defaultMovementConfig(),
    results: { drawWindow: DEFAULT_DRAW_WINDOW, narrowThreshold: DEFAULT_NARROW_THRESHOLD },
    presentation: { cinematicFinishes: true, damageNumbers: false, criticalEffects: true },
    player: { topId: STARTER_TOPS[0]!.id, overrides: {} },
    opponent: { topId: STARTER_TOPS[1]!.id, overrides: {} },
    // The engine default stays passive (v0.4.1 combat) so every headless
    // regression path is unchanged; career battles and the sandbox opt in
    // through sandboxDefaultConfig / buildCareerConfig.
    tactical: passiveTacticalConfig(),
  };
}

/** The sandbox's starting configuration (v0.5): default rules with tactical abilities on. */
export function sandboxDefaultConfig(seed = 1): SandboxConfig {
  const c = defaultConfig(seed);
  c.tactical = defaultTacticalConfig();
  return c;
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
  c.movement = legacyMovementConfig();
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
  const base = deriveTopPhysics(getTop(slot.topId), { ruleset, stats: slot.stats });
  const out: TopPhysicsParams = { ...base };
  for (const [k, v] of Object.entries(slot.overrides)) {
    if (COMBAT_OVERRIDE_KEYS.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[k] = v;
  }
  return out;
}

/** Effective combat stats for a slot: derived values + overrides. */
export function resolveTopCombat(slot: TopSlotConfig, ruleset: Ruleset = DEFAULT_RULESET): TopCombatStats {
  const out = deriveTopCombat(getTop(slot.topId), { ruleset, stats: slot.stats, critChance: slot.critChance });
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

/** Launch aims of both slots: the player's aim and the fixed or seeded AI opponent aim. */
export function resolveAims(c: SandboxConfig): [LaunchAim, LaunchAim] {
  const o = c.launch.opponentAim;
  return [clampAim(c.launch.playerAim), o === 'auto' ? aiAim(c.seed, 1, c.launch.aiAim) : clampAim(o)];
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
    relief:
      c.movement.naturalVariation && (c.movement.floorRelief > 0 || c.movement.floorFrictionVariation > 0)
        ? { amplitude: c.movement.floorRelief, frictionVariation: c.movement.floorFrictionVariation, seed: hashKey(RNG_STREAM.floor, c.seed >>> 0) }
        : undefined,
  });
  const ls = launches ?? autoLaunches(c);
  const mv = c.movement;
  const scaleWander = (p: TopPhysicsParams): TopPhysicsParams =>
    mv.naturalVariation ? { ...p, contactWander: (p.contactWander ?? 0) * mv.contactWanderScale } : { ...p, contactWander: 0 };
  const tc = c.tactical;
  const tacticsOn = !!tc?.enabled;
  const agents: (TacticalAgent | null)[] = tacticsOn
    ? ([tc.player, tc.opponent] as const).map((slot, i) => {
        if (slot.controller !== 'ai') return null;
        const me = getTop(i === 0 ? c.player.topId : c.opponent.topId);
        const them = getTop(i === 0 ? c.opponent.topId : c.player.topId);
        return new TacticalAI({ difficulty: slot.difficulty, seed: c.seed, slot: i, selfClass: me.topClass, opponentClass: them.topClass, profile: me.tacticalProfile });
      })
    : [];
  return {
    tactics: tacticsOn ? { enabled: true, boost: { ...tc.boost }, brace: { ...tc.brace } } : undefined,
    agents,
    script: tacticsOn && tc.script.length ? tc.script : undefined,
    stadium,
    tops: [scaleWander(resolveTopParams(c.player, c.ruleset)), scaleWander(resolveTopParams(c.opponent, c.ruleset))],
    aims: resolveAims(c),
    topCombat: [resolveTopCombat(c.player, c.ruleset), resolveTopCombat(c.opponent, c.ruleset)],
    collision: {
      restitution: c.collision.restitution,
      energyLoss: c.collision.energyLoss,
      statSpinDrainWeight: c.collision.statSpinDrainWeight,
    },
    combat: combatParamsOf(c),
    launch: mv.naturalVariation
      ? {
          ...DEFAULT_LAUNCH,
          variation: {
            position: mv.positionVariation,
            radius: mv.radiusVariation,
            heading: mv.headingVariation,
            speed: mv.speedVariation,
            tilt: mv.tiltVariation,
            energy: mv.energyVariation,
          },
        }
      : DEFAULT_LAUNCH,
    seed: c.seed,
    stepHz: DEFAULT_STEP_HZ,
    maxDuration: c.maxDuration,
    launches: ls,
    launchEnergyMultipliers: ls.map((l) => l.energyMultiplier),
    drawWindow: c.results.drawWindow,
    narrowThreshold: c.results.narrowThreshold,
  };
}

/**
 * The v0.4.0 game as a v0.4.1 configuration: 'v0.3' ruleset (v0.4.0 stats
 * and mapping), v0.4.0 collision and combat values, and the v0.4.0 launch /
 * movement model (no variability, no aim). Reproduces v0.4.0 battles
 * exactly (tests/v041.test.ts) and is the baseline of every comparison in
 * docs/COMBAT_DYNAMICS_v0.4.1.md.
 */
export function legacyV040Config(seed = 1): SandboxConfig {
  const c = defaultConfig(seed);
  c.ruleset = 'v0.3';
  c.collision = { ...V040_COLLISION };
  c.combat = combatConfigFrom(V040_COMBAT);
  c.movement = legacyMovementConfig();
  return c;
}
