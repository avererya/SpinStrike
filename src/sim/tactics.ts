/**
 * Tactical abilities (v0.5): Directional Boost and Defensive Brace.
 *
 * Architecture (see docs/TACTICAL_COMBAT_v0.5.md):
 *
 *   input (UI gesture / keyboard / AI / script)
 *        │  produces a TacticalCommand {tick, slot, ability, dir, strength}
 *        ▼
 *   validateCommand()   pure: is the ability available on this tick?
 *        ▼
 *   applyCommand()      mutates ONE body (impulse / brace window) and its
 *                       TacticalState; returns a presentation event
 *        ▼
 *   World.step()        normal physics; Brace is read by collision.ts and
 *                       combat.ts through TopBody.brace* fields
 *
 * Everything is keyed to simulation steps (ticks), never wall-clock time,
 * so cooldowns and durations pause with the simulation, and the same seed +
 * configuration + command list reproduces a battle exactly at any frame
 * rate or simulation speed. Nothing here reads the DOM.
 */
import type { TopBody } from './body';

export type AbilityId = 'boost' | 'brace';
export const ABILITY_IDS: readonly AbilityId[] = ['boost', 'brace'];

/** One ability activation (the unit of replay and of future network input). */
export interface TacticalCommand {
  /** Simulation step index at whose start the command is applied (world.steps). */
  readonly tick: number;
  /** Participant slot (0 = player side, 1 = opponent side). */
  readonly slot: number;
  readonly ability: AbilityId;
  /** Boost only: impulse direction in the simulation plane (normalised on use). */
  readonly dirX?: number;
  readonly dirY?: number;
  /** Boost only: normalised strength in [minStrength, maxStrength]. */
  readonly strength?: number;
}

export interface BoostParams {
  /** Charges per battle (no regeneration). */
  charges: number;
  /** Cooldown after an activation, s (simulation time). */
  cooldown: number;
  /** Weakest accepted strength (normalised). Shorter gestures are rejected, not rounded up. */
  minStrength: number;
  /** Strongest strength (normalised, 1 = 100 %). */
  maxStrength: number;
  /** Stamina cost at minStrength, fraction of the battle's launch rotational energy. */
  minCost: number;
  /** Stamina cost at maxStrength, fraction of the battle's launch rotational energy. */
  maxCost: number;
  /**
   * Impulse at strength 1 for a top with boostPower 1, N·s. Δv = J / m, so a
   * heavier top gains less speed from the same impulse.
   */
  impulse: number;
  /**
   * Upper bound on the share of the paid spin energy that may appear as
   * translational kinetic energy (≤ 1). Guarantees a boost never creates
   * energy; in practice the tip dissipates far more than this.
   */
  efficiency: number;
}

export interface BraceParams {
  charges: number;
  /** Active duration, s (simulation time). */
  duration: number;
  /** Cooldown, s, counted from activation. */
  cooldown: number;
  /** Fraction of incoming structural damage removed while active (0–0.9). */
  damageReduction: number;
  /** Fraction by which top–top contact impulses on a braced top are reduced (0–0.9). */
  knockbackReduction: number;
  /** Stamina cost, fraction of launch rotational energy (0 in v0.5). */
  staminaCost: number;
}

export interface TacticalParams {
  /** Master switch. Off = v0.4.1 passive combat, exactly. */
  enabled: boolean;
  boost: BoostParams;
  brace: BraceParams;
}

/** v0.5.0 starting values (provisional tuning parameters). */
/** Combat ruleset label recorded with battles played with tactical abilities. */
export const COMBAT_RULESET = 'v0.5.0';

export const DEFAULT_BOOST: Readonly<BoostParams> = Object.freeze({
  charges: 3,
  cooldown: 3,
  minStrength: 0.33,
  maxStrength: 1,
  minCost: 0.01,
  maxCost: 0.03,
  impulse: 0.06,
  efficiency: 0.9,
});

export const DEFAULT_BRACE: Readonly<BraceParams> = Object.freeze({
  charges: 2,
  duration: 1.5,
  cooldown: 5,
  damageReduction: 0.3,
  knockbackReduction: 0.25,
  staminaCost: 0,
});

export function defaultTacticalParams(enabled = true): TacticalParams {
  return { enabled, boost: { ...DEFAULT_BOOST }, brace: { ...DEFAULT_BRACE } };
}

/** Tactical abilities off (v0.4.1 combat). */
export const PASSIVE_TACTICS: Readonly<TacticalParams> = Object.freeze({ enabled: false, boost: DEFAULT_BOOST, brace: DEFAULT_BRACE });

/**
 * Per-top modifiers (future equipment / signature abilities). Every field is
 * optional; v0.5 never sets any, so all tops share the base parameters. Kept
 * here so later systems can extend abilities without touching the engine.
 */
export interface TacticalModifiers {
  boostCharges?: number;
  braceCharges?: number;
  /** Multipliers (1 = unchanged). */
  boostCooldownScale?: number;
  boostImpulseScale?: number;
  boostCostScale?: number;
  braceDurationScale?: number;
  braceCooldownScale?: number;
  braceDamageReductionAdd?: number;
  braceKnockbackReductionAdd?: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const fin = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Resolves base parameters + modifiers into the parameters of one top (sanitised). */
export function effectiveTactics(p: TacticalParams, m: TacticalModifiers = {}): { boost: BoostParams; brace: BraceParams } {
  const b = p.boost;
  const r = p.brace;
  const minS = clamp(fin(b.minStrength, 0.33), 0.01, 1);
  return {
    boost: {
      charges: Math.max(0, Math.floor(fin(b.charges, 0) + fin(m.boostCharges, 0))),
      cooldown: Math.max(0, fin(b.cooldown, 0) * fin(m.boostCooldownScale, 1)),
      minStrength: minS,
      maxStrength: clamp(fin(b.maxStrength, 1), minS, 1),
      minCost: Math.max(0, fin(b.minCost, 0) * fin(m.boostCostScale, 1)),
      maxCost: Math.max(0, fin(b.maxCost, 0) * fin(m.boostCostScale, 1)),
      impulse: Math.max(0, fin(b.impulse, 0) * fin(m.boostImpulseScale, 1)),
      efficiency: clamp(fin(b.efficiency, 0.9), 0, 1),
    },
    brace: {
      charges: Math.max(0, Math.floor(fin(r.charges, 0) + fin(m.braceCharges, 0))),
      duration: Math.max(0, fin(r.duration, 0) * fin(m.braceDurationScale, 1)),
      cooldown: Math.max(0, fin(r.cooldown, 0) * fin(m.braceCooldownScale, 1)),
      damageReduction: clamp(fin(r.damageReduction, 0) + fin(m.braceDamageReductionAdd, 0), 0, 0.9),
      knockbackReduction: clamp(fin(r.knockbackReduction, 0) + fin(m.braceKnockbackReductionAdd, 0), 0, 0.9),
      staminaCost: clamp(fin(r.staminaCost, 0), 0, 0.5),
    },
  };
}

/**
 * Stamina cost of a boost of normalised strength s, as a fraction of launch
 * rotational energy: linear from minCost at minStrength to maxCost at
 * maxStrength (33 % → 1 %, 66 % → ≈ 2 %, 100 % → 3 % by default).
 */
export function boostCostFraction(b: BoostParams, strength: number): number {
  const span = b.maxStrength - b.minStrength;
  const u = span > 1e-9 ? clamp((strength - b.minStrength) / span, 0, 1) : 1;
  return b.minCost + (b.maxCost - b.minCost) * u;
}

/** Live ability state of one participant (reset at every battle start). */
export interface TacticalState {
  boostCharges: number;
  braceCharges: number;
  /** First tick on which Boost may be used again. */
  boostReadyTick: number;
  braceReadyTick: number;
  /** Brace is active on ticks t with braceStartTick ≤ t < braceUntilTick. */
  braceStartTick: number;
  braceUntilTick: number;
  // --- statistics (observation only) ---
  boostsUsed: number;
  bracesUsed: number;
  /** Spin energy paid for boosts, J. */
  boostEnergy: number;
  /** Paid boost cost as a fraction of launch energy, summed (0.03 = 3 %). */
  boostCostFraction: number;
  boostStrengthSum: number;
  /** Impacts during which an active Brace reduced damage taken. */
  braceImpacts: number;
  /** Structural damage removed by Brace, HP. */
  damagePrevented: number;
  /** Tick of the latest boost (−1e9 = none). */
  lastBoostTick: number;
  /** Boosts followed by a damaging hit between the two tops within the attribution window. */
  boostsToHit: number;
  /** Ticks of every boost (for timing statistics). */
  boostTicks: number[];
  braceTicks: number[];
  /** Rejected activation attempts by reason (diagnostics; nothing is consumed). */
  rejected: Partial<Record<RejectReason, number>>;
}

export function makeTacticalState(b: BoostParams, r: BraceParams): TacticalState {
  return {
    boostCharges: b.charges,
    braceCharges: r.charges,
    boostReadyTick: 0,
    braceReadyTick: 0,
    braceStartTick: -1,
    braceUntilTick: -1,
    boostsUsed: 0,
    bracesUsed: 0,
    boostEnergy: 0,
    boostCostFraction: 0,
    boostStrengthSum: 0,
    braceImpacts: 0,
    damagePrevented: 0,
    lastBoostTick: -1e9,
    boostsToHit: 0,
    boostTicks: [],
    braceTicks: [],
    rejected: {},
  };
}

export type RejectReason =
  | 'disabled'
  | 'phase'
  | 'eliminated'
  | 'stopped'
  | 'cooldown'
  | 'charges'
  | 'stamina'
  | 'strength'
  | 'direction'
  | 'active'
  | 'slot'
  | 'tick';

export type Validation = { ok: true; strength: number; dirX: number; dirY: number; cost: number } | { ok: false; reason: RejectReason };

export function braceActive(s: TacticalState, tick: number): boolean {
  return tick >= s.braceStartTick && tick < s.braceUntilTick;
}

/**
 * Is `cmd` valid on `tick`? Pure. Checks everything the spec requires at
 * the moment of release: battle running, top in play and spinning, charges,
 * cooldown, stamina (a boost may never take the top to or below its
 * toppling energy), strength threshold and a usable direction.
 */
export function validateCommand(
  cmd: TacticalCommand,
  body: TopBody,
  state: TacticalState,
  eff: { boost: BoostParams; brace: BraceParams },
  tick: number,
  running: boolean,
): Validation {
  if (!running) return { ok: false, reason: 'phase' };
  if (body.eliminated !== null) return { ok: false, reason: 'eliminated' };
  if (!body.spinning) return { ok: false, reason: 'stopped' };
  if (cmd.ability === 'boost') {
    const b = eff.boost;
    if (state.boostCharges <= 0) return { ok: false, reason: 'charges' };
    if (tick < state.boostReadyTick) return { ok: false, reason: 'cooldown' };
    const s = cmd.strength;
    if (typeof s !== 'number' || !Number.isFinite(s) || s < b.minStrength - 1e-9) return { ok: false, reason: 'strength' };
    const dx = cmd.dirX ?? NaN;
    const dy = cmd.dirY ?? NaN;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1e-9) return { ok: false, reason: 'direction' };
    const strength = Math.min(b.maxStrength, s);
    const cost = boostCostFraction(b, strength) * body.launchEnergy;
    if (!(body.spinEnergy - cost > body.criticalEnergy)) return { ok: false, reason: 'stamina' };
    return { ok: true, strength, dirX: dx / len, dirY: dy / len, cost };
  }
  if (cmd.ability === 'brace') {
    const r = eff.brace;
    if (state.braceCharges <= 0) return { ok: false, reason: 'charges' };
    if (braceActive(state, tick)) return { ok: false, reason: 'active' };
    if (tick < state.braceReadyTick) return { ok: false, reason: 'cooldown' };
    const cost = r.staminaCost * body.launchEnergy;
    if (cost > 0 && !(body.spinEnergy - cost > body.criticalEnergy)) return { ok: false, reason: 'stamina' };
    return { ok: true, strength: 1, dirX: 0, dirY: 0, cost };
  }
  return { ok: false, reason: 'disabled' };
}

/** Presentation event for an accepted activation or a Brace state change. */
export interface TacticalEvent {
  kind: 'boost' | 'brace-start' | 'brace-end' | 'brace-impact' | 'rejected';
  slot: number;
  tick: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  strength: number;
  /** Boost: actual Δv, m/s. Brace impact: damage prevented, HP. */
  amount: number;
  reason?: RejectReason;
}

/**
 * Applies a VALIDATED boost to a body: an impulse J = s · J₀ · boostPower
 * along the gesture direction, so Δv = J/m adds to the current velocity
 * (never replaces it). The stamina cost is removed from spin. If the gain
 * in translational kinetic energy would exceed `efficiency` × the paid
 * energy, Δv is scaled down so the ability can never create energy.
 * Returns the applied |Δv|.
 */
export function applyBoost(body: TopBody, b: BoostParams, strength: number, dirX: number, dirY: number, cost: number): number {
  const power = Number.isFinite(body.params.boostPower) && body.params.boostPower! > 0 ? body.params.boostPower! : 1;
  const J = strength * b.impulse * power;
  let dvx = dirX * J * body.invMass;
  let dvy = dirY * J * body.invMass;
  const m = body.params.mass;
  const vx = body.vx;
  const vy = body.vy;
  const gain = 0.5 * m * ((vx + dvx) ** 2 + (vy + dvy) ** 2 - vx * vx - vy * vy);
  const cap = b.efficiency * cost;
  if (gain > cap) {
    // Solve ½m(|v + λΔv|² − |v|²) = cap for λ ∈ (0, 1].
    const a = dvx * dvx + dvy * dvy;
    const bb = 2 * (vx * dvx + vy * dvy);
    const c = (-2 * cap) / m;
    const disc = bb * bb - 4 * a * c;
    const lambda = a > 0 && disc >= 0 ? Math.max(0, Math.min(1, (-bb + Math.sqrt(disc)) / (2 * a))) : 0;
    dvx *= lambda;
    dvy *= lambda;
  }
  body.vx += dvx;
  body.vy += dvy;
  body.removeSpinEnergy(cost);
  return Math.hypot(dvx, dvy);
}

/** Read-only view of a participant's ability state (HUD, AI observation). */
export interface AbilityView {
  boostCharges: number;
  braceCharges: number;
  /** Seconds until Boost is off cooldown (0 = ready). */
  boostCooldown: number;
  braceCooldown: number;
  /** Seconds of Brace remaining (0 = inactive). */
  braceRemaining: number;
  braceActive: boolean;
  /** Fraction of the cooldown elapsed (1 = ready). */
  boostCooldownProgress: number;
  braceCooldownProgress: number;
  /** True when a full-cost minimum boost would be accepted now (charges, cooldown, stamina). */
  boostAvailable: boolean;
  braceAvailable: boolean;
  /** Why Boost / Brace is unavailable (null when available). */
  boostBlocked: RejectReason | null;
  braceBlocked: RejectReason | null;
}

/** Attribution windows used by tactical statistics (simulation seconds). */
export const ATTRIBUTION = {
  /** A damaging hit between the two tops within this time after a boost counts as "boost → hit". */
  boostToHit: 1.0,
  /** A knockout of the opponent within this time after the booster's last boost (with a damaging hit in between) counts as "boost → knockout". */
  boostToKnockout: 1.5,
} as const;

/** An ability request from an input source (the battle stamps tick and slot). */
export interface AbilityRequest {
  ability: AbilityId;
  dirX?: number;
  dirY?: number;
  strength?: number;
}

/**
 * A tactical decision-maker for one slot (AI, or any scripted policy).
 * Called at every step boundary while the battle is running; `observe`
 * builds the legitimate observation lazily (agents that are not deciding on
 * this tick never pay for it). Must be deterministic given its
 * construction parameters and the observations it receives.
 */
export interface TacticalAgent {
  tick(tick: number, observe: () => import('./observation').Observation): readonly AbilityRequest[] | null;
}

/** Per-participant tactical summary recorded in the battle result. */
export interface TacticalTopSummary {
  boostsUsed: number;
  bracesUsed: number;
  boostsLeft: number;
  bracesLeft: number;
  /** Spin energy spent on boosts, J, and as a fraction of launch energy. */
  boostEnergy: number;
  boostCost: number;
  /** Mean normalised boost strength (0 when unused). */
  avgStrength: number;
  braceImpacts: number;
  damagePrevented: number;
  boostsToHit: number;
  /** The opponent was knocked out within the attribution window after this top's boost, with a hit in between. */
  boostKnockout: boolean;
  /** Simulation times of activations, s. */
  boostTimes: readonly number[];
  braceTimes: readonly number[];
  rejected: Readonly<Partial<Record<RejectReason, number>>>;
}

export interface TacticalSummary {
  enabled: boolean;
  /** Accepted commands in application order: with the seed and configuration, a complete replay. */
  commands: readonly TacticalCommand[];
  tops: readonly TacticalTopSummary[];
}
