import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, buildBattleOptions, defaultConfig, legacyV02Config } from '../src/config/sandboxConfig';
import { validateConfig } from '../src/config/validate';
import { runBatch } from '../src/sim/headless';
import { renormalise } from '../src/ui/devPanel';
import { LAUNCH_QUALITIES } from '../src/sim/launch';
import { DEFAULT_COMBAT, strikeEnergy } from '../src/sim/combat';
import { deriveTopPhysics } from '../src/content/derive';
import { LEGACY_V040_STATS, getTop } from '../src/content/tops';

describe('v0.3 configuration', () => {
  it('migrates a v0.2 (version 2) file to the legacy ruleset, keeping all values, new mechanics off', () => {
    const v2 = JSON.parse(JSON.stringify(legacyV02Config(77))) as Record<string, any>;
    v2.version = 2;
    delete v2.ruleset;
    delete v2.launch;
    delete v2.movement;
    delete v2.tactical;
    delete v2.results;
    delete v2.combat.criticalHits;
    delete v2.presentation.criticalEffects;
    v2.combat.damageScale = 42;
    v2.player.overrides = { attack: 120 };
    const r = validateConfig(v2);
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (!r.ok) return;
    expect(r.config.version).toBe(CONFIG_VERSION);
    expect(r.config.ruleset).toBe('v0.2');
    expect(r.config.movement.naturalVariation).toBe(false);
    expect(r.config.combat.damageScale).toBe(42);
    expect(r.config.combat.criticalHits).toBe(false);
    expect(r.config.results.drawWindow).toBe(0);
    expect(r.config.launch).toMatchObject({ playerQuality: 'poor', opponentQuality: 'poor', minigame: false });
    expect(r.config.player.overrides).toEqual({ attack: 120 });
    expect(r.notes.join('\n')).toMatch(/v0\.2 \(version 2\)/);
    // v0.3 sections are not allowed in an old-version file.
    expect(validateConfig({ ...v2, launch: {} }).ok).toBe(false);
  });

  it('validates launch zones, bonuses, distribution, qualities and result rules', () => {
    const bad = JSON.parse(JSON.stringify(defaultConfig(1))) as Record<string, any>;
    bad.launch.zones = { perfect: 0.3, great: 0.2, good: 0.35 };
    bad.launch.aiDistribution = { poor: 0.5, good: 0.5, great: 0.5, perfect: 0 };
    bad.launch.playerQuality = 'excellent';
    bad.launch.bonuses.perfect = Number.NaN;
    bad.results.drawWindow = -1;
    bad.ruleset = 'v9';
    bad.player.overrides = { critChance: 2 };
    const r = validateConfig(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join('\n');
    for (const m of [/perfect < great < good/, /sum to 1/, /launch\.playerQuality/, /bonuses\.perfect/, /results\.drawWindow/, /ruleset/, /overrides\.critChance/]) expect(all).toMatch(m);
  });

  it('requires the v0.3 groups in a version 3 file', () => {
    for (const k of ['launch', 'results', 'ruleset']) {
      const c = JSON.parse(JSON.stringify(defaultConfig(1))) as Record<string, any>;
      delete c[k];
      expect(validateConfig(c).ok, k).toBe(false);
    }
  });

  it('the developer-panel distribution editor keeps probabilities summing to 1', () => {
    const d = { poor: 0.15, good: 0.4, great: 0.35, perfect: 0.1 };
    renormalise(d, 'perfect', 0.4);
    expect(d.perfect).toBeCloseTo(0.4, 4);
    expect(LAUNCH_QUALITIES.reduce((a, q) => a + d[q], 0)).toBeCloseTo(1, 9);
    expect(d.good / d.great).toBeCloseTo(0.4 / 0.35, 2);
    renormalise(d, 'poor', 1);
    expect(d).toEqual({ poor: 1, good: 0, great: 0, perfect: 0 });
    renormalise(d, 'poor', 0.5);
    expect(d.good).toBeCloseTo(1 / 6, 3);
    const v = validateConfig({ ...JSON.parse(JSON.stringify(defaultConfig(1))), launch: { ...defaultConfig(1).launch, aiDistribution: d } });
    expect(v.ok).toBe(true);
  });
});

describe('extreme and extended v0.3 simulations', () => {
  it('extreme crit, launch and window settings stay finite with no guard trips', () => {
    const s = runBatch(
      (seed) => {
        const c = defaultConfig(seed);
        c.player.topId = seed % 2 ? 'inferno' : 'tempest';
        c.opponent.topId = seed % 3 ? 'titan' : 'phantom';
        c.launch.minigame = false;
        c.launch.bonuses = { poor: 0.5, good: 1, great: 1.5, perfect: 2 };
        c.launch.aiDistribution = { poor: 0.25, good: 0.25, great: 0.25, perfect: 0.25 };
        c.player.overrides = { critChance: 1, critMultiplier: 10 };
        c.opponent.overrides = { critChance: 1, critMultiplier: 10 };
        c.results.drawWindow = 2;
        c.results.narrowThreshold = 0.2;
        return buildBattleOptions(c);
      },
      40,
      1,
    );
    expect(s.failures, s.failureDetails.join('\n')).toBe(0);
  });

  it('300 default v0.3 battles across all matchups complete without failures or timeouts', () => {
    const ids = ['inferno', 'titan', 'tempest', 'phantom'];
    const s = runBatch(
      (seed) => {
        const c = defaultConfig(seed);
        c.player.topId = ids[seed % 4]!;
        c.opponent.topId = ids[Math.floor(seed / 4) % 4]!;
        c.launch.minigame = false;
        return buildBattleOptions(c);
      },
      300,
      90001,
    );
    expect(s.failures, s.failureDetails.join('\n')).toBe(0);
    expect(s.timeouts).toBe(0);
    for (const r of s.results) {
      for (const t of r.tops) {
        expect(t.stamina).toBeGreaterThanOrEqual(0);
        expect(t.stamina).toBeLessThanOrEqual(1);
        expect(t.health).toBeGreaterThanOrEqual(0);
        expect(t.critDamageDealt).toBeLessThanOrEqual(t.damageDealt + 1e-9);
      }
      if (r.outcome.kind === 'win') {
        // The loser is out; the winner was in play at the decisive moment.
        expect(r.tops[r.outcome.winner]!.spinning).toBe(true);
      }
    }
  });
});

describe('v0.3 stat mapping and blade exposure', () => {
  it('blade exposure scales only the blade term of the strike energy, is clamped, and defaults to 1', () => {
    const p = { ...DEFAULT_COMBAT, impactScale: 0 };
    const full = strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, p);
    expect(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, p, 0.37)).toBeCloseTo(full * 0.37, 12);
    expect(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, p, 5)).toBeCloseTo(full, 12);
    expect(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, p, -1)).toBe(0);
    expect(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, p, Number.NaN)).toBeCloseTo(full, 12);
    // The translational term is unaffected.
    const q = { ...DEFAULT_COMBAT, rotationalContribution: 0 };
    expect(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, q, 0.37)).toBe(strikeEnergy(0.5, 0.02, 0.0176, 600, 0.025, q));
  });

  it('defense no longer feeds stability or impact spin resistance; stamina and tips do', () => {
    const tempest = getTop('tempest');
    // v0.3 / v0.4.0 mapping (v0.4.1 keeps the same defense rule; its Zephyr Halo values are tested in v041.test.ts).
    const base = deriveTopPhysics(tempest, { ruleset: 'v0.3' });
    const def = deriveTopPhysics(tempest, { ruleset: 'v0.3', stats: { ...LEGACY_V040_STATS.tempest!, defense: 100 } });
    const cur = deriveTopPhysics(tempest);
    expect(deriveTopPhysics(tempest, { stats: { ...tempest.stats, defense: 100 } }).stability).toBe(cur.stability);
    expect(def.stability).toBe(base.stability);
    expect(def.impactSpinResist).toBe(base.impactSpinResist);
    expect(def.restitution).toBeLessThan(base.restitution);
    const sta = deriveTopPhysics(tempest, { ruleset: 'v0.3', stats: { ...LEGACY_V040_STATS.tempest!, stamina: 100 } });
    expect(sta.impactSpinResist).toBeGreaterThan(base.impactSpinResist);
    expect(base.bladeExposure).toBe(0.37);
    expect(deriveTopPhysics(getTop('inferno')).bladeExposure).toBe(1);
    // The legacy ruleset keeps the v0.2 mapping (defense → stability).
    const v2 = deriveTopPhysics(tempest, { ruleset: 'v0.2' });
    const v2def = deriveTopPhysics(tempest, { ruleset: 'v0.2', stats: { ...tempest.stats, defense: 100 } });
    expect(v2def.stability).toBeGreaterThan(v2.stability);
    expect(v2.bladeExposure).toBeUndefined();
  });
});
