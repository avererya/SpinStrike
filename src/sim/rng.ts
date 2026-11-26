/**
 * Small, fast, seedable PRNG (mulberry32). The simulation must never call
 * Math.random(): every random choice flows through an Rng instance created
 * from the battle seed, which makes seeded battles exactly reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform float in [-amount, amount). */
  spread(amount: number): number {
    return (this.next() * 2 - 1) * amount;
  }
}

/** Generate a fresh 32-bit seed. Only used by the UI, never inside the sim. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * Stateless 32-bit integer hash (lowbias32 finaliser). Used to derive
 * independent, event-keyed random values from the battle seed so that a
 * random decision (a critical hit roll, an AI launch) depends only on its
 * key, never on how many other random numbers were drawn before it.
 */
export function hash32(x: number): number {
  x = x >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** Combines several integers into one 32-bit hash (order-sensitive). */
export function hashKey(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) h = hash32((h ^ hash32(p >>> 0)) + 0x632be5ab);
  return h >>> 0;
}

/** Uniform float in [0, 1) from a key (deterministic, stateless). */
export function keyedUniform(...parts: number[]): number {
  return hashKey(...parts) / 4294967296;
}

/** Stream identifiers for keyed randomness (arbitrary distinct constants). */
export const RNG_STREAM = {
  aiLaunch: 0xa1a0c4,
  critical: 0xc217,
} as const;
