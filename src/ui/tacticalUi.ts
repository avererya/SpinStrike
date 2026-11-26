/**
 * Tactical combat interface (v0.5): Boost aim-and-release gesture, the
 * directional arrow, the Boost / Brace control bar and the short tactical
 * help card. Pure input collection and presentation: it never touches the
 * simulation. The stage turns a finished gesture into an AbilityRequest and
 * submits it to the battle, which validates it again on release.
 */
import { el } from './dom';
import type { AbilityView, BoostParams, RejectReason } from '../sim/tactics';
import { boostCostFraction } from '../sim/tactics';

/** Gesture normalisation, as fractions of the displayed stadium diameter. */
export const GESTURE = {
  /** Shorter drags are cancelled (no charge, no stamina). */
  deadZone: 0.06,
  /** Drag length that gives full strength. */
  fullLength: 0.36,
} as const;

/** Normalised boost strength for a drag of `len` px on a stadium of `diameter` px (0 = below the dead zone). */
export function gestureStrength(len: number, diameter: number, b: Pick<BoostParams, 'minStrength' | 'maxStrength'>): number {
  if (!(diameter > 0) || !(len >= 0)) return 0;
  const f = len / diameter;
  if (f < GESTURE.deadZone) return 0;
  const u = Math.min(1, (f - GESTURE.deadZone) / (GESTURE.fullLength - GESTURE.deadZone));
  return b.minStrength + (b.maxStrength - b.minStrength) * u;
}

export const REJECT_TEXT: Record<RejectReason, string> = {
  disabled: 'Abilities are off',
  phase: 'Battle is not running',
  eliminated: 'Your top is out',
  stopped: 'Your top has stopped',
  cooldown: 'Cooling down',
  charges: 'No charges left',
  stamina: 'Not enough stamina',
  strength: 'Drag further to boost',
  direction: 'Drag to aim',
  active: 'Brace already active',
  slot: 'Unavailable',
  tick: 'Unavailable',
};

export interface AimState {
  pointerId: number;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  /** 'pointer' (touch / mouse drag) or 'keys' (keyboard aim). */
  source: 'pointer' | 'keys';
}

/** Small pip row: ● for remaining charges, ○ for used ones. */
function pips(n: number, total: number): string {
  const t = Math.max(total, n, 0);
  return '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, t - n));
}

/**
 * The player's tactical bar: Boost status (gesture hint, charges, cooldown,
 * cost preview) and a large Brace button (charges, cooldown, active time).
 */
export class TacticalBar {
  readonly root: HTMLElement;
  readonly braceBtn: HTMLButtonElement;
  readonly helpBtn: HTMLButtonElement;
  private readonly boostBox: HTMLElement;
  private readonly boostPips: HTMLElement;
  private readonly boostState: HTMLElement;
  private readonly boostCd: HTMLElement;
  private readonly bracePips: HTMLElement;
  private readonly braceState: HTMLElement;
  private readonly braceCd: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;
  private totals = { boost: 3, brace: 2 };

  constructor(onBrace: () => void, onHelp: () => void) {
    this.boostPips = el('span', { class: 'tac-pips', 'aria-label': 'Boost charges' });
    this.boostState = el('span', { class: 'tac-state' });
    this.boostCd = el('div', { class: 'tac-cd' });
    this.boostBox = el('div', { class: 'tac-boost', role: 'status', 'aria-label': 'Boost' }, [
      el('div', { class: 'tac-line' }, [el('span', { class: 'tac-icon', text: '➹' }), el('strong', { text: 'Boost' }), this.boostPips]),
      this.boostState,
      this.boostCd,
    ]);
    this.bracePips = el('span', { class: 'tac-pips', 'aria-label': 'Brace charges' });
    this.braceState = el('span', { class: 'tac-state' });
    this.braceCd = el('div', { class: 'tac-cd' });
    this.braceBtn = el('button', { class: 'tac-brace', title: 'Brace (B or Shift): reduces incoming damage and knockback for a moment' }, [
      el('div', { class: 'tac-line' }, [el('span', { class: 'tac-icon', text: '⛨' }), el('strong', { text: 'Brace' }), this.bracePips]),
      this.braceState,
      this.braceCd,
    ]);
    this.braceBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onBrace();
    });
    this.braceBtn.addEventListener('click', (e) => e.preventDefault());
    this.braceBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onBrace();
      }
    });
    this.helpBtn = el('button', { class: 'tac-help-btn', title: 'How Boost and Brace work', 'aria-label': 'Tactical help', text: '?' });
    this.helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onHelp();
    });
    this.toast = el('div', { class: 'tac-toast', 'aria-live': 'polite' });
    this.root = el('div', { class: 'tac-bar' }, [this.boostBox, this.helpBtn, this.braceBtn, this.toast]);
  }

  setTotals(boost: number, brace: number): void {
    this.totals = { boost, brace };
  }

  /** Brief feedback line (rejected input, cancelled gesture). */
  flash(text: string, ms = 1100): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  update(v: AbilityView, aiming: { strength: number; costPct: number } | null): void {
    this.boostPips.textContent = pips(v.boostCharges, this.totals.boost);
    this.bracePips.textContent = pips(v.braceCharges, this.totals.brace);
    let bs: string;
    if (aiming) bs = aiming.strength > 0 ? `${Math.round(aiming.strength * 100)} % · −${aiming.costPct.toFixed(1)} % stamina` : 'Drag further…';
    else if (v.boostCharges <= 0) bs = 'No charges';
    else if (v.boostBlocked === 'cooldown') bs = `Ready in ${v.boostCooldown.toFixed(1)} s`;
    else if (v.boostBlocked === 'stamina') bs = 'Low stamina';
    else if (v.boostBlocked) bs = '—';
    else bs = 'Drag in the stadium, release';
    this.boostState.textContent = bs;
    this.boostCd.style.transform = `scaleX(${v.boostBlocked === 'cooldown' ? v.boostCooldownProgress : 1})`;
    this.boostBox.classList.toggle('ready', v.boostAvailable);
    this.boostBox.classList.toggle('aiming', !!aiming);
    this.boostBox.classList.toggle('off', !v.boostAvailable && !aiming);

    let rs: string;
    if (v.braceActive) rs = `Active ${v.braceRemaining.toFixed(1)} s`;
    else if (v.braceCharges <= 0) rs = 'No charges';
    else if (v.braceBlocked === 'cooldown') rs = `Ready in ${v.braceCooldown.toFixed(1)} s`;
    else if (v.braceBlocked) rs = '—';
    else rs = 'Tap before impact';
    this.braceState.textContent = rs;
    if (!v.braceActive) this.braceCd.style.transform = `scaleX(${v.braceBlocked === 'cooldown' ? v.braceCooldownProgress : 1})`;
    this.braceBtn.classList.toggle('active', v.braceActive);
    this.braceBtn.classList.toggle('ready', v.braceAvailable);
    this.braceBtn.disabled = !v.braceAvailable && !v.braceActive;
    this.braceBtn.setAttribute('aria-disabled', String(!v.braceAvailable));
  }

  /** Active-duration bar of Brace as a fraction (set by the stage, which knows the duration). */
  setBraceFraction(f: number): void {
    if (this.braceBtn.classList.contains('active')) this.braceCd.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
  }
}

/** SVG overlay drawing the Boost arrow from the player's top. */
export class AimArrow {
  readonly root: SVGSVGElement;
  private readonly line: SVGLineElement;
  private readonly head: SVGPolygonElement;
  private readonly ring: SVGCircleElement;
  private readonly label: SVGTextElement;

  constructor() {
    const ns = 'http://www.w3.org/2000/svg';
    this.root = document.createElementNS(ns, 'svg');
    this.root.setAttribute('class', 'aim-arrow');
    this.root.setAttribute('aria-hidden', 'true');
    this.ring = document.createElementNS(ns, 'circle');
    this.ring.setAttribute('class', 'aim-origin');
    this.line = document.createElementNS(ns, 'line');
    this.line.setAttribute('class', 'aim-line');
    this.head = document.createElementNS(ns, 'polygon');
    this.head.setAttribute('class', 'aim-head');
    this.label = document.createElementNS(ns, 'text');
    this.label.setAttribute('class', 'aim-label');
    this.root.append(this.ring, this.line, this.head, this.label);
    this.hide();
  }

  hide(): void {
    this.root.classList.remove('show');
  }

  /**
   * Draws the arrow from (ox, oy) (the top, CSS px within the stage) along
   * the screen direction (ux, uy) with a length set by the strength. A weak
   * (below dead-zone) aim is drawn dashed and dim.
   */
  draw(ox: number, oy: number, ux: number, uy: number, strength: number, text: string, maxLen: number): void {
    const valid = strength > 0;
    const len = (valid ? 0.25 + 0.75 * strength : 0.18) * maxLen;
    const ex = ox + ux * len;
    const ey = oy + uy * len;
    this.ring.setAttribute('cx', ox.toFixed(1));
    this.ring.setAttribute('cy', oy.toFixed(1));
    this.ring.setAttribute('r', '16');
    this.line.setAttribute('x1', ox.toFixed(1));
    this.line.setAttribute('y1', oy.toFixed(1));
    this.line.setAttribute('x2', ex.toFixed(1));
    this.line.setAttribute('y2', ey.toFixed(1));
    const hw = 9 + 5 * strength;
    const px = -uy;
    const py = ux;
    const tip = `${(ex + ux * hw * 1.2).toFixed(1)},${(ey + uy * hw * 1.2).toFixed(1)}`;
    const l = `${(ex + px * hw).toFixed(1)},${(ey + py * hw).toFixed(1)}`;
    const r = `${(ex - px * hw).toFixed(1)},${(ey - py * hw).toFixed(1)}`;
    this.head.setAttribute('points', `${tip} ${l} ${r}`);
    this.label.setAttribute('x', (ex + ux * (hw * 1.2 + 14)).toFixed(1));
    this.label.setAttribute('y', (ey + uy * (hw * 1.2 + 14) + 4).toFixed(1));
    this.label.textContent = text;
    this.root.style.setProperty('--aim-w', `${(3 + 4 * strength).toFixed(1)}px`);
    this.root.classList.toggle('weak', !valid);
    this.root.classList.add('show');
  }
}

/** Cost preview in percent of launch energy for a strength. */
export function costPercent(b: BoostParams, strength: number): number {
  return strength > 0 ? boostCostFraction(b, strength) * 100 : 0;
}

/** The short, dismissible tactical tutorial (also opened from the ? button). */
export class TacticalHelp {
  readonly root: HTMLElement;
  private onClose: (() => void) | null = null;

  constructor() {
    const ok = el('button', { class: 'btn primary', text: 'Got it' });
    ok.addEventListener('click', () => this.close());
    this.root = el('div', { class: 'tac-help', role: 'dialog', 'aria-label': 'Tactical abilities' }, [
      el('div', { class: 'tac-help-title', text: 'Tactical abilities' }),
      el('ul', {}, [
        el('li', {}, [el('strong', { text: 'Boost: ' }), 'press anywhere in the stadium, drag the way you want to go, and release. You do not need to touch your top.']),
        el('li', { text: 'Longer drags give a stronger boost (33–100 %).' }),
        el('li', { text: 'Every boost costs a little stamina (1–3 % of your launch spin).' }),
        el('li', {}, [el('strong', { text: 'Brace: ' }), 'tap just before a hit to take 30 % less damage and 25 % less knockback for 1.5 s.']),
        el('li', { text: 'Each battle gives you 3 Boosts and 2 Braces. Charges do not come back until the next battle.' }),
      ]),
      el('div', { class: 'tac-help-keys', text: 'Keyboard: hold arrow keys to aim a boost, release to fire · B or Shift = Brace · Space = pause' }),
      el('div', { class: 'btn-row' }, [ok]),
    ]);
  }

  get open(): boolean {
    return this.root.classList.contains('show');
  }

  show(onClose?: () => void): void {
    this.onClose = onClose ?? null;
    this.root.classList.add('show');
  }

  close(): void {
    if (!this.open) return;
    this.root.classList.remove('show');
    const f = this.onClose;
    this.onClose = null;
    f?.();
  }
}

/** Compact per-top ability summary for the HUD cards (both sides). */
export function abilityChipText(v: AbilityView, totals: { boost: number; brace: number }): string {
  return `➹ ${pips(v.boostCharges, totals.boost)}  ⛨ ${pips(v.braceCharges, totals.brace)}`;
}
