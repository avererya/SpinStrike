import { describe, expect, it } from 'vitest';
import { bowl, flat, makeWorld, place, puck } from './helpers';

describe('arena surface', () => {
  it('gradient matches the numerical derivative of the height function', () => {
    const s = bowl();
    const g = { x: 0, y: 0 };
    const h = 1e-6;
    for (const [x, y] of [
      [0.05, 0.02],
      [-0.12, 0.07],
      [0.0, -0.17],
      [0.15, 0.08],
    ] as const) {
      s.gradient(x, y, g);
      expect(g.x).toBeCloseTo((s.height(x + h, y) - s.height(x - h, y)) / (2 * h), 5);
      expect(g.y).toBeCloseTo((s.height(x, y + h) - s.height(x, y - h)) / (2 * h), 5);
    }
  });

  it('is concave: centre is lowest and height rises monotonically outward, steeper at the rim', () => {
    const s = bowl();
    let prev = -Infinity;
    for (let r = 0; r <= 0.2; r += 0.01) {
      const z = s.height(r, 0);
      expect(z).toBeGreaterThan(prev);
      prev = z;
    }
    const g1 = { x: 0, y: 0 };
    const g2 = { x: 0, y: 0 };
    s.gradient(0.08, 0, g1);
    s.gradient(0.19, 0, g2);
    expect(g2.x).toBeGreaterThan(g1.x * 2);
  });

  it('a top released at rest on the slope accelerates toward the centre', () => {
    const w = makeWorld([puck()]);
    const b = w.bodies[0]!;
    place(b, 0.12, 0, 0, 0, 0);
    for (let i = 0; i < 60; i++) w.step();
    expect(b.vx).toBeLessThan(-0.05);
    expect(Math.abs(b.vy)).toBeLessThan(1e-9);
    expect(b.x).toBeLessThan(0.12);
  });

  it('a top released at rest on a flat floor stays put', () => {
    const w = makeWorld([puck()], { stadium: flat() });
    const b = w.bodies[0]!;
    place(b, 0.12, 0, 0, 0, 0);
    for (let i = 0; i < 240; i++) w.step();
    expect(b.x).toBeCloseTo(0.12, 9);
  });

  it('steeper bowls pull harder toward the centre', () => {
    const accel = (depth: number) => {
      const w = makeWorld([puck()], { stadium: bowl({ depth }) });
      const b = w.bodies[0]!;
      place(b, 0.1, 0, 0, 0, 0);
      w.step();
      return -b.vx;
    };
    expect(accel(0.05)).toBeGreaterThan(accel(0.02) * 2);
  });

  it('spinning tips are driven around the bowl (tangential motion emerges from spin on a slope)', () => {
    const w = makeWorld([puck({ tipTraction: 0.5, tipDriveRadius: 0.006 })]);
    const b = w.bodies[0]!;
    place(b, 0.1, 0, 0, 0, -650); // right spin
    for (let i = 0; i < 48; i++) w.step();
    // Right spin (clockwise from above) drives counter-clockwise travel: +y at (+x, 0).
    expect(b.vy).toBeGreaterThan(0.05);
  });

  it('keeps tops inside the wall', () => {
    const w = makeWorld([puck()], { stadium: flat() });
    const b = w.bodies[0]!;
    place(b, 0, 0, 3, 1, 0);
    for (let i = 0; i < 2400; i++) {
      w.step();
      expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(0.2 - b.params.radius + 1e-3);
    }
  });
});
