/**
 * Pure formatting helpers for the HUD and result card (no DOM), so they can
 * be unit-tested.
 */

/**
 * Stamina fraction (0–1) as a percentage label. Never rounds a nonzero
 * value down to "0%": small values get more precision and values below
 * 0.1 % read "<0.1%". Exactly 0 (a stopped top) reads "0%".
 */
export function formatStamina(f: number): string {
  if (!Number.isFinite(f) || f <= 0) return '0%';
  const p = Math.min(1, f) * 100;
  if (p < 0.1) return '<0.1%';
  if (p < 10) return `${(Math.floor(p * 10) / 10).toFixed(1)}%`;
  return `${Math.floor(p)}%`;
}

/** Health label "current / max" that never shows 0 for a top with health left. */
export function formatHealth(h: number, max: number): string {
  const cur = h > 0 ? Math.max(1, Math.ceil(h - 1e-9)) : 0;
  return `${cur} / ${Math.round(max)}`;
}

/** "+10%" style label for a launch energy multiplier. */
export function formatBonus(mult: number): string {
  const p = Math.round((mult - 1) * 1000) / 10;
  if (Math.abs(p) < 0.05) return '+0%';
  return `${p > 0 ? '+' : ''}${Number.isInteger(p) ? p.toFixed(0) : p.toFixed(1)}%`;
}
