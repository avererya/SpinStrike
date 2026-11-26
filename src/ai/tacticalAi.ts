/**
 * Tactical AI (v0.5): decides when to Boost and Brace from a legitimate
 * observation (src/sim/observation.ts) and returns ordinary ability
 * requests, which the battle validates exactly like the player's input.
 *
 * Decision model (utility based, short horizon):
 *   every `decisionInterval` (seeded jitter) the AI
 *     1. predicts the relative motion for up to `horizon` seconds by straight-
 *        line extrapolation of the CURRENT velocities (with a seeded heading
 *        error that shrinks with difficulty), solving for the time and
 *        approach speed of the next contact;
 *     2. scores candidate actions: Brace before a hard impact, evade, centre
 *        recovery, interception, knockout attempt, orbit break, counter-attack;
 *     3. weights them by its personality, the current health / stamina
 *        advantage, the public stats of both tops, and a charge budget
 *        spread over the expected battle length;
 *     4. if the best score clears the difficulty's threshold, schedules the
 *        action after a reaction latency (it may be stale by then, and is
 *        re-validated on release like any input).
 *
 * It never simulates the battle forward, never sees the seed, the RNG
 * state, critical-hit rolls or the player's unreleased gesture.
 */
import { RNG_STREAM, hashKey, keyedUniform } from '../sim/rng';
import type { Observation } from '../sim/observation';
import type { AbilityRequest, TacticalAgent } from '../sim/tactics';
import type { TopClass } from '../content/stats';
import { MATCHUP_KNOWLEDGE, SKILLS, personalityFor, type Personality, type Skill, type TacticKind } from './profiles';
import type { Difficulty } from './difficulty';

export interface TacticalAiOptions {
  difficulty: Difficulty;
  /** The battle seed; only a derived key is kept (the AI never holds the seed itself). */
  seed: number;
  slot: number;
  selfClass: TopClass;
  opponentClass: TopClass;
  /** Optional named personality (TopDefinition.tacticalProfile). */
  profile?: string;
  /** Override skill / personality (sandbox experiments). */
  skill?: Partial<Skill>;
  personality?: Partial<Personality>;
  /** Learning runs only: always use the brace-attack combo when possible. */
  forceCombo?: boolean;
}

/** Expected battle length used for charge budgeting, s (median of v0.4.1 battles ≈ 37 s). */
const EXPECTED_DURATION = 40;
/** Minimum time into the battle before non-emergency boosts, s. */
const OPENING_HOLD = 0.8;

export type Kind = 'brace' | 'evade' | 'recover' | 'intercept' | 'knockout' | 'orbit' | 'counter' | 'blunder' | 'combo';
interface Candidate {
  kind: Kind;
  utility: number;
  req: AbilityRequest;
  emergency?: boolean;
  /** Brace first, then this boost (brace-attack combo). */
  comboBrace?: boolean;
}

/** Diagnostic counters (observation only). */
export interface AiStats {
  decisions: number;
  actions: Record<Kind, number>;
}

export class TacticalAI implements TacticalAgent {
  readonly skill: Skill;
  readonly personality: Personality;
  readonly stats: AiStats = { decisions: 0, actions: { brace: 0, evade: 0, recover: 0, intercept: 0, knockout: 0, orbit: 0, counter: 0, blunder: 0, combo: 0 } };
  private readonly key: number;
  private nextDecision = 0;
  private pending: { at: number; req: AbilityRequest }[] = [];
  private readonly matchupAggression: number;

  constructor(readonly opts: TacticalAiOptions) {
    this.skill = { ...SKILLS[opts.difficulty], ...opts.skill };
    this.key = hashKey(RNG_STREAM.aiTactics, opts.seed >>> 0, opts.slot >>> 0);
    // Seeded per-battle variation of the personality (±15 %), so two AIs of
    // the same class and difficulty never behave identically.
    const base = { ...personalityFor(opts.selfClass, opts.profile), ...opts.personality };
    const j = (k: number) => 0.85 + 0.3 * this.u(0, 900 + k);
    this.personality = {
      ...base,
      interception: base.interception * j(1),
      knockout: base.knockout * j(2),
      orbitBreak: base.orbitBreak * j(3),
      orbitPatience: base.orbitPatience * j(4),
      counter: base.counter * j(5),
      centerRecovery: base.centerRecovery * j(6),
      evasion: base.evasion * j(7),
      brace: base.brace * j(8),
    };
    // Soft-counter awareness (public class information): attackers press
    // stamina tops, stamina tops stay away from attackers.
    const m: Partial<Record<TopClass, Partial<Record<TopClass, number>>>> = {
      Attack: { Stamina: 0.35, Defense: -0.15 },
      Defense: { Attack: 0.15, Stamina: 0.25 },
      Stamina: { Attack: -0.35, Defense: 0.1 },
      Balance: { Stamina: 0.3, Attack: -0.1, Defense: -0.1 },
    };
    this.matchupAggression = m[opts.selfClass]?.[opts.opponentClass] ?? 0;
    this.nextDecision = Math.round(this.u(0, 1) * 0.3 * 240);
  }

  /** Seeded uniform in [0, 1) keyed by tick and a component id. */
  private u(tick: number, k: number): number {
    return keyedUniform(this.key, tick >>> 0, k);
  }

  tick(t: number, observe: () => Observation): readonly AbilityRequest[] | null {
    if (this.pending.length && t >= this.pending[0]!.at) {
      const out: AbilityRequest[] = [];
      while (this.pending.length && t >= this.pending[0]!.at) out.push(this.pending.shift()!.req);
      return out;
    }
    if (this.pending.length || t < this.nextDecision) return null;
    const obs = observe();
    const hz = obs.stepHz;
    const sk = this.skill;
    this.nextDecision = t + Math.max(1, Math.round(sk.decisionInterval * hz * (0.8 + 0.4 * this.u(t, 1))));
    this.stats.decisions++;
    const c = this.choose(obs, t);
    if (!c) return null;
    this.stats.actions[c.kind]++;
    const lat = sk.reaction[0] + (sk.reaction[1] - sk.reaction[0]) * this.u(t, 2);
    const at = t + Math.max(1, Math.round(lat * hz));
    if (c.comboBrace) this.pending.push({ at, req: { ability: 'brace' } });
    this.pending.push({ at: at + (c.comboBrace ? Math.round(0.05 * hz) : 0), req: c.req });
    return null;
  }

  /** Learned matchup multiplier for an action (1 = neutral), weighted by the AI's matchup knowledge. */
  private know(kind: TacticKind): number {
    const k = this.skill.knowledge;
    if (!(k > 0)) return 1;
    const v = MATCHUP_KNOWLEDGE[this.opts.selfClass]?.[this.opts.opponentClass]?.[kind];
    return v === undefined ? 1 : 1 + k * (v - 1);
  }

  /**
   * Boost needed to reach a moving target: tries several lead times and
   * returns the cheapest Δv (accounting for the tip's sliding deceleration,
   * which eats a boost within a fraction of a second).
   */
  private interceptPlan(S: Observation['self'], P: Observation['opponent'], dvMax: number): { dvx: number; dvy: number; need: number; lead: number } {
    let best = { dvx: 0, dvy: 0, need: Infinity, lead: 0 };
    for (const tl of [0.12, 0.2, 0.3, 0.42, 0.55]) {
      const tx = P.x + P.vx * tl - S.x;
      const ty = P.y + P.vy * tl - S.y;
      const d = Math.hypot(tx, ty) || 1e-9;
      const a = Math.min(S.tipDecel, (2 * d) / (tl * tl) * 0.95);
      const v0 = d / tl + 0.5 * a * tl;
      const dvx = (tx / d) * v0 - S.vx;
      const dvy = (ty / d) * v0 - S.vy;
      const need = Math.hypot(dvx, dvy);
      if (need < best.need) best = { dvx, dvy, need, lead: tl };
    }
    void dvMax;
    return best;
  }

  private choose(o: Observation, t: number): Candidate | null {
    const S = o.self;
    const P = o.opponent;
    if (!S.active || !S.spinning || !P.active) return null;
    const sk = this.skill;
    const pe = this.personality;
    const R = o.arenaRadius;
    const A = S.abilities;
    const canBoost = A.boostAvailable;
    const canBrace = A.braceAvailable;
    if (!canBoost && !canBrace) return null;

    // ---------------------------------------------------- prediction
    const dx = P.x - S.x;
    const dy = P.y - S.y;
    const dist = Math.hypot(dx, dy) || 1e-9;
    const nx = dx / dist;
    const ny = dy / dist;
    const err = (this.u(t, 3) * 2 - 1) * sk.predictionError;
    const ce = Math.cos(err);
    const se = Math.sin(err);
    const rvx0 = P.vx - S.vx;
    const rvy0 = P.vy - S.vy;
    const rvx = rvx0 * ce - rvy0 * se;
    const rvy = rvx0 * se + rvy0 * ce;
    const cd = S.radius + P.radius;
    const a = rvx * rvx + rvy * rvy;
    const b = 2 * (dx * rvx + dy * rvy);
    const cc = dist * dist - cd * cd;
    let tc = Infinity;
    let vn = 0;
    if (cc <= 0) {
      tc = 0;
      vn = Math.max(0, -(dx * rvx + dy * rvy) / dist);
    } else if (a > 1e-8) {
      const disc = b * b - 4 * a * cc;
      if (disc >= 0) {
        const t0 = (-b - Math.sqrt(disc)) / (2 * a);
        if (t0 > 0 && t0 < sk.horizon) {
          tc = t0;
          const qx = dx + rvx * t0;
          const qy = dy + rvy * t0;
          vn = Math.max(0, -(qx * rvx + qy * rvy) / cd);
        }
      }
    }
    const collide = tc < sk.horizon;
    const lat = 0.5 * (sk.reaction[0] + sk.reaction[1]);

    // ------------------------------------------------- situation
    const adv = 0.6 * (S.health - P.health) + 0.8 * (S.stamina - P.stamina);
    // Who out-damages whom, from public attack / defense (bounded defense formula).
    const myHit = S.attack / (100 + 0.5 * P.defense);
    const theirHit = P.attack / (100 + 0.5 * S.defense);
    const dmgRatio = theirHit > 1e-6 ? myHit / theirHit : 2;
    const adaptW = 0.3 + 0.7 * sk.planning; // better AIs adapt more to the matchup
    let aggression = 1 + adaptW * (this.matchupAggression + 0.3 * (Math.min(2, dmgRatio) - 1));
    let caution = 1 + adaptW * (Math.max(0, adv) * 0.8 - this.matchupAggression);
    if (pe.adaptive) {
      // Flexible: press when behind or out-damaging, protect a lead otherwise.
      aggression += 0.5 * Math.max(0, -adv) + 0.2 * Math.max(0, Math.min(2, dmgRatio) - 1);
      caution += 0.8 * Math.max(0, adv);
    }
    aggression = Math.max(0.2, aggression);
    caution = Math.max(0.2, caution);
    // Attacking into an active Brace is poor value; skilled AIs wait it out.
    const braceDeterrent = P.abilities.braceActive ? 1 - 0.7 * sk.planning : 1;
    const rs = Math.hypot(S.x, S.y) / R;
    const ro = Math.hypot(P.x, P.y) / R;
    const outS = rs > 1e-3 ? (S.vx * S.x + S.vy * S.y) / (rs * R) : 0;
    const dvMax = (o.boostImpulse * S.boostPower * o.boostMaxStrength) / Math.max(1e-6, S.mass);

    // Charge budget across the expected battle length.
    const usedB = this.usedBoosts(o);
    const totalB = A.boostCharges + usedB;
    const allowedB = totalB * Math.min(1, 0.34 + (0.66 * o.time) / EXPECTED_DURATION);
    const overBudget = sk.planning > 0 && usedB + 1 > allowedB + (1 - sk.planning) * 1.5;
    const lowStamina = S.stamina < 0.12 + 0.1 * pe.conservation;

    const cands: Candidate[] = [];
    const strengthFor = (dv: number, lo = o.boostMinStrength) =>
      Math.min(o.boostMaxStrength, Math.max(lo, (dv / Math.max(1e-6, dvMax)) * o.boostMaxStrength));

    // ------------------------------------------------------ Brace
    if (canBrace && collide && vn >= pe.braceMinImpact) {
      const dur = o.braceDuration;
      // Good timing: impact inside the active window, ideally early in it.
      const ideal = lat + 0.15;
      const inWindow = tc >= lat * 0.6 && tc <= lat + dur * 0.9;
      const timing = inWindow ? 1 - (sk.braceTiming * Math.abs(tc - ideal)) / dur : 1 - sk.braceTiming;
      const sev = Math.min(1.6, vn / 0.5);
      const risk = (1 + (1 - S.health)) * (rs > 0.65 ? 1.3 : 1) * Math.min(1.6, Math.max(0.6, P.attack / 65));
      const reserve = A.braceCharges <= 1 && o.time < EXPECTED_DURATION * 0.4 ? 0.8 + 0.2 * (1 - sk.planning) : 1;
      cands.push({ kind: 'brace', utility: pe.brace * sev * timing * risk * reserve * this.know('brace'), req: { ability: 'brace' }, emergency: S.health < 0.25 });
    }

    if (canBoost && !lowStamina && o.time >= OPENING_HOLD) {
      // ------------------------------------------------- evade
      if (collide && vn > 0.2) {
        let px = -ny;
        let py = nx;
        if (px * -S.x + py * -S.y < -px * -S.x + -py * -S.y) {
          px = -px;
          py = -py;
        }
        // Blend a little toward the centre so an escape does not run into the rim.
        const cx = rs > 1e-3 ? -S.x / (rs * R) : 0;
        const cy = rs > 1e-3 ? -S.y / (rs * R) : 0;
        const sev = Math.min(1.5, vn / 0.5);
        const want = pe.evasion * sev * caution * (theirHit > myHit ? 1.2 : 0.8) * (tc > lat ? 1 : 0.35) * this.know('evade');
        cands.push({ kind: 'evade', utility: want, req: { ability: 'boost', dirX: px + 0.35 * cx, dirY: py + 0.35 * cy, strength: strengthFor(0.35 + 0.8 * vn, 0.45) } });
      }
      // ---------------------------------------------- centre recovery (knockout danger only)
      if (rs > 0.8 && outS > 0.1) {
        const cx = -S.x / (rs * R);
        const cy = -S.y / (rs * R);
        const danger = ((rs - 0.75) / 0.25) * (1 + 3 * outS) * (o.sinceContact < 0.4 ? 1.5 : 0.7);
        cands.push({ kind: 'recover', utility: pe.centerRecovery * danger * this.know('recover'), req: { ability: 'boost', dirX: cx, dirY: cy, strength: strengthFor(outS + 0.3) }, emergency: rs > 0.9 });
      }
      // ---------------------------------------- interception family
      if (!collide) {
        const plan = this.interceptPlan(S, P, dvMax);
        const reach = plan.need <= dvMax ? 1 : Math.max(0, 1 - (plan.need - dvMax) / (0.5 * dvMax));
        const close = Math.exp(-dist / (0.6 * R));
        const req: AbilityRequest = { ability: 'boost', dirX: plan.dvx, dirY: plan.dvy, strength: strengthFor(plan.need) };
        // Brace-then-boost combo: an attack that lands while braced trades favourably.
        const combo = canBrace && sk.planning >= 0.75 && P.attack >= 0.5 * S.attack;
        if (reach > 0) {
          cands.push({ kind: 'intercept', utility: pe.interception * reach * close * aggression * braceDeterrent * (0.6 + 0.6 * Math.max(0, adv)) * this.know('intercept'), req, comboBrace: combo && (this.opts.forceCombo || this.know('combo') > 1) });
          // Knockout attempt: the opponent is near the rim, I am well inside it and would hit it outward.
          const ox = ro > 1e-3 ? P.x / (ro * R) : 0;
          const oy = ro > 1e-3 ? P.y / (ro * R) : 0;
          const align = nx * ox + ny * oy;
          if (ro > 0.62 && align > 0.35 && rs < ro - 0.12) {
            const edge = ((ro - 0.55) / 0.45) ** 2;
            cands.push({ kind: 'knockout', utility: pe.knockout * edge * align * reach * Math.min(1.4, S.mass / P.mass) * 1.8 * braceDeterrent * this.know('knockout'), req: { ...req, strength: o.boostMaxStrength }, comboBrace: combo && (this.opts.forceCombo || this.know('combo') > 1) });
          }
          // Orbit break: nothing has happened for a while.
          if (o.sinceContact > pe.orbitPatience && o.time > 2) {
            cands.push({ kind: 'orbit', utility: pe.orbitBreak * reach * Math.min(1.4, 0.55 + (o.sinceContact - pe.orbitPatience) / 4) * this.know('orbit'), req });
          }
          // Counter-attack: right after an exchange, the opponent is close and not approaching.
          const gap = dist - cd;
          const closing = -(dx * rvx0 + dy * rvy0) / dist;
          if (o.sinceContact < 0.7 && gap < 0.03 && closing < 0.05) {
            cands.push({ kind: 'counter', utility: pe.counter * reach * (0.45 + 0.5 * Math.max(0, Math.min(2, dmgRatio) - 0.8)) * aggression * braceDeterrent * this.know('counter'), req });
          }
        }
      }
      // ---------------------------------------- poor decisions (low skill)
      if (this.u(t, 4) < sk.mistakeChance * 0.03 * sk.decisionInterval) {
        const ang = this.u(t, 5) * Math.PI * 2;
        cands.push({ kind: 'blunder', utility: 10, req: { ability: 'boost', dirX: Math.cos(ang), dirY: Math.sin(ang), strength: o.boostMinStrength + (o.boostMaxStrength - o.boostMinStrength) * this.u(t, 6) } });
      }
    }
    if (canBrace && !collide && this.u(t, 7) < sk.mistakeChance * 0.01 * sk.decisionInterval) cands.push({ kind: 'blunder', utility: 10, req: { ability: 'brace' } });

    // ------------------------------------------- rim safety (own path)
    // Skilled AIs check where their own boost would carry them: a path that
    // leaves the stadium before the tip drive stops it is a self-knockout.
    // Short-horizon kinematics only (current velocity, boost Δv, tip friction).
    const rimRisk = (req: AbilityRequest): number => {
      const l = Math.hypot(req.dirX ?? 0, req.dirY ?? 0);
      if (l < 1e-9) return 0;
      const dv = dvMax * ((req.strength ?? o.boostMaxStrength) / o.boostMaxStrength);
      const vx = S.vx + ((req.dirX ?? 0) / l) * dv;
      const vy = S.vy + ((req.dirY ?? 0) / l) * dv;
      const v2 = vx * vx + vy * vy;
      if (v2 < 1e-8) return 0;
      const reachD = v2 / (2 * Math.max(0.3, S.tipDecel));
      const v = Math.sqrt(v2);
      const ux = vx / v;
      const uy = vy / v;
      // Distance along the path to the 0.95 R circle.
      const lim = 0.95 * R;
      const pb = S.x * ux + S.y * uy;
      const pc = S.x * S.x + S.y * S.y - lim * lim;
      const disc = pb * pb - pc;
      if (disc < 0) return 0;
      const hit = -pb + Math.sqrt(disc);
      if (hit <= 0) return 1;
      return Math.max(0, Math.min(1, (reachD - hit) / Math.max(1e-6, 0.5 * hit) + 0.5));
    };
    for (const c of cands) {
      if (c.req.ability !== 'boost' || c.kind === 'blunder' || c.kind === 'recover') continue;
      const risk = rimRisk(c.req);
      // A knockout the matchup knowledge rates highly is worth the gamble when
      // the attacker is at least as heavy (it keeps control after the hit).
      const w = c.kind === 'knockout' ? (this.know('knockout') >= 1.5 && S.mass >= P.mass ? 0 : 0.6) : 0.9;
      if (risk > 0) c.utility *= 1 - w * sk.planning * risk;
    }

    // ------------------------------------------------ select
    let best: Candidate | null = null;
    let bestU = -Infinity;
    cands.forEach((c, i) => {
      let uu = c.utility * sk.activity;
      if (c.req.ability === 'boost' && c.kind !== 'blunder') {
        if (overBudget && !c.emergency) uu *= 0.4;
        uu *= 1 - 0.35 * pe.conservation * (1 - S.stamina);
      }
      uu += (this.u(t, 10 + i) * 2 - 1) * sk.noise;
      if (uu > bestU) {
        bestU = uu;
        best = c;
      }
    });
    const chosen = best as Candidate | null;
    if (!chosen || bestU < sk.threshold) return null;
    if (chosen.req.ability === 'boost' && chosen.kind !== 'blunder' && this.u(t, 8) < sk.mistakeChance) {
      // Poor execution: the boost goes out 40–90° off.
      const off = (40 + 50 * this.u(t, 9)) * (Math.PI / 180) * (this.u(t, 11) < 0.5 ? -1 : 1);
      const x = chosen.req.dirX ?? 1;
      const y = chosen.req.dirY ?? 0;
      return { ...chosen, req: { ...chosen.req, dirX: x * Math.cos(off) - y * Math.sin(off), dirY: x * Math.sin(off) + y * Math.cos(off) } };
    }
    return chosen;
  }

  private totalBoosts = -1;
  private usedBoosts(o: Observation): number {
    if (this.totalBoosts < 0) this.totalBoosts = o.self.abilities.boostCharges;
    return Math.max(0, this.totalBoosts - o.self.abilities.boostCharges);
  }
}
