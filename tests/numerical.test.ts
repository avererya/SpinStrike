import { describe, expect, it } from 'vitest';
import { allFinite, bowl, makeWorld, phantom, place } from './helpers';
import { LIMITS } from '../src/sim/units';

describe('numerical safety', () => {
  it('recovers from injected NaN/Infinity and reports a guard trip', () => {
    const w = makeWorld([phantom(), phantom()]);
    const b = w.bodies[0]!;
    b.vx = NaN;
    b.omega = Infinity;
    w.step();
    expect(allFinite(b)).toBe(true);
    expect(b.guardTrips).toBeGreaterThan(0);
  });

  it('extreme parameters stay finite and bounded', () => {
    const extremes = [
      phantom({ mass: 0.01, launchSpeed: 3, launchSpinEnergy: 8, tipTraction: 1.5, stability: 0, wobbleIntensity: 1 }),
      phantom({ mass: 0.12, launchSpeed: 0, launchSpinEnergy: 0.2, tipTraction: 0, stability: 1, spinDecay: 4 }),
    ];
    const w = makeWorld(extremes, { stadium: bowl({ depth: 0.08, surfaceFriction: 3, wallRestitution: 1 }), collision: { restitution: 1, energyLoss: 3 } });
    for (let i = 0; i < 240 * 60; i++) {
      w.step();
      for (const b of w.bodies) {
        expect(allFinite(b)).toBe(true);
        expect(b.speed).toBeLessThanOrEqual(LIMITS.maxSpeed + 1e-9);
      }
    }
  });

  it('coincident tops are separated deterministically without NaN', () => {
    const w = makeWorld([phantom(), phantom()]);
    const [A, B] = w.bodies;
    place(A!, 0, 0, 0, 0, -500);
    place(B!, 0, 0, 0, 0, -500);
    for (let i = 0; i < 30; i++) w.step();
    expect(allFinite(A!) && allFinite(B!)).toBe(true);
    expect(Math.hypot(A!.x - B!.x, A!.y - B!.y)).toBeGreaterThan(0.04);
  });
});
