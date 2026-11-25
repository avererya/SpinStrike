/**
 * Internal unit conventions for the SpinStrike physics simulation.
 *
 * All simulation quantities use SI-style units so the physics reads like
 * ordinary mechanics and future contributors can reason about magnitudes:
 *
 *   length            metres (m)        bowl radius ≈ 0.20 m, top radius ≈ 0.025 m
 *   mass              kilograms (kg)    tops ≈ 0.03–0.06 kg
 *   time              seconds (s)
 *   angle             radians (rad)
 *   velocity          m/s
 *   angular velocity  rad/s             launch spin ≈ 500–800 rad/s (≈ 5–7.5k rpm)
 *   force             newtons (N)
 *   torque            N·m
 *   energy            joules (J)
 *   moment of inertia kg·m²
 *
 * The horizontal play plane is (x, y); +z is up. Positive angular velocity is
 * counter-clockwise when viewed from above (right-hand rule about +z).
 *
 * Gameplay stats (0–100) are NOT in these units. They are mapped to physical
 * parameters in `src/content/derive.ts`.
 */

/** Gravitational acceleration, m/s². */
export const GRAVITY = 9.81;

/** Default fixed physics step rate, Hz. */
export const DEFAULT_STEP_HZ = 240;

/** Hard safety limits used by numerical-instability guards. */
export const LIMITS = {
  /** Max translational speed, m/s. Real tops rarely exceed ~3 m/s. */
  maxSpeed: 8,
  /** Max angular speed, rad/s (≈ 19k rpm). */
  maxSpin: 2000,
  /** Max axis tilt, rad. */
  maxTilt: 1.3,
  /** Max substeps per fixed step. */
  maxSubsteps: 8,
} as const;
