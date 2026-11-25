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
] as const satisfies readonly ParamSpec[];

export const COLLISION_PARAMS = [
  { key: 'restitution', label: 'Collision restitution', min: 0, max: 1, step: 0.01, unit: '', help: 'Global top–top bounciness (scaled per top by defense).' },
  { key: 'energyLoss', label: 'Collision energy loss', min: 0, max: 3, step: 0.05, unit: '×', help: 'Extra spin energy removed per unit of impact energy.' },
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

export const SIM_LIMITS = {
  maxDuration: { min: 5, max: 600 },
} as const;
