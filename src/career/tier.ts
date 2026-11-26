import { rankDef, type RankTier } from './config';
/** Reward tier (Bronze…Master) of an opponent rank id. */
export function opponentTierOf(rankId: string): RankTier {
  return rankDef(rankId)?.tier ?? 'bronze';
}
