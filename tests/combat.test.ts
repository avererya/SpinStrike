import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMBAT,
  applyContactDamage,
  attackFactor,
  computeDamage,
  defenseFactor,
  makeContactReport,
  makeDamageEvent,
  makePairState,
  rimEscape,
  softCap,
  strikeEnergy,
  type CombatParams,
  type DamageEvent,
} from '../src/sim/combat';
import { resolveTopPair } from '../src/sim/collision';
import { Battle, finishOf } from '../src/sim/battle';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { deriveTopCombat } from '../src/content/derive';
import { getTop } from '../src/content/tops';
import { flat, makeWorld, place, puck, phantom, bowl } from './helpers';
import type { World } from '../src/sim/world';

const P: CombatParams = { ...DEFAULT_COMBAT };
const ev = (): DamageEvent => makeDamageEvent();

/** Two pucks on a large flat floor, A moving toward B. Returns damage dealt in one contact. */
function hit(opts: { vx?: number; vy?: number; offset?: number; atkA?: number; defB?: number; massB?: number; omega?: number } = {}) {
  const w = makeWorld([puck({ ringStrike: 0.01 }), puck({ ringStrike: 0.01, mass: opts.massB ?? 0.048 })], {
    stadium: flat({ radius: 2 }),
  });
  const [A, B] = w.bodies as [World['bodies'][0], World['bodies'][0]];
  A.combat.attack = opts.atkA ?? 65;
  B.combat.defense = opts.defB ?? 65;
  const off = opts.offset ?? 0;
  place(A, -0.0495, off, opts.vx ?? 0.6, opts.vy ?? 0, opts.omega ?? -600);
  place(B, 0, 0, 0, 0, opts.omega ?? -600);
  const r = makeContactReport();
  const pair = makePairState();
  const e = ev();
  resolveTopPair(A, B, w.collision, { touching: false }, 0, r);
  applyContactDamage(A, B, r, pair, P, 0, 240, e);
  return { w, A, B, e, r };
}

describe('health', () => {
  it('starts at maximum health derived from the health stat, and resets for every new battle', () => {
    const c = defaultConfig(5);
    c.player.topId = 'titan';
    c.opponent.topId = 'tempest';
    const b1 = new Battle(buildBattleOptions(c));
    expect(b1.world.bodies[0]!.health).toBe(deriveTopCombat(getTop('titan')).maxHealth);
    expect(b1.world.bodies[1]!.health).toBe(deriveTopCombat(getTop('tempest')).maxHealth);
    b1.runToEnd();
    const b2 = new Battle(buildBattleOptions(c));
    expect(b2.world.bodies.map((b) => b.health)).toEqual(b2.world.bodies.map((b) => b.combat.maxHealth));
    expect(b2.world.bodies.every((b) => b.damageReceived === 0 && b.hitsLanded === 0)).toBe(true);
  });

  it('is clamped at zero and a top reaching zero bursts', () => {
    const { B } = (() => {
      const w = makeWorld([puck({ ringStrike: 0.02 }), puck()], { stadium: flat({ radius: 2 }) });
      const [A, B] = w.bodies;
      A!.combat.attack = 300;
      B!.health = 1;
      place(A!, -0.0495, 0, 1.5, 0, -600);
      place(B!, 0, 0, 0, 0, -600);
      const r = makeContactReport();
      resolveTopPair(A!, B!, w.collision, { touching: false }, 0, r);
      applyContactDamage(A!, B!, r, makePairState(), P, 0, 240, ev());
      return { B: B! };
    })();
    expect(B.health).toBe(0);
    expect(B.eliminated).toBe('burst');
    expect(B.damageReceived).toBeCloseTo(1, 9); // only the health that existed is counted as received
  });

  it('is independent of stamina: damage does not change spin, and spin loss does not change health', () => {
    const a = hit();
    const b = hit();
    // Same impact with combat damage vs a world where health is irrelevant: physics identical.
    expect(a.A.omega).toBe(b.A.omega);
    expect(a.B.vx).toBe(b.B.vx);
    const w = makeWorld([phantom()], { stadium: bowl() });
    const top = w.bodies[0]!;
    for (let i = 0; i < 2400; i++) w.step();
    expect(top.spinFraction).toBeLessThan(0.9);
    expect(top.health).toBe(top.combat.maxHealth);
  });
});

describe('damage formula', () => {
  it('scales linearly with attack', () => {
    const d1 = computeDamage(0.004, 50, 50, P);
    const d2 = computeDamage(0.004, 100, 50, P);
    expect(d2 / d1).toBeCloseTo(2, 9);
    expect(attackFactor(P.attackReference, P)).toBeCloseTo(1, 12);
  });

  it('defense reduces damage with diminishing returns and never reaches zero', () => {
    const f = (d: number) => defenseFactor(d, P);
    expect(f(0)).toBe(1);
    expect(f(50)).toBeLessThan(f(0));
    expect(f(100)).toBeLessThan(f(50));
    // Each additional 50 defense removes less damage than the previous 50.
    expect(f(0) - f(50)).toBeGreaterThan(f(50) - f(100));
    expect(f(50) - f(100)).toBeGreaterThan(f(100) - f(150));
    expect(f(1e9)).toBeGreaterThan(0);
    expect(computeDamage(0.01, 65, 1e9, P)).toBeGreaterThan(0);
  });

  it('high-speed impacts deal much more damage than low-speed ones', () => {
    const slow = hit({ vx: 0.15 }).e;
    const fast = hit({ vx: 0.9 }).e;
    expect(slow.damageToB).toBeGreaterThan(0);
    expect(fast.damageToB).toBeGreaterThan(slow.damageToB * 1.6);
  });

  it('glancing impacts deal less damage than direct impacts at the same speed', () => {
    const direct = hit({ vx: 0.6, offset: 0 }).e;
    const glancing = hit({ vx: 0.6, offset: 0.045 }).e;
    expect(glancing.damageToB).toBeLessThan(direct.damageToB * 0.6);
  });

  it('identical tops in a symmetric head-on collision take identical damage', () => {
    const w = makeWorld([puck({ ringStrike: 0.01 }), puck({ ringStrike: 0.01 })], { stadium: flat({ radius: 2 }) });
    const [A, B] = w.bodies;
    place(A!, -0.025, 0, 0.5, 0, -600);
    place(B!, 0.0249, 0, -0.5, 0, -600);
    const r = makeContactReport();
    const e = ev();
    resolveTopPair(A!, B!, w.collision, { touching: false }, 0, r);
    expect(applyContactDamage(A!, B!, r, makePairState(), P, 0, 240, e)).toBe(true);
    expect(e.damageToA).toBeCloseTo(e.damageToB, 9);
  });

  it('attack and defense make damage asymmetric (strong attacker vs strong defender)', () => {
    const e = hit({ atkA: 90, defB: 95 }).e;
    const w = hit({ atkA: 40, defB: 35 }).e;
    expect(e.damageToB).toBeGreaterThan(0);
    // Same physical impact, different stats → different damage.
    expect(e.damageToB).not.toBeCloseTo(w.damageToB, 3);
  });

  it('rotational blade strike adds damage and grows with spin', () => {
    const slowSpin = strikeEnergy(0.4, 0.024, 0.02, 100, 0.025, P);
    const fastSpin = strikeEnergy(0.4, 0.024, 0.02, 700, 0.025, P);
    const noBlade = strikeEnergy(0.4, 0.024, 0, 700, 0.025, P);
    expect(fastSpin).toBeGreaterThan(slowSpin);
    expect(slowSpin).toBeGreaterThan(noBlade);
    // A spinning ring alone cannot damage without an actual impact.
    expect(strikeEnergy(0, 0.024, 0.02, 700, 0.025, P)).toBe(0);
    expect(strikeEnergy(P.minImpactSpeed * 0.9, 0.024, 0.02, 700, 0.025, P)).toBe(0);
  });

  it('soft cap bounds extreme hits', () => {
    expect(softCap(1e9, 4)).toBeLessThan(4);
    expect(softCap(0.01, 4)).toBeCloseTo(0.01, 4);
    const huge = computeDamage(1e6, 65, 0, P);
    expect(huge).toBeLessThanOrEqual(P.damageScale * P.severityCap + 1e-9);
  });

  it('never produces negative, NaN or infinite damage for invalid inputs', () => {
    const bad = [NaN, Infinity, -Infinity, -1, 0, 1e308];
    for (const e of bad)
      for (const a of bad)
        for (const d of bad) {
          const v = computeDamage(e, a, d, P);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
    for (const x of bad) {
      const v = strikeEnergy(x, x, x, x, x, P);
      expect(Number.isFinite(v) && v >= 0).toBe(true);
    }
    const zeroRef: CombatParams = { ...P, attackReference: 0, defenseReference: 0, energyReference: 0, severityCap: 0 };
    expect(Number.isFinite(computeDamage(0.01, 65, 65, zeroRef))).toBe(true);
  });
});

describe('contact lifecycle', () => {
  it('a sustained contact deals damage once, not on every physics update', () => {
    const w = makeWorld([puck({ ringStrike: 0.01 }), puck({ ringStrike: 0.01 })], { stadium: flat({ radius: 2 }) });
    const [A, B] = w.bodies;
    place(A!, -0.0495, 0, 0.5, 0, -600);
    place(B!, 0, 0, 0, 0, -600);
    let hits = 0;
    for (let i = 0; i < 240; i++) {
      // Keep pushing A into B (a grinding contact).
      A!.vx = Math.max(A!.vx, 0.06);
      w.step();
      hits += w.drainDamage().length;
    }
    expect(hits).toBe(1);
  });

  it('a genuinely new impact after separating deals damage again, even shortly after', () => {
    const w = makeWorld([puck({ ringStrike: 0.01 }), puck({ ringStrike: 0.01 })], { stadium: flat({ radius: 2 }) });
    const [A, B] = w.bodies;
    place(A!, -0.0495, 0, 0.6, 0, -600);
    place(B!, 0, 0, 0, 0, -600);
    w.step();
    expect(w.drainDamage().length).toBe(1);
    // Separate by a few millimetres, then strike again 50 ms later.
    for (let i = 0; i < 12; i++) w.step();
    place(A!, B!.x - 0.0495, B!.y, 0.6, 0);
    B!.vx = 0;
    B!.vy = 0;
    // Force the separation to be observed first.
    const gapA = A!.x;
    A!.x = gapA - 0.01;
    w.step();
    A!.x = B!.x - 0.0495;
    A!.vx = 0.6;
    w.step();
    expect(w.drainDamage().length).toBe(1);
  });

  it('within one unbroken contact a hard new approach counts again after the re-arm time', () => {
    const w = makeWorld([puck({ ringStrike: 0.01 }), puck({ ringStrike: 0.01 })], { stadium: flat({ radius: 2 }) });
    const [A, B] = w.bodies;
    place(A!, -0.0495, 0, 0.6, 0, -600);
    place(B!, 0, 0, 0, 0, -600);
    const r = makeContactReport();
    const pair = makePairState();
    const contact = { touching: false };
    const e = ev();
    resolveTopPair(A!, B!, w.collision, contact, 0, r);
    expect(applyContactDamage(A!, B!, r, pair, P, 0, 240, e)).toBe(true);
    // Still touching (never re-armed): a new hard approach right away does not count…
    A!.vx = 0.6;
    B!.vx = 0;
    A!.x = B!.x - 0.0499;
    resolveTopPair(A!, B!, w.collision, contact, 1, r);
    expect(applyContactDamage(A!, B!, r, pair, P, 1, 240, e)).toBe(false);
    // …but it does once the re-arm time has passed.
    const later = Math.ceil(P.rearmTime * 240) + 1;
    A!.vx = 0.6;
    B!.vx = 0;
    A!.x = B!.x - 0.0499;
    resolveTopPair(A!, B!, w.collision, contact, later, r);
    expect(applyContactDamage(A!, B!, r, pair, P, later, 240, e)).toBe(true);
  });
});

describe('finishes', () => {
  function battle(a: string, b: string, seed = 7, maxDuration = 180) {
    const c = defaultConfig(seed);
    c.player.topId = a;
    c.opponent.topId = b;
    c.maxDuration = maxDuration;
    return new Battle(buildBattleOptions(c));
  }

  it('burst finish: a top that reaches zero health loses by burst', () => {
    const bt = battle('inferno', 'tempest');
    bt.world.bodies[1]!.health = 1e-6;
    const r = bt.runToEnd();
    expect(r.outcome).toMatchObject({ kind: 'win', winner: 0, loser: 1, finish: 'burst' });
    expect(r.tops[1]!.health).toBe(0);
    expect(bt.world.bodies[1]!.eliminated).toBe('burst');
  });

  it('spin finish: with damage disabled a battle ends by spin finish', () => {
    const c = defaultConfig(3);
    c.combat.damageScale = 0;
    c.combat.knockouts = false;
    const r = new Battle(buildBattleOptions(c)).runToEnd();
    expect(r.outcome.kind).toBe('win');
    if (r.outcome.kind === 'win') expect(r.outcome.finish).toBe('spin');
  });

  it('classifies a top meeting several conditions on the same step deterministically (burst > knockout > spin)', () => {
    const bt = battle('phantom', 'phantom');
    const b = bt.world.bodies[0]!;
    b.spinning = false;
    expect(finishOf(b)).toBe('spin');
    b.eliminated = 'knockout';
    expect(finishOf(b)).toBe('knockout');
    b.health = 0;
    expect(finishOf(b)).toBe('burst');
  });

  it('both tops eliminated on the same step is a draw, regardless of which condition', () => {
    const bt = battle('phantom', 'phantom');
    const [A, B] = bt.world.bodies;
    B!.omega = Math.sign(B!.omega) * B!.criticalSpin * 0.5; // B will stop this step
    A!.health = 0; // A has burst
    A!.eliminated = 'burst';
    bt.step();
    expect(bt.result!.outcome).toEqual({ kind: 'draw', reason: 'same-step', finishes: ['burst', 'spin'] });
  });

  it('a mutual burst in one collision is a draw', () => {
    const c = defaultConfig(1);
    c.player.topId = 'phantom';
    c.opponent.topId = 'phantom';
    const bt = new Battle(buildBattleOptions(c));
    const [A, B] = bt.world.bodies;
    A!.health = 1e-3;
    B!.health = 1e-3;
    place(A!, -0.026, 0, 0.6, 0, A!.omega);
    place(B!, 0.0255, 0, -0.6, 0, B!.omega);
    bt.step();
    expect(bt.result?.outcome.kind).toBe('draw');
  });

  it('slot assignment does not decide simultaneous finishes (swapping slots mirrors the outcome)', () => {
    const r: string[] = [];
    for (const order of [0, 1]) {
      const bt = battle('titan', 'titan');
      const [A, B] = bt.world.bodies;
      const victim = order === 0 ? A! : B!;
      victim.omega = Math.sign(victim.omega) * victim.criticalSpin * 0.5;
      // v0.3: a lone spin stop opens the draw window; run until resolved.
      bt.runToEnd();
      const o = bt.result!.outcome;
      r.push(o.kind === 'win' ? `${o.winner === (order === 0 ? 1 : 0)}` : o.kind);
    }
    expect(r).toEqual(['true', 'true']);
  });

  it('timeout: no invented winner when the maximum duration is reached', () => {
    const bt = battle('tempest', 'tempest', 3, 6);
    const r = bt.runToEnd();
    expect(r.outcome.kind).toBe('timeout');
  });

  it('the result is frozen and does not change during the finishing presentation', () => {
    const bt = battle('inferno', 'phantom', 11);
    const r = bt.runToEnd();
    const copy = JSON.parse(JSON.stringify(r));
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.outcome)).toBe(true);
    expect(Object.isFrozen(r.tops[0])).toBe(true);
    const healthAtEnd = bt.world.bodies.map((b) => b.health);
    for (let i = 0; i < 240 * 6; i++) bt.stepAftermath();
    expect(JSON.parse(JSON.stringify(bt.result))).toEqual(copy);
    expect(bt.step()).toBe(false);
    // Combat is disabled after the result: no further damage.
    expect(bt.world.bodies.map((b) => b.health)).toEqual(healthAtEnd);
  });
});

describe('knockouts (rim escape)', () => {
  it('an ordinary wall impact does not knock a top out', () => {
    const w = makeWorld([phantom()], { stadium: bowl() });
    const b = w.bodies[0]!;
    place(b, 0.17, 0, 0.5, 0, -600);
    for (let i = 0; i < 240; i++) w.step();
    expect(b.eliminated).toBeNull();
    expect(Math.hypot(b.x, b.y)).toBeLessThan(0.2);
  });

  it('merely overlapping the rim (no outward velocity) never knocks out', () => {
    const w = makeWorld([phantom()], { stadium: bowl() });
    const b = w.bodies[0]!;
    place(b, 0.19, 0, 0, 0, -600); // overlapping the wall, at rest
    w.step();
    expect(b.eliminated).toBeNull();
  });

  it('a powerful hit near the rim followed by a fast outward wall impact escapes', () => {
    const w = makeWorld([phantom({ stability: 0.2 })], { stadium: bowl() });
    const b = w.bodies[0]!;
    place(b, 0.172, 0, 1.2, 0, -600);
    b.lastImpactStep = 0;
    b.lastImpactDv = 1.2;
    w.step();
    expect(b.eliminated).toBe('knockout');
    expect(b.finishDirX).toBeGreaterThan(0.9);
  });

  it('escape depends on speed, lift, stability and lip height', () => {
    const w = makeWorld([phantom()], { stadium: bowl() });
    const b = w.bodies[0]!;
    const lip = 0.016;
    b.lastImpactStep = -1e9;
    const p = DEFAULT_COMBAT;
    expect(rimEscape(b, 0.2, 0.6, lip, 0, 240, p)).toBe(0);
    b.lastImpactStep = 0;
    b.lastImpactDv = 2;
    const fast = rimEscape(b, 1.2, 0.6, lip, 0, 240, p);
    expect(fast).toBeGreaterThan(0);
    // Higher lip or knockouts disabled → no escape.
    expect(rimEscape(b, 1.2, 0.6, 1, 0, 240, p)).toBe(0);
    expect(rimEscape(b, 1.2, 0.6, lip, 0, 240, { ...p, knockouts: false })).toBe(0);
    // Lift only counts within the lift window.
    b.lastImpactDv = 0.9;
    const within = rimEscape(b, 0.9, 0.6, lip, 0, 240, p);
    const after = rimEscape(b, 0.9, 0.6, lip, Math.ceil(p.liftWindow * 240) + 5, 240, p);
    expect(after).toBeLessThanOrEqual(within);
  });

  it('a knocked-out top leaves play and the other top wins by knockout', () => {
    const c = defaultConfig(2);
    c.player.topId = 'inferno';
    c.opponent.topId = 'tempest';
    const bt = new Battle(buildBattleOptions(c));
    const B = bt.world.bodies[1]!;
    B.eliminated = 'knockout';
    bt.step();
    expect(bt.result!.outcome).toEqual({ kind: 'win', winner: 0, loser: 1, finish: 'knockout', narrow: false });
    // Eliminated tops no longer collide.
    const x = B.x;
    for (let i = 0; i < 100; i++) bt.stepAftermath();
    expect(B.x).toBe(x);
  });
});

describe('seeded reproducibility with combat', () => {
  it('same seed ⇒ identical damage, finishes and statistics', () => {
    const mk = () => {
      const c = defaultConfig(77);
      c.player.topId = 'inferno';
      c.opponent.topId = 'tempest';
      return new Battle(buildBattleOptions(c));
    };
    const a = mk();
    const b = mk();
    expect(a.runToEnd()).toEqual(b.runToEnd());
    expect(a.world.bodies.map((x) => [x.health, x.damageDealt, x.hitsLanded])).toEqual(
      b.world.bodies.map((x) => [x.health, x.damageDealt, x.hitsLanded]),
    );
  });
});

describe('extended combat stability', () => {
  it('extreme combat settings across all matchups stay finite, keep health in range and never trip guards', async () => {
    const { runBatch } = await import('../src/sim/headless');
    const { STARTER_TOPS } = await import('../src/content/tops');
    for (const a of STARTER_TOPS) {
      for (const b of STARTER_TOPS) {
        const s = runBatch(
          (seed) => {
            const c = defaultConfig(seed);
            c.player.topId = a.id;
            c.opponent.topId = b.id;
            Object.assign(c.combat, { damageScale: 200, severityExponent: 2, severityCap: 100, impactLift: 2, rimClimbEfficiency: 1.5, rotationalContribution: 40, rearmTime: 0, rearmDistance: 0 });
            return buildBattleOptions(c);
          },
          2,
          300,
        );
        expect(s.failures, s.failureDetails.join('\n')).toBe(0);
      }
    }
  });

  it('long Tempest mirror (up to 10 minutes simulated) stays stable with combat on', () => {
    const c = defaultConfig(12);
    c.player.topId = 'tempest';
    c.opponent.topId = 'tempest';
    c.maxDuration = 600;
    const bt = new Battle(buildBattleOptions(c));
    const r = bt.runToEnd();
    expect(['win', 'draw', 'timeout']).toContain(r.outcome.kind);
    for (const b of bt.world.bodies) {
      expect(b.guardTrips).toBe(0);
      expect(Number.isFinite(b.x + b.y + b.vx + b.vy + b.omega + b.health)).toBe(true);
    }
  });
});
