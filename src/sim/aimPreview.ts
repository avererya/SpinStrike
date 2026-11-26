import { World } from './world';
import { ClassicBowl } from './stadium/classicBowl';
import type { BattleOptions } from './battle';
import { NO_LAUNCH_VARIATION, clampAim, nominalPlacementAngle, type LaunchAim } from './launchGeometry';

/**
 * Aiming preview (v0.4.1): the NOMINAL opening path of the player's top,
 * simulated by the real physics for a short time.
 *
 * The preview is the player's top ALONE on a perfect floor, with no launch
 * variation and no contact wander, so it shows what the aim does without
 * revealing anything random or the opponent: no collisions, no seeded
 * variation, no floor imperfections, no opponent decisions, no outcome.
 * The real launch then adds its small natural variation on top.
 */
export interface AimPreview {
  /** Sampled path of the player's top, metres (x, y pairs). */
  path: [number, number][];
  /** Nominal start positions of both slots, metres. */
  start: [number, number][];
  /** Release heading (rad) and tilt (rad) of the player's top. */
  heading: number;
  tilt: number;
}

export const AIM_PREVIEW_SECONDS = 1.0;

export function aimPreview(opts: BattleOptions, aim: LaunchAim, seconds = AIM_PREVIEW_SECONDS): AimPreview {
  const st = opts.stadium as ClassicBowl;
  const perfect = st instanceof ClassicBowl ? new ClassicBowl({ ...st.params, relief: undefined }) : opts.stadium;
  const top = { ...opts.tops[0]!, contactWander: 0 };
  const w = new World({
    ...opts,
    stadium: perfect,
    tops: [top],
    topCombat: opts.topCombat ? [opts.topCombat[0]!] : undefined,
    launch: { ...opts.launch, variation: NO_LAUNCH_VARIATION },
    aims: [clampAim(aim)],
    launchEnergyMultipliers: [1],
  });
  const b = w.bodies[0]!;
  const heading = Math.atan2(b.vy, b.vx);
  const tilt = b.tilt;
  const path: [number, number][] = [[b.x, b.y]];
  const steps = Math.round(seconds * opts.stepHz);
  const every = Math.max(1, Math.round(opts.stepHz / 60));
  for (let i = 1; i <= steps; i++) {
    w.step();
    if (i % every === 0) path.push([b.x, b.y]);
  }
  const R = opts.stadium.boundingRadius * opts.launch.radiusFraction;
  const start: [number, number][] = [0, 1].map((slot) => {
    const a = nominalPlacementAngle(opts.seed, slot, 2);
    return [Math.cos(a) * R, Math.sin(a) * R];
  });
  return { path, start, heading, tilt };
}
