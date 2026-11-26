import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, buildBattleOptions, defaultConfig, legacyV02Config, resolveTopParams } from '../src/config/sandboxConfig';
import { parseConfigJson, validateConfig } from '../src/config/validate';
import { deriveTopPhysics } from '../src/content/derive';
import { STARTER_TOPS } from '../src/content/tops';

describe('configuration validation', () => {
  it('accepts the default configuration and round-trips through JSON', () => {
    const c = defaultConfig(123);
    c.player.overrides.mass = 0.05;
    const r = parseConfigJson(JSON.stringify(c));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(c);
  });

  it('rejects malformed JSON', () => {
    const r = parseConfigJson('{ not json');
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range, non-numeric and unknown values with readable errors', () => {
    const c = defaultConfig(1) as unknown as Record<string, any>;
    c.stadium.slope = 5;
    c.collision.restitution = 'high';
    c.player.topId = 'dragon';
    c.opponent.overrides = { mass: -1, warpDrive: 3 };
    c.seed = 1.5;
    const r = validateConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.errors.join('\n');
      expect(all).toMatch(/stadium\.slope/);
      expect(all).toMatch(/collision\.restitution/);
      expect(all).toMatch(/player\.topId/);
      expect(all).toMatch(/opponent\.overrides\.mass/);
      expect(all).toMatch(/warpDrive/);
      expect(all).toMatch(/seed/);
    }
  });

  it('rejects NaN/Infinity smuggled in as numbers', () => {
    const c = defaultConfig(1);
    c.stadium.surfaceFriction = Infinity;
    expect(validateConfig(c).ok).toBe(false);
  });

  it('overrides change only the named physical parameters', () => {
    const c = defaultConfig(1);
    c.player.overrides = { mass: 0.07 };
    const p = resolveTopParams(c.player);
    const base = deriveTopPhysics(STARTER_TOPS.find((t) => t.id === c.player.topId)!);
    expect(p.mass).toBe(0.07);
    expect(p.tipTraction).toBe(base.tipTraction);
  });
});

describe('top definitions', () => {
  it('provides four starter tops with distinct classes and physical identities', () => {
    expect(STARTER_TOPS.map((t) => t.topClass).sort()).toEqual(['Attack', 'Balance', 'Defense', 'Stamina']);
    const p = Object.fromEntries(STARTER_TOPS.map((t) => [t.id, deriveTopPhysics(t)]));
    expect(p.titan!.mass).toBeGreaterThan(p.inferno!.mass);
    expect(p.titan!.stability).toBeGreaterThan(p.inferno!.stability);
    expect(p.inferno!.launchSpeed).toBeGreaterThan(p.titan!.launchSpeed);
    expect(p.inferno!.tipTraction).toBeGreaterThan(p.tempest!.tipTraction);
    expect(p.tempest!.spinDecay).toBeLessThan(p.inferno!.spinDecay);
  });
});

describe('v0.2/v0.3 configuration', () => {
  it('every default value is inside its own validation range', () => {
    const r = validateConfig(JSON.parse(JSON.stringify(defaultConfig(9))));
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (r.ok) expect(r.notes).toEqual([]);
  });

  it('imports a v0.1 (version 1) configuration, keeping every v0.1 value and defaulting new parameters', () => {
    const v1 = {
      version: 1,
      seed: 4242,
      maxDuration: 120,
      stadium: { slope: 0.035, surfaceFriction: 1.1, wallRestitution: 0.45 },
      collision: { restitution: 0.55, energyLoss: 0.7 },
      player: { topId: 'tempest', overrides: { mass: 0.05, spinDecay: 0.9 } },
      opponent: { topId: 'inferno', overrides: {} },
    };
    const r = validateConfig(v1);
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (!r.ok) return;
    // v0.3: v0.1/v0.2 files migrate to the legacy v0.2 ruleset with the new mechanics off.
    const d = legacyV02Config(0);
    expect(r.config.version).toBe(CONFIG_VERSION);
    expect(r.config.ruleset).toBe('v0.2');
    expect(r.config.combat.criticalHits).toBe(false);
    expect(r.config.results.drawWindow).toBe(0);
    expect(r.config.launch.playerQuality).toBe('poor');
    expect(r.config.seed).toBe(4242);
    expect(r.config.maxDuration).toBe(120);
    expect(r.config.stadium).toEqual({ slope: 0.035, surfaceFriction: 1.1, wallRestitution: 0.45, rimLipHeight: d.stadium.rimLipHeight });
    expect(r.config.collision).toEqual({ restitution: 0.55, energyLoss: 0.7, statSpinDrainWeight: d.collision.statSpinDrainWeight });
    expect(r.config.combat).toEqual(d.combat);
    expect(r.config.presentation).toEqual(d.presentation);
    expect(r.config.player).toEqual({ topId: 'tempest', overrides: { mass: 0.05, spinDecay: 0.9 } });
    expect(r.notes.join('\n')).toMatch(/v0\.1/);
    // And it round-trips as a v3 file afterwards.
    const again = validateConfig(JSON.parse(JSON.stringify(r.config)));
    expect(again.ok).toBe(true);
  });

  it('still rejects invalid values in a v0.1 file instead of silently fixing them', () => {
    const r = validateConfig({ version: 1, seed: 1, maxDuration: 120, stadium: { slope: 9, surfaceFriction: 1, wallRestitution: 0.5 }, collision: { restitution: 0.6, energyLoss: 0.6 }, player: { topId: 'tempest', overrides: {} }, opponent: { topId: 'titan', overrides: {} } });
    expect(r.ok).toBe(false);
  });

  it('requires the v0.2 groups in a version 2 file and validates combat values and per-top combat overrides', () => {
    const c = defaultConfig(1) as unknown as Record<string, any>;
    delete c.combat;
    expect(validateConfig(c).ok).toBe(false);
    const d = defaultConfig(1) as unknown as Record<string, any>;
    d.combat.damageScale = -5;
    d.combat.knockouts = 'yes';
    d.player.overrides = { attack: 120, defense: 999, maxHealth: 0 };
    d.presentation.damageNumbers = 1;
    const r = validateConfig(d);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.errors.join('\n');
      expect(all).toMatch(/combat\.damageScale/);
      expect(all).toMatch(/combat\.knockouts/);
      expect(all).toMatch(/overrides\.defense/);
      expect(all).toMatch(/overrides\.maxHealth/);
      expect(all).toMatch(/presentation\.damageNumbers/);
      expect(all).not.toMatch(/overrides\.attack/);
    }
  });

  it('rejects unknown versions', () => {
    const c = defaultConfig(1) as unknown as Record<string, any>;
    c.version = 6;
    expect(validateConfig(c).ok).toBe(false);
    c.version = 0;
    expect(validateConfig(c).ok).toBe(false);
  });

  it('per-top combat overrides change only combat values, not the derived physics', () => {
    const c = defaultConfig(1);
    c.player.overrides = { attack: 150, maxHealth: 1234 };
    const p = resolveTopParams(c.player);
    const base = deriveTopPhysics(STARTER_TOPS.find((t) => t.id === c.player.topId)!);
    expect(p).toEqual(base);
    const opts = buildBattleOptions(c);
    expect(opts.topCombat![0]).toMatchObject({ attack: 150, maxHealth: 1234 });
  });
});
