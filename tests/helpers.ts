import { ClassicBowl, DEFAULT_CLASSIC_BOWL } from '../src/sim/stadium/classicBowl';
import { World, DEFAULT_LAUNCH, type LaunchParams } from '../src/sim/world';
import type { TopPhysicsParams } from '../src/sim/topParams';
import { DEFAULT_COLLISION, type CollisionParams } from '../src/sim/collision';
import { deriveTopPhysics } from '../src/content/derive';
import { getTop } from '../src/content/tops';
import type { TopBody } from '../src/sim/body';

export function phantom(over: Partial<TopPhysicsParams> = {}): TopPhysicsParams {
  // Physics tests use the v0.2 Phantom so v0.1/v0.2 expectations stay exact.
  return { ...deriveTopPhysics(getTop('phantom'), { ruleset: 'v0.2' }), ...over };
}

/** A "frictionless puck" top: no tip coupling, no drag, no decay. */
export function puck(over: Partial<TopPhysicsParams> = {}): TopPhysicsParams {
  return phantom({
    tipTraction: 0,
    tipSpinFriction: 0,
    airDrag: 0,
    rollingResistance: 0,
    baseWobble: 0,
    wobbleIntensity: 0,
    ringStrike: 0,
    contactFriction: 0,
    ...over,
  });
}

export function bowl(over: Partial<typeof DEFAULT_CLASSIC_BOWL> = {}): ClassicBowl {
  return new ClassicBowl({ ...DEFAULT_CLASSIC_BOWL, ...over });
}

export function flat(over: Partial<typeof DEFAULT_CLASSIC_BOWL> = {}): ClassicBowl {
  return bowl({ depth: 0, rimRise: 0, ...over });
}

export function makeWorld(
  tops: TopPhysicsParams[],
  opts: { stadium?: ClassicBowl; collision?: Partial<CollisionParams>; launch?: Partial<LaunchParams>; seed?: number } = {},
): World {
  return new World({
    stadium: opts.stadium ?? bowl(),
    tops,
    collision: { ...DEFAULT_COLLISION, ...opts.collision },
    launch: { ...DEFAULT_LAUNCH, ...opts.launch },
    seed: opts.seed ?? 1,
    stepHz: 240,
  });
}

/** Place a body explicitly (overriding the seeded launch). */
export function place(b: TopBody, x: number, y: number, vx = 0, vy = 0, omega?: number): void {
  b.x = b.px = x;
  b.y = b.py = y;
  b.vx = vx;
  b.vy = vy;
  if (omega !== undefined) {
    b.omega = omega;
    b.launchEnergy = b.spinEnergy;
  }
  b.tilt = 0;
}

export function kinetic(b: TopBody): number {
  return 0.5 * b.params.mass * (b.vx * b.vx + b.vy * b.vy) + b.spinEnergy;
}

export function allFinite(b: TopBody): boolean {
  return [b.x, b.y, b.vx, b.vy, b.omega, b.tilt, b.tiltPhase, b.angle].every(Number.isFinite);
}
