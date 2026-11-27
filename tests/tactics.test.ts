import { describe, expect, it } from 'vitest';
import { Battle } from '../src/sim/battle';
import { World, DEFAULT_LAUNCH } from '../src/sim/world';
import { DEFAULT_COLLISION } from '../src/sim/collision';
import { DEFAULT_COMBAT } from '../src/sim/combat';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig, passiveTacticalConfig, sandboxDefaultConfig, type SandboxConfig } from '../src/config/sandboxConfig';
import { validateConfig } from '../src/config/validate';
import { observe } from '../src/sim/observation';
import { DEFAULT_BOOST, DEFAULT_BRACE, boostCostFraction, defaultTacticalParams, effectiveTactics, type TacticalCommand } from '../src/sim/tactics';
import { TacticalAI } from '../src/ai/tacticalAi';
import { PERSONALITIES, SKILLS, personalityFor } from '../src/ai/profiles';
import { GESTURE, gestureStrength } from '../src/ui/tacticalUi';
import { STARTER_TOPS } from '../src/content/tops';
import { flat, puck, place } from './helpers';
import { DEFAULT_TOP_COMBAT } from '../src/sim/combat';

const HZ = 240;

/** A running battle with abilities on and no agents (manual commands only). */
function manual(seed = 11, mutate?: (c: SandboxConfig) => void): Battle {
  const c = defaultConfig(seed);
  c.tactical = defaultTacticalConfig();
  c.tactical.player = { controller: 'passive', difficulty: 'normal' };
  c.tactical.opponent = { controller: 'passive', difficulty: 'normal' };
  mutate?.(c);
  return new Battle(buildBattleOptions(c));
}

function stepN(b: Battle, n: number): void {
  for (let i = 0; i < n && b.phase !== 'finished'; i++) b.step();
}

function aiConfig(seed: number, a: string, b: string, da: 'easy' | 'normal' | 'hard' | 'expert', db: 'easy' | 'normal' | 'hard' | 'expert'): SandboxConfig {
  const c = defaultConfig(seed);
  c.player.topId = a;
  c.opponent.topId = b;
  c.tactical = defaultTacticalConfig();
  c.tactical.player = { controller: 'ai', difficulty: da };
  c.tactical.opponent = { controller: 'ai', difficulty: db };
  return c;
}

describe('v0.5 parameters (approved values)', () => {
  it('Boost: 3 charges, 3 s cooldown, 33–100 % strength, 1–3 % cost', () => {
    expect(DEFAULT_BOOST).toMatchObject({ charges: 3, cooldown: 3, minStrength: 0.33, maxStrength: 1, minCost: 0.01, maxCost: 0.03 });
    expect(boostCostFraction(DEFAULT_BOOST, 0.33)).toBeCloseTo(0.01, 12);
    expect(boostCostFraction(DEFAULT_BOOST, 1)).toBeCloseTo(0.03, 12);
    expect(boostCostFraction(DEFAULT_BOOST, (0.33 + 1) / 2)).toBeCloseTo(0.02, 12);
  });
  it('Brace: 2 charges, 1.5 s, 5 s cooldown from activation, −30 % damage, −25 % knockback, no stamina cost', () => {
    expect(DEFAULT_BRACE).toEqual({ charges: 2, duration: 1.5, cooldown: 5, damageReduction: 0.3, knockbackReduction: 0.25, staminaCost: 0 });
  });
  it('modifiers are extensible but v0.5 applies none (identical parameters for every top)', () => {
    const p = defaultTacticalParams();
    expect(effectiveTactics(p)).toEqual(effectiveTactics(p, {}));
    expect(effectiveTactics(p, { boostCharges: 1 }).boost.charges).toBe(4);
    const opts = buildBattleOptions(sandboxDefaultConfig(1));
    expect(opts.tacticalModifiers).toBeUndefined();
  });
});

describe('abilities off = v0.4.1 passive combat', () => {
  it('passive configs (tactics disabled) give results identical to configs without any tactical agent', () => {
    for (const seed of [1, 2, 3, 4]) {
      const a = defaultConfig(seed);
      const b = defaultConfig(seed);
      b.tactical = { ...defaultTacticalConfig(), enabled: false };
      const ra = new Battle(buildBattleOptions(a)).runToEnd();
      const rb = new Battle(buildBattleOptions(b)).runToEnd();
      expect(rb).toEqual(ra);
      expect(ra.tactical).toBeNull();
    }
  });
  it('enabled tactics with nobody using them do not change the battle (only the summary is added)', () => {
    for (const seed of [5, 6]) {
      const ra = new Battle(buildBattleOptions(defaultConfig(seed))).runToEnd();
      const rb = manual(seed).runToEnd();
      expect({ ...rb, tactical: null }).toEqual(ra);
      expect(rb.tactical?.enabled).toBe(true);
      expect(rb.tactical?.tops.map((t) => t.boostsLeft)).toEqual([3, 3]);
    }
  });
});

describe('Directional Boost', () => {
  it('consumes a charge and starts the cooldown; respects charges and the 3 s cooldown', () => {
    const b = manual();
    stepN(b, 120);
    const boost = () => b.submit(0, { ability: 'boost', dirX: 1, dirY: 0, strength: 0.5 });
    expect(boost().ok).toBe(true);
    expect(boost()).toEqual({ ok: false, reason: 'cooldown' });
    stepN(b, 3 * HZ - 1);
    expect(boost()).toEqual({ ok: false, reason: 'cooldown' });
    stepN(b, 1);
    expect(boost().ok).toBe(true);
    stepN(b, 3 * HZ);
    expect(boost().ok).toBe(true);
    stepN(b, 3 * HZ);
    expect(boost()).toEqual({ ok: false, reason: 'charges' });
    expect(b.world.abilities[0]!.boostCharges).toBe(0);
    expect(b.world.abilities[1]!.boostCharges).toBe(3); // the other side is untouched
  });

  it('invalid or cancelled gestures consume nothing (strength, direction, NaN)', () => {
    const b = manual();
    stepN(b, 60);
    const spin0 = b.world.bodies[0]!.spinEnergy;
    const v0 = [b.world.bodies[0]!.vx, b.world.bodies[0]!.vy];
    expect(b.submit(0, { ability: 'boost', dirX: 1, dirY: 0, strength: 0.2 })).toEqual({ ok: false, reason: 'strength' });
    expect(b.submit(0, { ability: 'boost', dirX: 0, dirY: 0, strength: 1 })).toEqual({ ok: false, reason: 'direction' });
    expect(b.submit(0, { ability: 'boost', dirX: NaN, dirY: 1, strength: 1 })).toEqual({ ok: false, reason: 'direction' });
    expect(b.submit(0, { ability: 'boost', dirX: 1, dirY: 0, strength: NaN })).toEqual({ ok: false, reason: 'strength' });
    expect(b.submit(0, { ability: 'boost', dirX: 1, dirY: 0 })).toEqual({ ok: false, reason: 'strength' });
    expect(b.world.abilities[0]!.boostCharges).toBe(3);
    expect(b.world.bodies[0]!.spinEnergy).toBe(spin0);
    expect([b.world.bodies[0]!.vx, b.world.bodies[0]!.vy]).toEqual(v0);
    expect(b.world.commandLog).toHaveLength(0);
  });

  it('clamps strength above 100 % and normalises the direction', () => {
    const b = manual();
    stepN(b, 60);
    const r = b.submit(0, { ability: 'boost', dirX: 3, dirY: 4, strength: 7 });
    expect(r.ok && r.strength).toBe(1);
    expect(r.ok && [r.dirX, r.dirY]).toEqual([0.6, 0.8]);
    expect(b.world.commandLog[0]).toMatchObject({ dirX: 3, dirY: 4, strength: 1 }); // logged as requested (exact replay), strength as applied
  });

  it('is a physical impulse: pays its cost in spin energy, never creates energy, Δv ∝ 1/mass, no auto-targeting', () => {
    const run = (mass: number) => {
      const w = new World({ stadium: flat(), tops: [puck({ mass }), puck({ mass })], collision: DEFAULT_COLLISION, launch: DEFAULT_LAUNCH, seed: 1, stepHz: HZ, tactics: defaultTacticalParams() });
      place(w.bodies[0]!, -0.05, 0, 0, 0, 900);
      place(w.bodies[1]!, 0.05, 0.02, 0, 0, 900);
      const b = w.bodies[0]!;
      const e0 = b.spinEnergy + 0.5 * b.params.mass * (b.vx ** 2 + b.vy ** 2);
      const res = w.applyCommand({ tick: 0, slot: 0, ability: 'boost', dirX: 0, dirY: 1, strength: 0.6 }, true);
      expect(res.ok).toBe(true);
      const cost = boostCostFraction(DEFAULT_BOOST, 0.6) * b.launchEnergy;
      expect(res.ok && res.cost).toBeCloseTo(cost, 12);
      const e1 = b.spinEnergy + 0.5 * b.params.mass * (b.vx ** 2 + b.vy ** 2);
      expect(e1).toBeLessThanOrEqual(e0 + 1e-12); // never creates energy
      expect(0.5 * b.params.mass * (b.vx ** 2 + b.vy ** 2)).toBeLessThanOrEqual(DEFAULT_BOOST.efficiency * cost + 1e-12);
      // Straight along the requested direction (no homing toward the opponent at (0.05, 0.02)).
      expect(b.vx).toBe(0);
      expect(b.vy).toBeGreaterThan(0);
      return b.vy;
    };
    const light = run(0.03);
    const heavy = run(0.06);
    // Below the energy ceiling, Δv = J / m exactly.
    expect(light / heavy).toBeCloseTo(2, 6);
  });

  it('the energy ceiling scales the impulse down when a boost would add more kinetic energy than it paid', () => {
    const w = new World({ stadium: flat(), tops: [puck({ mass: 0.02 }), puck()], collision: DEFAULT_COLLISION, launch: DEFAULT_LAUNCH, seed: 1, stepHz: HZ, tactics: { enabled: true, boost: { ...DEFAULT_BOOST, impulse: 0.1 }, brace: { ...DEFAULT_BRACE } } });
    place(w.bodies[0]!, 0, 0, 0, 0, 900);
    place(w.bodies[1]!, 0.1, 0, 0, 0, 900);
    const b = w.bodies[0]!;
    const r = w.applyCommand({ tick: 0, slot: 0, ability: 'boost', dirX: 1, dirY: 0, strength: 1 }, true);
    expect(r.ok).toBe(true);
    const ke = 0.5 * b.params.mass * b.vx ** 2;
    expect(ke).toBeCloseTo(DEFAULT_BOOST.efficiency * (r.ok ? r.cost : 0), 9);
    expect(b.vx).toBeLessThan(0.1 / 0.02);
  });

  it('Speed sets boost authority (heavier or slower tops gain less speed); never a second bonus', () => {
    const slow = buildBattleOptions(defaultConfig(1)).tops.map((t) => t.boostPower);
    for (const p of slow) expect(p).toBeGreaterThan(0.5);
    const titan = STARTER_TOPS.find((t) => t.id === 'titan')!;
    const inferno = STARTER_TOPS.find((t) => t.id === 'inferno')!;
    const c = defaultConfig(1);
    c.player.topId = inferno.id;
    c.opponent.topId = titan.id;
    const o = buildBattleOptions(c);
    expect(o.tops[0]!.boostPower!).toBeGreaterThan(o.tops[1]!.boostPower!);
  });

  it('a boost is refused when it would spin the top out (stamina), and refused once the top has stopped', () => {
    const b = manual();
    stepN(b, 60);
    const body = b.world.bodies[0]!;
    // Leave the top just above its toppling energy.
    body.omega = Math.sign(body.omega) * Math.sqrt((2 * (body.criticalEnergy + 0.001 * body.launchEnergy)) / body.inertia);
    expect(b.submit(0, { ability: 'boost', dirX: 1, dirY: 0, strength: 1 })).toEqual({ ok: false, reason: 'stamina' });
    expect(b.world.abilities[0]!.boostCharges).toBe(3);
  });

  it('rejects input outside normal combat and after the battle', () => {
    const b = manual(3);
    const r = b.runToEnd();
    expect(r).toBeTruthy();
    expect(b.submit(0, { ability: 'boost', dirX: 1, dirY: 0, strength: 1 })).toEqual({ ok: false, reason: 'phase' });
    expect(b.submit(0, { ability: 'brace' })).toEqual({ ok: false, reason: 'phase' });
  });

  it('with abilities off every command is refused', () => {
    const b = new Battle(buildBattleOptions(defaultConfig(2)));
    expect(b.submit(0, { ability: 'brace' })).toEqual({ ok: false, reason: 'disabled' });
  });
});

describe('Defensive Brace', () => {
  it('2 charges, active 1.5 s of simulation time, 5 s cooldown from activation, no stacking', () => {
    const b = manual();
    stepN(b, 30);
    expect(b.submit(1, { ability: 'brace' }).ok).toBe(true);
    const t0 = b.world.steps;
    expect(b.world.abilityView(1).braceActive).toBe(true);
    expect(b.submit(1, { ability: 'brace' })).toEqual({ ok: false, reason: 'active' });
    stepN(b, 1.5 * HZ - 1);
    expect(b.world.abilityView(1).braceActive).toBe(true);
    stepN(b, 1);
    expect(b.world.steps - t0).toBe(1.5 * HZ);
    expect(b.world.abilityView(1).braceActive).toBe(false);
    expect(b.submit(1, { ability: 'brace' })).toEqual({ ok: false, reason: 'cooldown' });
    stepN(b, 5 * HZ - 1.5 * HZ);
    expect(b.submit(1, { ability: 'brace' }).ok).toBe(true);
    stepN(b, 5 * HZ);
    expect(b.submit(1, { ability: 'brace' })).toEqual({ ok: false, reason: 'charges' });
  });

  it('costs no stamina and can be combined with Boost on the same tick', () => {
    const b = manual();
    stepN(b, 60);
    const e = b.world.bodies[0]!.spinEnergy;
    expect(b.submit(0, { ability: 'brace' }).ok).toBe(true);
    expect(b.world.bodies[0]!.spinEnergy).toBe(e);
    expect(b.submit(0, { ability: 'boost', dirX: 0, dirY: 1, strength: 0.4 }).ok).toBe(true);
    expect(b.world.abilityView(0).braceActive).toBe(true);
  });

  it('timers pause with the battle: an un-stepped battle keeps its remaining time', () => {
    const b = manual();
    stepN(b, 10);
    b.submit(0, { ability: 'brace' });
    stepN(b, 100);
    const v1 = b.world.abilityView(0);
    // (Paused = the runner simply does not step.)
    const v2 = b.world.abilityView(0);
    expect(v2).toEqual(v1);
    expect(v1.braceRemaining).toBeCloseTo(1.5 - 100 / HZ, 9);
  });

  it('reduces impact damage by 30 % and the contact impulse by 25 %, conserving momentum between the tops', () => {
    const hit = (brace: boolean) => {
      const w = new World({
        stadium: flat(),
        tops: [puck({ mass: 0.05 }), puck({ mass: 0.05 })],
        topCombat: [DEFAULT_TOP_COMBAT, DEFAULT_TOP_COMBAT],
        collision: DEFAULT_COLLISION,
        combat: { ...DEFAULT_COMBAT, criticalHits: false },
        launch: DEFAULT_LAUNCH,
        seed: 1,
        stepHz: HZ,
        tactics: defaultTacticalParams(),
      });
      place(w.bodies[0]!, -0.03, 0, 0.8, 0, 900);
      place(w.bodies[1]!, 0.03, 0, -0.8, 0, -900);
      if (brace) expect(w.applyCommand({ tick: 0, slot: 1, ability: 'brace' }, true).ok).toBe(true);
      let dmg = 0;
      let p = 0;
      for (let i = 0; i < 240 && dmg === 0; i++) {
        w.step();
        for (const d of w.drainDamage()) dmg += d.damageToB;
      }
      const [A, B] = w.bodies as [typeof w.bodies[0], typeof w.bodies[0]];
      p = A!.params.mass * A!.vx + B!.params.mass * B!.vx;
      return { dmg, p, sep: B!.vx - A!.vx, prevented: B!.bracePrevented };
    };
    const plain = hit(false);
    const braced = hit(true);
    expect(plain.dmg).toBeGreaterThan(0);
    expect(braced.dmg).toBeCloseTo(plain.dmg * 0.7, 6);
    expect(braced.prevented).toBeCloseTo(plain.dmg * 0.3, 6);
    expect(braced.p).toBeCloseTo(0, 9); // equal and opposite: momentum stays zero
    expect(plain.p).toBeCloseTo(0, 9);
    expect(braced.sep).toBeLessThan(plain.sep); // less knockback (less separation speed)
    expect(braced.sep).toBeGreaterThanOrEqual(0); // never pulls the tops into each other
  });

  it('never heals and never makes a top invulnerable', () => {
    const b = manual(21, (c) => {
      c.tactical.boost.charges = 0;
      c.tactical.brace = { ...c.tactical.brace, charges: 20, cooldown: 1.5 };
    });
    let healed = false;
    let lastHp = b.world.bodies[1]!.health;
    while (b.phase !== 'finished') {
      b.submit(1, { ability: 'brace' });
      b.step();
      const hp = b.world.bodies[1]!.health;
      if (hp > lastHp + 1e-9) healed = true;
      lastHp = hp;
    }
    expect(healed).toBe(false);
    const t = b.result!.tactical!.tops[1]!;
    if (t.braceImpacts > 0) expect(b.result!.tops[1]!.damageReceived).toBeGreaterThan(0);
  });
});

describe('determinism and replay', () => {
  it('AI vs AI battles are deterministic for a seed', () => {
    for (const [a, b] of [['inferno', 'titan'], ['tempest', 'phantom']] as const) {
      const r1 = new Battle(buildBattleOptions(aiConfig(77, a, b, 'expert', 'hard'))).runToEnd();
      const r2 = new Battle(buildBattleOptions(aiConfig(77, a, b, 'expert', 'hard'))).runToEnd();
      expect(r2).toEqual(r1);
    }
  });

  it('the command log replays a battle exactly without the AI (seed + configuration + commands)', () => {
    let used = 0;
    for (const seed of [31, 32, 33]) {
      const cfg = aiConfig(seed, 'phantom', 'inferno', 'expert', 'normal');
      const live = new Battle(buildBattleOptions(cfg)).runToEnd();
      used += live.tactical!.commands.length;
      const replay = structuredClone(cfg);
      replay.tactical.player = { controller: 'passive', difficulty: 'normal' };
      replay.tactical.opponent = { controller: 'passive', difficulty: 'normal' };
      replay.tactical.script = live.tactical!.commands.map((c) => ({ ...c }));
      const again = new Battle(buildBattleOptions(replay)).runToEnd();
      expect(again).toEqual(live);
    }
    expect(used).toBeGreaterThan(0);
  });

  it('live input on a tick equals a scripted command on that tick', () => {
    const cmds: TacticalCommand[] = [
      { tick: 300, slot: 0, ability: 'boost', dirX: 0.3, dirY: -1, strength: 0.8 },
      { tick: 700, slot: 1, ability: 'brace' },
      { tick: 1300, slot: 0, ability: 'brace' },
    ];
    const live = manual(41);
    while (live.phase !== 'finished') {
      for (const c of cmds) if (c.tick === live.world.steps) live.submit(c.slot, c);
      live.step();
    }
    const scripted = manual(41, (c) => (c.tactical.script = cmds));
    expect(scripted.runToEnd()).toEqual(live.result);
  });

  it('commands for a past or future tick are refused (no time travel)', () => {
    const b = manual();
    stepN(b, 10);
    expect(b.world.applyCommand({ tick: 5, slot: 0, ability: 'brace' }, true)).toEqual({ ok: false, reason: 'tick' });
    expect(b.world.applyCommand({ tick: 11, slot: 0, ability: 'brace' }, true)).toEqual({ ok: false, reason: 'tick' });
    expect(b.world.applyCommand({ tick: 10, slot: 5, ability: 'brace' }, true)).toEqual({ ok: false, reason: 'slot' });
  });
});

describe('tactical AI', () => {
  it('observes only legitimate state: no seed, RNG, impact counter or opponent intentions', () => {
    const b = manual();
    stepN(b, 50);
    const o = observe(b.world, 0);
    const keys = JSON.stringify(Object.keys(o)) + JSON.stringify(Object.keys(o.self)) + JSON.stringify(Object.keys(o.self.abilities));
    expect(keys).not.toMatch(/seed|rng|impact|crit|script|command|pending/i);
    expect(o.opponent.slot).toBe(1);
  });

  it('class personalities: Inferno aggressive, Titan brace/centre/counter, Tempest conserving/evading, Phantom adaptive', () => {
    expect(personalityFor('Attack').id).toBe('striker');
    expect(personalityFor('Defense').id).toBe('bulwark');
    expect(personalityFor('Stamina').id).toBe('endurer');
    expect(personalityFor('Balance').id).toBe('tactician');
    expect(PERSONALITIES.striker!.interception).toBeGreaterThan(PERSONALITIES.endurer!.interception);
    expect(PERSONALITIES.bulwark!.brace).toBe(1);
    expect(PERSONALITIES.bulwark!.centerRecovery).toBe(1);
    expect(PERSONALITIES.endurer!.conservation).toBe(1);
    expect(PERSONALITIES.endurer!.evasion).toBe(1);
    expect(PERSONALITIES.tactician!.adaptive).toBe(true);
    expect(personalityFor('Attack', 'bulwark').id).toBe('bulwark'); // reusable profile by id
  });

  it('difficulty changes decision quality only (reaction, prediction, mistakes), never stats or charges', () => {
    expect(SKILLS.easy.reaction[0]).toBeGreaterThan(SKILLS.expert.reaction[1]);
    expect(SKILLS.easy.mistakeChance).toBeGreaterThan(SKILLS.normal.mistakeChance);
    expect(SKILLS.expert.mistakeChance).toBe(0);
    const e = buildBattleOptions(aiConfig(5, 'titan', 'inferno', 'easy', 'easy'));
    const x = buildBattleOptions(aiConfig(5, 'titan', 'inferno', 'expert', 'expert'));
    expect(x.tactics).toEqual({ enabled: true, boost: { ...DEFAULT_BOOST }, brace: { ...DEFAULT_BRACE } });
    expect(e.tactics).toEqual(x.tactics);
    expect(e.tops).toEqual(x.tops);
    expect(e.topCombat).toEqual(x.topCombat);
  });

  it('uses the same validated commands as the player (a seeded agent only emits requests)', () => {
    const ai = new TacticalAI({ difficulty: 'expert', seed: 9, slot: 0, selfClass: 'Attack', opponentClass: 'Defense' });
    const b = manual(9, (c) => (c.player.topId = 'inferno'));
    let reqs = 0;
    while (b.phase !== 'finished') {
      const out = ai.tick(b.world.steps, () => observe(b.world, 0));
      if (out) for (const r of out) {
        reqs++;
        b.submit(0, r);
      }
      b.step();
    }
    const st = b.world.abilities[0]!;
    expect(st.boostsUsed).toBeLessThanOrEqual(3);
    expect(st.bracesUsed).toBeLessThanOrEqual(2);
    expect(reqs).toBeGreaterThanOrEqual(st.boostsUsed + st.bracesUsed);
  });

  it('AI vs AI over the roster: no NaN, no guard trips, charges never exceeded, valid results', () => {
    for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) {
      const r = new Battle(buildBattleOptions(aiConfig(1000 + a.id.length * 7 + b.id.length, a.id, b.id, 'expert', 'easy'))).runToEnd();
      for (const t of r.tops) {
        expect(Number.isFinite(t.health)).toBe(true);
        expect(Number.isFinite(t.stamina)).toBe(true);
      }
      for (const t of r.tactical!.tops) {
        expect(t.boostsUsed + t.boostsLeft).toBe(3);
        expect(t.bracesUsed + t.bracesLeft).toBe(2);
        expect(t.boostCost).toBeLessThanOrEqual(0.09 + 1e-9);
      }
    }
  });
});

describe('gesture normalisation', () => {
  it('dead zone cancels, longer drags give more strength, full length = 100 %', () => {
    const D = 400;
    expect(gestureStrength(GESTURE.deadZone * D * 0.99, D, DEFAULT_BOOST)).toBe(0);
    expect(gestureStrength(GESTURE.deadZone * D, D, DEFAULT_BOOST)).toBeCloseTo(0.33, 9);
    expect(gestureStrength(GESTURE.fullLength * D, D, DEFAULT_BOOST)).toBeCloseTo(1, 9);
    expect(gestureStrength(GESTURE.fullLength * D * 3, D, DEFAULT_BOOST)).toBeCloseTo(1, 9);
    // Normalised to the stadium size: the same fraction gives the same strength on any screen.
    expect(gestureStrength(0.2 * 300, 300, DEFAULT_BOOST)).toBeCloseTo(gestureStrength(0.2 * 900, 900, DEFAULT_BOOST), 12);
    expect(gestureStrength(10, 0, DEFAULT_BOOST)).toBe(0);
    expect(gestureStrength(NaN, 300, DEFAULT_BOOST)).toBe(0);
  });
});

describe('sandbox tactical configuration', () => {
  it('the sandbox starts with abilities on (player vs Normal AI); validation round-trips it', () => {
    const c = sandboxDefaultConfig(4);
    expect(c.tactical.enabled).toBe(true);
    expect(c.tactical.player.controller).toBe('player');
    expect(c.tactical.opponent).toEqual({ controller: 'ai', difficulty: 'normal' });
    const r = validateConfig(JSON.parse(JSON.stringify(c)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.tactical).toEqual(c.tactical);
  });

  it('rejects malformed tactical settings and scripts', () => {
    const bad = (mut: (t: Record<string, any>) => void) => {
      const c = JSON.parse(JSON.stringify(sandboxDefaultConfig(1)));
      mut(c.tactical);
      return validateConfig(c).ok;
    };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((t) => (t.player.controller = 'robot'))).toBe(false);
    expect(bad((t) => (t.opponent.difficulty = 'insane'))).toBe(false);
    expect(bad((t) => (t.script = [{ tick: -1, slot: 0, ability: 'boost', dirX: 1, dirY: 0, strength: 1 }]))).toBe(false);
    expect(bad((t) => (t.script = [{ tick: 10, slot: 3, ability: 'brace' }]))).toBe(false);
    expect(bad((t) => (t.script = [{ tick: 10, slot: 0, ability: 'fly' }]))).toBe(false);
    expect(bad((t) => (t.script = [{ tick: 10, slot: 0, ability: 'brace' }]))).toBe(true);
  });

  it('a version 4 (v0.4.1) configuration loads with abilities off and replays v0.4.1 battles', () => {
    const c = JSON.parse(JSON.stringify(defaultConfig(8)));
    c.version = 4;
    delete c.tactical;
    const r = validateConfig(c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.tactical).toEqual(passiveTacticalConfig());
    expect(new Battle(buildBattleOptions(r.config)).runToEnd()).toEqual(new Battle(buildBattleOptions(defaultConfig(8))).runToEnd());
  });

  it('per-slot controllers: player, AI or passive; AI vs AI needs no input', () => {
    const c = sandboxDefaultConfig(2);
    expect(buildBattleOptions(c).agents?.map((a) => a !== null)).toEqual([false, true]);
    c.tactical.player = { controller: 'ai', difficulty: 'hard' };
    expect(buildBattleOptions(c).agents?.map((a) => a !== null)).toEqual([true, true]);
    c.tactical.enabled = false;
    expect(buildBattleOptions(c).tactics).toBeUndefined();
  });
});

describe('v0.5 career data and save migration', async () => {
  const { CareerStore, MemoryStore } = await import('../src/career/store');
  const { loadSaveData, parseImport, makeExport, SAVE_SCHEMA_VERSION } = await import('../src/career/save');
  const { playHeadlessBattle } = await import('../src/career/headless');

  it('a schema-1 (v0.4.x) save migrates: tactics start at zero, old records are not back-filled', () => {
    const s = new CareerStore(new MemoryStore(), { version: 'test' });
    s.startCareer('titan');
    playHeadlessBattle(s, 'normal', 5, undefined, 'passive');
    const v1 = JSON.parse(JSON.stringify(s.save)) as Record<string, any>;
    v1.schemaVersion = 1;
    for (const t of v1.tops) {
      delete t.stats.tactics;
      for (const r of t.stats.recent) {
        delete r.tactical;
        delete r.launchSettings;
        r.ruleset = 'v0.4.1';
      }
    }
    const before = JSON.stringify(v1.tops[0].stats.recent);
    const r = loadSaveData(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(r.save.tops[0]!.stats.tactics.battles).toBe(0);
    expect(JSON.stringify(r.save.tops[0]!.stats.recent)).toBe(before);
  });

  it('new battles record both sides’ tactical use and lifetime statistics; export / import / reset round-trip', () => {
    const s = new CareerStore(new MemoryStore(), { version: 'test' });
    s.startCareer('inferno');
    for (let i = 0; i < 6; i++) playHeadlessBattle(s, 'hard', 100 + i, undefined, 'expert');
    const top = s.activeTop!;
    const rec = top.stats.recent.at(-1)!;
    expect(rec.ruleset).toBe('v0.5.0');
    expect(rec.tactical).toBeDefined();
    expect(rec.tactical!.player.boosts + rec.tactical!.player.boostsLeft).toBe(3);
    expect(rec.launchSettings?.opponentAimDirection).toHaveLength(2);
    const t = top.stats.tactics;
    expect(t.battles).toBe(6);
    expect(t.boostsUsed).toBe(top.stats.recent.reduce((a, r) => a + (r.tactical?.player.boosts ?? 0), 0));
    expect(t.noAbilityWins).toBeLessThanOrEqual(t.noAbilityBattles);
    const imported = parseImport(JSON.stringify(makeExport(s.save!, 'now', '0.5.0')));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.save.tops[0]!.stats.tactics).toEqual(t);
    s.reset();
    expect(s.save).toBeNull();
  });
});
