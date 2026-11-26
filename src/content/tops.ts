import type { GameplayStats, TopClass } from './stats';

export interface TopPalette {
  /** Main body colour (hex). */
  primary: number;
  /** Secondary colour. */
  secondary: number;
  /** Accent / trim colour. */
  accent: number;
  /** Metal tint. */
  metal: number;
}

export interface TopDefinition {
  id: string;
  name: string;
  topClass: TopClass;
  description: string;
  /** Preliminary gameplay stats (design values, 0–100). */
  stats: GameplayStats;
  parts: { core: string; ring: string; disc: string; tip: string };
  palette: TopPalette;
  /** +1 = right spin (clockwise from above), −1 = left spin. */
  spinDirection: 1 | -1;
}

export const STARTER_TOPS: readonly TopDefinition[] = [
  {
    id: 'inferno',
    name: 'Inferno',
    topClass: 'Attack',
    description: 'Aggressive flat-tip attacker that sweeps the bowl and burns its own spin to hit hard.',
    stats: { health: 60, attack: 90, defense: 35, stamina: 45, speed: 85, weight: 50 },
    parts: { core: 'core-flame', ring: 'blaze-fang', disc: 'spoke-6', tip: 'rush-flat' },
    palette: { primary: 0xc8191e, secondary: 0x141414, accent: 0xff7a1a, metal: 0xc9ccd2 },
    spinDirection: 1,
  },
  {
    id: 'titan',
    name: 'Titan',
    topClass: 'Defense',
    description: 'Heavy armoured ball-tip defender that settles in the centre and shrugs off hits.',
    stats: { health: 90, attack: 40, defense: 95, stamina: 65, speed: 30, weight: 95 },
    parts: { core: 'core-shield', ring: 'aegis-wall', disc: 'heavy-solid', tip: 'bastion-ball' },
    palette: { primary: 0x1f56c9, secondary: 0x0c1e45, accent: 0x7fb4ff, metal: 0xd4d8de },
    spinDirection: 1,
  },
  {
    id: 'tempest',
    name: 'Tempest',
    topClass: 'Stamina',
    description: 'Smooth, efficient needle-tip spinner built to outlast everything.',
    stats: { health: 60, attack: 35, defense: 50, stamina: 100, speed: 50, weight: 55 },
    parts: { core: 'core-leaf', ring: 'zephyr-halo', disc: 'outer-rim', tip: 'needle-point' },
    palette: { primary: 0x0f9a5c, secondary: 0x0a3d2a, accent: 0xe2b33c, metal: 0xd8c78f },
    spinDirection: 1,
  },
  {
    id: 'phantom',
    name: 'Phantom',
    topClass: 'Balance',
    description: 'Well-rounded semi-flat all-rounder with no extreme strengths or weaknesses.',
    stats: { health: 65, attack: 65, defense: 65, stamina: 65, speed: 65, weight: 65 },
    parts: { core: 'core-crescent', ring: 'eclipse-wing', disc: 'notch-8', tip: 'vector-semi' },
    palette: { primary: 0x6a2fc0, secondary: 0x121018, accent: 0xb9a7e8, metal: 0xc3c6cf },
    spinDirection: 1,
  },
];

/**
 * v0.2 starter stats, kept for the legacy v0.2 ruleset (regression runs and
 * migrated v0.1/v0.2 configurations). v0.3 stats live in STARTER_TOPS.
 */
export const LEGACY_V02_STATS: Readonly<Record<string, GameplayStats>> = {
  inferno: { health: 60, attack: 90, defense: 35, stamina: 45, speed: 85, weight: 50 },
  titan: { health: 90, attack: 40, defense: 95, stamina: 65, speed: 30, weight: 95 },
  tempest: { health: 60, attack: 35, defense: 50, stamina: 100, speed: 50, weight: 55 },
  phantom: { health: 65, attack: 65, defense: 65, stamina: 65, speed: 65, weight: 65 },
};

export function getTop(id: string): TopDefinition {
  const t = STARTER_TOPS.find((d) => d.id === id);
  if (!t) throw new Error(`Unknown top id: ${id}`);
  return t;
}
