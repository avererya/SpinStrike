import { describe, expect, it } from 'vitest';
import { FinishFx } from '../src/render/finishFx';
import { buildTopModel } from '../src/render/topModels';
import { getTop } from '../src/content/tops';

describe('finishing presentation lifecycle (no WebGL needed)', () => {
  it('a burst separates the four components, animates them, settles, and clear() removes all debris', () => {
    const fx = new FinishFx(10);
    const model = buildTopModel(getTop('tempest'));
    model.root.position.set(0.5, 0.1, 0);
    fx.burst(model, 1, 0, 1, 0, 0);
    expect(fx.activeDebris).toBe(4);
    expect(model.root.visible).toBe(false);
    for (const part of Object.values(model.parts)) expect(part.parent?.parent).toBe(fx.group);
    const surface = () => 0.1;
    const start = model.parts.ring.getWorldPosition(model.parts.ring.position.clone());
    for (let i = 0; i < 600; i++) fx.update(1 / 60, surface, 2, -0.45);
    const end = model.parts.ring.parent!.position;
    expect(end.distanceTo(start)).toBeGreaterThan(0.1);
    // Debris stays inside the bowl and rests on the surface.
    for (const part of Object.values(model.parts)) {
      const p = part.parent!.position;
      expect(Math.hypot(p.x, p.z)).toBeLessThan(2);
      expect(p.y).toBeGreaterThanOrEqual(0.1);
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    }
    fx.clear();
    expect(fx.activeDebris).toBe(0);
    expect(fx.group.children.length).toBe(1); // only the pooled flash mesh remains
    model.dispose();
    fx.dispose();
  });

  it('a knockout moves the top out over the rim and down to the floor; flash and shake expire', () => {
    const fx = new FinishFx(10);
    const model = buildTopModel(getTop('phantom'));
    model.root.position.set(1.7, 0.4, 0);
    fx.knockout(model, 6, 5, 0);
    fx.flashAt(1.7, 0.4, 0, 1);
    fx.shakeCamera(0.03);
    for (let i = 0; i < 300; i++) fx.update(1 / 60, () => 0, 2, -0.45);
    expect(model.root.position.x).toBeGreaterThan(2.2);
    expect(model.root.position.y).toBeCloseTo(-0.45, 5);
    expect(fx.shake.length()).toBe(0);
    fx.clear();
    model.dispose();
    fx.dispose();
  });

  it('presentation never touches the simulation: a paused update (dt = 0) changes nothing', () => {
    const fx = new FinishFx(10);
    const model = buildTopModel(getTop('inferno'));
    fx.burst(model, 0, 1, 0.5, 0, 0);
    const before = model.parts.core.parent!.position.clone();
    fx.update(0, () => 0, 2, -0.45);
    expect(model.parts.core.parent!.position.equals(before)).toBe(true);
    fx.dispose();
    model.dispose();
  });
});
