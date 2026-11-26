/**
 * Per-top career statistics (v0.4). Pure data + pure functions so the format
 * can be validated, migrated and tested without a DOM.
 *
 * Lifetime aggregates are kept forever; `recent` is bounded
 * (RECENT_BATTLE_LIMIT, newest last). Matchup tables are keyed by opponent
 * class / opponent top definition id / stadium id, so new tops and stadiums
 * need no schema change.
 */
import { RECENT_BATTLE_LIMIT, type Difficulty, DIFFICULTIES, type BattleOutcomeKind, type UpgradeRanks } from './config';
import { LAUNCH_QUALITIES, type LaunchQuality } from '../sim/launch';
import type { FinishKind } from '../sim/combat';

export const FINISH_KINDS: readonly FinishKind[] = ['burst', 'spin', 'knockout'];

export interface Tally {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
}
export type FinishCounts = Record<FinishKind, number>;

export interface BattleRecord {
  id: string;
  /** ISO timestamp the battle was settled. */
  at: string;
  seed: number;
  stadiumId: string;
  difficulty: Difficulty;
  /** Player career rank when the battle started. */
  playerRankId: string;
  opponent: { topId: string; topClass: string; rankId: string; ranks: UpgradeRanks };
  result: BattleOutcomeKind;
  /** How the battle ended: the finish of whoever was eliminated, 'draw', or 'timeout'. */
  finish: FinishKind | 'draw' | 'timeout';
  /** Battle duration, simulated seconds. */
  duration: number;
  launch: LaunchQuality;
  opponentLaunch: LaunchQuality;
  damageDealt: number;
  damageReceived: number;
  crits: number;
  rewards: { credits: number; xp: number };
}

export interface TopStats {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  winsByFinish: FinishCounts;
  lossesByFinish: FinishCounts;
  fastestWin: number | null;
  longestBattle: number | null;
  damageDealt: number;
  damageReceived: number;
  critsLanded: number;
  creditsEarned: number;
  xpEarned: number;
  launches: Record<LaunchQuality, number>;
  vsClass: Record<string, Tally>;
  vsTop: Record<string, Tally>;
  byStadium: Record<string, Tally>;
  recent: BattleRecord[];
}

const zeroFinish = (): FinishCounts => ({ burst: 0, spin: 0, knockout: 0 });
export const emptyTally = (): Tally => ({ battles: 0, wins: 0, losses: 0, draws: 0 });

export function emptyTopStats(): TopStats {
  return {
    battles: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    winsByFinish: zeroFinish(),
    lossesByFinish: zeroFinish(),
    fastestWin: null,
    longestBattle: null,
    damageDealt: 0,
    damageReceived: 0,
    critsLanded: 0,
    creditsEarned: 0,
    xpEarned: 0,
    launches: { poor: 0, good: 0, great: 0, perfect: 0 },
    vsClass: {},
    vsTop: {},
    byStadium: {},
    recent: [],
  };
}

/** Victories ÷ all completed battles (draws count as battles). 0 with no battles. */
export function winRate(s: Pick<Tally, 'battles' | 'wins'>): number {
  return s.battles > 0 ? s.wins / s.battles : 0;
}

function bump(t: Tally | undefined, r: BattleOutcomeKind): Tally {
  const o = t ? { ...t } : emptyTally();
  o.battles++;
  if (r === 'win') o.wins++;
  else if (r === 'loss') o.losses++;
  else o.draws++;
  return o;
}

/** Returns new stats with one completed battle recorded. Pure. */
export function recordBattle(s: TopStats, r: BattleRecord): TopStats {
  const o: TopStats = {
    ...s,
    winsByFinish: { ...s.winsByFinish },
    lossesByFinish: { ...s.lossesByFinish },
    launches: { ...s.launches },
    vsClass: { ...s.vsClass },
    vsTop: { ...s.vsTop },
    byStadium: { ...s.byStadium },
  };
  o.battles++;
  if (r.result === 'win') {
    o.wins++;
    o.streak++;
    o.bestStreak = Math.max(o.bestStreak, o.streak);
    if (r.finish !== 'draw' && r.finish !== 'timeout') o.winsByFinish[r.finish]++;
    o.fastestWin = o.fastestWin === null ? r.duration : Math.min(o.fastestWin, r.duration);
  } else if (r.result === 'loss') {
    o.losses++;
    o.streak = 0;
    if (r.finish !== 'draw' && r.finish !== 'timeout') o.lossesByFinish[r.finish]++;
  } else {
    o.draws++;
    o.streak = 0;
  }
  o.longestBattle = o.longestBattle === null ? r.duration : Math.max(o.longestBattle, r.duration);
  o.damageDealt += r.damageDealt;
  o.damageReceived += r.damageReceived;
  o.critsLanded += r.crits;
  o.creditsEarned += r.rewards.credits;
  o.xpEarned += r.rewards.xp;
  o.launches[r.launch]++;
  o.vsClass[r.opponent.topClass] = bump(o.vsClass[r.opponent.topClass], r.result);
  o.vsTop[r.opponent.topId] = bump(o.vsTop[r.opponent.topId], r.result);
  o.byStadium[r.stadiumId] = bump(o.byStadium[r.stadiumId], r.result);
  o.recent = [...s.recent, r].slice(-RECENT_BATTLE_LIMIT);
  return o;
}

// ------------------------------------------------------------ sanitising
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export function num(v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}
export function int(v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(num(v, def, min, max));
}
function tally(v: unknown): Tally | null {
  if (!isObj(v)) return null;
  const t = { battles: int(v.battles, 0), wins: int(v.wins, 0), losses: int(v.losses, 0), draws: int(v.draws, 0) };
  return t;
}
function tallyMap(v: unknown): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  if (isObj(v)) for (const [k, t] of Object.entries(v)) { const x = tally(t); if (x) out[k] = x; }
  return out;
}
function finishCounts(v: unknown): FinishCounts {
  const o = isObj(v) ? v : {};
  return { burst: int(o.burst, 0), spin: int(o.spin, 0), knockout: int(o.knockout, 0) };
}
const isQuality = (v: unknown): v is LaunchQuality => (LAUNCH_QUALITIES as readonly string[]).includes(v as string);

function sanitizeRecord(v: unknown): BattleRecord | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isObj(v.opponent)) return null;
  const op = v.opponent;
  if (typeof op.topId !== 'string') return null;
  const result = v.result === 'win' || v.result === 'loss' || v.result === 'draw' ? v.result : null;
  if (!result) return null;
  const rw = isObj(v.rewards) ? v.rewards : {};
  const rk = isObj(op.ranks) ? op.ranks : {};
  const r = (k: string) => int(rk[k], 0, 0, 10);
  const finish = v.finish === 'burst' || v.finish === 'spin' || v.finish === 'knockout' || v.finish === 'timeout' ? v.finish : 'draw';
  return {
    id: v.id,
    at: typeof v.at === 'string' ? v.at : '',
    seed: int(v.seed, 0, 0, 0xffffffff),
    stadiumId: typeof v.stadiumId === 'string' ? v.stadiumId : 'classic',
    difficulty: (DIFFICULTIES as readonly unknown[]).includes(v.difficulty) ? (v.difficulty as Difficulty) : 'normal',
    playerRankId: typeof v.playerRankId === 'string' ? v.playerRankId : 'bronze-3',
    opponent: {
      topId: op.topId,
      topClass: typeof op.topClass === 'string' ? op.topClass : 'Unknown',
      rankId: typeof op.rankId === 'string' ? op.rankId : 'bronze-3',
      ranks: { health: r('health'), attack: r('attack'), defense: r('defense'), stamina: r('stamina'), speed: r('speed'), critChance: r('critChance') },
    },
    result,
    finish,
    duration: num(v.duration, 0),
    launch: isQuality(v.launch) ? v.launch : 'poor',
    opponentLaunch: isQuality(v.opponentLaunch) ? v.opponentLaunch : 'poor',
    damageDealt: num(v.damageDealt, 0),
    damageReceived: num(v.damageReceived, 0),
    crits: int(v.crits, 0),
    rewards: { credits: int(rw.credits, 0), xp: int(rw.xp, 0) },
  };
}

export function sanitizeTopStats(v: unknown): TopStats {
  const e = emptyTopStats();
  if (!isObj(v)) return e;
  const lq = isObj(v.launches) ? v.launches : {};
  const recent = Array.isArray(v.recent) ? v.recent.map(sanitizeRecord).filter((r): r is BattleRecord => r !== null).slice(-RECENT_BATTLE_LIMIT) : [];
  const wins = int(v.wins, 0);
  const losses = int(v.losses, 0);
  const draws = int(v.draws, 0);
  return {
    battles: Math.max(int(v.battles, 0), wins + losses + draws),
    wins,
    losses,
    draws,
    streak: int(v.streak, 0),
    bestStreak: Math.max(int(v.bestStreak, 0), int(v.streak, 0)),
    winsByFinish: finishCounts(v.winsByFinish),
    lossesByFinish: finishCounts(v.lossesByFinish),
    fastestWin: v.fastestWin === null || v.fastestWin === undefined ? null : num(v.fastestWin, 0),
    longestBattle: v.longestBattle === null || v.longestBattle === undefined ? null : num(v.longestBattle, 0),
    damageDealt: num(v.damageDealt, 0),
    damageReceived: num(v.damageReceived, 0),
    critsLanded: int(v.critsLanded, 0),
    creditsEarned: int(v.creditsEarned, 0),
    xpEarned: int(v.xpEarned, 0),
    launches: { poor: int(lq.poor, 0), good: int(lq.good, 0), great: int(lq.great, 0), perfect: int(lq.perfect, 0) },
    vsClass: tallyMap(v.vsClass),
    vsTop: tallyMap(v.vsTop),
    byStadium: tallyMap(v.byStadium),
    recent,
  };
}
