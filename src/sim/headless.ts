import { Battle, type BattleOptions, type BattleResult } from './battle';
import type { FinishKind } from './combat';

/** Compact per-battle record kept by runBatch (pure data). */
export interface BattleRecord {
  seed: number;
  result: BattleResult;
  /** Top–top collisions counted by the physics (new contacts). */
  collisions: number;
  /** Maximum translational speed reached by either top, m/s. */
  maxSpeed: number;
  guardTrips: number;
  nonFinite: boolean;
}

export interface BatchStats {
  battles: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  /** Wins indexed by top slot (0, 1). */
  wins: [number, number];
  draws: number;
  timeouts: number;
  /** Win counts by finish type, indexed by slot. */
  finishes: Record<FinishKind, [number, number]>;
  avgCollisions: number;
  maxTranslationalSpeed: number;
  avgMaxSpeed: number;
  /** Largest single damaging hit in the batch. */
  maxHit: number;
  /** Battles where a numerical guard tripped or a value became non-finite. */
  failures: number;
  failureDetails: string[];
  results: BattleResult[];
  records: BattleRecord[];
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
    finishes: { burst: [0, 0], knockout: [0, 0], spin: [0, 0] },
    avgCollisions: 0,
    maxTranslationalSpeed: 0,
    avgMaxSpeed: 0,
    maxHit: 0,
    failures: 0,
    failureDetails: [],
    results: [],
    records: [],
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
    if (o.kind === 'win') {
      stats.wins[o.winner as 0 | 1]++;
      stats.finishes[o.finish][o.winner as 0 | 1]++;
    } else if (o.kind === 'draw') stats.draws++;
    else stats.timeouts++;
    stats.maxHit = Math.max(stats.maxHit, result.strongestHit.damage);
    const bodies = battle.world.bodies;
    stats.avgCollisions += bodies[0]!.collisions;
    let battleMax = 0;
    let trips = 0;
    let nonFinite = false;
    for (const b of bodies) {
      battleMax = Math.max(battleMax, b.maxSpeed);
      trips += b.guardTrips;
      for (const v of [b.x, b.y, b.vx, b.vy, b.omega, b.tilt, b.health]) if (!Number.isFinite(v)) nonFinite = true;
      if (b.health < 0 || b.health > b.combat.maxHealth) nonFinite = true;
    }
    for (const t of result.tops) {
      for (const v of [t.health, t.stamina, t.damageDealt, t.damageReceived, t.strongestHit]) if (!Number.isFinite(v) || v < 0) nonFinite = true;
    }
    stats.avgMaxSpeed += battleMax;
    stats.maxTranslationalSpeed = Math.max(stats.maxTranslationalSpeed, battleMax);
    stats.records.push({ seed, result, collisions: bodies[0]!.collisions, maxSpeed: battleMax, guardTrips: trips, nonFinite });
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

/** p-th percentile (0–100) of a numeric array (linear interpolation). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (Math.max(0, Math.min(100, p)) / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}
