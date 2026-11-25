import * as THREE from 'three';
import type { StadiumSurface } from '../sim/stadium/types';
import { WORLD_SCALE } from './coords';

/**
 * Builds the stadium mesh by sampling the SAME surface height function the
 * physics uses, on a polar grid. Visual concavity therefore always matches
 * the physical surface. Works for any StadiumSurface whose play area is
 * star-shaped around the origin.
 */
export function buildStadium(surface: StadiumSurface): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stadium';
  const S = WORLD_SCALE;
  const R = surface.boundingRadius;
  const rings = 48;
  const segs = 128;

  // --- floor ---
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  positions.push(0, surface.height(0, 0) * S, 0);
  uvs.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) {
    const r = (R * i) / rings;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      positions.push(x * S, surface.height(x, y) * S, -y * S);
      uvs.push(0.5 + (x / R) * 0.5, 0.5 + (y / R) * 0.5);
    }
  }
  for (let j = 0; j < segs; j++) indices.push(0, 1 + j, 1 + ((j + 1) % segs));
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs;
    const a1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      indices.push(a0 + j, a1 + j, a0 + j1);
      indices.push(a0 + j1, a1 + j, a1 + j1);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  floorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  floorGeo.setIndex(indices);
  floorGeo.computeVertexNormals();
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xb8c2cc,
    metalness: 0.45,
    roughness: 0.42,
    map: makeFloorTexture(),
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // --- concentric depth markings (follow the surface) ---
  const markMat = new THREE.LineBasicMaterial({ color: 0x3d4652, transparent: true, opacity: 0.6 });
  for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.88]) {
    const pts: THREE.Vector3[] = [];
    const r = R * f;
    for (let j = 0; j <= 160; j++) {
      const a = (j / 160) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      pts.push(new THREE.Vector3(x * S, surface.height(x, y) * S + 0.004, -y * S));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), markMat);
    group.add(line);
  }
  // Radial guide ticks
  const tickPts: THREE.Vector3[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (const f of [0.62, 0.86]) {
      const x = Math.cos(a) * R * f;
      const y = Math.sin(a) * R * f;
      tickPts.push(new THREE.Vector3(x * S, surface.height(x, y) * S + 0.004, -y * S));
    }
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), markMat));

  // --- raised outer wall + lip ---
  const edgeH = surface.height(R, 0) * S;
  const wallH = surface.wallHeight * S;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R * S, R * S, wallH, segs, 1, true), wallMat);
  wall.position.y = edgeH + wallH / 2;
  wall.receiveShadow = true;
  group.add(wall);
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xd0d6dd, metalness: 0.9, roughness: 0.25 });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R * S + 0.06, 0.07, 12, segs), lipMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = edgeH + wallH;
  group.add(lip);
  // Accent stripe on the lip
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(R * S + 0.06, 0.02, 6, segs),
    new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0x6a2a00, metalness: 0.3, roughness: 0.5 }),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = edgeH + wallH + 0.06;
  group.add(stripe);

  // --- outer housing: shows the bowl is a solid object ---
  const baseBottom = -0.25;
  const housingGeo = new THREE.CylinderGeometry(R * S + 0.18, R * S + 0.32, edgeH + wallH - baseBottom, segs, 1, true);
  const housing = new THREE.Mesh(housingGeo, new THREE.MeshStandardMaterial({ color: 0x1b2129, metalness: 0.5, roughness: 0.6 }));
  housing.position.y = (edgeH + wallH + baseBottom) / 2;
  group.add(housing);
  const topRing = new THREE.Mesh(
    new THREE.RingGeometry(R * S + 0.06, R * S + 0.18, segs),
    new THREE.MeshStandardMaterial({ color: 0x323c48, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
  );
  topRing.rotation.x = -Math.PI / 2;
  topRing.position.y = edgeH + wallH;
  group.add(topRing);

  return group;
}

/** Brushed-metal radial texture with subtle concentric grain. */
function makeFloorTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#c9d0d8');
  g.addColorStop(0.6, '#aeb7c1');
  g.addColorStop(1, '#8a949f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // concentric brushing
  for (let r = 4; r < size / 2; r += 2) {
    ctx.strokeStyle = `rgba(${r % 6 === 0 ? '255,255,255' : '40,48,58'},${0.025 + ((r * 7919) % 13) / 500})`;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // centre emblem
  ctx.strokeStyle = 'rgba(30,36,44,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
