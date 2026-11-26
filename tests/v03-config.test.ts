import { describe, expect, it } from 'vitest';
import { buildBattleOptions, defaultConfig, legacyV02Config } from '../src/config/sandboxConfig';
import { validateConfig } from '../src/config/validate';
import { runBatch } from '../src/sim/headless';
import { renormalise } from '../src/ui/devPanel';
import { LAUNCH_QUALITIES } from '../src/sim/launch';

describe('v0.3 configuration', () => {
  it('migrates a v0.2 (version 2) file to the legacy ruleset, keeping all values, new mechanics off', () => {
    const v2 = JSON.parse(JSON.stringify(legacyV02Config(77))) as Record<string, any>;
    v2.version = 2;
    delete v2.ruleset;
    delete v2.launch;
    delete v2.results;
    delete v2.combat.criticalHits;
    delete v2.presentation.criticalEffects;
    v2.combat.damageScale = 42;
    v2.player.overrides = { attack: 120 };
    const r = validateConfig(v2);
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (!r.ok) return;
    expect(r.config.version).toBe(3);
    expect(r.config.ruleset).toBe('v0.2');
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
