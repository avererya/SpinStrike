import { STARTER_TOPS, getTop } from '../content/tops';
import { deriveTopPhysics } from '../content/derive';
import { ClassicBowl, DEFAULT_CLASSIC_BOWL } from '../sim/stadium/classicBowl';
import { DEFAULT_COLLISION } from '../sim/collision';
import { DEFAULT_LAUNCH } from '../sim/world';
import type { BattleOptions } from '../sim/battle';
import type { TopPhysicsParams } from '../sim/topParams';
import { DEFAULT_STEP_HZ } from '../sim/units';
import type { CollisionParamKey, StadiumParamKey, TopParamKey } from './params';

export const CONFIG_VERSION = 1;

export type TopOverrides = Partial<Record<TopParamKey, number>>;

export interface TopSlotConfig {
  topId: string;
  /** Only parameters the developer changed; others come from the definition. */
  overrides: TopOverrides;
}

export interface SandboxConfig {
  version: typeof CONFIG_VERSION;
  seed: number;
  /** Maximum simulated battle duration before a timeout, s. */
  maxDuration: number;
  stadium: Record<StadiumParamKey, number>;
  collision: Record<CollisionParamKey, number>;
  player: TopSlotConfig;
  opponent: TopSlotConfig;
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
    },
    collision: { restitution: DEFAULT_COLLISION.restitution, energyLoss: DEFAULT_COLLISION.energyLoss },
    player: { topId: STARTER_TOPS[0]!.id, overrides: {} },
    opponent: { topId: STARTER_TOPS[1]!.id, overrides: {} },
  };
}

export function cloneConfig(c: SandboxConfig): SandboxConfig {
  return JSON.parse(JSON.stringify(c)) as SandboxConfig;
}

/** Effective physics params for a slot: definition-derived values + overrides. */
export function resolveTopParams(slot: TopSlotConfig): TopPhysicsParams {
  const base = deriveTopPhysics(getTop(slot.topId));
  const out: TopPhysicsParams = { ...base };
  for (const [k, v] of Object.entries(slot.overrides)) {
    if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[k] = v;
  }
  return out;
}

/** Builds everything the simulation needs from a sandbox config. */
export function buildBattleOptions(c: SandboxConfig): BattleOptions {
  const stadium = new ClassicBowl({
    ...DEFAULT_CLASSIC_BOWL,
    depth: c.stadium.slope,
    surfaceFriction: c.stadium.surfaceFriction,
    wallRestitution: c.stadium.wallRestitution,
  });
  return {
    stadium,
    tops: [resolveTopParams(c.player), resolveTopParams(c.opponent)],
    collision: { restitution: c.collision.restitution, energyLoss: c.collision.energyLoss },
    launch: DEFAULT_LAUNCH,
    seed: c.seed,
    stepHz: DEFAULT_STEP_HZ,
    maxDuration: c.maxDuration,
  };
}
