/**
 * AI difficulty levels (shared by the tactical AI, the sandbox and the
 * career). Defined here, outside the career layer, so the sandbox can offer
 * AI opponents without importing career code.
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', expert: 'Expert' };
