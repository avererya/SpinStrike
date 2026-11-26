import { el, hex } from '../dom';
import type { TopDefinition } from '../../content/tops';
import type { GameplayStats } from '../../content/stats';

export const CLASS_COLOR: Record<string, string> = { Attack: '#ff6a3d', Defense: '#4d8dff', Stamina: '#2fcf8a', Balance: '#a77bff' };

export function chip(text: string, cls = '', title = ''): HTMLElement {
  return el('span', { class: `chip ${cls}`.trim(), text, title });
}
export function classChip(cls: string): HTMLElement {
  const c = chip(cls, 'class-chip');
  c.style.setProperty('--c', CLASS_COLOR[cls] ?? '#8b96a5');
  return c;
}
export function rarityChip(label: string): HTMLElement {
  return chip(label, `rarity-chip r-${label.toLowerCase()}`);
}

/** A labelled horizontal meter (0–1). */
export function meter(frac: number, label: string, cls = ''): HTMLElement {
  const fill = el('div', { class: 'meter-fill' });
  fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  return el('div', { class: `meter ${cls}`.trim(), role: 'meter', 'aria-label': label, title: label }, [fill]);
}

export function pips(rank: number, max: number): HTMLElement {
  const row = el('div', { class: 'pips', role: 'img', 'aria-label': `${rank} of ${max}` });
  for (let i = 0; i < max; i++) row.append(el('span', { class: i < rank ? 'pip on' : 'pip' }));
  return row;
}

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
/** Stat value with at most one decimal ("94.5", "63"). */
export function fmtStat(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
export const fmtPct = (f: number): string => `${Math.round(f * 100)}%`;
export function fmtDuration(s: number | null): string {
  if (s === null) return '—';
  return `${s.toFixed(1)} s`;
}

export const STAT_ROWS: { key: keyof GameplayStats; label: string }[] = [
  { key: 'health', label: 'Health' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'speed', label: 'Speed' },
  { key: 'weight', label: 'Weight' },
];

/** Strengths / weaknesses text derived from the stats (works for any top). */
export function traitsOf(stats: GameplayStats): { strong: string[]; weak: string[] } {
  const rows = STAT_ROWS.map((r) => ({ label: r.label, v: stats[r.key] })).sort((a, b) => b.v - a.v);
  const strong = rows.filter((r) => r.v >= 70).slice(0, 2).map((r) => r.label);
  const weak = [...rows].reverse().filter((r) => r.v <= 45).slice(0, 2).map((r) => r.label);
  return { strong: strong.length ? strong : [rows[0]!.label], weak };
}

export function accentStyle(def: TopDefinition): string {
  return `--accent-top:${hex(def.palette.accent)};--primary-top:${hex(def.palette.primary)}`;
}

/** Plain base-stat bars (0–100) for starter selection and the Collection. */
export function statBars(stats: GameplayStats): HTMLElement {
  const wrap = el('div', { class: 'statbars' });
  for (const r of STAT_ROWS) {
    wrap.append(el('div', { class: 'sb-row' }, [el('span', { class: 'sb-k', text: r.label }), meter(stats[r.key] / 100, `${r.label} ${stats[r.key]}`), el('span', { class: 'sb-v', text: fmtStat(stats[r.key]) })]));
  }
  return wrap;
}

export function button(text: string, cls: string, fn: () => void, title = ''): HTMLButtonElement {
  const b = el('button', { class: `btn ${cls}`.trim(), text, title });
  b.addEventListener('click', fn);
  return b;
}

export function section(title: string, children: (Node | string)[], cls = ''): HTMLElement {
  return el('section', { class: `panel ${cls}`.trim() }, [el('h3', { class: 'panel-title', text: title }), ...children]);
}

export function kv(k: string, v: string | Node): HTMLElement {
  return el('div', { class: 'kv' }, [el('span', { class: 'kv-k', text: k }), typeof v === 'string' ? el('span', { class: 'kv-v', text: v }) : v]);
}
