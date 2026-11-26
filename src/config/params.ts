/**
 * Specifications for every developer-tunable parameter. Used both to build
 * the developer panel and to validate imported JSON, so ranges live in one
 * place.
 */
export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
}

export const STADIUM_PARAMS = [
  { key: 'slope', label: 'Stadium slope (bowl depth)', min: 0, max: 0.08, step: 0.001, unit: 'm', help: 'Height of the bowl edge above the centre. 0 = flat floor.' },
  { key: 'surfaceFriction', label: 'Surface friction', min: 0, max: 3, step: 0.05, unit: '×', help: 'Multiplier on tip traction, pivot friction and rolling resistance.' },
  { key: 'wallRestitution', label: 'Wall restitution', min: 0, max: 1, step: 0.01, unit: '', help: 'Bounciness of the outer wall.' },
  { key: 'rimLipHeight', label: 'Rim lip height', min: 0, max: 0.05, step: 0.001, unit: 'm', help: 'Height of the lip above the rim edge. A top must hop higher than this (raised by stability) to be knocked out. Also sets the drawn wall height.' },
] as const satisfies readonly ParamSpec[];

export const COLLISION_PARAMS = [
  { key: 'restitution', label: 'Collision restitution', min: 0, max: 1, step: 0.01, unit: '', help: 'Global top–top bounciness (scaled per top by defense).' },
  { key: 'energyLoss', label: 'Collision energy loss', min: 0, max: 3, step: 0.05, unit: '×', help: 'Extra spin energy removed per unit of impact energy.' },
  { key: 'statSpinDrainWeight', label: 'Combat spin drain (stat weight)', min: 0, max: 1, step: 0.05, unit: '', help: 'How much attack/defense change impact spin loss (v0.1 = 1). Lowered in v0.2 because attack and defense now act through health damage.' },
] as const satisfies readonly ParamSpec[];

export const COMBAT_PARAMS = [
  { key: 'damageScale', label: 'Global damage scale', min: 0, max: 200, step: 0.5, unit: 'HP', help: 'G: health points per unit of impact severity.' },
  { key: 'impactScale', label: 'Impact damage scale', min: 0, max: 5, step: 0.05, unit: '×', help: 'k_imp: weight of the translational impact term (½·μ·v′²).' },
  { key: 'rotationalContribution', label: 'Rotational damage contribution', min: 0, max: 40, step: 0.5, unit: '×', help: 'k_rot: weight of the blade strike term (ring strike × ring surface speed).' },
  { key: 'defenseEffectiveness', label: 'Defense effectiveness', min: 0, max: 5, step: 0.05, unit: '×', help: 'e in K/(K + e·defense). Higher = defense reduces more (never to zero).' },
  { key: 'defenseReference', label: 'Defense half-value (K)', min: 1, max: 1000, step: 1, unit: '', help: 'Defense K/e halves incoming damage.' },
  { key: 'attackReference', label: 'Attack reference', min: 1, max: 200, step: 1, unit: '', help: 'Attack value that gives a 1× attack factor.' },
  { key: 'energyReference', label: 'Severity reference energy', min: 0.0001, max: 0.1, step: 0.0001, unit: 'J', help: 'Strike energy that counts as severity 1.' },
  { key: 'severityExponent', label: 'Severity exponent', min: 0.1, max: 2, step: 0.05, unit: '', help: 'p in x = (E/E_ref)^p. Below 1 compresses the gap between light and heavy hits.' },
  { key: 'severityCap', label: 'Damage spike cap', min: 0.5, max: 100, step: 0.5, unit: '', help: 'Soft cap on severity: x/(1+x/cap). Limits damage from extreme impacts.' },
  { key: 'minImpactSpeed', label: 'Minimum damaging impact speed', min: 0, max: 1, step: 0.01, unit: 'm/s', help: 'Approach speed below which contacts do no damage. Subtracted from the speed used in the formula.' },
  { key: 'rearmDistance', label: 'Contact re-arm separation', min: 0, max: 0.02, step: 0.0005, unit: 'm', help: 'Gap the rings must open before a new contact can damage again.' },
  { key: 'rearmTime', label: 'Contact re-arm time', min: 0, max: 1, step: 0.01, unit: 's', help: 'Within one sustained contact, a new hard approach can damage again after this time.' },
  { key: 'rimClimbEfficiency', label: 'Rim climb efficiency', min: 0, max: 1.5, step: 0.05, unit: '', help: 'Share of outward speed along the rim slope that becomes vertical hop speed.' },
  { key: 'impactLift', label: 'Impact lift', min: 0, max: 2, step: 0.05, unit: '', help: 'Share of a recent hit’s Δv (= J/m) that lifts the top toward the lip.' },
  { key: 'liftWindow', label: 'Impact lift window', min: 0, max: 2, step: 0.05, unit: 's', help: 'How long after a hit its lift still counts at the wall.' },
  { key: 'stabilityLipFactor', label: 'Stability lip factor', min: 0, max: 5, step: 0.05, unit: '', help: 'Extra hop height needed per unit stability: lip·(1 + k·stability).' },
] as const satisfies readonly ParamSpec[];

/** Per-top combat values (overridable per slot). */
export const TOP_COMBAT_PARAMS = [
  { key: 'maxHealth', label: 'Maximum health', min: 1, max: 5000, step: 1, unit: 'HP', help: 'Structural integrity. 0 health = burst finish.' },
  { key: 'attack', label: 'Attack', min: 0, max: 300, step: 1, unit: '', help: 'Scales outgoing damage linearly (combat only; physical parts unchanged).' },
  { key: 'defense', label: 'Defense', min: 0, max: 300, step: 1, unit: '', help: 'Reduces incoming damage with diminishing returns (combat only).' },
  { key: 'critChance', label: 'Critical chance', min: 0, max: 1, step: 0.01, unit: '', help: 'Probability that a damaging impact by this top is a critical hit (0.05 = 5 %).' },
  { key: 'critMultiplier', label: 'Critical damage multiplier', min: 1, max: 10, step: 0.05, unit: '×', help: 'Structural damage multiplier of a critical hit. Never changes impulse or spin.' },
] as const satisfies readonly ParamSpec[];

export const TOP_PARAMS = [
  { key: 'mass', label: 'Mass', min: 0.01, max: 0.12, step: 0.001, unit: 'kg', help: 'Heavier tops are displaced less by impacts.' },
  { key: 'launchSpinEnergy', label: 'Initial rotational energy', min: 0.2, max: 8, step: 0.05, unit: 'J', help: 'Spin kinetic energy at launch.' },
  { key: 'launchSpeed', label: 'Initial translational velocity', min: 0, max: 3, step: 0.05, unit: 'm/s', help: 'Launch speed across the bowl.' },
  { key: 'tipTraction', label: 'Tip friction (traction)', min: 0, max: 1.5, step: 0.01, unit: 'μ', help: 'Grip of the tip; converts spin into movement.' },
  { key: 'spinDecay', label: 'Rotational energy decay', min: 0, max: 4, step: 0.05, unit: '×', help: 'Multiplier on passive spin friction and air drag.' },
  { key: 'stability', label: 'Stability', min: 0, max: 1, step: 0.01, unit: '', help: 'Resists wobble and tilt kicks; lowers toppling speed.' },
  { key: 'wobbleIntensity', label: 'Wobble intensity', min: 0, max: 1, step: 0.01, unit: 'rad', help: 'How strongly wobble grows as spin runs down.' },
] as const satisfies readonly ParamSpec[];

export type StadiumParamKey = (typeof STADIUM_PARAMS)[number]['key'];
export type CollisionParamKey = (typeof COLLISION_PARAMS)[number]['key'];
export type TopParamKey = (typeof TOP_PARAMS)[number]['key'];
export type CombatParamKey = (typeof COMBAT_PARAMS)[number]['key'];
export type TopCombatParamKey = (typeof TOP_COMBAT_PARAMS)[number]['key'];
export type LaunchParamKey = (typeof LAUNCH_PARAMS)[number]['key'];
export type ResultParamKey = (typeof RESULT_PARAMS)[number]['key'];
export type TopOverrideKey = TopParamKey | TopCombatParamKey;

/** Boolean switches stored in the configuration. */
export const FLAG_PARAMS = [
  { key: 'knockouts', group: 'combat', label: 'Knockouts (rim escape)', help: 'Allow tops to be knocked over the rim.' },
  { key: 'cinematicFinishes', group: 'presentation', label: 'Cinematic finishes', help: 'Slow motion, flash and finish banners (presentation only).' },
  { key: 'damageNumbers', group: 'presentation', label: 'Floating damage numbers', help: 'Show damage numbers above damaging hits.' },
  { key: 'criticalEffects', group: 'presentation', label: 'Critical hit effects', help: 'Golden damage numbers, CRITICAL HIT label and stronger sparks for critical hits.' },
  { key: 'criticalHits', group: 'combat', label: 'Critical hits', help: 'Enable critical-hit rolls on damaging impacts.' },
] as const;

/** Launch minigame / launch quality numeric settings (v0.3). */
export const LAUNCH_PARAMS = [
  { key: 'sweepTime', label: 'Indicator sweep time', min: 0.3, max: 4, step: 0.05, unit: 's', help: 'Seconds for the indicator to cross the meter once (0 → 100 %).' },
  { key: 'timeout', label: 'Launch timeout', min: 1, max: 30, step: 0.5, unit: 's', help: 'If the player does not launch within this time, the launch is Poor.' },
] as const satisfies readonly ParamSpec[];

/** Zone half-widths around the meter centre; boundaries count toward the better zone. */
export const LAUNCH_ZONE_PARAMS = [
  { key: 'perfect', label: 'Perfect zone half-width', min: 0.005, max: 0.5, step: 0.005, unit: '', help: '0.05 → Perfect from 45 % to 55 % (inclusive).' },
  { key: 'great', label: 'Great zone half-width', min: 0.005, max: 0.5, step: 0.005, unit: '', help: '0.20 → Great from 30 % to 70 %.' },
  { key: 'good', label: 'Good zone half-width', min: 0.005, max: 0.5, step: 0.005, unit: '', help: '0.35 → Good from 15 % to 85 %. Outside = Poor.' },
] as const satisfies readonly ParamSpec[];

export const LAUNCH_BONUS_PARAMS = [
  { key: 'poor', label: 'Poor energy multiplier', min: 0.5, max: 2, step: 0.005, unit: '×', help: 'Starting rotational-energy multiplier.' },
  { key: 'good', label: 'Good energy multiplier', min: 0.5, max: 2, step: 0.005, unit: '×', help: 'Starting rotational-energy multiplier.' },
  { key: 'great', label: 'Great energy multiplier', min: 0.5, max: 2, step: 0.005, unit: '×', help: 'Starting rotational-energy multiplier.' },
  { key: 'perfect', label: 'Perfect energy multiplier', min: 0.5, max: 2, step: 0.005, unit: '×', help: 'Starting rotational-energy multiplier (energy, not angular velocity).' },
] as const satisfies readonly ParamSpec[];

export const AI_LAUNCH_PARAMS = [
  { key: 'poor', label: 'AI Poor probability', min: 0, max: 1, step: 0.01, unit: '', help: 'The four probabilities must sum to 1.' },
  { key: 'good', label: 'AI Good probability', min: 0, max: 1, step: 0.01, unit: '', help: 'The four probabilities must sum to 1.' },
  { key: 'great', label: 'AI Great probability', min: 0, max: 1, step: 0.01, unit: '', help: 'The four probabilities must sum to 1.' },
  { key: 'perfect', label: 'AI Perfect probability', min: 0, max: 1, step: 0.01, unit: '', help: 'The four probabilities must sum to 1.' },
] as const satisfies readonly ParamSpec[];

/** Result rules (v0.3). */
export const RESULT_PARAMS = [
  { key: 'drawWindow', label: 'Spin-finish draw window', min: 0, max: 2, step: 0.01, unit: 's', help: 'If the second top stops within this simulated time of the first, the battle is a draw. 0 = v0.2 rule (same step only).' },
  { key: 'narrowThreshold', label: 'Narrow victory threshold', min: 0, max: 0.2, step: 0.005, unit: '', help: 'Spin wins with winner stamina at or below this fraction are labelled NARROW VICTORY (presentation only).' },
] as const satisfies readonly ParamSpec[];

export const SIM_LIMITS = {
  maxDuration: { min: 5, max: 600 },
} as const;
