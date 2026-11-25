import { describe, expect, it } from 'vitest';
import { defaultConfig, resolveTopParams } from '../src/config/sandboxConfig';
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
