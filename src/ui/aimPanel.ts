import { el } from './dom';
import { AIM_LIMITS, DEFAULT_AIM, clampAim, type LaunchAim } from '../sim/launchGeometry';
import { aimPreview, type AimPreview } from '../sim/aimPreview';
import type { BattleOptions } from '../sim/battle';

/**
 * Pre-battle launch aiming (v0.4.1). A top-down view of the stadium with
 * both start positions and the player's nominal opening path, simulated by
 * the real physics (see sim/aimPreview.ts).
 *
 *   drag left / right  → launch direction (−45° … +45°, + = toward the centre)
 *   drag up / down     → release tilt (0° … 30°)
 *   sliders and ± buttons are the accessible alternative; Reset restores the
 *   default aim; "Time launch" proceeds to the timing minigame.
 *
 * The canvas uses `touch-action: none` and pointer capture, so aiming
 * gestures never scroll the page on mobile.
 */
export class AimPanel {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly dirIn: HTMLInputElement;
  private readonly tiltIn: HTMLInputElement;
  private readonly dirOut: HTMLElement;
  private readonly tiltOut: HTMLElement;
  private readonly title: HTMLElement;
  private readonly keys: [HTMLElement, HTMLElement];
  private opts: BattleOptions | null = null;
  private aim: LaunchAim = { ...DEFAULT_AIM };
  private preview: AimPreview | null = null;
  private colors: [string, string] = ['#ff5a3c', '#5aa0ff'];
  private onProceed: ((aim: LaunchAim) => void) | null = null;
  private onChange: ((aim: LaunchAim) => void) | null = null;
  private drag: { id: number; x: number; y: number; aim: LaunchAim } | null = null;
  private raf = 0;

  constructor() {
    this.canvas = el('canvas', { class: 'aim-canvas', 'aria-label': 'Launch aim: drag sideways to change direction, up or down to change tilt' });
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, aim: { ...this.aim } };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      e.preventDefault();
      const w = Math.max(160, this.canvas.clientWidth);
      // A full canvas-width drag sweeps the whole direction range; a full height sweeps the tilt range.
      const dx = ((e.clientX - this.drag.x) / w) * (AIM_LIMITS.direction.max - AIM_LIMITS.direction.min);
      const dy = ((this.drag.y - e.clientY) / w) * (AIM_LIMITS.tilt.max - AIM_LIMITS.tilt.min) * 1.5;
      this.set({ direction: Math.round(this.drag.aim.direction + dx), tilt: Math.round(this.drag.aim.tilt + dy) });
    });
    const end = (e: PointerEvent) => {
      if (this.drag && e.pointerId === this.drag.id) this.drag = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    const slider = (label: string, min: number, max: number, onInput: (v: number) => void): [HTMLElement, HTMLInputElement, HTMLElement] => {
      const input = el('input', { type: 'range', min: String(min), max: String(max), step: '1', 'aria-label': label });
      const out = el('output', { class: 'aim-val' });
      input.addEventListener('input', () => onInput(Number(input.value)));
      const minus = el('button', { class: 'btn small aim-step', text: '−', 'aria-label': `${label} down` });
      const plus = el('button', { class: 'btn small aim-step', text: '+', 'aria-label': `${label} up` });
      minus.addEventListener('click', () => onInput(Number(input.value) - 1));
      plus.addEventListener('click', () => onInput(Number(input.value) + 1));
      return [el('div', { class: 'aim-row' }, [el('span', { class: 'aim-label', text: label }), minus, input, plus, out]), input, out];
    };
    const [dirRow, dirIn, dirOut] = slider('Direction', AIM_LIMITS.direction.min, AIM_LIMITS.direction.max, (v) => this.set({ ...this.aim, direction: v }));
    const [tiltRow, tiltIn, tiltOut] = slider('Tilt', AIM_LIMITS.tilt.min, AIM_LIMITS.tilt.max, (v) => this.set({ ...this.aim, tilt: v }));
    this.dirIn = dirIn;
    this.tiltIn = tiltIn;
    this.dirOut = dirOut;
    this.tiltOut = tiltOut;
    const reset = el('button', { class: 'btn small', text: 'Reset' });
    reset.addEventListener('click', () => this.set({ ...DEFAULT_AIM }));
    const go = el('button', { class: 'btn primary aim-go', text: 'Time launch ▶' });
    go.addEventListener('click', () => this.onProceed?.({ ...this.aim }));
    this.title = el('div', { class: 'launch-title', text: 'Aim your launch' });
    this.keys = [el('span', { class: 'aim-key you', text: 'You' }), el('span', { class: 'aim-key opp', text: 'Opponent' })];
    this.root = el('div', { class: 'aim-box', role: 'dialog', 'aria-label': 'Launch aiming' }, [
      this.title,
      this.canvas,
      el('div', { class: 'aim-legend' }, [
        this.keys[0],
        this.keys[1],
        el('span', { class: 'aim-key path', text: 'Opening path (nominal)' }),
      ]),
      dirRow,
      tiltRow,
      el('div', { class: 'aim-hint', text: 'Drag on the stadium: sideways = direction, up/down = tilt. + aims toward the centre.' }),
      el('div', { class: 'btn-row aim-actions' }, [reset, go]),
    ]);
  }

  get visible(): boolean {
    return this.root.classList.contains('show');
  }

  get current(): LaunchAim {
    return { ...this.aim };
  }

  show(opts: BattleOptions, aim: LaunchAim, colors: [string, string], onProceed: (aim: LaunchAim) => void, onChange?: (aim: LaunchAim) => void): void {
    this.opts = opts;
    this.colors = colors;
    this.keys.forEach((k, i) => k.style.setProperty('--key', colors[i]!));
    this.onProceed = onProceed;
    this.onChange = onChange ?? null;
    this.root.classList.add('show');
    this.set(clampAim(aim), true);
  }

  hide(): void {
    this.root.classList.remove('show');
    this.drag = null;
  }

  private set(a: LaunchAim, silent = false): void {
    const next = clampAim(a);
    const changed = next.direction !== this.aim.direction || next.tilt !== this.aim.tilt;
    this.aim = next;
    this.dirIn.value = String(next.direction);
    this.tiltIn.value = String(next.tilt);
    this.dirOut.textContent = `${next.direction > 0 ? '+' : ''}${next.direction}°`;
    this.tiltOut.textContent = `${next.tilt}°`;
    if (this.opts) this.preview = aimPreview(this.opts, next);
    if (!this.raf) this.raf = requestAnimationFrame(() => this.draw());
    if (changed && !silent) this.onChange?.({ ...next });
  }

  private draw(): void {
    this.raf = 0;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.max(140, Math.round(c.clientWidth || 240));
    if (c.width !== size * dpr) {
      c.width = size * dpr;
      c.height = size * dpr;
    }
    const g = c.getContext('2d');
    if (!g || !this.opts || !this.preview) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const R = this.opts.stadium.boundingRadius;
    const k = (size / 2 - 6) / R;
    const X = (x: number) => size / 2 + x * k;
    const Y = (y: number) => size / 2 - y * k;
    // Bowl: depth rings.
    const grad = g.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, R * k);
    grad.addColorStop(0, '#20242e');
    grad.addColorStop(1, '#2d3442');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(size / 2, size / 2, R * k, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#4b5568';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) {
      g.beginPath();
      g.arc(size / 2, size / 2, R * k * f, 0, Math.PI * 2);
      g.stroke();
    }
    const p = this.preview;
    const r0 = this.opts.tops[0]!.radius * k;
    const r1 = (this.opts.tops[1]?.radius ?? this.opts.tops[0]!.radius) * k;
    // Opponent start.
    const [ox, oy] = p.start[1]!;
    g.fillStyle = this.colors[1];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(X(ox), Y(oy), r1, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // Nominal opening path.
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    p.path.forEach(([x, y], i) => (i === 0 ? g.moveTo(X(x), Y(y)) : g.lineTo(X(x), Y(y))));
    g.stroke();
    g.setLineDash([]);
    // Player start + heading arrow + tilt indicator.
    const [px, py] = p.start[0]!;
    g.fillStyle = this.colors[0];
    g.beginPath();
    g.arc(X(px), Y(py), r0, 0, Math.PI * 2);
    g.fill();
    const L = 0.05 * k;
    const ax = X(px) + Math.cos(p.heading) * L;
    const ay = Y(py) - Math.sin(p.heading) * L;
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(X(px), Y(py));
    g.lineTo(ax, ay);
    g.stroke();
    const hx = Math.cos(p.heading);
    const hy = -Math.sin(p.heading);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(ax + hx * 7, ay + hy * 7);
    g.lineTo(ax - hy * 5, ay + hx * 5);
    g.lineTo(ax + hy * 5, ay - hx * 5);
    g.closePath();
    g.fill();
    // Tilt: ellipse squash of a ring around the player top (more tilt = flatter ellipse).
    g.strokeStyle = 'rgba(255, 220, 120, 0.9)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(X(px), Y(py), r0 + 5, (r0 + 5) * Math.cos(Math.min(1.2, p.tilt * 2)), -p.heading, 0, Math.PI * 2);
    g.stroke();
  }
}
