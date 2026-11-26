/** Career opponent generation: curated, bounded randomised builds (never scaled to the player). */
import { STARTER_TOPS, type TopDefinition } from '../content/tops';
import { hashKey, keyedUniform } from '../sim/rng';
import { OPPONENT_BUILDS, UPGRADE_STATS, zeroRanks, type UpgradeRanks } from './config';

export interface OpponentBuild {
  topId: string;
  rankId: string;
  ranks: UpgradeRanks;
}

const STREAM_PICK = 0x0b9001;
const STREAM_RANK = 0x0b9002;

/** Tops that may appear as career opponents (all common starters in v0.4). */
export function eligibleOpponents(): readonly TopDefinition[] {
  return STARTER_TOPS;
}

/**
 * Deterministic opponent for a career battle, derived only from the career
 * rank and an opponent seed (so a stored seed always rebuilds the same
 * opponent). Each attribute rank is uniform in the rank band's [min, max].
 */
export function generateOpponent(rankId: string, opponentSeed: number): OpponentBuild {
  const band = OPPONENT_BUILDS[rankId] ?? OPPONENT_BUILDS['bronze-3']!;
  const pool = eligibleOpponents();
  const top = pool[Math.floor(keyedUniform(STREAM_PICK, opponentSeed >>> 0) * pool.length)]!;
  const ranks = zeroRanks();
  UPGRADE_STATS.forEach((k, i) => {
    const u = keyedUniform(STREAM_RANK, hashKey(opponentSeed >>> 0, i));
    ranks[k] = band.min + Math.floor(u * (band.max - band.min + 1));
  });
  return { topId: top.id, rankId, ranks };
}
