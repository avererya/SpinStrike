import type { CareerStore } from '../../career/store';
import type { PreviewHub } from '../../render/topPreview';
import type { Difficulty } from '../../career/config';

export type Route =
  | { name: 'starter' }
  | { name: 'garage' }
  | { name: 'upgrades' }
  | { name: 'history'; tab?: 'overview' | 'matchups' | 'stadiums' }
  | { name: 'battle' }
  | { name: 'collection' }
  | { name: 'career' }
  | { name: 'settings' };

export interface GameContext {
  store: CareerStore;
  previews: PreviewHub;
  go(route: Route): void;
  /** Re-renders the current screen (keeps scroll position). */
  refresh(): void;
  startQuickBattle(difficulty: Difficulty): void;
  openSandbox(): void;
  difficulty: Difficulty;
  setDifficulty(d: Difficulty): void;
  /** Starts a brand-new career with the chosen starter. */
  beginCareer(starterId: string): void;
  version: string;
  build: string;
}
