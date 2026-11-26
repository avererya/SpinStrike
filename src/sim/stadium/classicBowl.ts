import type { StadiumSurface, Vec2Out, WallContactOut } from './types';
import { RNG_STREAM, keyedUniform } from '../rng';

/**
 * Floor imperfections (v0.4.1). A real stadium floor is never a perfect
 * surface of revolution: moulding tolerances, wear, dust and a table that
 * is not perfectly level all add slight unevenness. Modelled as a smooth,
 * seeded micro-relief (a sum of long-wavelength surface waves) plus a
 * matching variation of surface grip. The relief is part of the height
 * field, so gravity on it is conservative (no energy is created); the grip
 * variation only scales friction, which is dissipative.
 */
export interface FloorRelief {
  /** RMS height of the micro-relief, m (≈ 0.2 mm; invisible at play scale). */
  amplitude: number;
  /** RMS relative variation of surface friction (0.06 = ±6 %). */
  frictionVariation: number;
  /** Seed of the relief pattern (derived from the battle seed). */
  seed: number;
}

interface Wave {
  kx: number;
  ky: number;
  phase: number;
  amp: number;
}
const RELIEF_WAVES = 6;
const RELIEF_WAVELENGTH: readonly [number, number] = [0.07, 0.2];

function makeWaves(seed: number, salt: number, rms: number): Wave[] {
  const out: Wave[] = [];
  if (!(rms > 0)) return out;
  const amp = rms * Math.sqrt(2 / RELIEF_WAVES);
  for (let k = 0; k < RELIEF_WAVES; k++) {
    const u = (c: number) => keyedUniform(RNG_STREAM.floor, seed >>> 0, salt, k, c);
    const lambda = RELIEF_WAVELENGTH[0] + (RELIEF_WAVELENGTH[1] - RELIEF_WAVELENGTH[0]) * u(1);
    const dir = u(2) * Math.PI * 2;
    const kmag = (Math.PI * 2) / lambda;
    out.push({ kx: Math.cos(dir) * kmag, ky: Math.sin(dir) * kmag, phase: u(3) * Math.PI * 2, amp });
  }
  return out;
}

export interface ClassicBowlParams {
  /** Radius of the playable floor (inside of the wall), metres. */
  radius: number;
  /**
   * Bowl depth at the wall relative to the centre, metres. This is the
   * "stadium slope" developer control: larger = steeper bowl.
   */
  depth: number;
  /** Fraction of radius where the raised rim begins to curve up more steeply. */
  rimStart: number;
  /** Extra height gained by the rim between rimStart and the wall, metres. */
  rimRise: number;
  /** Surface friction multiplier (1 = nominal). */
  surfaceFriction: number;
  /** Top–wall coefficient of restitution. */
  wallRestitution: number;
  /** Visual wall height above the rim edge, metres. */
  wallHeight: number;
  /** v0.4.1 floor imperfections. Undefined = perfect surface (v0.4.0). */
  relief?: FloorRelief;
}

export const DEFAULT_CLASSIC_BOWL: ClassicBowlParams = {
  radius: 0.2,
  depth: 0.03,
  rimStart: 0.82,
  rimRise: 0.018,
  surfaceFriction: 1,
  wallRestitution: 0.5,
  wallHeight: 0.016,
};

/**
 * The Classic Bowl: a circular, concave stadium.
 *
 * Height profile (r = distance from centre, R = radius, rs = rimStart·R):
 *   z(r) = depth·(r/R)²                                 (parabolic basin)
 *        + rimRise·((r − rs)/(R − rs))²   for r > rs     (steeper raised rim)
 *
 * The parabolic basin gives a gentle, nearly linear restoring slope toward
 * the centre; the rim term makes the outer band noticeably steeper so tops
 * running along the edge are turned back inward before they hit the wall.
 */
export class ClassicBowl implements StadiumSurface {
  readonly id = 'classic-bowl';
  readonly name = 'Classic Bowl';
  readonly boundingRadius: number;
  readonly wallRestitution: number;
  readonly wallHeight: number;
  private readonly r: number;
  private readonly invR2: number;
  private readonly depth: number;
  private readonly rs: number;
  private readonly rimK: number;
  private readonly fric: number;
  private readonly hWaves: Wave[];
  private readonly fWaves: Wave[];

  constructor(readonly params: ClassicBowlParams = DEFAULT_CLASSIC_BOWL) {
    this.r = params.radius;
    this.boundingRadius = params.radius;
    this.invR2 = 1 / (params.radius * params.radius);
    this.depth = params.depth;
    this.rs = params.rimStart * params.radius;
    const band = Math.max(1e-6, params.radius - this.rs);
    this.rimK = params.rimRise / (band * band);
    this.fric = params.surfaceFriction;
    this.wallRestitution = params.wallRestitution;
    this.wallHeight = params.wallHeight;
    this.hWaves = params.relief ? makeWaves(params.relief.seed, 1, params.relief.amplitude) : [];
    this.fWaves = params.relief ? makeWaves(params.relief.seed, 2, params.relief.frictionVariation) : [];
  }

  private heightR(r: number): number {
    const rc = Math.min(r, this.r);
    let z = this.depth * rc * rc * this.invR2;
    if (rc > this.rs) {
      const d = rc - this.rs;
      z += this.rimK * d * d;
    }
    return z;
  }

  /** dz/dr */
  private slopeR(r: number): number {
    const rc = Math.min(r, this.r);
    let s = 2 * this.depth * rc * this.invR2;
    if (rc > this.rs) s += 2 * this.rimK * (rc - this.rs);
    return s;
  }

  height(x: number, y: number): number {
    let z = this.heightR(Math.sqrt(x * x + y * y));
    for (const w of this.hWaves) z += w.amp * Math.cos(w.kx * x + w.ky * y + w.phase);
    return z;
  }

  gradient(x: number, y: number, out: Vec2Out): void {
    const r = Math.sqrt(x * x + y * y);
    let gx = 0;
    let gy = 0;
    if (r >= 1e-9) {
      const s = this.slopeR(r) / r;
      gx = s * x;
      gy = s * y;
    }
    for (const w of this.hWaves) {
      const d = -w.amp * Math.sin(w.kx * x + w.ky * y + w.phase);
      gx += d * w.kx;
      gy += d * w.ky;
    }
    out.x = gx;
    out.y = gy;
  }

  friction(x: number, y: number): number {
    if (this.fWaves.length === 0) return this.fric;
    let v = 1;
    for (const w of this.fWaves) v += w.amp * Math.cos(w.kx * x + w.ky * y + w.phase);
    return this.fric * Math.min(1.5, Math.max(0.5, v));
  }

  wallContact(x: number, y: number, radius: number, out: WallContactOut): boolean {
    const r = Math.sqrt(x * x + y * y);
    const pen = r + radius - this.r;
    if (pen <= 0) return false;
    if (r < 1e-9) {
      out.nx = 1;
      out.ny = 0;
    } else {
      out.nx = x / r;
      out.ny = y / r;
    }
    out.penetration = pen;
    return true;
  }

  contains(x: number, y: number): boolean {
    return x * x + y * y <= this.r * this.r;
  }
}
