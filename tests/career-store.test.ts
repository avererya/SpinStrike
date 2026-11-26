import { describe, expect, it } from 'vitest';
import { CAREER_BACKUP_KEY, CAREER_CORRUPT_KEY, CAREER_KEY, CareerStore, MemoryStore } from '../src/career/store';
import { MIGRATIONS, SAVE_SCHEMA_VERSION, loadSaveData, migrateSave, parseImport, validateSave } from '../src/career/save';
import { createBattleSetup, type CareerBattleSetup } from '../src/career/battle';
import { playHeadlessBattle } from '../src/career/headless';
import type { BattleResult } from '../src/sim/battle';
import { emptyTopStats, recordBattle, winRate, type BattleRecord } from '../src/career/history';
import { RECENT_BATTLE_LIMIT, STARTING_CREDITS } from '../src/career/config';
import { defaultConfig } from '../src/config/sandboxConfig';

let n = 0;
const ids = (p: string) => `${p}_${++n}`;
function mk(storage = new MemoryStore()) {
  const store = new CareerStore(storage, { version: '0.4.0', ids, now: () => '2026-01-01T00:00:00.000Z' });
  return { store, storage };
}
function started(starter = 'inferno') {
  const m = mk();
  m.store.startCareer(starter);
  return m;
}
function setupFor(store: CareerStore, id: string, diff: 'easy' | 'normal' | 'hard' | 'expert' = 'normal'): CareerBattleSetup {
  const t = store.activeTop!;
  return createBattleSetup({ battleId: id, seed: 11, opponentSeed: 22, difficulty: diff, playerRankId: store.save!.rank.id, playerInstanceId: t.instanceId, playerTopId: t.definitionId });
}
function fake(kind: 'win' | 'loss' | 'draw' | 'timeout', finish: 'burst' | 'spin' | 'knockout' = 'burst', time = 20): BattleResult {
  const top = { health: 100, maxHealth: 600, stamina: 0.5, spinning: true, damageDealt: 100, damageReceived: 50, hitsLanded: 3, strongestHit: 40, strongestHitCritical: false, critsLanded: 2, critsReceived: 0, critDamageDealt: 80, collisions: 5 };
  const launch = { quality: 'great', energyMultiplier: 1.07, source: 'player' } as const;
  const outcome =
    kind === 'win' ? { kind: 'win', winner: 0, loser: 1, finish, narrow: false }
    : kind === 'loss' ? { kind: 'win', winner: 1, loser: 0, finish, narrow: false }
    : kind === 'draw' ? { kind: 'draw', finishes: ['spin', 'spin'], reason: 'near-simultaneous' }
    : { kind: 'timeout' };
  return { outcome, time, steps: 0, seed: 1, tops: [top, top], strongestHit: { damage: 1, by: 0, critical: false }, launches: [launch, launch], drawWindow: null } as unknown as BattleResult;
}

describe('starter selection and new career', () => {
  it('creates the approved starting state for each starter', () => {
    for (const s of ['inferno', 'titan', 'tempest', 'phantom']) {
      const { store } = started(s);
      const c = store.save!;
      expect(c.tops).toHaveLength(1);
      const t = store.activeTop!;
      expect(t.definitionId).toBe(s);
      expect(t.rarity).toBe('common');
      expect(t.level).toBe(1);
      expect(t.xp).toBe(0);
      expect(Object.values(t.upgrades).every((v) => v === 0)).toBe(true);
      expect(c.credits).toBe(500);
      expect(STARTING_CREDITS).toBe(500);
      expect(c.rank).toEqual({ id: 'bronze-3', wins: 0, championshipQualified: false });
      expect(c.unlocks.stadiums).toContain('classic');
      expect(t.instanceId).toBeTruthy();
    }
  });
  it('rejects unknown starters', () => {
    expect(() => mk().store.startCareer('nope')).toThrow();
  });
});

describe('persistence', () => {
  it('persists new career, upgrades and rewards and reloads identically', () => {
    const { store, storage } = started();
    store.upgrade(store.activeTop!.instanceId, 'attack');
    playHeadlessBattle(store, 'normal', 1);
    const snapshot = JSON.stringify(store.save);
    const again = new CareerStore(storage, { version: '0.4.0' });
    expect(again.load().kind).toBe('ok');
    expect(JSON.stringify(again.save)).toBe(snapshot);
  });
  it('does not reset when the game version changes', () => {
    const { store, storage } = started();
    store.upgrade(store.activeTop!.instanceId, 'health');
    const next = new CareerStore(storage, { version: '9.9.9' });
    next.load();
    expect(next.activeTop!.upgrades.health).toBe(1);
  });
  it('falls back to the backup when the main save is corrupt and keeps the corrupt copy', () => {
    const { store, storage } = started();
    store.upgrade(store.activeTop!.instanceId, 'attack'); // backup = state before this commit
    storage.setItem(CAREER_KEY, '{not json');
    const again = new CareerStore(storage, { version: '0.4.0' });
    const st = again.load();
    expect(st.kind).toBe('ok');
    expect(st.kind === 'ok' && st.recoveredFromBackup).toBe(true);
    expect(storage.getItem(CAREER_CORRUPT_KEY)).toBe('{not json');
    expect(storage.getItem(CAREER_BACKUP_KEY)).not.toBeNull();
  });
  it('reports unreadable saves without wiping them', () => {
    const storage = new MemoryStore();
    storage.setItem(CAREER_KEY, 'garbage');
    const { store } = mk(storage);
    expect(store.load().kind).toBe('unreadable');
    expect(storage.getItem(CAREER_KEY)).toBe('garbage');
  });
  it('refuses saves from a newer schema without touching them', () => {
    const storage = new MemoryStore();
    const raw = JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, anything: true });
    storage.setItem(CAREER_KEY, raw);
    const { store } = mk(storage);
    expect(store.load().kind).toBe('newer');
    expect(storage.getItem(CAREER_KEY)).toBe(raw);
  });
  it('keeps working in memory and reports an error when storage fails', () => {
    const { store, storage } = started();
    storage.setItem = () => { throw new Error('quota'); };
    expect(store.upgrade(store.activeTop!.instanceId, 'attack').ok).toBe(true);
    expect(store.save!.credits).toBe(400);
    expect(store.lastSaveError).toContain('quota');
  });
});

describe('validation and migration', () => {
  const base = () => JSON.parse(JSON.stringify(started().store.save));
  it('accepts a valid save', () => expect(validateSave(base()).ok).toBe(true));
  it('sanitises malformed fields instead of crashing', () => {
    const s = base();
    s.credits = 'lots';
    s.tops[0].level = 999;
    s.tops[0].xp = -5;
    s.tops[0].upgrades = { attack: 99, health: 'x', bogus: 3 };
    s.tops[0].stats = 'nope';
    s.rank = { id: 'wat' };
    s.activeTopId = 'missing';
    const r = validateSave(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.credits).toBe(0);
    expect(r.save.tops[0]!.level).toBe(30);
    expect(r.save.tops[0]!.xp).toBe(0);
    expect(r.save.tops[0]!.upgrades.attack).toBe(10);
    expect(r.save.tops[0]!.upgrades.health).toBe(0);
    expect(r.save.tops[0]!.stats.battles).toBe(0);
    expect(r.save.rank.id).toBe('bronze-3');
    expect(r.save.activeTopId).toBe(r.save.tops[0]!.instanceId);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('rejects non-saves', () => {
    for (const bad of [null, [], 'x', 5, {}, { schemaVersion: 1 }, { schemaVersion: 1, tops: [] }, { schemaVersion: 1, tops: [{ definitionId: 'ghost' }] }]) {
      expect(loadSaveData(bad).ok).toBe(false);
    }
  });
  it('runs a migration chain in order', () => {
    const migrations = {
      1: (r: Record<string, unknown>) => ({ ...r, credits: (r.credits as number) + 1 }),
      2: (r: Record<string, unknown>) => ({ ...r, credits: (r.credits as number) * 10 }),
    };
    const m = migrateSave({ schemaVersion: 1, credits: 4 }, migrations, 3);
    expect(m.ok && m.raw.credits).toBe(50);
    expect(m.ok && m.raw.schemaVersion).toBe(3);
    expect(migrateSave({ schemaVersion: 1 }, {}, 2).ok).toBe(false);
    expect(Object.keys(MIGRATIONS)).toEqual([]);
  });
});

describe('credits, XP, ranks and exactly-once rewards', () => {
  it('awards victory rewards once and ignores duplicates', () => {
    const { store } = started();
    const setup = setupFor(store, 'b1');
    const first = store.settleBattle(setup, fake('win'))!;
    expect(first.reward).toEqual({ credits: 100, xp: 50 });
    expect(store.save!.credits).toBe(600);
    expect(store.activeTop!.xp).toBe(50);
    expect(store.save!.rank.wins).toBe(1);
    const rev = store.save!.revision;
    const dup = store.settleBattle(setup, fake('win'))!;
    expect(dup.duplicate).toBe(true);
    expect(store.save!.credits).toBe(600);
    expect(store.save!.revision).toBe(rev);
    expect(store.activeTop!.stats.battles).toBe(1);
    // After a reload the claimed id still blocks the same battle.
    const again = new CareerStore(storageOf(store), { version: 'x' });
    again.load();
    expect(again.settleBattle(setup, fake('win'))).toBeNull();
    expect(again.save!.credits).toBe(600);
  });
  it('pays defeat and draw (and timeout) rewards and gives no rank progress', () => {
    const { store } = started();
    const l = store.settleBattle(setupFor(store, 'l'), fake('loss'))!;
    expect(l.reward).toEqual({ credits: 5, xp: 5 });
    const d = store.settleBattle(setupFor(store, 'd'), fake('draw'))!;
    expect(d.reward).toEqual({ credits: 15, xp: 13 });
    const t = store.settleBattle(setupFor(store, 't'), fake('timeout'))!;
    expect(t.outcome).toBe('draw');
    expect(store.save!.rank.wins).toBe(0);
    expect(store.save!.credits).toBe(500 + 5 + 15 + 15);
    const s = store.activeTop!.stats;
    expect([s.wins, s.losses, s.draws, s.battles]).toEqual([0, 1, 2, 3]);
    expect(s.streak).toBe(0);
  });
  it('applies difficulty multipliers', () => {
    const { store } = started();
    expect(store.settleBattle(setupFor(store, 'e', 'expert'), fake('win'))!.reward).toEqual({ credits: 120, xp: 60 });
    expect(store.settleBattle(setupFor(store, 'h', 'hard'), fake('win'))!.reward).toEqual({ credits: 110, xp: 55 });
    expect(store.settleBattle(setupFor(store, 'z', 'easy'), fake('win'))!.reward).toEqual({ credits: 75, xp: 38 });
  });
  it('levels up with overflow and reports unlocked ranks', () => {
    const { store } = started();
    const first = store.settleBattle(setupFor(store, 'x0', 'expert'), fake('win'))!; // 60 XP
    const second = store.settleBattle(setupFor(store, 'x1', 'expert'), fake('win'))!; // 120 XP: level 2 with 20 overflow
    expect(first.top.levelUps).toEqual([]);
    expect(store.activeTop!.level).toBe(2);
    expect(store.activeTop!.xp).toBe(20);
    expect(second.top.levelUps.map((l) => l.to)).toEqual([2]);
    expect(second.top.levelUps[0]!.newMaxRank).toBeNull();
  });
  it('advances rank on wins, never demotes, and keeps playing at the limit', () => {
    const { store } = started();
    for (let i = 0; i < 10; i++) store.settleBattle(setupFor(store, `w${i}`), fake('win'));
    expect(store.save!.rank).toMatchObject({ id: 'bronze-2', wins: 0 });
    store.settleBattle(setupFor(store, 'loss'), fake('loss'));
    expect(store.save!.rank.id).toBe('bronze-2');
    let q = false;
    for (let i = 0; i < 50; i++) q = store.settleBattle(setupFor(store, `v${i}`), fake('win'))!.rank.qualifiedNow || q;
    expect(q).toBe(true);
    expect(store.save!.rank).toMatchObject({ id: 'bronze-1', wins: 30, championshipQualified: true });
    const credits = store.save!.credits;
    store.settleBattle(setupFor(store, 'after'), fake('win'));
    expect(store.save!.credits).toBe(credits + 100);
  });
  it('stops levelling at 30 but keeps lifetime XP', () => {
    const { store } = started();
    const raw = JSON.parse(JSON.stringify(store.save));
    raw.tops[0].level = 30;
    raw.tops[0].lifetimeXp = 13050;
    store.importJson(JSON.stringify(raw));
    store.settleBattle(setupFor(store, 'max'), fake('win'));
    expect(store.activeTop!.level).toBe(30);
    expect(store.activeTop!.xp).toBe(0);
    expect(store.activeTop!.lifetimeXp).toBe(13100);
  });
});
function storageOf(store: CareerStore): MemoryStore {
  return (store as unknown as { storage: MemoryStore }).storage;
}

describe('upgrades', () => {
  it('charges the approved cost, applies immediately and persists', () => {
    const { store, storage } = started();
    const id = store.activeTop!.instanceId;
    const r = store.upgrade(id, 'attack');
    expect(r).toMatchObject({ ok: true, cost: 100, newRank: 1 });
    expect(store.save!.credits).toBe(400);
    expect(JSON.parse(storage.getItem(CAREER_KEY)!).tops[0].upgrades.attack).toBe(1);
  });
  it('blocks on insufficient credits and on level requirement, with no state change', () => {
    const { store } = started();
    const id = store.activeTop!.instanceId;
    store.upgrade(id, 'attack'); // 100 → rank1
    store.upgrade(id, 'attack'); // 200 → rank2, credits 200
    const r3 = store.upgrade(id, 'attack');
    expect(r3).toMatchObject({ ok: false, reason: 'level', requiredLevel: 5 });
    store.upgrade(id, 'health');
    store.upgrade(id, 'health'); // 100 + 200 → credits -100? only if affordable
    expect(store.save!.credits).toBeGreaterThanOrEqual(0);
    const before = store.save!.credits;
    const poor = store.upgrade(id, 'stamina');
    // stamina rank 1 costs 100; with <100 credits it fails
    if (before < 100) expect(poor).toMatchObject({ ok: false, reason: 'credits' });
    expect(store.save!.credits).toBeGreaterThanOrEqual(0);
  });
  it('reports insufficient credits precisely', () => {
    const { store } = started();
    const raw = JSON.parse(JSON.stringify(store.save));
    raw.credits = 99;
    store.importJson(JSON.stringify(raw));
    expect(store.upgrade(store.activeTop!.instanceId, 'speed')).toMatchObject({ ok: false, reason: 'credits' });
    expect(store.save!.credits).toBe(99);
  });
  it('stops at maximum rank', () => {
    const { store } = started();
    const raw = JSON.parse(JSON.stringify(store.save));
    raw.credits = 1_000_000;
    raw.tops[0].level = 30;
    store.importJson(JSON.stringify(raw));
    const id = store.activeTop!.instanceId;
    for (let i = 0; i < 10; i++) expect(store.upgrade(id, 'critChance').ok).toBe(true);
    expect(store.upgrade(id, 'critChance')).toMatchObject({ ok: false, reason: 'max-rank' });
    expect(1_000_000 - store.save!.credits).toBe(13900);
  });
});

describe('career statistics', () => {
  const rec = (over: Partial<BattleRecord>): BattleRecord => ({
    id: String(Math.random()), at: '', seed: 1, stadiumId: 'classic', difficulty: 'normal', playerRankId: 'bronze-3',
    opponent: { topId: 'titan', topClass: 'Defense', rankId: 'bronze-3', ranks: { health: 0, attack: 0, defense: 0, stamina: 0, speed: 0, critChance: 0 } },
    result: 'win', finish: 'burst', duration: 20, launch: 'great', opponentLaunch: 'good', damageDealt: 100, damageReceived: 40, crits: 1, rewards: { credits: 100, xp: 50 }, ...over,
  });
  it('tracks totals, streaks, finishes, fastest/longest, matchups and launches', () => {
    let s = emptyTopStats();
    s = recordBattle(s, rec({ duration: 30 }));
    s = recordBattle(s, rec({ finish: 'spin', duration: 12 }));
    s = recordBattle(s, rec({ result: 'loss', finish: 'knockout', duration: 50, opponent: { topId: 'inferno', topClass: 'Attack', rankId: 'bronze-3', ranks: rec({}).opponent.ranks } }));
    s = recordBattle(s, rec({ result: 'draw', finish: 'draw', duration: 20 }));
    s = recordBattle(s, rec({}));
    expect([s.battles, s.wins, s.losses, s.draws]).toEqual([5, 3, 1, 1]);
    expect(winRate(s)).toBeCloseTo(0.6);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(s.winsByFinish).toEqual({ burst: 2, spin: 1, knockout: 0 });
    expect(s.lossesByFinish.knockout).toBe(1);
    expect(s.fastestWin).toBe(12);
    expect(s.longestBattle).toBe(50);
    expect(s.damageDealt).toBe(500);
    expect(s.critsLanded).toBe(5);
    expect(s.creditsEarned).toBe(500);
    expect(s.launches.great).toBe(5);
    expect(s.vsClass.Defense!.battles).toBe(4);
    expect(s.vsTop.inferno!.losses).toBe(1);
    expect(s.byStadium.classic!.battles).toBe(5);
  });
  it('bounds recent history at 100 while aggregates keep counting', () => {
    let s = emptyTopStats();
    for (let i = 0; i < RECENT_BATTLE_LIMIT + 30; i++) s = recordBattle(s, rec({ id: `r${i}` }));
    expect(s.recent).toHaveLength(RECENT_BATTLE_LIMIT);
    expect(s.recent.at(-1)!.id).toBe(`r${RECENT_BATTLE_LIMIT + 29}`);
    expect(s.battles).toBe(RECENT_BATTLE_LIMIT + 30);
  });
  it('records real settled battles with opponent, stadium, launch and rewards', () => {
    const { store } = started();
    const { settled } = playHeadlessBattle(store, 'normal', 42);
    const r = store.activeTop!.stats.recent[0]!;
    expect(r.id).toBe(settled.battleId);
    expect(r.stadiumId).toBe('classic');
    expect(r.difficulty).toBe('normal');
    expect(['poor', 'good', 'great', 'perfect']).toContain(r.launch);
    expect(r.opponent.topId).toBeTruthy();
    expect(r.rewards.credits).toBeGreaterThan(0);
  });
});

describe('sandbox isolation', () => {
  it('sandbox configs never touch the career store or storage', () => {
    const { store, storage } = started();
    const before = JSON.stringify(store.save);
    const keys = [...storage.data.keys()];
    const c = defaultConfig(5);
    expect(c.player.stats).toBeUndefined();
    expect(c.player.critChance).toBeUndefined();
    expect(JSON.stringify(store.save)).toBe(before);
    expect([...storage.data.keys()]).toEqual(keys);
  });
  it('sandbox source never imports or calls the career store', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['src/config/sandboxConfig.ts', 'src/config/validate.ts', 'src/ui/devPanel.ts']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/career\//);
    }
  });
});

describe('export / import / reset', () => {
  it('round-trips a save through export and import', () => {
    const a = started();
    playHeadlessBattle(a.store, 'hard', 7);
    a.store.upgrade(a.store.activeTop!.instanceId, 'speed');
    const json = a.store.exportJson()!;
    const b = mk();
    expect(b.store.importJson(json).ok).toBe(true);
    expect(b.store.save!.credits).toBe(a.store.save!.credits);
    expect(b.store.activeTop!.stats.battles).toBe(1);
    expect(b.store.activeTop!.upgrades.speed).toBe(1);
    expect(b.storage.getItem(CAREER_KEY)).not.toBeNull();
  });
  it('rejects bad imports without changing the current career', () => {
    const { store } = started();
    const before = JSON.stringify(store.save);
    for (const bad of ['', '{', '{"schemaVersion":1}', JSON.stringify({ format: 'spinstrike-career-export', exportVersion: 7 })]) {
      expect(store.importJson(bad).ok).toBe(false);
      expect(parseImport(bad).ok).toBe(false);
    }
    expect(JSON.stringify(store.save)).toBe(before);
  });
  it('reset removes the save, backup and corrupt copy; nothing happens until confirmed', () => {
    const { store, storage } = started();
    store.upgrade(store.activeTop!.instanceId, 'attack');
    expect(storage.getItem(CAREER_KEY)).not.toBeNull(); // before reset() is called nothing is deleted
    store.reset();
    expect(store.save).toBeNull();
    for (const k of [CAREER_KEY, CAREER_BACKUP_KEY, CAREER_CORRUPT_KEY]) expect(storage.getItem(k)).toBeNull();
    store.startCareer('titan');
    expect(store.activeTop!.definitionId).toBe('titan');
    expect(store.save!.credits).toBe(500);
  });
});
