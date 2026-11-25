/**
 * Stadium surface abstraction.
 *
 * The simulation never assumes a particular stadium shape. Everything it
 * needs (height, slope, friction, boundary contact) comes through this
 * interface, so future stadiums (oval, polygonal boundaries, raised centres,
 * knockout pockets, multi-basin floors, friction zones) only need a new
 * implementation. The renderer builds its mesh by sampling the same
 * `height()` function, which keeps visuals and physics in agreement.
 */
export interface Vec2Out {
  x: number;
  y: number;
}

export interface WallContactOut {
  /** Unit normal pointing OUT of the play area at the contact. */
  nx: number;
  ny: number;
  /** Penetration depth into the wall, metres (> 0 when touching). */
  penetration: number;
}

export interface StadiumSurface {
  readonly id: string;
  readonly name: string;
  /** Radius of a circle that fully contains the play area, metres. */
  readonly boundingRadius: number;
  /** Coefficient of restitution for top–wall impacts. */
  readonly wallRestitution: number;
  /** Surface height z at (x, y), metres. Lower = deeper. */
  height(x: number, y: number): number;
  /** Writes ∂z/∂x, ∂z/∂y at (x, y) into `out`. Must be allocation-free. */
  gradient(x: number, y: number, out: Vec2Out): void;
  /** Surface friction multiplier at (x, y) (1 = nominal). */
  friction(x: number, y: number): number;
  /**
   * Boundary test for a circular body of `radius` centred at (x, y).
   * Returns true and fills `out` when the body touches the boundary wall.
   */
  wallContact(x: number, y: number, radius: number, out: WallContactOut): boolean;
  /** True if (x, y) lies on the playable floor (used by renderer sampling). */
  contains(x: number, y: number): boolean;
  /** Height of the vertical wall lip above the floor edge (visual only), metres. */
  readonly wallHeight: number;
}
