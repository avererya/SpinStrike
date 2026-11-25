import * as THREE from 'three';
import type { TopModel } from './topModels';

/**
 * Finishing-move presentation (burst debris, knockout exit, impact flash,
 * light camera shake). Purely cosmetic: it never reads or writes the
 * simulation beyond the snapshot it is given when a finish starts, so it
 * cannot change a battle's result. Everything is bounded (4 debris parts
 * per burst, one flash mesh) and is removed by `clear()` on reset/restart.
 *
 * Units are Three.js scene units (1 sim metre = WORLD_SCALE). Gravity is a
 * presentation value, lower than real scale so the parts' flight reads well
 * on screen.
 */
const FX_GRAVITY = 30;
const DEBRIS_BOUNCE = 0.35;
const DEBRIS_FRICTION = 3.5;

interface Debris {
  pivot: THREE.Group;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  /** Half-height of the part above its pivot when lying down, scene units. */
  rest: number;
  settled: boolean;
}

interface KnockoutAnim {
  model: TopModel;
  vel: THREE.Vector3;
  tumble: THREE.Vector3;
  t: number;
}

/** Height above the tip of each part's centre, metres (matches topModels layout). */
const PART_CENTRE: Record<string, number> = { tip: 0.006, disc: 0.013, ring: 0.018, core: 0.024 };
const PART_REST: Record<string, number> = { tip: 0.004, disc: 0.002, ring: 0.003, core: 0.006 };

export class FinishFx {
  readonly group = new THREE.Group();
  private debris: Debris[] = [];
  private kos: KnockoutAnim[] = [];
  private readonly flash: THREE.Mesh;
  private flashLife = 0;
  private flashMax = 0.3;
  private flashScale = 1;
  private shakeLife = 0;
  private shakeAmp = 0;
  private seed = 777;
  readonly shake = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  constructor(private readonly scale: number) {
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.flash.visible = false;
    this.flash.renderOrder = 4;
    this.group.add(this.flash);
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Bright, short flash at a scene-space point. */
  flashAt(x: number, y: number, z: number, intensity: number): void {
    this.flash.position.set(x, y, z);
    this.flash.visible = true;
    this.flashMax = 0.18 + 0.2 * intensity;
    this.flashLife = this.flashMax;
    this.flashScale = 0.25 + 0.55 * intensity;
  }

  /** Small, quickly decaying camera shake (amplitude in scene units). */
  shakeCamera(amp: number, duration = 0.3): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeLife = Math.max(this.shakeLife, duration);
  }

  /**
   * Bursts a top model into its four components. `dir` is the horizontal
   * scene-space direction of the decisive impact (x, z), `power` 0–1.
   */
  burst(model: TopModel, dirX: number, dirZ: number, power: number, carryX: number, carryZ: number): void {
    model.root.updateMatrixWorld(true);
    const names = ['core', 'ring', 'disc', 'tip'] as const;
    const base = (1.4 + 2.2 * power) * 1;
    names.forEach((name, k) => {
      const part = model.parts[name];
      const pivot = new THREE.Group();
      // Pivot at the part's centre so it tumbles about itself.
      this.tmp.set(0, PART_CENTRE[name]! * this.scale, 0);
      part.parent!.localToWorld(this.tmp);
      pivot.position.copy(this.tmp);
      this.group.add(pivot);
      pivot.attach(part);
      // Fan the parts out around the impact direction.
      const ang = Math.atan2(dirZ, dirX) + (k - 1.5) * 0.65 + (this.rand() - 0.5) * 0.5;
      const sp = base * (0.6 + this.rand() * 0.6) * (name === 'ring' ? 1.15 : name === 'tip' ? 0.8 : 1);
      const vel = new THREE.Vector3(Math.cos(ang) * sp + carryX, (1.6 + this.rand() * 1.8) * (0.6 + power), Math.sin(ang) * sp + carryZ);
      const spin = new THREE.Vector3((this.rand() - 0.5) * 24, (this.rand() - 0.5) * 30, (this.rand() - 0.5) * 24);
      this.debris.push({ pivot, vel, spin, rest: PART_REST[name]! * this.scale, settled: false });
    });
    model.root.visible = false;
  }

  /** Animates a knocked-out top flying over the rim and tumbling away. */
  knockout(model: TopModel, velX: number, velY: number, velZ: number): void {
    this.kos.push({
      model,
      vel: new THREE.Vector3(velX, velY, velZ),
      tumble: new THREE.Vector3((this.rand() - 0.5) * 10, 0, (this.rand() - 0.5) * 10),
      t: 0,
    });
  }

  /**
   * Advances debris, knockout and flash animation. `surface(x, z)` returns
   * the stadium height (scene units) or null outside the bowl; `floorY` is
   * where knocked-out tops come to rest; `radius` is the bowl radius.
   */
  update(dt: number, surface: (x: number, z: number) => number | null, radius: number, floorY: number): void {
    if (dt <= 0) {
      this.updateShake(0);
      return;
    }
    for (const d of this.debris) {
      if (d.settled) continue;
      const p = d.pivot.position;
      d.vel.y -= FX_GRAVITY * dt;
      p.addScaledVector(d.vel, dt);
      // Stay inside the bowl wall.
      const r = Math.hypot(p.x, p.z);
      const lim = radius - 0.06;
      if (r > lim) {
        const nx = p.x / r;
        const nz = p.z / r;
        p.x = nx * lim;
        p.z = nz * lim;
        const vn = d.vel.x * nx + d.vel.z * nz;
        if (vn > 0) {
          d.vel.x -= (1 + DEBRIS_BOUNCE) * vn * nx;
          d.vel.z -= (1 + DEBRIS_BOUNCE) * vn * nz;
        }
      }
      const ground = (surface(p.x, p.z) ?? 0) + d.rest;
      let grounded = false;
      if (p.y <= ground) {
        p.y = ground;
        grounded = true;
        if (d.vel.y < 0) d.vel.y = -d.vel.y * DEBRIS_BOUNCE;
        if (d.vel.y < 0.4) d.vel.y = 0;
        const k = Math.exp(-DEBRIS_FRICTION * dt);
        d.vel.x *= k;
        d.vel.z *= k;
        d.spin.multiplyScalar(Math.exp(-4 * dt));
      }
      this.e.set(d.spin.x * dt, d.spin.y * dt, d.spin.z * dt);
      this.q.setFromEuler(this.e);
      d.pivot.quaternion.multiply(this.q);
      if (grounded) {
        // Settle toward lying flat (the disc/ring axis vertical) with its current heading.
        this.e.setFromQuaternion(d.pivot.quaternion, 'YXZ');
        this.e.x *= Math.exp(-6 * dt);
        this.e.z *= Math.exp(-6 * dt);
        d.pivot.quaternion.setFromEuler(this.e);
        const sp = Math.hypot(d.vel.x, d.vel.z);
        const flat = Math.abs(this.e.x) < 0.03 && Math.abs(this.e.z) < 0.03;
        if (sp < 0.05 && d.vel.y === 0 && d.spin.length() < 0.5 && flat) d.settled = true;
      }
    }
    for (const k of this.kos) {
      k.t += dt;
      const p = k.model.root.position;
      k.vel.y -= FX_GRAVITY * dt;
      p.addScaledVector(k.vel, dt);
      // Once over the rim, fall to the floor outside the stadium.
      const r = Math.hypot(p.x, p.z);
      if (r > radius + 0.25 && p.y < floorY) {
        p.y = floorY;
        k.vel.set(k.vel.x * 0.5, 0, k.vel.z * 0.5);
        k.tumble.multiplyScalar(0.9);
      }
      k.model.tilt.rotation.x += k.tumble.x * dt;
      k.model.tilt.rotation.z += k.tumble.z * dt;
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      const t = Math.max(0, this.flashLife / this.flashMax);
      this.flash.scale.setScalar(this.flashScale * (1.4 - t));
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * t * t;
      if (this.flashLife <= 0) this.flash.visible = false;
    }
    this.updateShake(dt);
  }

  private updateShake(dt: number): void {
    if (this.shakeLife > 0) {
      this.shakeLife -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeLife / 0.3);
      this.shake.set((this.rand() - 0.5) * a, (this.rand() - 0.5) * a * 0.5, (this.rand() - 0.5) * a);
      if (this.shakeLife <= 0) {
        this.shakeAmp = 0;
        this.shake.set(0, 0, 0);
      }
    }
  }

  get activeDebris(): number {
    return this.debris.length;
  }

  /** Removes all debris and effects. Part geometries belong to their model and are disposed with it. */
  clear(): void {
    for (const d of this.debris) this.group.remove(d.pivot);
    this.debris = [];
    this.kos = [];
    this.flash.visible = false;
    this.flashLife = 0;
    this.shakeLife = 0;
    this.shakeAmp = 0;
    this.shake.set(0, 0, 0);
  }

  dispose(): void {
    this.clear();
    this.flash.geometry.dispose();
    (this.flash.material as THREE.Material).dispose();
  }
}
