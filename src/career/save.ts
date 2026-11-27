/**
 * Career save schema, validation and migration (v0.4). See docs/SAVE_SCHEMA.md.
 *
 * The save is plain JSON with an explicit `schemaVersion`. Loading goes
 * raw → migrate (version chain) → validate/sanitise → typed CareerSave.
 * Nothing here touches the DOM or storage.
 */
import { STARTER_TOPS, getTop } from '../content/tops';
import {
  CLAIMED_ID_LIMIT,
  MAX_LEVEL,
  MAX_UPGRADE_RANK,
  RARITIES,
  STARTING_CREDITS,
  STARTING_RANK_ID,
  isRankId,
  rankDef,
  xpToNextLevel,
  zeroRanks,
  type Rarity,
  type UpgradeRanks,
  UPGRADE_STATS,
} from './config';
import type { RankState } from './progression';
import { clampAim, isAim, type LaunchAim } from '../sim/launchGeometry';
import { emptyTacticalLifetime, emptyTopStats, int, sanitizeTopStats, type TopStats } from './history';

/**
 * Schema history: 1 = v0.4.0 / v0.4.1; 2 = v0.5.0 (lifetime tactical
 * statistics per owned top; battle records may carry tactical usage).
 */
export const SAVE_SCHEMA_VERSION = 2;
export const SAVE_FORMAT = 'spinstrike-career';

/** One owned top (an INSTANCE of a top definition). */
export interface OwnedTop {
  /** Stable unique id of this owned instance (not the definition id). */
  instanceId: string;
  definitionId: string;
  rarity: Rarity;
  acquiredAt: string;
  level: number;
  /** XP into the current level. */
  xp: number;
  lifetimeXp: number;
  upgrades: UpgradeRanks;
  stats: TopStats;
  /** Reserved: equipped part instance ids by slot (v0.6+). Empty in v0.4. */
  equipment: Record<string, string | null>;
  /** Reserved: cosmetic selections (later release). Empty in v0.4. */
  cosmetics: Record<string, string>;
  /**
   * v0.4.1: the player's last launch aim with this top (optional; absent on
   * v0.4.0 saves and until the player first aims). Not a schema change:
   * older builds simply ignore it.
   */
  launchAim?: LaunchAim;
}

export interface CareerSave {
  format: typeof SAVE_FORMAT;
  schemaVersion: number;
  careerId: string;
  createdAt: string;
  updatedAt: string;
  /** Game version that created the save (informational; never triggers a reset). */
  createdWithVersion: string;
  /** Incremented on every committed change. */
  revision: number;
  credits: number;
  rank: RankState;
  totals: { battles: number; wins: number; creditsEarned: number; xpEarned: number };
  activeTopId: string;
  tops: OwnedTop[];
  unlocks: { stadiums: string[] };
  /** Recently settled battle ids (duplicate-claim protection), newest last. */
  claimedBattleIds: string[];
}

export function newOwnedTop(instanceId: string, definitionId: string, now: string, rarity: Rarity = 'common'): OwnedTop {
  return {
    instanceId,
    definitionId,
    rarity,
    acquiredAt: now,
    level: 1,
    xp: 0,
    lifetimeXp: 0,
    upgrades: zeroRanks(),
    stats: emptyTopStats(),
    equipment: {},
    cosmetics: {},
  };
}

export function createCareer(opts: { starterId: string; careerId: string; topInstanceId: string; now: string; version: string }): CareerSave {
  getTop(opts.starterId); // throws for unknown ids
  return {
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId: opts.careerId,
    createdAt: opts.now,
    updatedAt: opts.now,
    createdWithVersion: opts.version,
    revision: 0,
    credits: STARTING_CREDITS,
    rank: { id: STARTING_RANK_ID, wins: 0, championshipQualified: false },
    totals: { battles: 0, wins: 0, creditsEarned: 0, xpEarned: 0 },
    activeTopId: opts.topInstanceId,
    tops: [newOwnedTop(opts.topInstanceId, opts.starterId, opts.now)],
    unlocks: { stadiums: ['classic'] },
    claimedBattleIds: [],
  };
}

// -------------------------------------------------------------- migration
/** Migration from schema N to N+1, keyed by N. Add entries when the schema changes. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /**
   * 1 → 2 (v0.5.0): every owned top gets empty lifetime tactical statistics.
   * Old battle records are kept exactly as they are: nothing is back-filled,
   * because no tactical data existed before v0.5.
   */
  1: (raw) => ({
    ...raw,
    tops: Array.isArray(raw.tops)
      ? raw.tops.map((t) =>
          isObj(t) ? { ...t, stats: isObj(t.stats) ? { ...t.stats, tactics: isObj(t.stats.tactics) ? t.stats.tactics : emptyTacticalLifetime() } : t.stats } : t,
        )
      : raw.tops,
  }),
};

export type MigrateResult = { ok: true; raw: Record<string, unknown>; from: number } | { ok: false; error: string; newer?: boolean };

export function migrateSave(raw: unknown, migrations: Readonly<Record<number, Migration>> = MIGRATIONS, target = SAVE_SCHEMA_VERSION): MigrateResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Save data must be a JSON object.' };
  let cur = raw as Record<string, unknown>;
  const v = cur.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'Save has no valid schemaVersion.' };
  if (v > target) return { ok: false, newer: true, error: `This save was made by a newer version of SpinStrike (schema ${v}; this build supports up to ${target}). Update the game to open it.` };
  for (let n = v; n < target; n++) {
    const m = migrations[n];
    if (!m) return { ok: false, error: `No migration from save schema ${n} to ${n + 1}.` };
    cur = { ...m(cur), schemaVersion: n + 1 };
  }
  return { ok: true, raw: cur, from: v };
}

// -------------------------------------------------------------- validation
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, def: string) => (typeof v === 'string' && v.length > 0 ? v : def);

export type ValidateResult = { ok: true; save: CareerSave; warnings: string[] } | { ok: false; errors: string[] };

function sanitizeTop(v: unknown, i: number, warnings: string[], seen: Set<string>): OwnedTop | null {
  if (!isObj(v)) {
    warnings.push(`tops[${i}] is not an object and was dropped.`);
    return null;
  }
  const defId = v.definitionId;
  if (typeof defId !== 'string' || !STARTER_TOPS.some((d) => d.id === defId)) {
    warnings.push(`tops[${i}] references an unknown top (${String(defId)}) and was dropped.`);
    return null;
  }
  let instanceId = str(v.instanceId, '');
  if (!instanceId || seen.has(instanceId)) {
    warnings.push(`tops[${i}] had a missing or duplicate id; a new one was assigned.`);
    instanceId = `${defId}-${i}-${seen.size}-${Math.random().toString(36).slice(2, 8)}`;
  }
  seen.add(instanceId);
  const level = int(v.level, 1, 1, MAX_LEVEL);
  const up = isObj(v.upgrades) ? v.upgrades : {};
  const upgrades = zeroRanks();
  for (const k of UPGRADE_STATS) upgrades[k] = int(up[k], 0, 0, MAX_UPGRADE_RANK);
  return {
    instanceId,
    definitionId: defId,
    rarity: (RARITIES as readonly unknown[]).includes(v.rarity) ? (v.rarity as Rarity) : 'common',
    acquiredAt: str(v.acquiredAt, ''),
    level,
    xp: level >= MAX_LEVEL ? 0 : int(v.xp, 0, 0, xpToNextLevel(level) - 1),
    lifetimeXp: int(v.lifetimeXp, 0),
    upgrades,
    stats: sanitizeTopStats(v.stats),
    equipment: isObj(v.equipment) ? Object.fromEntries(Object.entries(v.equipment).filter(([, x]) => x === null || typeof x === 'string')) as Record<string, string | null> : {},
    cosmetics: isObj(v.cosmetics) ? Object.fromEntries(Object.entries(v.cosmetics).filter(([, x]) => typeof x === 'string')) as Record<string, string> : {},
    ...(isAim(v.launchAim) ? { launchAim: clampAim(v.launchAim) } : {}),
  };
}

/** Validates and sanitises an (already migrated) save. Fatal problems → errors; recoverable ones → warnings. */
export function validateSave(raw: unknown): ValidateResult {
  if (!isObj(raw)) return { ok: false, errors: ['Save data must be a JSON object.'] };
  const warnings: string[] = [];
  if (raw.format !== undefined && raw.format !== SAVE_FORMAT) return { ok: false, errors: [`Unrecognised save format (${String(raw.format)}).`] };
  if (raw.schemaVersion !== SAVE_SCHEMA_VERSION) return { ok: false, errors: [`Unsupported schemaVersion ${String(raw.schemaVersion)}.`] };
  if (!Array.isArray(raw.tops)) return { ok: false, errors: ['Save has no tops list.'] };
  const seen = new Set<string>();
  const tops = raw.tops.map((t, i) => sanitizeTop(t, i, warnings, seen)).filter((t): t is OwnedTop => t !== null);
  if (tops.length === 0) return { ok: false, errors: ['Save contains no valid owned tops.'] };
  let activeTopId = str(raw.activeTopId, '');
  if (!tops.some((t) => t.instanceId === activeTopId)) {
    if (activeTopId) warnings.push('The active top was not found; the first owned top was selected.');
    activeTopId = tops[0]!.instanceId;
  }
  const rk = isObj(raw.rank) ? raw.rank : {};
  let rankId = str(rk.id, STARTING_RANK_ID);
  if (!isRankId(rankId)) {
    warnings.push(`Unknown career rank "${rankId}"; reset to ${STARTING_RANK_ID}.`);
    rankId = STARTING_RANK_ID;
  }
  const def = rankDef(rankId)!;
  const rankWins = int(rk.wins, 0, 0, def.winsToAdvance ?? Number.MAX_SAFE_INTEGER);
  const tt = isObj(raw.totals) ? raw.totals : {};
  const now = new Date(0).toISOString();
  const stadiums = isObj(raw.unlocks) && Array.isArray(raw.unlocks.stadiums) ? raw.unlocks.stadiums.filter((s): s is string => typeof s === 'string') : [];
  if (!stadiums.includes('classic')) stadiums.unshift('classic');
  const claimed = Array.isArray(raw.claimedBattleIds) ? raw.claimedBattleIds.filter((s): s is string => typeof s === 'string').slice(-CLAIMED_ID_LIMIT) : [];
  const save: CareerSave = {
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    careerId: str(raw.careerId, `career-${Math.random().toString(36).slice(2, 10)}`),
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
    createdWithVersion: str(raw.createdWithVersion, 'unknown'),
    revision: int(raw.revision, 0),
    credits: int(raw.credits, 0),
    rank: { id: rankId, wins: rankWins, championshipQualified: rk.championshipQualified === true && def.winsToAdvance !== null && rankWins >= def.winsToAdvance },
    totals: { battles: int(tt.battles, 0), wins: int(tt.wins, 0), creditsEarned: int(tt.creditsEarned, 0), xpEarned: int(tt.xpEarned, 0) },
    activeTopId,
    tops,
    unlocks: { stadiums },
    claimedBattleIds: claimed,
  };
  if (typeof raw.credits !== 'number' || !Number.isFinite(raw.credits)) warnings.push('Credits were missing or invalid and were set to 0.');
  return { ok: true, save, warnings };
}

/** raw → migrate → validate. */
export function loadSaveData(raw: unknown, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): ValidateResult & { newer?: boolean; migratedFrom?: number } {
  const m = migrateSave(raw, migrations);
  if (!m.ok) return { ok: false, errors: [m.error], newer: m.newer };
  const v = validateSave(m.raw);
  return v.ok ? { ...v, migratedFrom: m.from } : v;
}

// ------------------------------------------------------------ export format
export interface ExportFile {
  format: 'spinstrike-career-export';
  exportVersion: 1;
  exportedAt: string;
  gameVersion: string;
  save: CareerSave;
}
export function makeExport(save: CareerSave, now: string, gameVersion: string): ExportFile {
  return { format: 'spinstrike-career-export', exportVersion: 1, exportedAt: now, gameVersion, save };
}
/** Parses an exported file (or a bare save object) into a validated save. */
export function parseImport(text: string): ValidateResult & { newer?: boolean } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  if (isObj(raw) && raw.format === 'spinstrike-career-export') {
    if (raw.exportVersion !== 1) return { ok: false, errors: [`Unsupported export version ${String(raw.exportVersion)}.`] };
    raw = raw.save;
  }
  return loadSaveData(raw);
}
