/**
 * Headless career battles (no DOM, no WebGL): used by tests, the economy
 * simulator and the screenshot save generator. The player's launch quality
 * comes from a distribution (standing in for the timing minigame).
 */
import { Battle, type BattleResult } from '../sim/battle';
import { buildBattleOptions, autoLaunches } from '../config/sandboxConfig';
import { aiLaunchQuality, makeLaunch, type LaunchDistribution } from '../sim/launch';
import { RNG_STREAM, keyedUniform, hashKey } from '../sim/rng';
import { buildCareerConfig, createBattleSetup, type CareerBattleSetup } from './battle';
import type { CareerStore, SettledBattle } from './store';
import type { Difficulty } from './config';
import { sampleQuality } from '../sim/launch';

/** A decent human timing profile (Good/Great/Perfect most of the time). */
export const HUMAN_LAUNCH: LaunchDistribution = { poor: 0.1, good: 0.3, great: 0.4, perfect: 0.2 };

export function runCareerBattle(store: CareerStore, setup: CareerBattleSetup, playerLaunch: LaunchDistribution = HUMAN_LAUNCH): BattleResult {
  const top = store.save!.tops.find((t) => t.instanceId === setup.playerInstanceId)!;
  const cfg = buildCareerConfig(setup, top);
  const q = sampleQuality(playerLaunch, keyedUniform(RNG_STREAM.aiLaunch, hashKey(setup.seed, 77)));
  const [, opp] = autoLaunches(cfg);
  void aiLaunchQuality;
  const launches = [makeLaunch(q, cfg.launch.bonuses, 'player'), opp!];
  return new Battle(buildBattleOptions(cfg, launches)).runToEnd();
}

/** Plays and settles one headless career battle against a random opponent. */
export function playHeadlessBattle(store: CareerStore, difficulty: Difficulty, seed: number, playerLaunch?: LaunchDistribution): { result: BattleResult; settled: SettledBattle; setup: CareerBattleSetup } {
  const save = store.save!;
  const top = store.activeTop!;
  const setup = createBattleSetup({
    battleId: `h-${seed}-${save.totals.battles}`,
    seed,
    opponentSeed: hashKey(seed, 0x0bb),
    difficulty,
    playerRankId: save.rank.id,
    playerInstanceId: top.instanceId,
    playerTopId: top.definitionId,
  });
  const result = runCareerBattle(store, setup, playerLaunch);
  const settled = store.settleBattle(setup, result)!;
  return { result, settled, setup };
}
