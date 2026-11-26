import * as THREE from 'three';

/**
 * Lightweight visual effects with fixed-size pools so nothing is allocated
 * per frame: motion trails (ribbon), collision sparks (points) and impact
 * flash rings.
 */

// ------------------------------------------------------------------ trails
export class Trail {
  readonly mesh: THREE.Mesh;
  private readonly pts: Float32Array; // ring buffer of xyz
  private count = 0;
  private head = 0;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly color: THREE.Color;

  constructor(
    color: number,
    private readonly maxPoints = 40,
    private readonly width = 0.08,
    private readonly opacity = 0.55,
    private readonly minStep = 0.03,
  ) {
    this.color = new THREE.Color(color);
    this.pts = new Float32Array(maxPoints * 3);
    this.positions = new Float32Array(maxPoints * 2 * 3);
    this.colors = new Float32Array(maxPoints * 2 * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
    this.geo.setDrawRange(0, 0);
  }

  push(x: number, y: number, z: number): void {
    if (this.count > 0) {
      const li = ((this.head - 1 + this.maxPoints) % this.maxPoints) * 3;
      const dx = x - this.pts[li]!;
      const dz = z - this.pts[li + 2]!;
      if (dx * dx + dz * dz < this.minStep * this.minStep) {
        // Update newest point in place for a smooth leading edge.
        this.pts[li] = x;
        this.pts[li + 1] = y;
        this.pts[li + 2] = z;
        this.rebuild();
        return;
      }
    }
    const i = this.head * 3;
    this.pts[i] = x;
    this.pts[i + 1] = y;
    this.pts[i + 2] = z;
    this.head = (this.head + 1) % this.maxPoints;
    if (this.count < this.maxPoints) this.count++;
    this.rebuild();
  }

  private rebuild(): void {
    const n = this.count;
    if (n < 2) {
      this.geo.setDrawRange(0, 0);
      return;
    }
    const start = (this.head - n + this.maxPoints) % this.maxPoints;
    for (let k = 0; k < n; k++) {
      const i = ((start + k) % this.maxPoints) * 3;
      const j = ((start + Math.min(k + 1, n - 1)) % this.maxPoints) * 3;
      const h = ((start + Math.max(k - 1, 0)) % this.maxPoints) * 3;
      let dx = this.pts[j]! - this.pts[h]!;
      let dz = this.pts[j + 2]! - this.pts[h + 2]!;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const t = k / (n - 1); // 0 oldest → 1 newest
      const w = this.width * (0.25 + 0.75 * t) * 0.5;
      const px = this.pts[i]!;
      const py = this.pts[i + 1]!;
      const pz = this.pts[i + 2]!;
      const o = k * 6;
      this.positions[o] = px - dz * w;
      this.positions[o + 1] = py;
      this.positions[o + 2] = pz + dx * w;
      this.positions[o + 3] = px + dz * w;
      this.positions[o + 4] = py;
      this.positions[o + 5] = pz - dx * w;
      const a = this.opacity * t * t;
      const c = k * 8;
      for (let s = 0; s < 2; s++) {
        this.colors[c + s * 4] = this.color.r;
        this.colors[c + s * 4 + 1] = this.color.g;
        this.colors[c + s * 4 + 2] = this.color.b;
        this.colors[c + s * 4 + 3] = a;
      }
    }
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.color!.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 6);
  }

  dispose(): void {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ------------------------------------------------------------------ sparks
const MAX_SPARKS = 160;

export class Sparks {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX_SPARKS * 3);
  private readonly col = new Float32Array(MAX_SPARKS * 3);
  private readonly vel = new Float32Array(MAX_SPARKS * 3);
  private readonly life = new Float32Array(MAX_SPARKS);
  private readonly maxLife = new Float32Array(MAX_SPARKS);
  /** 1 = golden critical-hit spark (whiter, brighter), 0 = ordinary. */
  private readonly gold = new Uint8Array(MAX_SPARKS);
  private next = 0;
  private readonly geo = new THREE.BufferGeometry();
  private seed = 12345;

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    for (let i = 0; i < MAX_SPARKS; i++) this.pos[i * 3 + 1] = -100;
  }

  // Visual-only randomness; independent of the simulation RNG.
  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Emit sparks at (x,y,z) travelling roughly perpendicular to normal (nx,nz). */
  emit(x: number, y: number, z: number, nx: number, nz: number, intensity: number, golden = false): void {
    const n = Math.min(golden ? 56 : 40, Math.round(4 + intensity * (golden ? 52 : 36)));
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_SPARKS;
      const side = this.rand() < 0.5 ? -1 : 1;
      const spread = (this.rand() - 0.5) * 1.2;
      const speed = (0.8 + this.rand() * 2.2) * (0.5 + intensity);
      // tangent = (-nz, nx)
      const dx = (-nz * side + nx * spread) * speed;
      const dz = (nx * side + nz * spread) * speed;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = dx;
      this.vel[i * 3 + 1] = (0.5 + this.rand() * 1.5) * (0.5 + intensity);
      this.vel[i * 3 + 2] = dz;
      const l = (0.18 + this.rand() * 0.25) * (golden ? 1.35 : 1);
      this.gold[i] = golden ? 1 : 0;
      this.life[i] = l;
      this.maxLife[i] = l;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i]! -= dt;
      const o = i * 3;
      this.vel[o + 1]! -= 9 * dt;
      this.pos[o]! += this.vel[o]! * dt;
      this.pos[o + 1]! += this.vel[o + 1]! * dt;
      this.pos[o + 2]! += this.vel[o + 2]! * dt;
      const t = Math.max(0, this.life[i]! / this.maxLife[i]!);
      if (this.gold[i]) {
        this.col[o] = 1.3 * t;
        this.col[o + 1] = (0.9 + 0.3 * t) * t;
        this.col[o + 2] = 0.45 * t;
      } else {
        this.col[o] = 1 * t;
        this.col[o + 1] = (0.55 + 0.4 * t) * t;
        this.col[o + 2] = 0.2 * t * t;
      }
      if (this.life[i]! <= 0) this.pos[o + 1] = -100;
    }
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.color!.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < MAX_SPARKS; i++) this.pos[i * 3 + 1] = -100;
    this.geo.attributes.position!.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ------------------------------------------------------------ impact rings
const MAX_RINGS = 6;

export class ImpactRings {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly life = new Float32Array(MAX_RINGS);
  private readonly scaleMax = new Float32Array(MAX_RINGS);
  private next = 0;
  private readonly geo = new THREE.RingGeometry(0.8, 1, 40);

  constructor() {
    for (let i = 0; i < MAX_RINGS; i++) {
      const m = new THREE.Mesh(
        this.geo,
        new THREE.MeshBasicMaterial({
          color: 0xffd27a,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.meshes.push(m);
    }
  }

  emit(x: number, y: number, z: number, intensity: number): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_RINGS;
    const m = this.meshes[i]!;
    m.position.set(x, y + 0.02, z);
    m.visible = true;
    this.life[i] = 0.3;
    this.scaleMax[i] = 0.15 + intensity * 0.55;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_RINGS; i++) {
      const m = this.meshes[i]!;
      if (!m.visible) continue;
      this.life[i]! -= dt;
      const t = this.life[i]! / 0.3;
      if (t <= 0) {
        m.visible = false;
        continue;
      }
      const s = this.scaleMax[i]! * (1 - t * t * 0.8);
      m.scale.setScalar(s);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * t;
    }
  }

  clear(): void {
    for (const m of this.meshes) m.visible = false;
  }

  dispose(): void {
    this.geo.dispose();
    for (const m of this.meshes) (m.material as THREE.Material).dispose();
  }
}
