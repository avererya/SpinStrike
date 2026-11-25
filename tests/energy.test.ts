import { describe, expect, it } from 'vitest';
import { bowl, makeWorld, phantom, place } from './helpers';
import { deriveTopPhysics } from '../src/content/derive';
import { getTop, STARTER_TOPS } from '../src/content/tops';
import { GRAVITY } from '../src/sim/units';

describe('rotational energy', () => {
  it('decreases steadily for a lone top and the top eventually stops', () => {
    // Spin may briefly rise when a sliding tip "catches" (translational energy
    // feeds the spin, as with a rolling ball), so check one-second windows and
    // that it never exceeds the launch energy.
    const w = makeWorld([phantom()]);
    const b = w.bodies[0]!;
    let prev = b.spinEnergy;
    let steps = 0;
    while (b.spinning && steps < 240 * 300) {
      w.step();
      expect(b.spinEnergy).toBeLessThanOrEqual(b.launchEnergy * 1.01);
      steps++;
      if (steps % 240 === 0) {
        expect(b.spinEnergy).toBeLessThan(prev);
        prev = b.spinEnergy;
      }
    }
    expect(b.spinning).toBe(false);
    expect(Math.abs(b.omega)).toBeLessThanOrEqual(b.criticalSpin + 1e-9);
  });

  it('never gains total mechanical energy (spin + motion + height): no free energy from spin→movement coupling', () => {
    for (const def of STARTER_TOPS) {
      const w = makeWorld([deriveTopPhysics(def)], { seed: 7 });
      const b = w.bodies[0]!;
      const total = () => b.spinEnergy + 0.5 * b.params.mass * (b.vx ** 2 + b.vy ** 2) + b.params.mass * GRAVITY * w.stadium.height(b.x, b.y);
      let prev = total();
      for (let i = 0; i < 240 * 20; i++) {
        w.step();
        const e = total();
        // Small tolerance: semi-implicit integration of gravity on a curved surface.
        expect(e).toBeLessThanOrEqual(prev + 2e-5);
        prev = e;
      }
    }
  });

  it('attack tips burn spin faster than stamina tips', () => {
    const lifetime = (id: string) => {
      const w = makeWorld([deriveTopPhysics(getTop(id))]);
      const b = w.bodies[0]!;
      while (b.spinning && w.time < 400) w.step();
      return w.time;
    };
    const inferno = lifetime('inferno');
    const tempest = lifetime('tempest');
    expect(tempest).toBeGreaterThan(inferno * 2);
  });

  it('wobble grows as spin decreases', () => {
    const w = makeWorld([phantom()], { stadium: bowl({ depth: 0, rimRise: 0 }) });
    const b = w.bodies[0]!;
    place(b, 0, 0, 0, 0, -600);
    for (let i = 0; i < 240 * 3; i++) w.step();
    const highSpinTilt = b.tilt;
    b.omega = -b.criticalSpin * 1.4;
    for (let i = 0; i < 240 * 2; i++) w.step();
    expect(b.tilt).toBeGreaterThan(highSpinTilt * 3);
  });

  it('collisions consume rotational energy', () => {
    const p = phantom({ tipSpinFriction: 0, airDrag: 0, tipTraction: 0, baseWobble: 0 });
    const w = makeWorld([p, p], { stadium: bowl({ depth: 0, rimRise: 0, radius: 1 }) });
    const [A, B] = w.bodies as [typeof w.bodies[0], typeof w.bodies[0]];
    place(A, -0.1, 0, 1, 0, -600);
    place(B, 0.1, 0, -1, 0, -600);
    const before = A.spinEnergy + B.spinEnergy;
    for (let i = 0; i < 60; i++) w.step();
    expect(A.collisions).toBeGreaterThan(0);
    expect(A.spinEnergy + B.spinEnergy).toBeLessThan(before * 0.995);
  });
});
