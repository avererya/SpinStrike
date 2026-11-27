/**
 * CareerStore: owns the in-memory career save and every state transition
 * (starter selection, upgrades, battle settlement, reset, import/export).
 * Pure TypeScript over an injected key-value store, so it is fully testable.
 *
 * Persistence is recoverable: each commit writes the previous good copy to
 * a backup key before replacing the primary one, and loading falls back to
 * the backup when the primary is unreadable. A corrupt or too-new save is
 * never silently overwritten or wiped.
 */
import { getTop } from '../content/tops';
import {
  CLAIMED_ID_LIMIT,
  MAX_UPGRADE_RANK,
  CAREER_PLAYABLE_RARITIES,
  rankDef,
  type BattleOutcomeKind,
  type UpgradeStat,
} from './config';
import {
  applyRankWin,
  applyXp,
  calculateReward,
  clampRank,
  levelForRank,
  maxRankForLevel,
  upgradeCost,
  type LevelUp,
  type RankState,
  type Reward,
} from './progression';
import { recordBattle, type BattleRecord, type TacticalSide } from './history';
import { PHYSICS_VERSION } from '../content/derive';
import { COMBAT_RULESET, type TacticalTopSummary } from '../sim/tactics';
import { difficultyAiAim } from './config';

function tacticalSide(t: TacticalTopSummary): TacticalSide {
  return {
    boosts: t.boostsUsed,
    braces: t.bracesUsed,
    boostsLeft: t.boostsLeft,
    bracesLeft: t.bracesLeft,
    staminaSpent: Math.round(t.boostCost * 10000) / 100,
    braceImpacts: t.braceImpacts,
    damagePrevented: Math.round(t.damagePrevented * 10) / 10,
    boostsToHit: t.boostsToHit,
    boostKnockout: t.boostKnockout,
  };
}
import { clampAim, type LaunchAim } from '../sim/launchGeometry';
import { SAVE_SCHEMA_VERSION, createCareer, loadSaveData, makeExport, parseImport, type CareerSave, type OwnedTop } from './save';
import type { CareerBattleSetup } from './battle';
import type { BattleResult } from '../sim/battle';
import { opponentTierOf } from './tier';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Simple in-memory store (tests, or when localStorage is unavailable). */
export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

export const CAREER_KEY = 'spinstrike.career.v1';
export const CAREER_BACKUP_KEY = 'spinstrike.career.v1.backup';
export const CAREER_CORRUPT_KEY = 'spinstrike.career.v1.corrupt';

export type LoadStatus =
  | { kind: 'none' }
  | { kind: 'ok'; warnings: string[]; recoveredFromBackup: boolean }
  | { kind: 'unreadable'; errors: string[] }
  | { kind: 'newer'; errors: string[] };

export interface SettledBattle {
  battleId: string;
  outcome: BattleOutcomeKind;
  reward: Reward;
  record: BattleRecord;
  top: { before: { level: number; xp: number }; after: { level: number; xp: number }; levelUps: LevelUp[]; maxLevel: boolean };
  rank: { before: RankState; after: RankState; promotedTo: string | null; qualifiedNow: boolean };
  /** True when the battle had already been settled; no reward was granted again. */
  duplicate: boolean;
}

export type UpgradeResult = { ok: true; cost: number; newRank: number } | { ok: false; reason: 'max-rank' | 'level' | 'credits' | 'no-top' | 'rarity'; message: string; requiredLevel?: number };

export type Clock = () => string;
export type IdFactory = (prefix: string) => string;

let idCounter = 0;
export const defaultIds: IdFactory = (prefix) => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const core = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${core}`;
};

export class CareerStore {
  private current: CareerSave | null = null;
  private listeners = new Set<() => void>();
  private settled = new Map<string, SettledBattle>();
  /** Last persistence failure (the in-memory career keeps working). */
  lastSaveError: string | null = null;
  loadStatus: LoadStatus = { kind: 'none' };

  constructor(
    private readonly storage: KeyValueStore,
    private readonly opts: { version: string; now?: Clock; ids?: IdFactory } = { version: 'dev' },
  ) {}

  private now(): string {
    return (this.opts.now ?? (() => new Date().toISOString()))();
  }
  private id(prefix: string): string {
    return (this.opts.ids ?? defaultIds)(prefix);
  }

  get save(): CareerSave | null {
    return this.current;
  }
  get activeTop(): OwnedTop | null {
    const s = this.current;
    return s ? (s.tops.find((t) => t.instanceId === s.activeTopId) ?? s.tops[0] ?? null) : null;
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------------- loading
  load(): LoadStatus {
    const tryRead = (key: string) => {
      let text: string | null;
      try {
        text = this.storage.getItem(key);
      } catch (e) {
        return { state: 'error' as const, errors: [`Storage unavailable: ${(e as Error).message}`] };
      }
      if (text === null) return { state: 'missing' as const };
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { state: 'error' as const, errors: ['Stored save is not valid JSON.'], text };
      }
      const r = loadSaveData(raw);
      if (r.ok) return { state: 'ok' as const, save: r.save, warnings: r.warnings };
      return { state: 'error' as const, errors: r.errors, newer: r.newer, text };
    };
    const primary = tryRead(CAREER_KEY);
    if (primary.state === 'ok') {
      this.current = primary.save;
      return (this.loadStatus = { kind: 'ok', warnings: primary.warnings, recoveredFromBackup: false });
    }
    if (primary.state === 'error' && 'newer' in primary && primary.newer) {
      this.current = null;
      return (this.loadStatus = { kind: 'newer', errors: primary.errors });
    }
    const backup = tryRead(CAREER_BACKUP_KEY);
    if (backup.state === 'ok') {
      this.current = backup.save;
      const warnings = [...backup.warnings];
      if (primary.state === 'error') {
        warnings.push('The main save could not be read; your previous backup was restored.');
        if ('text' in primary && primary.text) this.keep(CAREER_CORRUPT_KEY, primary.text);
      }
      return (this.loadStatus = { kind: 'ok', warnings, recoveredFromBackup: primary.state === 'error' });
    }
    this.current = null;
    if (primary.state === 'error') {
      if ('text' in primary && primary.text) this.keep(CAREER_CORRUPT_KEY, primary.text);
      return (this.loadStatus = { kind: 'unreadable', errors: primary.errors });
    }
    return (this.loadStatus = { kind: 'none' });
  }

  private keep(key: string, text: string): void {
    try {
      this.storage.setItem(key, text);
    } catch {
      /* best effort */
    }
  }

  // ------------------------------------------------------------ persistence
  /** Replaces the save with `next` (revision bumped) and persists it. In-memory state always advances. */
  private commit(next: CareerSave): void {
    const committed: CareerSave = { ...next, revision: next.revision + 1, updatedAt: this.now() };
    const previous = (() => {
      try {
        return this.storage.getItem(CAREER_KEY);
      } catch {
        return null;
      }
    })();
    try {
      if (previous !== null) this.storage.setItem(CAREER_BACKUP_KEY, previous);
      this.storage.setItem(CAREER_KEY, JSON.stringify(committed));
      this.lastSaveError = null;
    } catch (e) {
      this.lastSaveError = `Could not save your career: ${(e as Error).message}. Export a backup from Settings.`;
    }
    this.current = committed;
    this.emit();
  }

  // ---------------------------------------------------------------- career
  startCareer(starterId: string): void {
    getTop(starterId);
    const topInstanceId = this.id('top');
    const save = createCareer({ starterId, careerId: this.id('career'), topInstanceId, now: this.now(), version: this.opts.version });
    this.settled.clear();
    this.commit(save);
    this.loadStatus = { kind: 'ok', warnings: [], recoveredFromBackup: false };
  }

  /** Deletes the career (callers must have obtained explicit confirmation). */
  reset(): void {
    try {
      this.storage.removeItem(CAREER_KEY);
      this.storage.removeItem(CAREER_BACKUP_KEY);
      this.storage.removeItem(CAREER_CORRUPT_KEY);
    } catch {
      /* ignore */
    }
    this.current = null;
    this.settled.clear();
    this.loadStatus = { kind: 'none' };
    this.emit();
  }

  setActiveTop(instanceId: string): boolean {
    const s = this.current;
    if (!s || !s.tops.some((t) => t.instanceId === instanceId)) return false;
    this.commit({ ...s, activeTopId: instanceId });
    return true;
  }

  // -------------------------------------------------------------- upgrades
  canUpgrade(top: OwnedTop, stat: UpgradeStat): UpgradeResult {
    const s = this.current;
    if (!s) return { ok: false, reason: 'no-top', message: 'No career.' };
    if (!CAREER_PLAYABLE_RARITIES.includes(top.rarity)) return { ok: false, reason: 'rarity', message: 'This rarity is not playable in career mode yet.' };
    const rank = clampRank(top.upgrades[stat]);
    if (rank >= MAX_UPGRADE_RANK) return { ok: false, reason: 'max-rank', message: 'Already at maximum rank.' };
    const next = rank + 1;
    if (next > maxRankForLevel(top.level)) {
      const requiredLevel = levelForRank(next);
      return { ok: false, reason: 'level', requiredLevel, message: `Requires top level ${requiredLevel}.` };
    }
    const cost = upgradeCost(top.rarity, next);
    if (s.credits < cost) return { ok: false, reason: 'credits', message: `Need ${cost - s.credits} more Credits.` };
    return { ok: true, cost, newRank: next };
  }

  /** Buys the next rank of `stat` for a top. Atomic: credits and rank change together. */
  upgrade(instanceId: string, stat: UpgradeStat): UpgradeResult {
    const s = this.current;
    const top = s?.tops.find((t) => t.instanceId === instanceId);
    if (!s || !top) return { ok: false, reason: 'no-top', message: 'Top not found.' };
    const check = this.canUpgrade(top, stat);
    if (!check.ok) return check;
    this.commit({
      ...s,
      credits: s.credits - check.cost,
      tops: s.tops.map((t) => (t.instanceId === instanceId ? { ...t, upgrades: { ...t.upgrades, [stat]: check.newRank } } : t)),
    });
    return check;
  }

  // --------------------------------------------------------- battle rewards
  hasSettled(battleId: string): boolean {
    return !!this.current && (this.current.claimedBattleIds.includes(battleId) || this.settled.has(battleId));
  }

  /**
   * Settles a completed career battle: Credits, XP, level-ups, rank progress,
   * statistics and the claimed-id list change in ONE transaction. A battle id
   * can be settled only once; settling it again returns the original summary
   * with `duplicate: true` and changes nothing.
   */
  settleBattle(setup: CareerBattleSetup, result: BattleResult): SettledBattle | null {
    const s = this.current;
    if (!s) return null;
    const prior = this.settled.get(setup.battleId);
    if (prior) return { ...prior, duplicate: true };
    if (s.claimedBattleIds.includes(setup.battleId)) return null; // settled in an earlier session: summary unavailable
    const top = s.tops.find((t) => t.instanceId === setup.playerInstanceId);
    if (!top) return null;

    const o = result.outcome;
    const outcome: BattleOutcomeKind = o.kind === 'win' ? (o.winner === 0 ? 'win' : 'loss') : 'draw';
    const reward = calculateReward(opponentTierOf(setup.opponent.rankId), setup.difficulty, outcome);
    const xp = applyXp(top.level, top.xp, reward.xp);

    let finish: BattleRecord['finish'] = 'draw';
    if (o.kind === 'win') finish = o.finish;
    else if (o.kind === 'timeout') finish = 'timeout';
    const mine = result.tops[0]!;
    const theirs = result.tops[1]!;
    const record: BattleRecord = {
      id: setup.battleId,
      at: this.now(),
      seed: setup.seed,
      stadiumId: setup.stadiumId,
      difficulty: setup.difficulty,
      playerRankId: setup.playerRankId,
      opponent: {
        topId: setup.opponent.topId,
        topClass: getTop(setup.opponent.topId).topClass,
        rankId: setup.opponent.rankId,
        ranks: { ...setup.opponent.ranks },
      },
      result: outcome,
      finish,
      duration: Math.round(result.time * 100) / 100,
      launch: result.launches[0]!.quality,
      opponentLaunch: result.launches[1]!.quality,
      damageDealt: Math.round(mine.damageDealt * 10) / 10,
      damageReceived: Math.round(theirs.damageDealt * 10) / 10,
      crits: mine.critsLanded,
      rewards: reward,
      ruleset: result.tactical?.enabled ? COMBAT_RULESET : PHYSICS_VERSION,
      ...(result.aims ? { aim: { ...result.aims[0]! }, opponentAim: { ...result.aims[1]! } } : {}),
      ...(result.tactical?.enabled ? { tactical: { player: tacticalSide(result.tactical.tops[0]!), opponent: tacticalSide(result.tactical.tops[1]!) } } : {}),
      launchSettings: (() => {
        const a = difficultyAiAim(setup.difficulty, setup.opponent.topId);
        return { opponentAimDirection: [a.direction.min, a.direction.max], opponentAimTilt: [a.tilt.min, a.tilt.max] };
      })(),
    };

    const rankBefore = s.rank;
    let rankAfter = rankBefore;
    let promoted: string | null = null;
    let qualifiedNow = false;
    if (outcome === 'win') {
      const r = applyRankWin(rankBefore);
      rankAfter = r.state;
      promoted = r.promoted ? r.promoted.id : null;
      qualifiedNow = r.qualifiedNow;
    }

    const updatedTop: OwnedTop = {
      ...top,
      ...(result.aims ? { launchAim: { ...result.aims[0]! } } : {}),
      level: xp.level,
      xp: xp.xp,
      lifetimeXp: top.lifetimeXp + reward.xp,
      stats: recordBattle(top.stats, record),
    };
    const next: CareerSave = {
      ...s,
      credits: s.credits + reward.credits,
      rank: rankAfter,
      totals: {
        battles: s.totals.battles + 1,
        wins: s.totals.wins + (outcome === 'win' ? 1 : 0),
        creditsEarned: s.totals.creditsEarned + reward.credits,
        xpEarned: s.totals.xpEarned + reward.xp,
      },
      tops: s.tops.map((t) => (t.instanceId === top.instanceId ? updatedTop : t)),
      claimedBattleIds: [...s.claimedBattleIds, setup.battleId].slice(-CLAIMED_ID_LIMIT),
    };
    this.commit(next);
    const summary: SettledBattle = {
      battleId: setup.battleId,
      outcome,
      reward,
      record,
      top: { before: { level: top.level, xp: top.xp }, after: { level: xp.level, xp: xp.xp }, levelUps: xp.levelUps, maxLevel: xp.level >= 30 },
      rank: { before: rankBefore, after: rankAfter, promotedTo: promoted, qualifiedNow },
      duplicate: false,
    };
    this.settled.set(setup.battleId, summary);
    return summary;
  }

  /** Remembers the launch aim of an owned top (pre-battle aiming screen). */
  setLaunchAim(instanceId: string, aim: LaunchAim): boolean {
    const s = this.current;
    if (!s) return false;
    const top = s.tops.find((t) => t.instanceId === instanceId);
    if (!top) return false;
    const a = clampAim(aim);
    if (top.launchAim && top.launchAim.direction === a.direction && top.launchAim.tilt === a.tilt) return true;
    this.commit({ ...s, tops: s.tops.map((t) => (t.instanceId === instanceId ? { ...t, launchAim: a } : t)) });
    return true;
  }

  // ------------------------------------------------------- export / import
  exportJson(): string | null {
    if (!this.current) return null;
    return JSON.stringify(makeExport(this.current, this.now(), this.opts.version), null, 2);
  }

  /** Validates `text` WITHOUT applying it. */
  previewImport(text: string) {
    return parseImport(text);
  }

  /** Replaces the career with a validated import. Callers must have confirmed. */
  importJson(text: string): { ok: true; warnings: string[] } | { ok: false; errors: string[] } {
    const r = parseImport(text);
    if (!r.ok) return r;
    this.settled.clear();
    this.commit(r.save);
    return { ok: true, warnings: r.warnings };
  }
}

export { rankDef, SAVE_SCHEMA_VERSION };
