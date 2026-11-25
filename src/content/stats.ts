/**
 * Gameplay stats are relative 0–100 design values. They are NOT physical
 * units. `derive.ts` maps them to physics parameters.
 */
export interface GameplayStats {
  health: number;
  attack: number;
  defense: number;
  stamina: number;
  speed: number;
  weight: number;
}

export type TopClass = 'Attack' | 'Defense' | 'Stamina' | 'Balance';
