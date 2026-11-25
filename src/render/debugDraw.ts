import * as THREE from 'three';
import type { World } from '../sim/world';
import type { CollisionEvent } from '../sim/collision';
import { WORLD_SCALE } from './coords';
import { Trail } from './effects';

export interface DebugFlags {
  velocity: boolean;
  boundaries: boolean;
  contacts: boolean;
  trails: boolean;
  slope: boolean;
  fps: boolean;
  physicsStats: boolean;
}

export const DEFAULT_DEBUG_FLAGS: DebugFlags = {
  velocity: false,
  boundaries: false,
  contacts: false,
  trails: false,
  slope: false,
  fps: false,
  physicsStats: false,
};

const S = WORLD_SCALE;
const MAX_CONTACTS = 12;

/** Optional debug overlays. All are hidden by default. */
export class DebugDraw {
  readonly group = new THREE.Group();
  private arrows: THREE.ArrowHelper[] = [];
  private circles: THREE.LineLoop[] = [];
  private pathTrails: Trail[] = [];
  private contactMeshes: THREE.Mesh[] = [];
  private contactLife = new Float32Array(MAX_CONTACTS);
  private contactNext = 0;
  private slopeGroup: THREE.Group | null = null;
  private readonly contactGeo = new THREE.SphereGeometry(0.035, 10, 8);
  private readonly contactMat = new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, depthTest: false });
  private readonly circleMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, depthTest: false, transparent: true, opacity: 0.9 });

  constructor() {
    this.group.renderOrder = 10;
    for (let i = 0; i < MAX_CONTACTS; i++) {
      const m = new THREE.Mesh(this.contactGeo, this.contactMat.clone());
      m.visible = false;
      m.renderOrder = 11;
      this.contactMeshes.push(m);
      this.group.add(m);
    }
  }

  /** Rebuild per-top helpers for a new world. */
  setWorld(world: World, colors: number[]): void {
    for (const a of this.arrows) {
      this.group.remove(a);
      a.dispose();
    }
    for (const c of this.circles) {
      this.group.remove(c);
      c.geometry.dispose();
    }
    for (const t of this.pathTrails) {
      this.group.remove(t.mesh);
      t.dispose();
    }
    this.arrows = [];
    this.circles = [];
    this.pathTrails = [];
    world.bodies.forEach((b, i) => {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffee00, 0.12, 0.08);
      (arrow.line.material as THREE.Material).depthTest = false;
      (arrow.cone.material as THREE.Material).depthTest = false;
      arrow.renderOrder = 12;
      this.arrows.push(arrow);
      this.group.add(arrow);
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * b.params.radius * S, 0, -Math.sin(a) * b.params.radius * S));
      }
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), this.circleMat);
      loop.renderOrder = 12;
      this.circles.push(loop);
      this.group.add(loop);
      const trail = new Trail(colors[i] ?? 0xffffff, 400, 0.025, 0.9, 0.01);
      this.pathTrails.push(trail);
      this.group.add(trail.mesh);
    });
    for (const m of this.contactMeshes) m.visible = false;
  }

  setSlopeVisible(world: World, visible: boolean): void {
    if (visible && !this.slopeGroup) {
      this.slopeGroup = buildSlopeField(world);
      this.group.add(this.slopeGroup);
    }
    if (this.slopeGroup) this.slopeGroup.visible = visible;
  }

  addContact(ev: CollisionEvent, world: World): void {
    const m = this.contactMeshes[this.contactNext]!;
    this.contactLife[this.contactNext] = 2.5;
    this.contactNext = (this.contactNext + 1) % MAX_CONTACTS;
    m.position.set(ev.x * S, world.stadium.height(ev.x, ev.y) * S + 0.2, -ev.y * S);
    m.visible = true;
  }

  update(world: World, alpha: number, flags: DebugFlags, dt: number): void {
    world.bodies.forEach((b, i) => {
      const x = b.px + (b.x - b.px) * alpha;
      const y = b.py + (b.y - b.py) * alpha;
      const h = world.stadium.height(x, y) * S;
      const arrow = this.arrows[i]!;
      arrow.visible = flags.velocity;
      if (flags.velocity) {
        const sp = b.speed;
        arrow.position.set(x * S, h + 0.32, -y * S);
        if (sp > 1e-4) arrow.setDirection(new THREE.Vector3(b.vx / sp, 0, -b.vy / sp));
        arrow.setLength(Math.max(0.05, sp * 1.2), 0.12, 0.08);
      }
      const circle = this.circles[i]!;
      circle.visible = flags.boundaries;
      if (flags.boundaries) circle.position.set(x * S, h + 0.12, -y * S);
      const trail = this.pathTrails[i]!;
      trail.mesh.visible = flags.trails;
      trail.push(x * S, h + 0.01, -y * S);
    });
    for (let i = 0; i < MAX_CONTACTS; i++) {
      const m = this.contactMeshes[i]!;
      if (!m.visible) continue;
      this.contactLife[i]! -= dt;
      const l = this.contactLife[i]!;
      m.visible = flags.contacts && l > 0;
      (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, l);
      if (l <= 0) m.visible = false;
    }
    if (!flags.contacts) for (const m of this.contactMeshes) m.visible = false;
  }

  dispose(): void {
    for (const a of this.arrows) a.dispose();
    for (const c of this.circles) c.geometry.dispose();
    for (const t of this.pathTrails) t.dispose();
    this.contactGeo.dispose();
    this.contactMat.dispose();
    for (const m of this.contactMeshes) (m.material as THREE.Material).dispose();
    this.circleMat.dispose();
    if (this.slopeGroup) disposeGroup(this.slopeGroup);
  }
}

/** Arrows showing the downhill acceleration direction/magnitude across the bowl. */
function buildSlopeField(world: World): THREE.Group {
  const g = new THREE.Group();
  const st = world.stadium;
  const R = st.boundingRadius;
  const grad = { x: 0, y: 0 };
  const step = R / 6;
  for (let x = -R; x <= R + 1e-9; x += step) {
    for (let y = -R; y <= R + 1e-9; y += step) {
      if (!st.contains(x, y) || x * x + y * y > (R * 0.97) ** 2) continue;
      st.gradient(x, y, grad);
      const m = Math.hypot(grad.x, grad.y);
      if (m < 1e-6) continue;
      const len = Math.min(0.5, 0.08 + m * 0.5);
      const color = new THREE.Color().setHSL(0.6 - Math.min(0.6, m * 0.5), 0.9, 0.55);
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(-grad.x / m, 0, grad.y / m),
        new THREE.Vector3(x * S, st.height(x, y) * S + 0.05, -y * S),
        len,
        color.getHex(),
        0.06,
        0.04,
      );
      g.add(arrow);
    }
  }
  return g;
}

function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
