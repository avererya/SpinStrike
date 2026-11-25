export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Returns `v` when finite, otherwise `fallback`. */
export function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Scales (x, y) down so its length does not exceed `max`. Returns the scale applied. */
export function limitLength(x: number, y: number, max: number): number {
  const l2 = x * x + y * y;
  if (l2 <= max * max) return 1;
  return max / Math.sqrt(l2);
}
