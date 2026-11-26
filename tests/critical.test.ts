import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { critRoll, isCritical, type DamageEvent } from '../src/sim/combat';
import { FixedStepRunner, SIM_SPEEDS } from '../src/sim/runner';

/** Inferno vs Phantom with effectively unbreakable tops, so every hit is observed and no burst ends the battle. */
function cfg(seed: number, pc: number, oc: number, mult = 2) {
  const c = defaultConfig(seed);
  c.player.topId = 'inferno';
  c.opponent.topId = 'phantom';
  c.launch.minigame = false;
  c.launch.playerQuality = 'good';
  c.launch.opponentQuality = 'good';
  c.player.overrides = { critChance: pc, critMultiplier: mult, maxHealth: 5000 };
  c.opponent.overrides = { critChance: oc, critMultiplier: mult, maxHealth: 5000 };
  c.combat.knockouts = false;
  return c;
}

function runAll(c: ReturnType<typeof cfg>) {
  const bt = new Battle(buildBattleOptions(c));
  const events: DamageEvent[] = [];
  const states: number[][] = [];
  while (bt.step()) {
    events.push(...bt.world.drainDamage());
    if (bt.world.steps % 60 === 0) states.push(bt.world.bodies.flatMap((b) => [b.x, b.y, b.vx, b.vy, b.omega, b.tilt]));
  }
  events.push(...bt.world.drainDamage());
  return { bt, events, states, result: bt.result! };
}

describe('critical hits', () => {
  it('0 % chance never crits and matches critical hits disabled exactly', () => {
    const a = runAll(cfg(3, 0, 0));
    const c = cfg(3, 0.5, 0.5);
    c.combat.criticalHits = false;
    const b = runAll(c);
    expect(a.events.some((e) => e.critToA || e.critToB)).toBe(false);
    expect(b.events.some((e) => e.critToA || e.critToB)).toBe(false);
    expect(a.result.tops.map((t) => t.health)).toEqual(b.result.tops.map((t) => t.health));
  });

  it('100 % chance makes every damaging hit critical with exactly 2× structural damage', () => {
    const base = runAll(cfg(4, 0, 0));
    const crit = runAll(cfg(4, 1, 1));
    expect(crit.events.length).toBe(base.events.length);
    expect(crit.events.length).toBeGreaterThan(3);
    crit.events.forEach((e, i) => {
      const n = base.events[i]!;
      expect(e.step).toBe(n.step);
      if (n.damageToB > 0) {
        expect(e.critToB).toBe(true);
        expect(e.damageToB).toBeCloseTo(2 * n.damageToB, 9);
      }
      if (n.damageToA > 0) {
        expect(e.critToA).toBe(true);
        expect(e.damageToA).toBeCloseTo(2 * n.damageToA, 9);
      }
    });
  });

  it('adds no impulse, knockback, energy or stamina drain: trajectories are identical with and without crits', () => {
    const base = runAll(cfg(5, 0, 0));
    const crit = runAll(cfg(5, 1, 1, 10));
    expect(crit.states).toEqual(base.states);
    expect(crit.result.steps).toBe(base.result.steps);
    expect(crit.result.tops.map((t) => t.stamina)).toEqual(base.result.tops.map((t) => t.stamina));
    // Only structural damage differs.
    expect(crit.result.tops[1]!.damageReceived).toBeGreaterThan(base.result.tops[1]!.damageReceived * 5);
  });

  it('each top rolls independently in the same collision', () => {
    let mixed = 0;
    let both = 0;
    for (let s = 1; s <= 10; s++) {
      for (const e of runAll(cfg(s, 0.5, 0.5)).events) {
        if (e.damageToA > 0 && e.damageToB > 0) {
          if (e.critToA !== e.critToB) mixed++;
          else if (e.critToA) both++;
        }
      }
    }
    expect(mixed).toBeGreaterThan(5);
    expect(both).toBeGreaterThan(0);
  });

  it('rolls once per damaging impact, never per physics update of a sustained contact', () => {
    const r = runAll(cfg(6, 1, 1));
    const b = r.bt.world.bodies;
    // One roll opportunity per damaging hit: crits landed equal damaging hits at 100 %.
    expect(b[0]!.critsLanded).toBe(b[0]!.damagingHits);
    expect(b[1]!.critsLanded).toBe(b[1]!.damagingHits);
    expect(r.bt.world.impactCount).toBe(r.events.length);
    // Rolls are keyed by impact index: the same impact always gives the same roll.
    expect(critRoll(6, 3, 0)).toBe(critRoll(6, 3, 0));
    expect(critRoll(6, 3, 0)).not.toBe(critRoll(6, 4, 0));
    expect(critRoll(6, 3, 0)).not.toBe(critRoll(6, 3, 1));
  });

  it('is reproducible from the seed and independent of simulation speed', () => {
    const a = runAll(cfg(7, 0.3, 0.3)).result;
    const b = runAll(cfg(7, 0.3, 0.3)).result;
    expect(a).toEqual(b);
    const viaRunner = SIM_SPEEDS.map((speed) => {
      const bt = new Battle(buildBattleOptions(cfg(7, 0.3, 0.3)));
      const run = new FixedStepRunner(bt);
      run.speed = speed;
      run.runAftermath = false;
      const frames = [1 / 60, 1 / 144, 1 / 30, 0.05];
      let i = 0;
      while (bt.phase !== 'finished') run.advance(frames[i++ % frames.length]!);
      return bt.result;
    });
    for (const r of viaRunner) expect(r).toEqual(a);
  });

  it('crit probabilities follow the configured chance', () => {
    let crit = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (isCritical(0.05, critRoll(99, i, i & 1))) crit++;
    expect(Math.abs(crit / n - 0.05)).toBeLessThan(0.006);
    expect(isCritical(0, 0)).toBe(false);
    expect(isCritical(1, 0.999999)).toBe(true);
    expect(isCritical(Number.NaN, 0)).toBe(false);
  });

  it('a critical hit can cause a burst finish, and statistics record it', () => {
    // Find a hit that would not burst normally but does when doubled.
    const probe = runAll(cfg(8, 0, 0));
    const first = probe.events.find((e) => e.damageToB > 2)!;
    const c = cfg(8, 1, 0);
    c.opponent.overrides.maxHealth = Math.max(1, Math.floor(first.damageToB * 1.5));
    const r = runAll(c).result;
    expect(r.outcome).toMatchObject({ kind: 'win', winner: 0, finish: 'burst' });
    const t = r.tops[0]!;
    expect(t.critsLanded).toBeGreaterThanOrEqual(1);
    expect(r.tops[1]!.critsReceived).toBe(t.critsLanded);
    expect(t.critDamageDealt).toBeGreaterThan(0);
    expect(t.critDamageDealt).toBeLessThanOrEqual(t.damageDealt + 1e-9);
    expect(t.strongestHitCritical).toBe(true);
    expect(r.strongestHit).toMatchObject({ by: 0, critical: true });
  });

  it('crit statistics are consistent over a normal battle', () => {
    const r = runAll(cfg(9, 0.25, 0.25));
    const [a, b] = r.result.tops;
    const critsToB = r.events.filter((e) => e.critToB).length;
    const critsToA = r.events.filter((e) => e.critToA).length;
    expect(a!.critsLanded).toBe(critsToB);
    expect(b!.critsLanded).toBe(critsToA);
    expect(a!.critsReceived).toBe(critsToA);
    const critDmgToB = r.events.filter((e) => e.critToB).reduce((s, e) => s + e.damageToB, 0);
    expect(a!.critDamageDealt).toBeCloseTo(critDmgToB, 6);
  });
});
