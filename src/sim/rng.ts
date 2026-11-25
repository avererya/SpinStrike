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
