import { describe, expect, it } from 'vitest';
import { makeWorld, place, puck, flat, kinetic, allFinite } from './helpers';
import { resolveTopPair } from '../src/sim/collision';
import type { TopPhysicsParams } from '../src/sim/topParams';

function pair(a: Partial<TopPhysicsParams> = {}, b: Partial<TopPhysicsParams> = {}, restitution = 0.6, energyLoss = 0) {
  const w = makeWorld([puck(a), puck(b)], { stadium: flat({ radius: 1 }), collision: { restitution, energyLoss } });
  return { w, A: w.bodies[0]!, B: w.bodies[1]! };
}

describe('collision resolution', () => {
  it('conserves linear momentum in a top–top impact', () => {
    const { w, A, B } = pair({ mass: 0.04 }, { mass: 0.06 });
    place(A, -0.0505, 0, 0.8, 0.1, 0);
    place(B, 0, 0, -0.2, 0, 0);
    const px = A.params.mass * A.vx + B.params.mass * B.vx;
    const py = A.params.mass * A.vy + B.params.mass * B.vy;
    resolveTopPair(A, B, w.collision, { touching: false }, 0);
    expect(A.params.mass * A.vx + B.params.mass * B.vx).toBeCloseTo(px, 10);
    expect(A.params.mass * A.vy + B.params.mass * B.vy).toBeCloseTo(py, 10);
  });

  it('never increases kinetic energy (translation + spin), including contact friction', () => {
    const { w, A, B } = pair({ contactFriction: 0.6 }, { contactFriction: 0.6 }, 1, 0);
    place(A, -0.049, 0.01, 1.2, 0.3, 600);
    place(B, 0, 0, -0.4, 0, 600);
    const before = kinetic(A) + kinetic(B);
    resolveTopPair(A, B, w.collision, { touching: true }, 0);
    expect(kinetic(A) + kinetic(B)).toBeLessThanOrEqual(before + 1e-12);
  });

  it('heavier tops are displaced less by the same impact', () => {
    const { w, A, B } = pair({ mass: 0.03 }, { mass: 0.06 });
    place(A, -0.0499, 0, 0, 0, 0);
    place(B, 0, 0, 0, 0, 0);
    A.vx = 0.5;
    B.vx = -0.5;
    resolveTopPair(A, B, w.collision, { touching: false }, 0);
    const dvA = Math.abs(A.vx - 0.5);
    const dvB = Math.abs(B.vx + 0.5);
    expect(dvA).toBeGreaterThan(dvB * 1.9);
  });

  it('direct impacts transfer much more impulse than glancing ones', () => {
    const impulse = (offsetY: number) => {
      const { w, A, B } = pair();
      const d = 0.0499;
      const x = -Math.sqrt(d * d - offsetY * offsetY);
      place(A, x, offsetY, 1, 0, 0);
      place(B, 0, 0, 0, 0, 0);
      const ev = resolveTopPair(A, B, w.collision, { touching: false }, 0);
      return ev?.impulse ?? 0;
    };
    const direct = impulse(0);
    const glancing = impulse(0.048);
    expect(direct).toBeGreaterThan(glancing * 3);
  });

  it('separates overlapping tops and does not leave them stuck together', () => {
    const { w, A, B } = pair();
    place(A, -0.01, 0, 0, 0, 0);
    place(B, 0.01, 0, 0, 0, 0); // heavily overlapped
    for (let i = 0; i < 60; i++) w.step();
    const d = Math.hypot(B.x - A.x, B.y - A.y);
    expect(d).toBeGreaterThanOrEqual(A.params.radius + B.params.radius - 0.001);
    expect(allFinite(A) && allFinite(B)).toBe(true);
  });

  it('resting contact does not vibrate (no bounce at very low approach speed)', () => {
    const { w, A, B } = pair({}, {}, 0.9);
    place(A, -0.025, 0, 0.01, 0, 0);
    place(B, 0.025, 0, -0.01, 0, 0);
    let maxSpeed = 0;
    for (let i = 0; i < 240; i++) {
      w.step();
      maxSpeed = Math.max(maxSpeed, A.speed, B.speed);
    }
    expect(maxSpeed).toBeLessThan(0.0101);
  });

  it('handles very high-speed collisions without tunnelling', () => {
    const { w, A, B } = pair({}, {}, 0.6);
    place(A, -0.12, 0, 7, 0, 0);
    place(B, 0.12, 0, -7, 0, 0);
    let minGap = Infinity;
    for (let i = 0; i < 60; i++) {
      w.step();
      minGap = Math.min(minGap, B.x - A.x);
    }
    expect(minGap).toBeGreaterThan(0.04); // never passed through each other
    expect(B.x).toBeGreaterThan(A.x);
    expect(A.vx).toBeLessThan(0); // bounced back
    expect(B.vx).toBeGreaterThan(0);
    expect(A.collisions).toBe(1);
  });

  it('spinning ring contact couples spin into the impact (same-spin tops exchange tangential impulse)', () => {
    const { w, A, B } = pair({ contactFriction: 0.5 }, { contactFriction: 0.5 });
    place(A, -0.0499, 0, 0.5, 0, -600);
    place(B, 0, 0, 0, 0, -600);
    resolveTopPair(A, B, w.collision, { touching: false }, 0);
    expect(Math.abs(A.vy) + Math.abs(B.vy)).toBeGreaterThan(0.01);
    expect(Math.abs(A.omega)).toBeLessThan(600);
  });
});
