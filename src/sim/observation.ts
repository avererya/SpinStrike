/**
 * What a tactical agent (AI) may observe (v0.5). Built by the simulation
 * from the current state only: positions, velocities, health, stamina,
 * ability state, stadium geometry and each top's PUBLIC physical
 * characteristics. It deliberately contains no seed, RNG state, impact
 * counter, future input or anything else that would let an agent predict
 * random outcomes (critical hits) or read the other side's intentions.
 */
import type { World } from './world';
import type { AbilityView } from './tactics';

export interface TopObservation {
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  /** Health fraction 0–1. */
  health: number;
  /** Usable stamina fraction 0–1 (HUD value). */
  stamina: number;
  active: boolean;
  spinning: boolean;
  abilities: AbilityView;
  /** Boost authority (from Speed), public stat-derived characteristic. */
  boostPower: number;
  /** Attack / defense values (shown to the player in the garage). */
  attack: number;
  defense: number;
  /**
   * Approximate sliding deceleration of this top's tip when pushed off its
   * driven path, m/s² (tip traction × local floor friction × g). A plain
   * physical characteristic of the part, used to plan how far a boost carries.
   */
  tipDecel: number;
}

export interface Observation {
  /** Current simulation step and time, s. */
  tick: number;
  time: number;
  stepHz: number;
  /** Stadium bounding radius (play area), m. */
  arenaRadius: number;
  self: TopObservation;
  opponent: TopObservation;
  /** Simulation seconds since the two tops last touched (∞ before the first contact). */
  sinceContact: number;
  /** Boost impulse at strength 1 for power 1, N·s, and the strength range. */
  boostImpulse: number;
  boostMinStrength: number;
  boostMaxStrength: number;
  boostMinCost: number;
  boostMaxCost: number;
  braceDuration: number;
}

function top(w: World, slot: number): TopObservation {
  const b = w.bodies[slot]!;
  return {
    slot,
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    radius: b.params.radius,
    mass: b.params.mass,
    health: b.healthFraction,
    stamina: b.staminaFraction,
    active: b.eliminated === null,
    spinning: b.spinning,
    abilities: w.abilityView(slot),
    boostPower: b.params.boostPower ?? 1,
    attack: b.combat.attack,
    defense: b.combat.defense,
    tipDecel: b.params.tipTraction * w.stadium.friction(b.x, b.y) * 9.81,
  };
}

export function observe(w: World, slot: number): Observation {
  const other = slot === 0 ? 1 : 0;
  const lc = w.telemetry.lastContactStep;
  const e = w.abilityParams[slot]!;
  return {
    tick: w.steps,
    time: w.time,
    stepHz: w.stepHz,
    arenaRadius: w.stadium.boundingRadius,
    self: top(w, slot),
    opponent: top(w, other),
    sinceContact: lc < 0 ? Infinity : (w.steps - lc) / w.stepHz,
    boostImpulse: e.boost.impulse,
    boostMinStrength: e.boost.minStrength,
    boostMaxStrength: e.boost.maxStrength,
    boostMinCost: e.boost.minCost,
    boostMaxCost: e.boost.maxCost,
    braceDuration: e.brace.duration,
  };
}
