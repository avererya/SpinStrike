import { Battle, type BattleOptions, type BattleResult } from './battle';

export interface BatchStats {
  battles: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  /** Wins indexed by top slot (0, 1). */
  wins: [number, number];
  draws: number;
  timeouts: number;
  avgCollisions: number;
  maxTranslationalSpeed: number;
  avgMaxSpeed: number;
  /** Battles where a numerical guard tripped or a value became non-finite. */
  failures: number;
  failureDetails: string[];
  results: BattleResult[];
}

/**
 * Runs `count` battles with seeds seedStart … seedStart+count−1, built by
 * `make(seed)`. Pure TypeScript: no DOM or Three.js, usable in Node/Vitest.
 */
export function runBatch(make: (seed: number) => BattleOptions, count: number, seedStart = 1): BatchStats {
  const stats: BatchStats = {
    battles: count,
    avgDuration: 0,
    minDuration: Infinity,
    maxDuration: 0,
    wins: [0, 0],
    draws: 0,
    timeouts: 0,
    avgCollisions: 0,
    maxTranslationalSpeed: 0,
    avgMaxSpeed: 0,
    failures: 0,
    failureDetails: [],
    results: [],
  };
  for (let i = 0; i < count; i++) {
    const seed = (seedStart + i) >>> 0;
    let result: BattleResult;
    let battle: Battle;
    try {
      battle = new Battle(make(seed));
      result = battle.runToEnd();
    } catch (e) {
      stats.failures++;
      stats.failureDetails.push(`seed ${seed}: exception ${(e as Error).message}`);
      continue;
    }
    stats.results.push(result);
    stats.avgDuration += result.time;
    stats.minDuration = Math.min(stats.minDuration, result.time);
    stats.maxDuration = Math.max(stats.maxDuration, result.time);
    const o = result.outcome;
    if (o.kind === 'win') stats.wins[o.winner as 0 | 1]++;
    else if (o.kind === 'draw') stats.draws++;
    else stats.timeouts++;
    const bodies = battle.world.bodies;
    stats.avgCollisions += bodies[0]!.collisions;
    let battleMax = 0;
    let trips = 0;
    let nonFinite = false;
    for (const b of bodies) {
      battleMax = Math.max(battleMax, b.maxSpeed);
      trips += b.guardTrips;
      for (const v of [b.x, b.y, b.vx, b.vy, b.omega, b.tilt]) if (!Number.isFinite(v)) nonFinite = true;
    }
    stats.avgMaxSpeed += battleMax;
    stats.maxTranslationalSpeed = Math.max(stats.maxTranslationalSpeed, battleMax);
    if (trips > 0 || nonFinite) {
      stats.failures++;
      stats.failureDetails.push(`seed ${seed}: guardTrips=${trips} nonFinite=${nonFinite}`);
    }
  }
  const n = Math.max(1, stats.results.length);
  stats.avgDuration /= n;
  stats.avgCollisions /= n;
  stats.avgMaxSpeed /= n;
  if (!Number.isFinite(stats.minDuration)) stats.minDuration = 0;
  return stats;
}
