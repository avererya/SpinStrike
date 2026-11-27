import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { World } from '../src/sim/world';
import { buildBattleOptions, defaultConfig, legacyV040Config, resolveAims, type SandboxConfig } from '../src/config/sandboxConfig';
import { validateConfig } from '../src/config/validate';

function validateConfigRoundTrip(c: SandboxConfig): SandboxConfig | null {
  const r = validateConfig(JSON.parse(JSON.stringify(c)));
  return r.ok ? r.config : null;
}
import { effectiveStats } from '../src/career/progression';
import { getTop, LEGACY_V040_STATS, STARTER_TOPS } from '../src/content/tops';
import { deriveTopPhysics } from '../src/content/derive';
import { makeLaunch } from '../src/sim/launch';
import { zeroRanks, DIFFICULTY_REWARD_PERCENT } from '../src/career/config';
import { calculateReward } from '../src/career/progression';
import { AIM_LIMITS, DEFAULT_AIM, aiAim, clampAim, isAim, launchJitter, nominalPlacementAngle } from '../src/sim/launchGeometry';
import { aimPreview } from '../src/sim/aimPreview';
import { CareerStore, MemoryStore } from '../src/career/store';
import { loadSaveData } from '../src/career/save';
import { playHeadlessBattle } from '../src/career/headless';
import { buildCareerConfig, createBattleSetup } from '../src/career/battle';
import { COMBAT_RULESET } from '../src/sim/tactics';

const DIAG_SEED = 3782078522;

/** Rebuilds the reported v0.4.0 battle: Inferno vs Inferno, Perfect vs Great launches. */
function diagnosticBattle(cfgFn: (seed: number) => ReturnType<typeof defaultConfig>, ruleset: 'v0.3' | 'v0.4.1') {
  const def = getTop('inferno');
  const c = cfgFn(DIAG_SEED);
  const p = effectiveStats(def, { ...zeroRanks(), health: 1, attack: 1, stamina: 2 }, ruleset);
  const o = effectiveStats(def, { ...zeroRanks(), attack: 1, stamina: 1 }, ruleset);
  c.player = { topId: 'inferno', overrides: {}, stats: p.stats, critChance: p.critChance };
  c.opponent = { topId: 'inferno', overrides: {}, stats: o.stats, critChance: o.critChance };
  const L = [makeLaunch('perfect', c.launch.bonuses, 'player'), makeLaunch('great', c.launch.bonuses, 'ai')];
  const b = new Battle(buildBattleOptions(c, L));
  const r = b.runToEnd();
  return { r, t: b.world.telemetry.summary(r.steps) };
}

describe('v0.4.0 baseline path and diagnostic seed 3782078522', () => {
  it('legacyV040Config reproduces the reported v0.4.0 battle exactly (59.26 s, 157 / 193 damage, narrow spin win)', () => {
    const { r, t } = diagnosticBattle(legacyV040Config, 'v0.3');
    expect(r.time).toBeCloseTo(59.26, 2);
    expect(Math.round(r.tops[0]!.damageDealt)).toBe(157);
    expect(Math.round(r.tops[1]!.damageDealt)).toBe(193);
    expect(r.outcome).toMatchObject({ kind: 'win', winner: 0, finish: 'spin', narrow: true });
    expect(r.aims).toBeNull(); // the v0.4.0 launch model has no aim
    expect(t.damagingHits).toBe(4);
    expect(t.firstHit!).toBeGreaterThan(25);
  });
  it('under v0.4.1 the same seed no longer stalls: the tops meet within a second (here an opening knockout)', () => {
    const { r, t } = diagnosticBattle(defaultConfig, 'v0.4.1');
    expect(t.firstHit).not.toBeNull();
    expect(t.firstHit!).toBeLessThan(2);
    expect(r.outcome).toMatchObject({ kind: 'win', finish: 'knockout' });
    expect(r.time).toBeLessThan(2);
    expect(r.aims).not.toBeNull();
  });
});

describe('movement variability: deterministic, keyed, independent', () => {
  it('the same seed and aims give identical battles; different seeds diverge', () => {
    const run = (seed: number) => new Battle(buildBattleOptions(defaultConfig(seed))).runToEnd();
    const a = run(42);
    const b = run(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(run(43).time).not.toBe(a.time);
  });
  it('launch jitter of one component does not depend on the others or on the other slot', () => {
    const comps = [1, 2, 3, 4, 5, 6];
    const j = comps.map((k) => launchJitter(99, 0, k, 1));
    expect(comps.map((k) => launchJitter(99, 0, k, 1))).toEqual(j);
    expect(comps.map((k) => launchJitter(99, 1, k, 1))).not.toEqual(j);
    expect(new Set(j).size).toBe(j.length);
    for (const v of j) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    // Scaling one component's amount changes only that component.
    expect(launchJitter(99, 0, 3, 0.5)).toBeCloseTo(j[2]! * 0.5, 12);
    expect(launchJitter(99, 0, 3, 0)).toBe(0);
  });
  it('launch placements are not point-symmetric any more (each slot jittered independently around its nominal spot)', () => {
    let symmetric = 0;
    for (let s = 1; s <= 50; s++) {
      expect(nominalPlacementAngle(s, 1, 2) - nominalPlacementAngle(s, 0, 2)).toBeCloseTo(Math.PI, 9);
      const [a, b] = new World(buildBattleOptions(defaultConfig(s))).bodies;
      if (Math.hypot(a!.x + b!.x, a!.y + b!.y) < 0.002) symmetric++;
    }
    expect(symmetric).toBeLessThan(5);
  });
  it('the opponent AI aim comes from its own stream: changing the AI profile never changes the player aim or launch qualities', () => {
    const c = defaultConfig(7);
    const [p1, o1] = resolveAims(c);
    c.launch.aiAim = { direction: { min: 10, max: 10 }, tilt: { min: 20, max: 20 } };
    const [p2, o2] = resolveAims(c);
    expect(p2).toEqual(p1);
    expect(o2).toEqual({ direction: 10, tilt: 20 });
    expect(o1).not.toEqual(o2);
    expect(aiAim(7, 1)).toEqual(aiAim(7, 1));
  });
  it('natural variation off reproduces the v0.4.0 launch model (no aim recorded)', () => {
    const c = defaultConfig(5);
    c.movement.naturalVariation = false;
    expect(new Battle(buildBattleOptions(c)).runToEnd().aims).toBeNull();
  });
  it('no NaN and bounded energy over many varied battles', () => {
    for (let s = 1; s <= 12; s++) {
      const c = defaultConfig(s * 7919);
      c.player.topId = STARTER_TOPS[s % 4]!.id;
      c.opponent.topId = STARTER_TOPS[(s * 3) % 4]!.id;
      c.launch.playerAim = { direction: ((s * 17) % 91) - 45, tilt: (s * 7) % 31 };
      const b = new Battle(buildBattleOptions(c));
      const e0 = b.world.totalEnergy();
      while (b.step()) {
        /* run */
      }
      for (const body of b.world.bodies) {
        expect(Number.isFinite(body.x) && Number.isFinite(body.y) && Number.isFinite(body.omega)).toBe(true);
      }
      expect(b.world.totalEnergy()).toBeLessThanOrEqual(e0 * 1.0001);
    }
  });
});

describe('slot symmetry', () => {
  it('mirror matchups are not decided by slot (Phantom mirror, 120 seeds, within ±15 %)', () => {
    let w0 = 0;
    let w1 = 0;
    for (let s = 1; s <= 120; s++) {
      const c = defaultConfig(s);
      c.player.topId = 'phantom';
      c.opponent.topId = 'phantom';
      c.launch.minigame = false;
      c.launch.opponentAim = { ...DEFAULT_AIM };
      const o = new Battle(buildBattleOptions(c)).runToEnd().outcome;
      if (o.kind === 'win') o.winner === 0 ? w0++ : w1++;
    }
    expect(Math.abs(w0 - w1) / (w0 + w1)).toBeLessThan(0.15);
  });
});

describe('launch aim', () => {
  it('clamps and validates aims', () => {
    expect(clampAim({ direction: 99, tilt: -3 })).toEqual({ direction: AIM_LIMITS.direction.max, tilt: 0 });
    expect(clampAim(undefined)).toEqual(DEFAULT_AIM);
    expect(clampAim({ direction: Number.NaN, tilt: 4.5 })).toEqual({ direction: DEFAULT_AIM.direction, tilt: 4.5 });
    expect(isAim({ direction: 0, tilt: 0 })).toBe(true);
    expect(isAim({ direction: 'x', tilt: 0 })).toBe(false);
  });
  it('the preview is deterministic and shows only the nominal launch (no jitter, relief or wander)', () => {
    const c1 = defaultConfig(1);
    const o1 = buildBattleOptions(c1);
    const a = aimPreview(o1, { direction: 20, tilt: 10 });
    expect(aimPreview(o1, { direction: 20, tilt: 10 })).toEqual(a);
    // Changing the random-variation amounts never changes the preview.
    const c2 = defaultConfig(1);
    c2.movement.headingVariation = 0.5;
    c2.movement.floorRelief = 0.001;
    c2.movement.contactWanderScale = 3;
    expect(aimPreview(buildBattleOptions(c2), { direction: 20, tilt: 10 })).toEqual(a);
    expect(a.path.length).toBeGreaterThan(10);
    expect(aimPreview(o1, { direction: -20, tilt: 10 }).path).not.toEqual(a.path);
  });
  it('direction changes the opening path and tilt costs spin energy (no damage bonus)', () => {
    const spinAfter = (tilt: number) => {
      const c = defaultConfig(3);
      c.launch.playerAim = { direction: 0, tilt };
      c.movement.contactWanderScale = 0;
      const o = buildBattleOptions(c);
      // The player's top alone, so no collision can mask the tilt cost.
      const w = new World({ ...o, tops: [o.tops[0]!], topCombat: o.topCombat ? [o.topCombat[0]!] : undefined, aims: o.aims ? [o.aims[0]!] : undefined });
      for (let i = 0; i < 480; i++) w.step();
      return Math.abs(w.bodies[0]!.omega);
    };
    expect(spinAfter(10)).toBeLessThan(spinAfter(0));
    expect(spinAfter(30)).toBeLessThan(spinAfter(10));
    const c = defaultConfig(3);
    const base = buildBattleOptions(c).topCombat;
    c.launch.playerAim = { direction: 45, tilt: 30 };
    expect(buildBattleOptions(c).topCombat).toEqual(base);
  });
  it('the result records each top aim', () => {
    const c = defaultConfig(9);
    c.launch.playerAim = { direction: -12, tilt: 8 };
    c.launch.opponentAim = { direction: 30, tilt: 2 };
    expect(new Battle(buildBattleOptions(c)).runToEnd().aims).toEqual([{ direction: -12, tilt: 8 }, { direction: 30, tilt: 2 }]);
  });
});

describe('telemetry', () => {
  it('counts contacts and damaging hits consistently with the result', () => {
    const b = new Battle(buildBattleOptions(defaultConfig(11)));
    const r = b.runToEnd();
    const t = b.world.telemetry.summary(r.steps);
    // A damaging impact can hurt both tops (mutual hit): it counts once.
    const hits = r.tops[0]!.hitsLanded + r.tops[1]!.hitsLanded;
    expect(t.damagingHits).toBeLessThanOrEqual(hits);
    expect(t.damagingHits).toBeGreaterThanOrEqual(Math.max(r.tops[0]!.hitsLanded, r.tops[1]!.hitsLanded));
    expect(t.contacts).toBeLessThanOrEqual(r.tops[0]!.collisions);
    expect(t.contacts).toBeGreaterThan(0);
    expect(t.hitTimes).toHaveLength(t.damagingHits);
    expect(t.longestGap).toBeGreaterThan(0);
    expect(t.syncTime).toBeGreaterThanOrEqual(0);
  });
});

describe('v0.4.1 stats and stat → physics mapping', () => {
  it('restores class identities: Titan attack well below Inferno, Tempest has the highest stamina', () => {
    const s = (id: string) => getTop(id).stats;
    expect(s('titan').attack).toBeLessThanOrEqual(s('inferno').attack - 30);
    for (const id of ['inferno', 'titan', 'phantom']) expect(s('tempest').stamina).toBeGreaterThan(s(id).stamina + 15);
    expect(LEGACY_V040_STATS.titan!.attack).toBe(82);
  });
  it('stamina above 100 keeps helping with diminishing returns (no compounding extrapolation)', () => {
    const t = getTop('tempest');
    const decay = (st: number) => deriveTopPhysics(t, { stats: { ...t.stats, stamina: st } }).spinDecay;
    expect(decay(110)).toBeLessThan(decay(100));
    expect(decay(123.5)).toBeLessThan(decay(110));
    expect(decay(123.5)).toBeGreaterThan(0);
    expect(decay(100) - decay(123.5)).toBeLessThan(decay(50) - decay(73.5));
  });
  it('speed scales tip drive, traction and launch speed past 100', () => {
    const t = getTop('inferno');
    const p = (sp: number) => deriveTopPhysics(t, { ruleset: 'v0.4.1', stats: { ...t.stats, speed: sp } });
    expect(p(112.5).launchSpeed).toBeGreaterThan(p(100).launchSpeed);
    expect(p(112.5).tipDriveRadius).toBeGreaterThan(p(90).tipDriveRadius);
  });
  it('v0.5 ruleset: upgrade speed tightens the drive, keeps base traction, raises launch speed and boost authority; base tops unchanged', () => {
    for (const t of STARTER_TOPS) {
      const base = (r: 'v0.4.1' | 'v0.5') => deriveTopPhysics(t, { ruleset: r });
      expect(base('v0.5')).toEqual(base('v0.4.1'));
      const up = deriveTopPhysics(t, { stats: { ...t.stats, speed: t.stats.speed * 1.25 } });
      const b = base('v0.5');
      expect(up.tipDriveRadius).toBeLessThan(b.tipDriveRadius);
      expect(up.tipTraction).toBe(b.tipTraction);
      expect(up.launchSpeed).toBeGreaterThan(b.launchSpeed);
      expect(up.boostPower!).toBeGreaterThan(b.boostPower!);
    }
  });
  it('effective stats are recalculated from ranks for the active ruleset', () => {
    const d = getTop('titan');
    const r = { ...zeroRanks(), attack: 10 };
    expect(effectiveStats(d, r).stats.attack).toBeCloseTo(55 * 1.4, 6);
    expect(effectiveStats(d, r, 'v0.3').stats.attack).toBeCloseTo(82 * 1.4, 6);
  });
});

describe('temporary difficulty reward multipliers', () => {
  it('Easy 0.75, Normal 1.0, Hard 1.1, Expert 1.2 with one integer half-up rounding', () => {
    expect(DIFFICULTY_REWARD_PERCENT).toEqual({ easy: 75, normal: 100, hard: 110, expert: 120 });
    expect(calculateReward('bronze', 'expert', 'win')).toEqual({ credits: 120, xp: 60 });
    expect(calculateReward('bronze', 'easy', 'win')).toEqual({ credits: 75, xp: 38 });
    expect(calculateReward('bronze', 'hard', 'draw')).toEqual({ credits: 17, xp: 14 }); // 16.5 → 17, 13.75 → 14
  });
});

describe('v0.4.0 save compatibility', () => {
  let n = 0;
  const ids = (p: string) => `${p}_${++n}`;
  function v040Save(): string {
    // A v0.4.0 store: same schema, no aim, records without ruleset / aims.
    const storage = new MemoryStore();
    const store = new CareerStore(storage, { version: '0.4.0', ids, now: () => '2026-01-01T00:00:00.000Z' });
    store.startCareer('titan');
    playHeadlessBattle(store, 'normal', 1234);
    const raw = JSON.parse(store.exportJson()!);
    const save = raw.save ?? raw;
    for (const t of save.tops) {
      delete t.launchAim;
      for (const rec of t.stats.recent) {
        delete rec.ruleset;
        delete rec.aim;
        delete rec.opponentAim;
      }
      t.upgrades.attack = 3;
    }
    return JSON.stringify(save);
  }
  it('loads unchanged: ranks kept, stats recalculated from ranks, old records not back-filled', () => {
    const raw = JSON.parse(v040Save());
    const r = loadSaveData(raw);
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (!r.ok) return;
    const top = r.save.tops[0]!;
    expect(top.upgrades.attack).toBe(3);
    expect(top.launchAim).toBeUndefined();
    const rec = top.stats.recent[0]!;
    expect(rec.ruleset).toBeUndefined();
    expect(rec.aim).toBeUndefined();
    expect(effectiveStats(getTop('titan'), top.upgrades).stats.attack).toBeCloseTo(55 * 1.12, 6);
  });
  it('new records carry the ruleset and both aims, and the last aim is remembered per top', () => {
    const storage = new MemoryStore();
    const store = new CareerStore(storage, { version: '0.4.1', ids, now: () => '2026-01-01T00:00:00.000Z' });
    store.startCareer('tempest');
    const id = store.activeTop!.instanceId;
    expect(store.setLaunchAim(id, { direction: 18, tilt: 6 })).toBe(true);
    const setup = createBattleSetup({ battleId: 'b1', seed: 5, opponentSeed: 6, difficulty: 'normal', playerRankId: 'bronze-3', playerInstanceId: id, playerTopId: 'tempest' });
    expect(buildCareerConfig(setup, store.activeTop!).launch.playerAim).toEqual({ direction: 18, tilt: 6 });
    const { settled } = playHeadlessBattle(store, 'normal', 99);
    expect(settled.duplicate ?? false).toBe(false);
    const rec = store.activeTop!.stats.recent.at(-1)!;
    expect(rec.ruleset).toBe(COMBAT_RULESET); // v0.5: battles with abilities record the v0.5.0 ruleset
    expect(rec.aim).toEqual({ direction: 18, tilt: 6 });
    expect(isAim(rec.opponentAim)).toBe(true);
    // Persisted and reloaded.
    const again = new CareerStore(storage, { version: '0.4.1', ids });
    again.load();
    expect(again.activeTop!.launchAim).toEqual({ direction: 18, tilt: 6 });
  });
  it('invalid aims and rulesets in imported data are dropped, never invented', () => {
    const raw = JSON.parse(v040Save());
    raw.tops[0].launchAim = { direction: 'left', tilt: 3 };
    raw.tops[0].stats.recent[0].ruleset = 42;
    const r = loadSaveData(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.tops[0]!.launchAim).toBeUndefined();
    expect(r.save.tops[0]!.stats.recent[0]!.ruleset).toBeUndefined();
  });
});

describe('config round trip', () => {
  it('a v0.4.1 config with movement and aims survives export/import', () => {
    const c = defaultConfig(3);
    c.launch.playerAim = { direction: -30, tilt: 22 };
    c.launch.opponentAim = { direction: 5, tilt: 1 };
    c.movement.contactWanderScale = 2;
    expect(validateConfigRoundTrip(c)).toEqual(c);
  });
});
