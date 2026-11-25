import type { TopBody } from './body';
import type { StadiumSurface, WallContactOut } from './stadium/types';
import { LIMITS } from './units';

export interface CollisionParams {
  /** Global top–top restitution (multiplied by per-top factors). */
  restitution: number;
  /**
   * Scale of the additional rotational energy removed on impact (ring
   * chatter, vibration, deformation). 0 disables it.
   */
  energyLoss: number;
}

export const DEFAULT_COLLISION: CollisionParams = {
  restitution: 0.6,
  energyLoss: 0.6,
};

export interface CollisionEvent {
  kind: 'top' | 'wall';
  step: number;
  /** Contact point, metres. */
  x: number;
  y: number;
  /** Contact normal (from first top toward second / outward for wall). */
  nx: number;
  ny: number;
  /** Normal impulse magnitude, N·s. */
  impulse: number;
  /** Approach speed along the normal, m/s. */
  normalSpeed: number;
  /** Kinetic energy of the normal approach (0.5·μ·vn²), J. Drives effect scale. */
  impactEnergy: number;
  a: number;
  b: number;
}

/** Approach speed below which contacts are treated as resting (no bounce). */
const RESTING_SPEED = 0.03;
/** Allowed penetration before positional correction, m. */
const SLOP = 0.0003;
/** Fraction of penetration corrected per step. */
const CORRECTION = 0.8;
/** Minimum approach speed for a new contact to count as a collision, m/s. */
const COUNT_SPEED = 0.05;
/** Fraction of spin energy spent on a blade strike that becomes translational KE. */
const STRIKE_EFFICIENCY = 0.5;
/** Scale of impact spin loss from ring surfaces sliding under load. */
const CHATTER = 0.15;

function translationalKE(b: TopBody): number {
  return 0.5 * b.params.mass * (b.vx * b.vx + b.vy * b.vy);
}

export interface ContactState {
  touching: boolean;
}

/**
 * Resolves contact between two tops modelled as circles.
 *
 * Uses a sequential impulse at the contact point. The relative contact
 * velocity includes the surface velocity of each spinning ring (ω × r), so
 * spin direction matters: same-spin tops meet with opposing ring surfaces
 * (large slip, violent spin exchange), opposite-spin tops mesh more smoothly.
 * Tangential friction impulse is Coulomb-limited and never exceeds the
 * impulse needed to stop slip, so friction cannot inject energy.
 *
 * Returns an event when a new contact begins (for counting/effects).
 */
export function resolveTopPair(
  A: TopBody,
  B: TopBody,
  params: CollisionParams,
  state: ContactState,
  step: number,
): CollisionEvent | null {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const rA = A.params.radius;
  const rB = B.params.radius;
  const rSum = rA + rB;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rSum * rSum) {
    // Small hysteresis so grazing contacts do not flicker on/off.
    if (d2 > (rSum + 0.001) * (rSum + 0.001)) state.touching = false;
    return null;
  }
  let d = Math.sqrt(d2);
  let nx: number;
  let ny: number;
  if (d < 1e-9) {
    // Exactly coincident: choose a deterministic axis.
    nx = 1;
    ny = 0;
    d = 0;
  } else {
    nx = dx / d;
    ny = dy / d;
  }
  const tx = -ny;
  const ty = nx;

  // Contact-point velocities (ring surface velocity = ω ẑ × arm).
  // A's arm = +rA·n  → ẑ×n = t ; B's arm = −rB·n → ẑ×(−n) = −t
  const vAx = A.vx + A.omega * rA * tx;
  const vAy = A.vy + A.omega * rA * ty;
  const vBx = B.vx - B.omega * rB * tx;
  const vBy = B.vy - B.omega * rB * ty;
  const rvx = vAx - vBx;
  const rvy = vAy - vBy;
  const vn = rvx * nx + rvy * ny; // > 0 when approaching
  const vt = rvx * tx + rvy * ty;

  const wasTouching = state.touching;
  state.touching = true;
  let event: CollisionEvent | null = null;

  if (vn > 0) {
    const invMassSum = A.invMass + B.invMass;
    const e =
      vn < RESTING_SPEED
        ? 0
        : Math.min(0.98, params.restitution * Math.sqrt(A.params.restitution * B.params.restitution));
    const jn = ((1 + e) * vn) / invMassSum;

    // Tangential (friction) impulse, including rotational inertia.
    const mu = Math.sqrt(A.params.contactFriction * B.params.contactFriction);
    const tangentInv = invMassSum + rA * rA * A.invInertia + rB * rB * B.invInertia;
    const jtStick = vt / tangentInv;
    const jtMax = mu * jn;
    const jt = jtStick > jtMax ? jtMax : jtStick < -jtMax ? -jtMax : jtStick;

    // Impulse on B is +(jn·n + jt·t); on A it is the negative.
    const px = jn * nx + jt * tx;
    const py = jn * ny + jt * ty;
    A.vx -= px * A.invMass;
    A.vy -= py * A.invMass;
    B.vx += px * B.invMass;
    B.vy += py * B.invMass;
    // Torques: τ = arm × P (z-component).
    // A: arm = rA·n, P = −p → (rA n × −p)_z = −rA (n × p)_z = −rA·jt
    // B: arm = −rB·n, P = +p → (−rB n × p)_z = −rB·jt
    A.omega -= rA * jt * A.invInertia;
    B.omega -= rB * jt * B.invInertia;

    // Blade strike: ring protrusions convert part of the tangential surface
    // slip into a separating impulse when a fresh contact begins. The
    // resulting gain in translational kinetic energy is paid for out of
    // the strikers' rotational energy (at STRIKE_EFFICIENCY), so no energy
    // is created.
    if (!wasTouching) {
      const slipT = Math.abs(vt);
      const sA = A.spinning ? A.params.ringStrike : 0;
      const sB = B.spinning ? B.params.ringStrike : 0;
      const strikeSum = sA + sB;
      if (strikeSum > 0 && slipT > 0) {
        const keBefore = translationalKE(A) + translationalKE(B);
        const js = (strikeSum * slipT) / invMassSum;
        A.vx -= js * nx * A.invMass;
        A.vy -= js * ny * A.invMass;
        B.vx += js * nx * B.invMass;
        B.vy += js * ny * B.invMass;
        const gained = translationalKE(A) + translationalKE(B) - keBefore;
        if (gained > 0) {
          const cost = gained / STRIKE_EFFICIENCY;
          const shareA = sA / strikeSum;
          const availA = A.spinEnergy;
          const availB = B.spinEnergy;
          const payA = Math.min(availA, cost * shareA);
          const payB = Math.min(availB, cost - payA);
          A.removeSpinEnergy(payA);
          B.removeSpinEnergy(payB);
          const unpaid = cost - payA - payB;
          if (unpaid > 1e-12) {
            // Not enough spin left to fund the strike: scale velocities back.
            const scale = Math.sqrt(Math.max(0, keBefore) / (keBefore + gained));
            A.vx *= scale;
            A.vy *= scale;
            B.vx *= scale;
            B.vy *= scale;
          }
        }
      }
    }

    // Additional spin loss from the impact (vibration/deformation).
    const reducedMass = 1 / invMassSum;
    const impactEnergy = 0.5 * reducedMass * vn * vn;
    // Ring chatter: the normal impulse acts while ring surfaces slide past
    // each other at |vt|, dissipating spin roughly ∝ jn·|vt| (on top of the
    // Coulomb friction exchange above). Plus a share of the normal impact
    // energy. Both terms only ever remove energy.
    const chatter = CHATTER * jn * Math.abs(vt) + impactEnergy;
    const lossA = params.energyLoss * chatter * B.params.impactSpinDrain * (1 - A.params.impactSpinResist);
    const lossB = params.energyLoss * chatter * A.params.impactSpinDrain * (1 - B.params.impactSpinResist);
    A.removeSpinEnergy(lossA);
    B.removeSpinEnergy(lossB);
    A.impactEnergyReceived += impactEnergy;
    B.impactEnergyReceived += impactEnergy;

    // Gyroscopic tilt response: an impulse P applied at height h above the
    // centre of mass is an angular impulse h·(ẑ × P); the spin axis moves in
    // that direction by |ΔL| / (I·ω). Lower spin ⇒ bigger knock.
    tiltKick(A, -px, -py);
    tiltKick(B, px, py);

    if (!wasTouching && vn > COUNT_SPEED) {
      A.collisions++;
      B.collisions++;
      event = {
        kind: 'top',
        step,
        x: A.x + nx * rA,
        y: A.y + ny * rA,
        nx,
        ny,
        impulse: jn,
        normalSpeed: vn,
        impactEnergy,
        a: A.index,
        b: B.index,
      };
    }
  }

  // Positional correction split by inverse mass (heavier tops move less).
  const pen = rSum - d;
  if (pen > SLOP) {
    const corr = ((pen - SLOP) * CORRECTION) / (A.invMass + B.invMass);
    A.x -= nx * corr * A.invMass;
    A.y -= ny * corr * A.invMass;
    B.x += nx * corr * B.invMass;
    B.y += ny * corr * B.invMass;
  }
  return event;
}

function tiltKick(b: TopBody, px: number, py: number): void {
  if (!b.spinning) return;
  const p = b.params;
  const lever = p.comHeight - p.contactHeight; // ring sits below/above COM
  const w = Math.max(Math.abs(b.omega), b.criticalSpin);
  const scale = (lever * (1 - 0.7 * p.stability)) / (b.inertia * w);
  // ẑ × P = (−Py, Px); sign of spin sets which way the axis responds.
  const sgn = b.omega >= 0 ? 1 : -1;
  const kx = -py * scale * sgn;
  const ky = px * scale * sgn;
  const nxT = b.tiltX + kx;
  const nyT = b.tiltY + ky;
  b.setTiltVector(nxT, nyT);
  if (b.tilt > LIMITS.maxTilt) b.tilt = LIMITS.maxTilt;
}

const wall: WallContactOut = { nx: 0, ny: 0, penetration: 0 };
/** Approx. spin-energy share lost per unit wall impact energy. */
const WALL_SPIN_LOSS = 0.5;
const WALL_FRICTION = 0.08;

/** Resolves contact between a top and the stadium boundary wall. */
export function resolveWall(b: TopBody, stadium: StadiumSurface, step: number): CollisionEvent | null {
  if (!stadium.wallContact(b.x, b.y, b.params.radius, wall)) return null;
  const nx = wall.nx;
  const ny = wall.ny;
  b.x -= nx * wall.penetration;
  b.y -= ny * wall.penetration;
  const vn = b.vx * nx + b.vy * ny; // > 0 moving into the wall
  if (vn <= 0) return null;
  const e = vn < RESTING_SPEED ? 0 : stadium.wallRestitution;
  const jn = (1 + e) * vn * b.params.mass;
  // Tangential: ring surface velocity at the wall + translational slide.
  const tx = -ny;
  const ty = nx;
  const r = b.params.radius;
  const vt = b.vx * tx + b.vy * ty + b.omega * r; // arm = r·n, ẑ×n = t
  const tangentInv = b.invMass + r * r * b.invInertia;
  const jtStick = vt / tangentInv;
  const jtMax = WALL_FRICTION * jn;
  const jt = jtStick > jtMax ? jtMax : jtStick < -jtMax ? -jtMax : jtStick;
  b.vx -= (jn * nx + jt * tx) * b.invMass;
  b.vy -= (jn * ny + jt * ty) * b.invMass;
  b.omega -= r * jt * b.invInertia;
  const impactEnergy = 0.5 * b.params.mass * vn * vn;
  b.removeSpinEnergy(WALL_SPIN_LOSS * impactEnergy * (1 - b.params.impactSpinResist));
  tiltKick(b, -jn * nx, -jn * ny);
  if (vn > COUNT_SPEED * 2) {
    b.wallHits++;
    return {
      kind: 'wall',
      step,
      x: b.x + nx * r,
      y: b.y + ny * r,
      nx,
      ny,
      impulse: jn,
      normalSpeed: vn,
      impactEnergy,
      a: b.index,
      b: -1,
    };
  }
  return null;
}
