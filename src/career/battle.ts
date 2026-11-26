/** Builds career battles: the setup record and the engine configuration. */
import { getTop } from '../content/tops';
import { defaultConfig, type SandboxConfig } from '../config/sandboxConfig';
import { DIFFICULTY_LAUNCH, rankDef, type Difficulty } from './config';
import { effectiveStats } from './progression';
import { generateOpponent, type OpponentBuild } from './opponents';
import type { OwnedTop } from './save';
import { DEFAULT_AIM, clampAim } from '../sim/launchGeometry';

export const CLASSIC_ARENA_ID = 'classic';

/** Everything needed to run a career battle and later settle its rewards. */
export interface CareerBattleSetup {
  /** Unique id; rewards are claimed against it exactly once. */
  battleId: string;
  seed: number;
  opponentSeed: number;
  stadiumId: string;
  difficulty: Difficulty;
  playerRankId: string;
  /** Owned-top instance id of the player's top. */
  playerInstanceId: string;
  playerTopId: string;
  opponent: OpponentBuild;
}

export function createBattleSetup(args: {
  battleId: string;
  seed: number;
  opponentSeed: number;
  difficulty: Difficulty;
  playerRankId: string;
  playerInstanceId: string;
  playerTopId: string;
}): CareerBattleSetup {
  return {
    battleId: args.battleId,
    seed: args.seed >>> 0,
    opponentSeed: args.opponentSeed >>> 0,
    stadiumId: CLASSIC_ARENA_ID,
    difficulty: args.difficulty,
    playerRankId: args.playerRankId,
    playerInstanceId: args.playerInstanceId,
    playerTopId: args.playerTopId,
    opponent: generateOpponent(args.playerRankId, args.opponentSeed),
  };
}

/**
 * Engine configuration for a career battle: a FRESH default configuration
 * (approved v0.3.1 ruleset, never a sandbox config, so developer overrides
 * cannot leak in), with each side's upgraded effective stats and the
 * difficulty's AI launch distribution.
 */
export function buildCareerConfig(setup: CareerBattleSetup, player: Pick<OwnedTop, 'definitionId' | 'upgrades' | 'launchAim'>): SandboxConfig {
  const c = defaultConfig(setup.seed);
  const p = effectiveStats(getTop(player.definitionId), player.upgrades);
  const o = effectiveStats(getTop(setup.opponent.topId), setup.opponent.ranks);
  c.player = { topId: player.definitionId, overrides: {}, stats: p.stats, critChance: p.critChance };
  c.opponent = { topId: setup.opponent.topId, overrides: {}, stats: o.stats, critChance: o.critChance };
  c.launch.aiDistribution = { ...DIFFICULTY_LAUNCH[setup.difficulty] };
  // v0.4.1: the player's remembered aim; the opponent aims with the seeded AI profile.
  c.launch.playerAim = clampAim(player.launchAim ?? DEFAULT_AIM);
  c.launch.opponentAim = 'auto';
  return c;
}

export function opponentRankLabel(setup: CareerBattleSetup): string {
  return rankDef(setup.opponent.rankId)?.label ?? setup.opponent.rankId;
}
