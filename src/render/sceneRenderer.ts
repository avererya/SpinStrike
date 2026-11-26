import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { World } from '../sim/world';
import type { CollisionEvent } from '../sim/collision';
import type { DamageEvent } from '../sim/combat';
import { FinishFx } from './finishFx';
import type { TopDefinition } from '../content/tops';
import { WORLD_SCALE } from './coords';
import { buildStadium } from './stadiumMesh';
import { buildTopModel, disposeMaterialCache, type TopModel } from './topModels';
import { ImpactRings, Sparks, Trail } from './effects';
import { DebugDraw, type DebugFlags } from './debugDraw';
import type { StadiumSurface } from '../sim/stadium/types';
import type { TacticalEvent } from '../sim/tactics';
import { braceActive } from '../sim/tactics';

const BRACE_COLOR = 0x4aa8ff;
const BOOST_COLOR = 0xffe08a;

const S = WORLD_SCALE;
/** Camera elevation above the horizon, radians (fixed, angled overhead). */
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(55);
const MAX_PIXEL_RATIO = 2;

/**
 * Three.js presentation of a World. Reads simulation state, never writes
 * it. Interpolates between the previous and current fixed step using the
 * runner's alpha so motion is smooth at any display refresh rate.
 */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private stadiumGroup: THREE.Group | null = null;
  private stadiumRef: StadiumSurface | null = null;
  private models: TopModel[] = [];
  private trails: Trail[] = [];
  private readonly sparks = new Sparks();
  private readonly rings = new ImpactRings();
  readonly debug = new DebugDraw();
  private readonly envTex: THREE.Texture;
  private readonly keyLight: THREE.DirectionalLight;
  private world: World | null = null;
  private readonly q = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly grad = { x: 0, y: 0 };
  readonly fx = new FinishFx(S);
  /** Finish presentation already started, per top index. */
  private finishStarted: boolean[] = [];
  /** Flash and camera shake on finishes (developer toggle). */
  cinematic = true;
  private readonly camBase = new THREE.Vector3();
  /** v0.5 Brace shield per top (cosmetic) and its impact pulse. */
  private shields: THREE.Mesh[] = [];
  private shieldPulse: number[] = [];
  private shieldFade: number[] = [];
  private readonly shieldGeo = new THREE.TorusGeometry(1, 0.09, 8, 40);
  private shieldTime = 0;
  private readonly projV = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(0x0b0e13);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.8;

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242b, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.5, 6, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = -2.6;
    sc.right = 2.6;
    sc.top = 2.6;
    sc.bottom = -2.6;
    sc.near = 1;
    sc.far = 14;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.keyLight = key;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9a50, 0.6);
    rim.position.set(3, 2.5, -3);
    this.scene.add(rim);

    this.scene.add(this.sparks.points, this.rings.group, this.debug.group, this.fx.group);
  }

  /** Attach a new world (on battle start/reset). Rebuilds top models. */
  setWorld(world: World, defs: TopDefinition[]): void {
    this.world = world;
    if (this.stadiumRef !== world.stadium) {
      if (this.stadiumGroup) {
        this.scene.remove(this.stadiumGroup);
        disposeObject(this.stadiumGroup);
      }
      this.stadiumGroup = buildStadium(world.stadium);
      this.scene.add(this.stadiumGroup);
      this.stadiumRef = world.stadium;
    }
    // Debris parts reference model geometry: clear them before disposing models.
    this.fx.clear();
    for (const m of this.models) {
      this.scene.remove(m.root);
      m.dispose();
    }
    for (const t of this.trails) {
      this.scene.remove(t.mesh);
      t.dispose();
    }
    this.models = defs.map((d) => buildTopModel(d));
    this.trails = defs.map((d) => new Trail(d.palette.accent, 48, 0.09, 0.32, 0.02));
    for (const m of this.models) this.scene.add(m.root);
    for (const t of this.trails) this.scene.add(t.mesh);
    this.finishStarted = defs.map(() => false);
    for (const sh of this.shields) {
      this.scene.remove(sh);
      (sh.material as THREE.Material).dispose();
    }
    this.shields = defs.map(() => {
      const m = new THREE.Mesh(
        this.shieldGeo,
        new THREE.MeshBasicMaterial({ color: BRACE_COLOR, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      return m;
    });
    this.shieldPulse = defs.map(() => 0);
    this.shieldFade = defs.map(() => 0);
    this.sparks.clear();
    this.rings.clear();
    this.debug.setWorld(world, defs.map((d) => d.palette.accent));
    this.frameCamera();
  }

  onCollisions(events: CollisionEvent[], showContacts: boolean): void {
    const w = this.world;
    if (!w) return;
    for (const ev of events) {
      // Effect intensity scales with impact speed (0 … 1).
      const intensity = Math.min(1, ev.normalSpeed / (ev.kind === 'wall' ? 1.6 : 1.0));
      if (intensity < 0.05) continue;
      const y = (w.stadium.height(ev.x, ev.y) + 0.018) * S;
      this.sparks.emit(ev.x * S, y, -ev.y * S, ev.nx, -ev.ny, intensity);
      if (ev.kind === 'top' && intensity > 0.15) this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, intensity);
      if (showContacts) this.debug.addContact(ev, w);
    }
  }

  /**
   * Extra feedback for damaging impacts: sparks and an impact ring scaled
   * by damage relative to the target's maximum health.
   */
  /**
   * Impact feedback for damaging hits. Critical hits (when `criticalFx`)
   * get a distinct golden burst of sparks and a larger impact ring.
   */
  onDamage(events: DamageEvent[], criticalFx = true): void {
    const w = this.world;
    if (!w) return;
    for (const ev of events) {
      if (criticalFx && (ev.critToA || ev.critToB)) {
        const y = (w.stadium.height(ev.x, ev.y) + 0.018) * S;
        this.sparks.emit(ev.x * S, y, -ev.y * S, ev.nx, -ev.ny, 1, true);
        this.sparks.emit(ev.x * S, y, -ev.y * S, -ev.nx, ev.ny, 0.6, true);
        this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, 1.25);
        continue;
      }
      const bA = w.bodies[ev.a]!;
      const bB = w.bodies[ev.b]!;
      const rel = Math.max(ev.damageToA / bA.combat.maxHealth, ev.damageToB / bB.combat.maxHealth);
      // ~6 % of max health in one hit reads as a heavy hit.
      const intensity = Math.min(1, rel / 0.06);
      if (intensity < 0.15) continue;
      const y = (w.stadium.height(ev.x, ev.y) + 0.018) * S;
      this.sparks.emit(ev.x * S, y, -ev.y * S, ev.nx, -ev.ny, intensity);
      this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, 0.4 + 0.6 * intensity);
    }
  }

  /**
   * v0.5 tactical feedback (cosmetic only): a boost streak of sparks behind
   * the top and a ring at the push-off point; a blue flash when Brace starts,
   * a pulse when it absorbs a hit, and a fading ring when it expires.
   */
  onTactical(events: TacticalEvent[]): void {
    const w = this.world;
    if (!w) return;
    for (const ev of events) {
      const y = (w.stadium.height(ev.x, ev.y) + 0.018) * S;
      if (ev.kind === 'boost') {
        const k = 0.5 + 0.5 * ev.strength;
        this.sparks.emit(ev.x * S, y, -ev.y * S, -ev.dirY, -ev.dirX, k);
        this.sparks.emit(ev.x * S, y, -ev.y * S, ev.dirY, ev.dirX, 0.5 * k);
        this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, 0.35 + 0.4 * ev.strength, BOOST_COLOR);
      } else if (ev.kind === 'brace-start') {
        this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, 0.7, BRACE_COLOR);
        if (this.shieldPulse[ev.slot] !== undefined) this.shieldPulse[ev.slot] = 1;
      } else if (ev.kind === 'brace-impact') {
        this.rings.emit(ev.x * S, y - 0.1, -ev.y * S, 0.9, BRACE_COLOR);
        if (this.shieldPulse[ev.slot] !== undefined) this.shieldPulse[ev.slot] = 1;
      } else if (ev.kind === 'brace-end') {
        if (this.shieldFade[ev.slot] !== undefined) this.shieldFade[ev.slot] = 0.35;
      }
    }
  }

  /** Displayed stadium diameter in CSS pixels (gesture normalisation). */
  stadiumScreenDiameter(): number {
    const w = this.world;
    if (!w) return 0;
    const R = w.stadium.boundingRadius;
    const a = this.project(-R, 0, 0);
    const b = this.project(R, 0, 0);
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  }

  /**
   * Converts a screen-space drag (CSS px) at the sim-plane point (x, y) into
   * a sim-plane direction, by inverting the local projection Jacobian (the
   * camera is angled, so screen and floor directions differ).
   */
  screenToWorldDir(x: number, y: number, sx: number, sy: number): { x: number; y: number } | null {
    const e = 0.01;
    const p0 = this.project(x, y, 0.03);
    const px = this.project(x + e, y, 0.03);
    const py = this.project(x, y + e, 0.03);
    if (!p0 || !px || !py) return null;
    const a = (px.x - p0.x) / e;
    const c = (px.y - p0.y) / e;
    const b = (py.x - p0.x) / e;
    const d = (py.y - p0.y) / e;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) return null;
    const wx = (d * sx - b * sy) / det;
    const wy = (-c * sx + a * sy) / det;
    const l = Math.hypot(wx, wy);
    return l > 1e-12 ? { x: wx / l, y: wy / l } : null;
  }

  /** Converts a sim-plane direction at (x, y) to a unit screen direction. */
  worldToScreenDir(x: number, y: number, dx: number, dy: number): { x: number; y: number } | null {
    const e = 0.01;
    const p0 = this.project(x, y, 0.03);
    const p1 = this.project(x + dx * e, y + dy * e, 0.03);
    if (!p0 || !p1) return null;
    const l = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    return l > 1e-9 ? { x: (p1.x - p0.x) / l, y: (p1.y - p0.y) / l } : null;
  }

  /** Projects a simulation-plane point (metres) to canvas CSS pixels, or null if behind the camera. */
  project(x: number, y: number, lift = 0.05): { x: number; y: number } | null {
    const w = this.world;
    if (!w) return null;
    this.projV.set(x * S, (w.stadium.height(x, y) + lift) * S, -y * S).project(this.camera);
    if (this.projV.z > 1) return null;
    const el = this.renderer.domElement;
    return { x: ((this.projV.x + 1) / 2) * el.clientWidth, y: ((1 - this.projV.y) / 2) * el.clientHeight };
  }

  /** Starts the burst / knockout presentation for a top that left play. */
  private startFinish(i: number): void {
    const w = this.world!;
    const b = w.bodies[i]!;
    const m = this.models[i]!;
    this.finishStarted[i] = true;
    this.trails[i]?.reset();
    if (this.trails[i]) this.trails[i]!.mesh.visible = false;
    const h = w.stadium.height(b.x, b.y);
    m.root.position.set(b.x * S, h * S, -b.y * S);
    if (b.eliminated === 'burst') {
      const power = Math.min(1, b.finishIntensity / Math.max(1, b.combat.maxHealth * 0.08));
      const y = (h + 0.018) * S;
      for (let k = 0; k < 3; k++) this.sparks.emit(b.x * S, y, -b.y * S, b.finishDirX, -b.finishDirY, 1);
      this.rings.emit(b.x * S, y - 0.1, -b.y * S, 1);
      if (this.cinematic) {
        this.fx.flashAt(b.x * S, y, -b.y * S, 0.6 + 0.4 * power);
        this.fx.shakeCamera(0.035);
      }
      this.fx.burst(m, b.finishDirX, -b.finishDirY, 0.4 + 0.6 * power, b.vx * S * 0.5, -b.vy * S * 0.5);
    } else if (b.eliminated === 'knockout') {
      const out = Math.max(Math.hypot(b.vx, b.vy), 0.6) * S;
      const up = Math.max(b.finishIntensity, 0.45) * S * 0.9;
      const y = (h + 0.02) * S;
      this.sparks.emit(b.x * S, y, -b.y * S, b.finishDirX, -b.finishDirY, 1);
      if (this.cinematic) {
        this.fx.flashAt(b.x * S, y, -b.y * S, 0.5);
        this.fx.shakeCamera(0.025);
      }
      this.fx.knockout(m, b.finishDirX * out, up, -b.finishDirY * out);
    }
  }

  render(alpha: number, dt: number, flags: DebugFlags): void {
    const w = this.world;
    if (w) {
      w.bodies.forEach((b, i) => {
        const m = this.models[i];
        if (!m) return;
        if (b.eliminated !== null) {
          // Burst / knocked-out tops are animated by the finish presentation.
          if (!this.finishStarted[i]) this.startFinish(i);
          return;
        }
        const x = b.px + (b.x - b.px) * alpha;
        const y = b.py + (b.y - b.py) * alpha;
        const h = w.stadium.height(x, y);
        m.root.position.set(x * S, h * S, -y * S);
        // Visual axis = wobble tilt + partial lean with the surface normal
        // (the normal tilts downhill, i.e. along −gradient).
        w.stadium.gradient(x, y, this.grad);
        const tx = b.tiltX - this.grad.x * 0.5;
        const ty = b.tiltY - this.grad.y * 0.5;
        const t = Math.hypot(tx, ty);
        if (t > 1e-6) {
          // Lean direction in three space: (tx, 0, −ty); axis = up × dir.
          this.axis.set(-ty / t, 0, -tx / t);
          this.q.setFromAxisAngle(this.axis, Math.min(t, 1.3));
          m.tilt.quaternion.copy(this.q);
        } else m.tilt.quaternion.identity();
        m.spin.rotation.y = b.prevAngle + (b.angle - b.prevAngle) * alpha;
        this.trails[i]?.push(x * S, h * S + 0.03, -y * S);
        this.updateShield(i, x, y, h, dt);
      });
      w.bodies.forEach((b, i) => {
        if (b.eliminated !== null && this.shields[i]) this.shields[i]!.visible = false;
      });
      this.debug.update(w, alpha, flags, dt);
      this.debug.setSlopeVisible(w, flags.slope);
    }
    this.sparks.update(dt);
    this.rings.update(dt);
    const stadium = w?.stadium;
    const R = (stadium?.boundingRadius ?? 0.2) * S;
    this.fx.update(
      dt,
      (x, z) => (stadium ? stadium.height(x / S, -z / S) * S : 0),
      R,
      -0.45,
    );
    this.camera.position.copy(this.camBase).add(this.fx.shake);
    this.renderer.render(this.scene, this.camera);
  }

  private updateShield(i: number, x: number, y: number, h: number, dt: number): void {
    const w = this.world!;
    const sh = this.shields[i];
    if (!sh) return;
    this.shieldTime += dt / Math.max(1, this.shields.length);
    const st = w.abilities[i];
    const on = !!st && w.tactics.enabled && braceActive(st, w.steps);
    const mat = sh.material as THREE.MeshBasicMaterial;
    this.shieldPulse[i] = Math.max(0, (this.shieldPulse[i] ?? 0) - dt * 3);
    this.shieldFade[i] = Math.max(0, (this.shieldFade[i] ?? 0) - dt);
    const fade = this.shieldFade[i]!;
    if (!on && fade <= 0) {
      sh.visible = false;
      return;
    }
    const r = w.bodies[i]!.params.radius * S;
    const pulse = this.shieldPulse[i]!;
    sh.visible = true;
    sh.position.set(x * S, h * S + 0.06, -y * S);
    sh.scale.setScalar(r * (1.35 + 0.25 * pulse + (on ? 0.04 * Math.sin(this.shieldTime * 9) : 0.3 * (1 - fade / 0.35))));
    mat.opacity = on ? 0.55 + 0.4 * pulse : 0.6 * (fade / 0.35);
  }

  resetTrails(): void {
    for (const t of this.trails) t.reset();
  }

  /** Resize to the canvas' CSS size and refit the camera. */
  resize(width: number, height: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.frameCamera();
  }

  /**
   * Fixed angled overhead camera, distance chosen so the whole stadium
   * (with housing) fits both vertically and horizontally for the current
   * aspect ratio — keeps framing correct in portrait and landscape.
   */
  private frameCamera(): void {
    const R = (this.stadiumRef?.boundingRadius ?? 0.2) * S + 0.4;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    // Vertical extent of a tilted disc ≈ R·sin(elevation) plus housing depth.
    const vExtent = R * Math.sin(CAMERA_ELEVATION) + 0.35 * Math.cos(CAMERA_ELEVATION);
    const dV = vExtent / Math.tan(vFov / 2) + R * Math.cos(CAMERA_ELEVATION);
    const dH = R / Math.tan(hFov / 2) + R * Math.cos(CAMERA_ELEVATION) * 0.5;
    const d = Math.max(dV, dH) * 1.04;
    this.camera.position.set(0, Math.sin(CAMERA_ELEVATION) * d, Math.cos(CAMERA_ELEVATION) * d);
    this.camBase.copy(this.camera.position);
    this.camera.lookAt(0, -0.05, 0);
    this.camera.far = d * 3;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    for (const m of this.models) m.dispose();
    for (const t of this.trails) t.dispose();
    this.sparks.dispose();
    this.rings.dispose();
    this.debug.dispose();
    this.fx.dispose();
    if (this.stadiumGroup) disposeObject(this.stadiumGroup);
    disposeMaterialCache();
    this.envTex.dispose();
    this.keyLight.shadow.map?.dispose();
    this.renderer.dispose();
  }
}

function disposeObject(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as (THREE.Material & { map?: THREE.Texture | null }) | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}
