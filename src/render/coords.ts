/**
 * Mapping between simulation space and Three.js space.
 *
 * Simulation: metres, (x, y) horizontal, +z up.
 * Three.js:   scene units, Y up. 1 sim metre = WORLD_SCALE scene units
 *             (keeps camera near/far planes comfortable).
 *             three.x = sim.x, three.y = sim.z, three.z = −sim.y
 * The mapping is right-handed, so a positive sim angle about +z is a
 * positive Three.js rotation about +Y.
 */
export const WORLD_SCALE = 10;

export function simToThreeX(x: number): number {
  return x * WORLD_SCALE;
}
export function simToThreeY(z: number): number {
  return z * WORLD_SCALE;
}
export function simToThreeZ(y: number): number {
  return -y * WORLD_SCALE;
}
