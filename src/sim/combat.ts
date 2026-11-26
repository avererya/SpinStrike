import type { TopBody } from './body';
import { GRAVITY } from './units';
import { RNG_STREAM, keyedUniform } from './rng';

/**
 * Combat layer (v0.2): structural damage (health), burst detection and
 * physical knockouts.
 *
 * The physics (collision.ts) never reads health. After it resolves a
 * contact, it fills a {@link ContactReport} describing the impact using
 * the PRE-impulse state. This module turns that report into damage. Health
 * therefore cannot feed back into movement, and the approved v0.1 motion
 * is unchanged until a finish removes a top from play.
 *
 * ## Damage formula (per damaging impact, attacker A → defender B)
 *
 *   gate    : no damage unless vₙ > v_min           (minimum damaging impact speed, m/s)
 *   v_blade = ringStrike_A · |ω_A| · r_A · x_B      A's blade (rotational) strike speed, m/s
 *                                                  (x_B = B's ring blade exposure, 1 unless set; v0.3)
 *   E_A     = ½ · μ · vₙ · (k_imp · vₙ + k_rot · v_blade)   strike energy, J
 *   x       = (E_A / E_ref)^p                       impact severity (dimensionless)
 *   S       = x / (1 + x / x_cap)                   soft cap: ≈ x for normal hits, → x_cap for extreme ones
 *   f_att   = attack_A / attack_ref                 linear attack scaling
 *   f_def   = K / (K + e · defense_B)               bounded, diminishing-returns defense
 *   damage  = G · f_att · f_def · S                 health points
 *
 * μ = m_A·m_B/(m_A+m_B) is the reduced (effective collision) mass, vₙ the
 * relative approach speed along the contact normal. Glancing contacts have
 * small vₙ, so they do little damage even when the rings slip fast. The
 * blade term is multiplied by vₙ, so a spinning ring alone cannot damage without
 * an actual impact. All terms are ≥ 0 and finite by construction. f_def
 * never reaches 0 for any finite defense, so no build can become invulnerable.
 */
export interface CombatParams {
  /** G: global damage scale, health points per unit of capped severity. */
  damageScale: number;
  /** k_imp: weight of the translational impact term. */
  impactScale: number;
  /** k_rot: weight of the rotational blade-strike term. */
  rotationalContribution: number;
  /** E_ref: strike energy that counts as severity 1, J. */
  energyReference: number;
  /** p: severity exponent. x = (E/E_ref)^p. p < 1 compresses the range between light and heavy hits. */
  severityExponent: number;
  /** x_cap: soft cap on severity (limits the damage from extreme hits). */
  severityCap: number;
  /** attack_ref: attack value at which f_att = 1. */
  attackReference: number;
  /** e: defense effectiveness. */
  defenseEffectiveness: number;
  /** K: defense half-value constant. Defense K/e halves damage. */
  defenseReference: number;
  /** v_min: approach speed that must be exceeded before an impact damages, m/s. */
  minImpactSpeed: number;
  /** Separation beyond touching that re-arms a contact for a new impact, m. */
  rearmDistance: number;
  /** Minimum time between damaging impacts within one sustained contact, s. */
  rearmTime: number;

  // --- knockout (rim escape) ---
  /** Enables rim escape (knockout) checks. */
  knockouts: boolean;
  /** Share of the rim-directed velocity that becomes vertical hop speed (0–1). */
  rimClimbEfficiency: number;
  /** Share of a recent top–top impact's Δv that becomes upward lift (0–1). */
  impactLift: number;
  /** Time after a top–top impact during which its lift still applies, s. */
  liftWindow: number;
  /** Extra lip clearance required per unit stability (stable tops stay down). */
  stabilityLipFactor: number;

  // --- critical hits (v0.3) ---
  /** Enables critical-hit rolls on damaging impacts. Off = v0.2 damage exactly. */
  criticalHits: boolean;
}

export const DEFAULT_COMBAT: CombatParams = {
  damageScale: 54,
  impactScale: 1,
  rotationalContribution: 9.4,
  energyReference: 0.005,
  severityExponent: 0.4,
  severityCap: 2.45,
  attackReference: 65,
  defenseEffectiveness: 0.5,
  defenseReference: 100,
  minImpactSpeed: 0.03,
  rearmDistance: 0.001,
  rearmTime: 0.08,
  knockouts: true,
  rimClimbEfficiency: 0.8,
  impactLift: 0.7,
  liftWindow: 0.25,
  stabilityLipFactor: 0.5,
  criticalHits: true,
};

/** v0.2 combat parameters, kept for the legacy ruleset and regression runs. */
export const LEGACY_V02_COMBAT: CombatParams = {
  damageScale: 50,
  impactScale: 1,
  rotationalContribution: 10,
  energyReference: 0.005,
  severityExponent: 0.5,
  severityCap: 2,
  attackReference: 65,
  defenseEffectiveness: 0.5,
  defenseReference: 100,
  minImpactSpeed: 0.03,
  rearmDistance: 0.001,
  rearmTime: 0.08,
  knockouts: true,
  rimClimbEfficiency: 0.8,
  impactLift: 0.7,
  liftWindow: 0.25,
  stabilityLipFactor: 0.5,
  criticalHits: false,
};

/** A hit counts as "landed" (HUD / statistics) when it deals at least this much damage. */
export const LANDED_HIT_MIN = 1;

/** Per-top combat values (from gameplay stats via derive.ts, or overrides). */
export interface TopCombatStats {
  maxHealth: number;
  attack: number;
  defense: number;
  /** Probability (0–1) that a damaging impact by this top is a critical hit (v0.3). */
  critChance: number;
  /** Structural-damage multiplier of this top's critical hits (v0.3). */
  critMultiplier: number;
}

/** Base critical chance of every starter top (provisional). */
export const BASE_CRIT_CHANCE = 0.05;
/** Critical damage multiplier (provisional). */
export const BASE_CRIT_MULTIPLIER = 2;
/** Proposed future cap on upgraded critical chance (not used by the engine yet). */
export const MAX_CRIT_CHANCE = 0.25;
/** Proposed future critical-chance gain per upgrade level (not implemented yet). */
export const CRIT_CHANCE_PER_UPGRADE = 0.02;

export const DEFAULT_TOP_COMBAT: TopCombatStats = {
  maxHealth: 650,
  attack: 65,
  defense: 65,
  critChance: BASE_CRIT_CHANCE,
  critMultiplier: BASE_CRIT_MULTIPLIER,
};

export type FinishKind = 'burst' | 'knockout' | 'spin';

/** Data about one top–top contact, written by the physics (pre-impulse values). */
export interface ContactReport {
  /** True when a contact was resolved this call (bodies overlapping). */
  active: boolean;
  /** Relative approach speed along the normal before the impulse, m/s (> 0 approaching). */
  vn: number;
  /** Relative tangential slip at the contact, m/s. */
  vt: number;
  /** Reduced mass, kg. */
  reducedMass: number;
  /** Normal impulse applied, N·s (0 if the bodies were separating). */
  jn: number;
  /** Spin of each body before the impulse, rad/s. */
  omegaA: number;
  omegaB: number;
  /** Contact normal from A to B and contact point. */
  nx: number;
  ny: number;
  x: number;
  y: number;
}

export function makeContactReport(): ContactReport {
  return { active: false, vn: 0, vt: 0, reducedMass: 0, jn: 0, omegaA: 0, omegaB: 0, nx: 1, ny: 0, x: 0, y: 0 };
}

/** Damage-tracking state for one pair of tops. */
export interface PairCombatState {
  armed: boolean;
  lastImpactStep: number;
}

export function makePairState(): PairCombatState {
  return { armed: true, lastImpactStep: -1e9 };
}

/** One damaging impact (for effects, HUD and statistics). */
export interface DamageEvent {
  step: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  a: number;
  b: number;
  /** Damage dealt to A (by B) and to B (by A), critical multiplier included. */
  damageToA: number;
  damageToB: number;
  /** True when the damage to A (dealt by B) / to B (dealt by A) was a critical hit. */
  critToA: boolean;
  critToB: boolean;
  /** Normal approach speed, m/s. */
  normalSpeed: number;
  /** Index of this damaging impact in the battle (keys the critical rolls). */
  impact: number;
}

export function makeDamageEvent(): DamageEvent {
  return { step: 0, x: 0, y: 0, nx: 0, ny: 0, a: 0, b: 0, damageToA: 0, damageToB: 0, critToA: false, critToB: false, normalSpeed: 0, impact: 0 };
}

/**
 * Critical-hit roll for one attacker in one damaging impact. Event-keyed:
 * the uniform comes from hash(stream, seed, impact index, attacker slot),
 * so it is independent of frame rate, simulation speed, rendering and every
 * other random decision, and switching critical hits off leaves all other
 * randomness untouched. Each top rolls independently.
 */
export function critRoll(seed: number, impact: number, attackerSlot: number): number {
  return keyedUniform(RNG_STREAM.critical, seed >>> 0, impact >>> 0, attackerSlot >>> 0);
}

/** Resolves a critical hit: returns true when the roll succeeds. */
export function isCritical(chance: number, roll: number): boolean {
  const c = Number.isFinite(chance) ? Math.min(1, Math.max(0, chance)) : 0;
  return roll < c;
}

function finite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/** Linear attack factor (≥ 0). */
export function attackFactor(attack: number, p: CombatParams): number {
  const ref = p.attackReference > 1e-9 ? p.attackReference : 1e-9;
  return Math.max(0, finite(attack)) / ref;
}

/** Bounded defense factor in (0, 1]: K / (K + e·defense). */
export function defenseFactor(defense: number, p: CombatParams): number {
  const K = Math.max(1e-9, finite(p.defenseReference));
  const ed = Math.max(0, finite(p.defenseEffectiveness)) * Math.max(0, finite(defense));
  return K / (K + ed);
}

/** Strike energy delivered by the attacker (J), see the module docs. */
export function strikeEnergy(
  vn: number,
  reducedMass: number,
  attackerRingStrike: number,
  attackerOmega: number,
  attackerRadius: number,
  p: CombatParams,
  defenderExposure = 1,
): number {
  const v = finite(vn);
  if (!(v > Math.max(0, p.minImpactSpeed))) return 0;
  const exposure = Number.isFinite(defenderExposure) ? Math.min(1, Math.max(0, defenderExposure)) : 1;
  const blade = Math.max(0, finite(attackerRingStrike)) * Math.abs(finite(attackerOmega)) * Math.max(0, attackerRadius) * exposure;
  const e = 0.5 * Math.max(0, finite(reducedMass)) * v * (Math.max(0, p.impactScale) * v + Math.max(0, p.rotationalContribution) * blade);
  return Math.max(0, finite(e));
}

/** Soft-capped severity: ≈ x for small x, approaches cap for large x. */
export function softCap(x: number, cap: number): number {
  if (!(x > 0)) return 0;
  if (!(cap > 0)) return x;
  return x / (1 + x / cap);
}

function clampExp(e: number): number {
  return Number.isFinite(e) ? Math.min(2, Math.max(0.1, e)) : 1;
}

/** Full damage formula. Always finite and ≥ 0. */
export function computeDamage(
  energy: number,
  attackerAttack: number,
  defenderDefense: number,
  p: CombatParams,
): number {
  const eRef = Math.max(1e-12, finite(p.energyReference));
  const ratio = Math.max(0, finite(energy)) / eRef;
  const sev = softCap(Math.pow(ratio, clampExp(p.severityExponent)), p.severityCap);
  const d = Math.max(0, finite(p.damageScale)) * attackFactor(attackerAttack, p) * defenseFactor(defenderDefense, p) * sev;
  return Math.max(0, finite(d));
}

/**
 * Applies combat for one resolved contact between A and B. Returns a
 * damage event when the contact counts as a new damaging impact.
 *
 * Contact lifecycle: a pair is "armed" initially and re-arms once the rings
 * separate by more than `rearmDistance`. An armed approach above the speed
 * threshold is an impact; afterwards the pair is disarmed, so the dozens of
 * physics updates of one sustained contact cannot each deal damage. During
 * a continuous contact (never separating enough to re-arm), a genuinely new
 * approach above the threshold still counts once `rearmTime` has elapsed
 * since the previous impact, so rapid legitimate re-hits are not lost.
 *
 * Damage to both tops is computed from the same pre-impulse report and
 * applied together, so slot order cannot favour either top.
 */
export function applyContactDamage(
  A: TopBody,
  B: TopBody,
  r: ContactReport,
  pair: PairCombatState,
  p: CombatParams,
  step: number,
  stepHz: number,
  out: DamageEvent,
  seed = 0,
  impact = 0,
): boolean {
  if (!r.active || r.vn <= p.minImpactSpeed) return false;
  if (A.eliminated || B.eliminated) return false;
  const rearmSteps = Math.max(0, p.rearmTime) * stepHz;
  if (!pair.armed && step - pair.lastImpactStep < rearmSteps) return false;
  pair.armed = false;
  pair.lastImpactStep = step;

  const eA = strikeEnergy(r.vn, r.reducedMass, A.params.ringStrike, r.omegaA, A.params.radius, p, B.params.bladeExposure ?? 1);
  const eB = strikeEnergy(r.vn, r.reducedMass, B.params.ringStrike, r.omegaB, B.params.radius, p, A.params.bladeExposure ?? 1);
  // A spun-out (toppled) top no longer strikes with its blades or attacks.
  const baseToB = A.spinning ? computeDamage(eA, A.combat.attack, B.combat.defense, p) : 0;
  const baseToA = B.spinning ? computeDamage(eB, B.combat.attack, A.combat.defense, p) : 0;
  if (baseToA <= 0 && baseToB <= 0) return false;

  // Critical hits (v0.3): rolled once per legitimate damaging impact, per
  // attacker, AFTER the normal damage is known. They scale structural damage
  // only; the impulse, spin exchange and trajectories were already resolved
  // by the physics from the same pre-impact state and are not touched.
  let critB = false;
  let critA = false;
  if (p.criticalHits) {
    if (baseToB > 0) critB = isCritical(A.combat.critChance, critRoll(seed, impact, A.index));
    if (baseToA > 0) critA = isCritical(B.combat.critChance, critRoll(seed, impact, B.index));
  }
  const toB = critB ? finite(baseToB * Math.max(1, finite(A.combat.critMultiplier))) : baseToB;
  const toA = critA ? finite(baseToA * Math.max(1, finite(B.combat.critMultiplier))) : baseToA;

  applyHit(B, A, toB, step, r.nx, r.ny, critB);
  applyHit(A, B, toA, step, -r.nx, -r.ny, critA);

  // Impact-induced lift bookkeeping for rim escape (Δv = jn / m).
  A.lastImpactStep = step;
  B.lastImpactStep = step;
  A.lastImpactDv = finite(r.jn * A.invMass);
  B.lastImpactDv = finite(r.jn * B.invMass);

  out.step = step;
  out.x = r.x;
  out.y = r.y;
  out.nx = r.nx;
  out.ny = r.ny;
  out.a = A.index;
  out.b = B.index;
  out.damageToA = toA;
  out.damageToB = toB;
  out.critToA = critA;
  out.critToB = critB;
  out.normalSpeed = r.vn;
  out.impact = impact;
  return true;
}

function applyHit(target: TopBody, source: TopBody, dmg: number, step: number, dirX: number, dirY: number, crit = false): void {
  if (dmg <= 0) return;
  const applied = Math.min(dmg, target.health);
  target.health = Math.max(0, target.health - dmg);
  target.damageReceived += applied;
  source.damageDealt += applied;
  if (dmg >= LANDED_HIT_MIN) source.hitsLanded++;
  source.damagingHits++;
  if (crit) {
    source.critsLanded++;
    target.critsReceived++;
    source.critDamageDealt += applied;
  }
  if (dmg > source.strongestHit) {
    source.strongestHit = dmg;
    source.strongestHitCritical = crit;
  }
  if (target.health <= 0 && !target.eliminated) {
    target.eliminated = 'burst';
    target.eliminatedStep = step + 1;
    target.finishSource = source.index;
    target.finishIntensity = dmg;
    target.finishDirX = dirX;
    target.finishDirY = dirY;
  }
}

/** Re-arms a pair once its rings have separated far enough. */
export function updatePairArming(A: TopBody, B: TopBody, pair: PairCombatState, p: CombatParams): void {
  if (pair.armed) return;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const gap = Math.sqrt(dx * dx + dy * dy) - A.params.radius - B.params.radius;
  if (gap > p.rearmDistance) pair.armed = true;
}

/**
 * Rim escape (knockout) check for a wall impact. 2.5D approximation:
 *
 *   s      = |∇h| at the top's position (local rim slope)
 *   v_up   = η_climb · vₙ,out · s/√(1+s²)  +  λ_lift · Δv_impact (if a top–top hit landed within the lift window)
 *   h_hop  = v_up² / (2g)                  ballistic hop height
 *   h_need = lip · (1 + k_stab · stability)
 *   escape ⇔ h_hop > h_need
 *
 * The outward speed along the steep rim face is what lifts a top over the
 * lip. A recent heavy strike adds upward speed scaled by Δv = J/m, so heavy
 * tops are lifted less. Stability raises the clearance needed (a stable top
 * stays seated). Only actual wall impacts with outward velocity qualify,
 * never mere positional overlap. Mechanical energy is respected: the hop
 * speed is derived from the top's current velocity, which already paid for
 * climbing the bowl (slope gravity in dynamics.ts).
 */
export function rimEscape(
  b: TopBody,
  vnOut: number,
  slope: number,
  lipHeight: number,
  step: number,
  stepHz: number,
  p: CombatParams,
): number {
  if (!p.knockouts || vnOut <= 0 || b.eliminated) return 0;
  const s = Math.max(0, finite(slope));
  let vUp = Math.max(0, p.rimClimbEfficiency) * vnOut * (s / Math.sqrt(1 + s * s));
  if (step - b.lastImpactStep <= p.liftWindow * stepHz) vUp += Math.max(0, p.impactLift) * b.lastImpactDv;
  const hop = (vUp * vUp) / (2 * GRAVITY);
  const need = Math.max(0, lipHeight) * (1 + Math.max(0, p.stabilityLipFactor) * b.params.stability);
  return hop > need ? vUp : 0;
}
