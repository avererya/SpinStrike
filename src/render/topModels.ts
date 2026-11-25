import * as THREE from 'three';
import type { TopDefinition } from '../content/tops';
import { resolveParts } from '../content/derive';
import type { CorePart, DiscPart, RingPart, TipPart } from '../content/parts';
import { WORLD_SCALE } from './coords';

/**
 * Procedural top models. Each top is assembled from four separately built
 * part meshes (tip, weight disc, battle ring, spin core) so future
 * interchangeable equipment can swap any one of them.
 *
 * Hierarchy produced by buildTopModel():
 *   root            → positioned on the surface
 *     tilt          → orientation of the spin axis (wobble), pivots at the tip
 *       spin        → rotation about the axis
 *         tip / disc / ring / core
 *
 * Dimensions are authored in metres and scaled by WORLD_SCALE.
 */
export interface TopModel {
  root: THREE.Group;
  tilt: THREE.Group;
  spin: THREE.Group;
  /** Height of the model's centre above its tip, scene units. */
  centreHeight: number;
  dispose(): void;
}

const S = WORLD_SCALE;

// Shared material cache: identical material settings are reused.
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, metalness: number, roughness: number, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${metalness}|${roughness}|${emissive}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive });
    materialCache.set(key, m);
  }
  return m;
}

export function disposeMaterialCache(): void {
  for (const m of materialCache.values()) m.dispose();
  materialCache.clear();
}

// Vertical layout (metres above tip contact)
const TIP_TOP = 0.011;
const DISC_Y = 0.0115;
const DISC_H = 0.0035;
const RING_Y = DISC_Y + DISC_H;
const RING_H = 0.0065;
const CORE_Y = RING_Y + RING_H * 0.25;

export function buildTopModel(def: TopDefinition): TopModel {
  const parts = resolveParts(def);
  const root = new THREE.Group();
  root.name = `top-${def.id}`;
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);

  const geos: THREE.BufferGeometry[] = [];
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    geos.push(mesh.geometry);
    spin.add(mesh);
    return mesh;
  };

  for (const m of buildTip(parts.tip, def)) add(m);
  for (const m of buildDisc(parts.disc, def)) add(m);
  for (const m of buildRing(parts.ring, def)) add(m);
  for (const m of buildCore(parts.core, def)) add(m);

  return {
    root,
    tilt,
    spin,
    centreHeight: 0.016 * S,
    dispose() {
      for (const g of geos) g.dispose();
    },
  };
}

// ---------------------------------------------------------------- tip
function buildTip(tip: TipPart, def: TopDefinition): THREE.Mesh[] {
  const r = tip.visualRadius;
  const pts: THREE.Vector2[] = [];
  switch (tip.shape) {
    case 'flat':
      pts.push(v(0, 0), v(r, 0), v(r * 1.05, 0.0012), v(r * 0.75, 0.004), v(0.0045, 0.0075), v(0.0075, TIP_TOP));
      break;
    case 'ball':
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
        pts.push(v(Math.cos(a) * r, r + Math.sin(a) * r));
      }
      pts.push(v(0.0048, 0.0075), v(0.0078, TIP_TOP));
      break;
    case 'sharp':
      pts.push(v(0, 0), v(0.0004, 0.0004), v(0.0028, 0.006), v(0.0045, 0.0085), v(0.0072, TIP_TOP));
      break;
    case 'semi-flat':
      pts.push(v(0, 0), v(r * 0.55, 0), v(r, 0.0016), v(0.0042, 0.006), v(0.0076, TIP_TOP));
      break;
  }
  pts.push(v(0, TIP_TOP));
  const geo = new THREE.LatheGeometry(scaled(pts), 28);
  const tipColor = tip.shape === 'flat' ? 0x1a1a1a : def.palette.metal;
  const tipMesh = new THREE.Mesh(geo, mat(tipColor, tip.shape === 'flat' ? 0.1 : 0.85, tip.shape === 'flat' ? 0.8 : 0.3));
  // Collar in the top's secondary colour
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085 * S, 0.0078 * S, 0.0025 * S, 28),
    mat(def.palette.secondary, 0.3, 0.55),
  );
  collar.position.y = (TIP_TOP - 0.0008) * S;
  return [tipMesh, collar];
}

// --------------------------------------------------------------- disc
function buildDisc(disc: DiscPart, def: TopDefinition): THREE.Mesh[] {
  const R = disc.radius;
  const shape = new THREE.Shape();
  if (disc.style === 'notched') {
    const n = 8;
    for (let i = 0; i <= n * 8; i++) {
      const a = (i / (n * 8)) * Math.PI * 2;
      const notch = (i % 8 === 0 || i % 8 === 1) ? 0.9 : 1;
      const x = Math.cos(a) * R * notch;
      const y = Math.sin(a) * R * notch;
      if (i === 0) shape.moveTo(x * S, y * S);
      else shape.lineTo(x * S, y * S);
    }
  } else {
    shape.absarc(0, 0, R * S, 0, Math.PI * 2, false);
  }
  // Centre bore
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.004 * S, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  if (disc.style === 'spoked') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * R * 0.6 * S, Math.sin(a) * R * 0.6 * S, R * 0.18 * S, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DISC_H * S,
    bevelEnabled: true,
    bevelThickness: 0.0004 * S,
    bevelSize: 0.0004 * S,
    bevelSegments: 2,
    curveSegments: 40,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, DISC_Y * S, 0);
  const meshes: THREE.Mesh[] = [new THREE.Mesh(geo, mat(def.palette.metal, 0.95, 0.22))];
  if (disc.style === 'rimmed' || disc.style === 'solid') {
    // Heavy outer rim band
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(R * S * 0.97, (disc.style === 'solid' ? 0.0022 : 0.0018) * S, 10, 48),
      mat(disc.style === 'rimmed' ? def.palette.accent : def.palette.metal, 0.95, 0.2),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = (DISC_Y + DISC_H * 0.5) * S;
    meshes.push(band);
  }
  return meshes;
}

// --------------------------------------------------------------- ring
function ringProfile(ring: RingPart, a: number): number {
  const R = ring.radius;
  const n = ring.lobes;
  const u = ((a / (Math.PI * 2)) * n) % 1; // 0..1 within one lobe
  switch (ring.style) {
    case 'jagged': {
      // Asymmetric saw teeth with a hooked leading edge.
      const ramp = u < 0.78 ? u / 0.78 : 1 - (u - 0.78) / 0.22;
      return R * (0.74 + 0.26 * Math.pow(ramp, 1.6));
    }
    case 'armored': {
      // Thick rounded armour plates.
      const c = Math.cos(u * Math.PI * 2);
      return R * (0.95 + 0.05 * Math.sqrt(Math.max(0, (c + 1) / 2)));
    }
    case 'smooth':
      return R * (0.975 + 0.025 * Math.cos(u * Math.PI * 2));
    case 'winged': {
      const c = Math.max(0, Math.cos(u * Math.PI * 2));
      return R * (0.8 + 0.2 * Math.pow(c, 0.6));
    }
  }
}

function buildRing(ring: RingPart, def: TopDefinition): THREE.Mesh[] {
  const shape = new THREE.Shape();
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = ringProfile(ring, a) * S;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0105 * S, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const thick = ring.style === 'armored' ? RING_H * 1.15 : ring.style === 'jagged' ? RING_H * 0.85 : RING_H;
  const bevel = ring.style === 'armored' ? 0.0016 : ring.style === 'smooth' ? 0.0012 : 0.0005;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: (thick - bevel * 2) * S,
    bevelEnabled: true,
    bevelThickness: bevel * S,
    bevelSize: bevel * S * 0.8,
    bevelSegments: ring.style === 'jagged' ? 1 : 3,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, (RING_Y + bevel) * S, 0);
  const body = new THREE.Mesh(geo, mat(def.palette.primary, 0.35, 0.35));

  // Metal inner frame with a second colour
  const frameShape = new THREE.Shape();
  frameShape.absarc(0, 0, ring.radius * 0.66 * S, 0, Math.PI * 2, false);
  const fh = new THREE.Path();
  fh.absarc(0, 0, 0.0095 * S, 0, Math.PI * 2, true);
  frameShape.holes.push(fh);
  // Three lightening windows reveal the metal disc below.
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2 + 0.25;
    const a1 = a0 + Math.PI * 0.42;
    const w = new THREE.Path();
    const rIn = 0.0112 * S;
    const rOut = ring.radius * 0.58 * S;
    w.absarc(0, 0, rOut, a1, a0, true);
    w.absarc(0, 0, rIn, a0, a1, false);
    frameShape.holes.push(w);
  }
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.0016 * S, bevelEnabled: true, bevelThickness: 0.0003 * S, bevelSize: 0.0003 * S, bevelSegments: 1, curveSegments: 40 });
  frameGeo.rotateX(-Math.PI / 2);
  frameGeo.translate(0, (RING_Y + thick) * S, 0);
  const frame = new THREE.Mesh(frameGeo, mat(def.palette.secondary, 0.6, 0.35));

  const meshes: THREE.Mesh[] = [body, frame];
  // Accent studs on each lobe for silhouette/readability of spin.
  const studGeo = new THREE.BoxGeometry(0.003 * S, 0.0015 * S, 0.0055 * S);
  for (let i = 0; i < ring.lobes; i++) {
    const a = ((i + 0.55) / ring.lobes) * Math.PI * 2;
    const r = ringProfile(ring, a) * 0.86;
    const stud = new THREE.Mesh(i === 0 ? studGeo : studGeo.clone(), mat(i === 0 ? 0xffffff : def.palette.accent, 0.5, 0.3, i === 0 ? 0x333333 : 0));
    stud.position.set(Math.cos(a) * r * S, (RING_Y + thick + 0.0004) * S, -Math.sin(a) * r * S);
    stud.rotation.y = a;
    meshes.push(stud);
  }
  return meshes;
}

// --------------------------------------------------------------- core
function buildCore(core: CorePart, def: TopDefinition): THREE.Mesh[] {
  const pts = [v(0, 0), v(0.0098, 0), v(0.0102, 0.004), v(0.0092, 0.0085), v(0.006, 0.0115), v(0, 0.0122)];
  const geo = new THREE.LatheGeometry(scaled(pts), 36);
  geo.translate(0, CORE_Y * S, 0);
  const body = new THREE.Mesh(geo, mat(def.palette.metal, 0.9, 0.18));
  // Coloured cap with emblem
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0068 * S, 0.0074 * S, 0.0016 * S, 36), mat(def.palette.secondary, 0.4, 0.4));
  cap.position.y = (CORE_Y + 0.0112) * S;
  const emblemGeo = new THREE.ExtrudeGeometry(emblemShape(core.emblem), { depth: 0.0009 * S, bevelEnabled: false, curveSegments: 16 });
  emblemGeo.rotateX(-Math.PI / 2);
  emblemGeo.translate(0, (CORE_Y + 0.012) * S, 0);
  const emblem = new THREE.Mesh(emblemGeo, mat(def.palette.accent, 0.3, 0.35, def.palette.accent & 0x3f3f3f));
  return [body, cap, emblem];
}

function emblemShape(kind: CorePart['emblem']): THREE.Shape {
  const s = new THREE.Shape();
  const k = S * 0.001; // millimetres → scene units
  switch (kind) {
    case 'flame':
      s.moveTo(0, 5.2 * k);
      s.quadraticCurveTo(3.5 * k, 1 * k, 2.6 * k, -2.5 * k);
      s.quadraticCurveTo(1.5 * k, -4.8 * k, 0, -4.8 * k);
      s.quadraticCurveTo(-1.5 * k, -4.8 * k, -2.6 * k, -2.5 * k);
      s.quadraticCurveTo(-3.2 * k, 0.5 * k, -1 * k, 2 * k);
      s.quadraticCurveTo(-0.6 * k, 3.5 * k, 0, 5.2 * k);
      break;
    case 'shield':
      s.moveTo(-4 * k, 3.8 * k);
      s.lineTo(4 * k, 3.8 * k);
      s.lineTo(4 * k, 0);
      s.quadraticCurveTo(3.4 * k, -3.6 * k, 0, -5 * k);
      s.quadraticCurveTo(-3.4 * k, -3.6 * k, -4 * k, 0);
      s.lineTo(-4 * k, 3.8 * k);
      break;
    case 'leaf':
      s.moveTo(0, 5 * k);
      s.quadraticCurveTo(4.2 * k, 0, 0, -5 * k);
      s.quadraticCurveTo(-4.2 * k, 0, 0, 5 * k);
      break;
    case 'crescent':
      s.absarc(0, 0, 4.6 * k, Math.PI * 0.25, Math.PI * 1.75, false);
      s.absarc(1.8 * k, 0, 3.4 * k, Math.PI * 1.62, Math.PI * 0.38, true);
      break;
  }
  return s;
}

function v(x: number, y: number): THREE.Vector2 {
  return new THREE.Vector2(x, y);
}
function scaled(pts: THREE.Vector2[]): THREE.Vector2[] {
  return pts.map((p) => new THREE.Vector2(p.x * S, p.y * S));
}
