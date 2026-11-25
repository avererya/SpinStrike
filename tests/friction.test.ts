import { describe, expect, it } from 'vitest';
import { flat, makeWorld, phantom, place } from './helpers';

function run(surfaceFriction: number) {
  const w = makeWorld([phantom({ baseWobble: 0, wobbleIntensity: 0 })], { stadium: flat({ surfaceFriction, radius: 1 }) });
  const b = w.bodies[0]!;
  place(b, 0, 0, 0.6, 0, -600);
  for (let i = 0; i < 120; i++) w.step();
  return { speed: b.speed, spin: Math.abs(b.omega) };
}

describe('friction', () => {
  it('higher surface friction slows translation faster', () => {
    expect(run(2).speed).toBeLessThan(run(0.5).speed);
  });

  it('higher surface friction drains spin faster', () => {
    expect(run(2).spin).toBeLessThan(run(0.5).spin);
  });

  it('zero friction leaves translation untouched', () => {
    const r = run(0);
    expect(r.speed).toBeCloseTo(0.6, 6);
  });

  it('tip traction never reverses the direction of spin', () => {
    const w = makeWorld([phantom({ tipTraction: 1.5, tipSpinFriction: 1, spinDecay: 4 })], { stadium: flat() });
    const b = w.bodies[0]!;
    place(b, 0, 0, 2, 0, -50);
    for (let i = 0; i < 2400; i++) {
      w.step();
      expect(b.omega).toBeLessThanOrEqual(0);
    }
  });
});
