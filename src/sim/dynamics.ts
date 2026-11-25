import type { TopBody } from './body';
import type { StadiumSurface, Vec2Out } from './stadium/types';
import { GRAVITY, LIMITS } from './units';
import { clamp } from './math';

const grad: Vec2Out = { x: 0, y: 0 };

/** Tilt a stopped top settles to (lying on its side), rad. */
const TOPPLED_TILT = 1.15;
/** Max effective lean (sine) between spin axis and surface normal at the tip. */
const MAX_CONTACT_LEAN = 0.2;

/**
 * Advances one top's free motion (no top–top contact) by dt.
 *
 * Forces on a spinning top:
 *  1. Gravity projected on the local surface slope — pulls the top toward
 *     lower ground (the bowl centre).
 *  2. Tip traction. The tip contacts the surface at a point offset from the
 *     spin axis by c = tipDriveRadius · (surface lean + axis tilt). Because
 *     the top spins, that contact point slides over the floor at
 *     v + ω ẑ×c. Coulomb friction opposes the slip, which (a) pushes the top
 *     sideways — the classic "top runs around the bowl" behaviour — and
 *     (b) applies a counter-torque that drains spin. The force magnitude is
 *     capped so a single step can at most bring the slip to zero, which
 *     makes this coupling strictly dissipative: it can convert spin into
 *     motion but never create energy.
 *  3. Rolling resistance (linear drag scaled by surface friction).
 *  4. Passive spin decay: tip pivot friction (grows with tilt) + air drag.
 */
export function integrateFree(b: TopBody, stadium: StadiumSurface, dt: number): void {
  const p = b.params;
  stadium.gradient(b.x, b.y, grad);
  const gx = grad.x;
  const gy = grad.y;
  const s2 = gx * gx + gy * gy;
  const invNorm = 1 / Math.sqrt(1 + s2);
  // Horizontal component of gravity along the surface: g·sinθ·cosθ = g·tanθ/(1+tan²θ).
  const gScale = -GRAVITY / (1 + s2);
  const ax = gScale * gx;
  const ay = gScale * gy;
  const fric = stadium.friction(b.x, b.y);

  if (!b.spinning) {
    // Toppled top: slides with heavy friction and stops rotating.
    const damp = Math.exp(-6 * fric * dt);
    b.vx = (b.vx + ax * dt) * damp;
    b.vy = (b.vy + ay * dt) * damp;
    b.omega *= Math.exp(-4 * dt);
    if (Math.abs(b.omega) < 0.5) b.omega = 0;
    b.tilt += (TOPPLED_TILT - b.tilt) * (1 - Math.exp(-5 * dt));
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.omega * dt;
    return;
  }

  const normal = p.mass * GRAVITY * invNorm;
  const tx = b.tiltX;
  const ty = b.tiltY;
  // Surface lean (sine of the slope, pointing uphill).
  const sx = gx * invNorm;
  const sy = gy * invNorm;
  // The spin axis gradually settles toward the surface normal (gyroscopic
  // lag). Only the unsettled part of the lean, plus wobble, offsets the tip.
  const align = 1 - Math.exp(-p.axisSettleRate * dt);
  b.leanX += (sx - b.leanX) * align;
  b.leanY += (sy - b.leanY) * align;
  // Relative lean between axis and surface normal, limited to what a
  // tip's contact patch can physically express before its edge digs in.
  let lx = sx - b.leanX + tx;
  let ly = sy - b.leanY + ty;
  const l2 = lx * lx + ly * ly;
  if (l2 > MAX_CONTACT_LEAN * MAX_CONTACT_LEAN) {
    const k = MAX_CONTACT_LEAN / Math.sqrt(l2);
    lx *= k;
    ly *= k;
  }
  // Contact point offset from the axis (horizontal), metres.
  const cx = p.tipDriveRadius * lx;
  const cy = p.tipDriveRadius * ly;
  const w = b.omega;
  // Contact point velocity relative to the floor.
  const slipX = b.vx - w * cy;
  const slipY = b.vy + w * cx;
  const slip = Math.sqrt(slipX * slipX + slipY * slipY);

  let fx = 0;
  let fy = 0;
  if (slip > 1e-9) {
    const mu = p.tipTraction * fric;
    const effInvMass = b.invMass + (cx * cx + cy * cy) * b.invInertia;
    const fMax = slip / (dt * effInvMass); // force that would zero the slip in one step
    const fMag = Math.min(mu * normal, fMax);
    fx = (-fMag * slipX) / slip;
    fy = (-fMag * slipY) / slip;
  }
  const driveTorque = cx * fy - cy * fx;

  // Rolling resistance.
  const rr = p.rollingResistance * fric;
  const rx = -rr * p.mass * b.vx;
  const ry = -rr * p.mass * b.vy;

  b.vx += ((fx + rx) * b.invMass + ax) * dt;
  b.vy += ((fy + ry) * b.invMass + ay) * dt;

  let omega = w + driveTorque * b.invInertia * dt;
  // Passive spin friction (always opposes spin, never reverses it).
  const pivotRadius = p.tipSpinRadius + p.tipDriveRadius * b.tilt;
  const passive = (p.tipSpinFriction * fric * normal * pivotRadius + p.airDrag * Math.abs(omega)) * p.spinDecay;
  const dw = passive * b.invInertia * dt;
  if (Math.abs(omega) <= dw) omega = 0;
  else omega -= Math.sign(omega) * dw;
  b.omega = omega;

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.angle += b.omega * dt;

  updateWobble(b, dt);
}


/**
 * Smooth wobble model. The axis tilt relaxes toward a target that grows as
 * spin approaches the critical (toppling) speed, and the tilt direction
 * precesses at the gyroscopic rate Ω = m·g·l / (I·ω) — slow at high spin,
 * fast and wide as the top runs down. No random noise is involved.
 */
export function updateWobble(b: TopBody, dt: number): void {
  const p = b.params;
  const w = Math.abs(b.omega);
  const ratio = b.criticalSpin / Math.max(w, 1e-6);
  const target = Math.min(0.9, p.baseWobble + p.wobbleIntensity * ratio * ratio);
  const rate = 0.5 + 3.5 * p.stability;
  b.tilt += (target - b.tilt) * (1 - Math.exp(-rate * dt));
  const precession = clamp(
    (p.mass * GRAVITY * b.effectiveComHeight) / (b.inertia * Math.max(w, 1e-6)),
    0,
    60,
  );
  // Precession follows the spin direction.
  b.tiltPhase += (b.omega >= 0 ? 1 : -1) * precession * dt;
  if (b.tiltPhase > Math.PI * 2) b.tiltPhase -= Math.PI * 2;
  else if (b.tiltPhase < 0) b.tiltPhase += Math.PI * 2;
}

/**
 * Numerical safety net. Replaces non-finite values and clamps extreme ones.
 * Every intervention increments `guardTrips` so tests and the headless
 * runner can report it; a healthy simulation never trips the guard.
 */
export function guardBody(b: TopBody, stadium: StadiumSurface): void {
  let tripped = false;
  if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
    b.x = b.px;
    b.y = b.py;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
      b.x = 0;
      b.y = 0;
    }
    tripped = true;
  }
  if (!Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
    b.vx = 0;
    b.vy = 0;
    tripped = true;
  }
  if (!Number.isFinite(b.omega)) {
    b.omega = 0;
    tripped = true;
  }
  if (!Number.isFinite(b.tilt) || !Number.isFinite(b.tiltPhase)) {
    b.tilt = 0;
    b.tiltPhase = 0;
    tripped = true;
  }
  if (!Number.isFinite(b.angle)) {
    b.angle = 0;
    tripped = true;
  }
  const v2 = b.vx * b.vx + b.vy * b.vy;
  if (v2 > LIMITS.maxSpeed * LIMITS.maxSpeed) {
    const s = LIMITS.maxSpeed / Math.sqrt(v2);
    b.vx *= s;
    b.vy *= s;
    tripped = true;
  }
  if (Math.abs(b.omega) > LIMITS.maxSpin) {
    b.omega = Math.sign(b.omega) * LIMITS.maxSpin;
    tripped = true;
  }
  if (b.tilt > LIMITS.maxTilt) b.tilt = LIMITS.maxTilt;
  // Keep the angle bounded for float precision over long battles.
  const TAU = Math.PI * 2;
  if (b.angle > TAU || b.angle < -TAU) {
    const k = Math.trunc(b.angle / TAU);
    b.angle -= k * TAU;
    b.prevAngle -= k * TAU;
  }
  // Never allow a body to escape the stadium bounds.
  const R = stadium.boundingRadius;
  const r2 = b.x * b.x + b.y * b.y;
  if (r2 > R * R * 1.21) {
    const s = R / Math.sqrt(r2);
    b.x *= s;
    b.y *= s;
    tripped = true;
  }
  if (tripped) b.guardTrips++;
}
