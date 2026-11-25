import { describe, expect, it } from 'vitest';
import { makeWorld, place, puck, flat, phantom } from './helpers';

describe('momentum', () => {
  it('a top on a flat frictionless floor keeps its velocity and direction', () => {
    const w = makeWorld([puck()], { stadium: flat() });
    const b = w.bodies[0]!;
    place(b, -0.1, 0, 0.3, 0.1, 500);
    for (let i = 0; i < 120; i++) w.step();
    expect(b.vx).toBeCloseTo(0.3, 6);
    expect(b.vy).toBeCloseTo(0.1, 6);
    expect(b.x).toBeCloseTo(-0.1 + 0.3 * 0.5, 4);
  });

  it('friction slows a moving top gradually rather than snapping its direction', () => {
    const w = makeWorld([phantom({ baseWobble: 0, wobbleIntensity: 0 })], { stadium: flat() });
    const b = w.bodies[0]!;
    place(b, 0, 0, 0.5, 0, 0); // not spinning: pure sliding friction
    b.spinning = true;
    const speeds: number[] = [];
    const headings: number[] = [];
    for (let i = 0; i < 24; i++) {
      w.step();
      speeds.push(b.speed);
      headings.push(Math.atan2(b.vy, b.vx));
    }
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeLessThanOrEqual(speeds[i - 1]! + 1e-12);
    expect(speeds.at(-1)!).toBeGreaterThan(0); // not stopped instantly
    for (const h of headings) expect(Math.abs(h)).toBeLessThan(1e-6); // direction preserved
  });
});
