import { STARTER_TOPS, getTop } from '../content/tops';
import { COLLISION_PARAMS, COMBAT_PARAMS, SIM_LIMITS, STADIUM_PARAMS, TOP_COMBAT_PARAMS, TOP_PARAMS, type ParamSpec } from '../config/params';
import { defaultConfig, resolveTopCombat, resolveTopParams, type SandboxConfig } from '../config/sandboxConfig';
import { parseConfigJson } from '../config/validate';
import type { DebugFlags } from '../render/debugDraw';
import { el } from './dom';

export interface DevPanelCallbacks {
  /** Config was edited. Battle should be rebuilt with it (not auto-started). */
  onConfigChange(config: SandboxConfig): void;
  onDebugChange(flags: DebugFlags): void;
}

const DEBUG_LABELS: Record<keyof DebugFlags, string> = {
  velocity: 'Velocity vectors',
  boundaries: 'Collision boundaries',
  contacts: 'Recent contact points',
  trails: 'Movement trails (path history)',
  slope: 'Stadium slope field',
  fps: 'Frames per second',
  physicsStats: 'Physics update statistics',
};

/**
 * Collapsible developer panel. Built from the parameter specs in
 * config/params.ts so ranges are shared with JSON validation.
 */
export class DevPanel {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private config!: SandboxConfig;
  private flags!: DebugFlags;
  private readonly messages: HTMLElement;
  private readonly io: HTMLTextAreaElement;

  constructor(private readonly cb: DevPanelCallbacks) {
    this.body = el('div', { class: 'dev-body' });
    this.messages = el('div', { class: 'dev-msg', role: 'status' });
    this.io = el('textarea', { class: 'dev-io', rows: '6', spellcheck: 'false', placeholder: 'Paste configuration JSON here to import…' });
    const close = el('button', { class: 'icon-btn', 'aria-label': 'Close developer panel', text: '✕' });
    close.addEventListener('click', () => this.setOpen(false));
    this.root = el('aside', { class: 'dev-panel', 'aria-label': 'Developer panel' }, [
      el('div', { class: 'dev-header' }, [el('h2', { text: 'Developer' }), close]),
      this.body,
    ]);
  }

  setOpen(open: boolean): void {
    this.root.classList.toggle('open', open);
    document.body.classList.toggle('dev-open', open);
  }

  toggle(): void {
    this.setOpen(!this.root.classList.contains('open'));
  }

  render(config: SandboxConfig, flags: DebugFlags): void {
    this.config = config;
    this.flags = flags;
    const b = this.body;
    b.replaceChildren();
    b.append(
      el('p', { class: 'dev-note', text: 'Parameter changes reset the battle with the current seed. Press Start to run.' }),
    );

    b.append(this.section('Debug visualisation', this.debugToggles()));
    b.append(
      this.section('Stadium · Classic Bowl', STADIUM_PARAMS.map((s) => this.slider(s, config.stadium[s.key], (v) => (config.stadium[s.key] = v)))),
    );
    b.append(
      this.section('Collisions', COLLISION_PARAMS.map((s) => this.slider(s, config.collision[s.key], (v) => (config.collision[s.key] = v)))),
    );
    b.append(
      this.section('Combat · damage, contacts & knockouts', [
        el('p', { class: 'dev-note', text: 'damage = G · (attack/attack_ref) · K/(K + e·defense) · softcap((E/E_ref)^p). E = ½·μ·vₙ·(k_imp·vₙ + k_rot·ring strike·|ω|·r).' }),
        ...COMBAT_PARAMS.map((s) => this.slider(s, config.combat[s.key], (v) => (config.combat[s.key] = v))),
        this.checkbox('Knockouts (rim escape)', config.combat.knockouts, (v) => {
          config.combat.knockouts = v;
          this.commit();
        }),
      ]),
    );
    b.append(
      this.section('Presentation', [
        this.checkbox('Cinematic finishes (slow motion, flash, shake)', config.presentation.cinematicFinishes, (v) => {
          config.presentation.cinematicFinishes = v;
          this.commit();
        }),
        this.checkbox('Floating damage numbers', config.presentation.damageNumbers, (v) => {
          config.presentation.damageNumbers = v;
          this.commit();
        }),
      ]),
    );
    b.append(
      this.section('Battle', [
        this.slider(
          { key: 'maxDuration', label: 'Maximum duration', min: SIM_LIMITS.maxDuration.min, max: SIM_LIMITS.maxDuration.max, step: 5, unit: 's', help: 'Timeout if both tops are still spinning.' },
          config.maxDuration,
          (v) => (config.maxDuration = v),
        ),
      ]),
    );
    for (const side of ['player', 'opponent'] as const) {
      const slot = config[side];
      const eff = resolveTopParams(slot);
      const effC = resolveTopCombat(slot);
      const def = getTop(slot.topId);
      const rows = [
        ...TOP_COMBAT_PARAMS.map((s) => {
          const row = this.slider(s, effC[s.key], (v) => (slot.overrides[s.key] = v));
          if (slot.overrides[s.key] !== undefined) row.classList.add('overridden');
          return row;
        }),
        ...TOP_PARAMS.map((s) => {
          const row = this.slider(s, eff[s.key], (v) => (slot.overrides[s.key] = v));
          if (slot.overrides[s.key] !== undefined) row.classList.add('overridden');
          return row;
        }),
      ];
      const resetTop = el('button', { class: 'btn small', text: `Reset ${def.name} to defaults` });
      resetTop.addEventListener('click', () => {
        slot.overrides = {};
        this.commit();
      });
      rows.push(resetTop);
      this.body.append(this.section(`${side === 'player' ? 'Player' : 'Opponent'} · ${def.name} (${def.topClass})`, rows));
    }

    // Config management
    const resetAll = el('button', { class: 'btn', text: 'Reset all to defaults' });
    resetAll.addEventListener('click', () => {
      const d = defaultConfig(this.config.seed);
      d.player.topId = this.config.player.topId;
      d.opponent.topId = this.config.opponent.topId;
      this.config = d;
      this.commit();
      this.flash('Defaults restored.');
    });
    const exportBtn = el('button', { class: 'btn', text: 'Export JSON' });
    exportBtn.addEventListener('click', () => this.exportJson());
    const importBtn = el('button', { class: 'btn', text: 'Import JSON' });
    importBtn.addEventListener('click', () => this.importJson(this.io.value));
    const file = el('input', { type: 'file', accept: 'application/json,.json', class: 'file' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      const text = await f.text();
      this.io.value = text;
      this.importJson(text);
      file.value = '';
    });
    const fileLabel = el('label', { class: 'btn' }, ['Import file…', file]);
    b.append(
      this.section('Configuration', [
        el('div', { class: 'btn-row' }, [resetAll]),
        el('div', { class: 'btn-row' }, [exportBtn, importBtn, fileLabel]),
        this.io,
        this.messages,
      ]),
    );
  }

  private section(title: string, children: Node[]): HTMLElement {
    const d = el('details', { class: 'dev-section', open: '' }, [el('summary', { text: title }), ...children]);
    return d;
  }

  private slider(spec: ParamSpec, value: number, set: (v: number) => void): HTMLElement {
    const range = el('input', { type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step), value: String(value), 'aria-label': spec.label });
    const num = el('input', { type: 'number', min: String(spec.min), max: String(spec.max), step: String(spec.step), value: fmt(value, spec.step), 'aria-label': `${spec.label} value` });
    const apply = (raw: string, fromNumber: boolean) => {
      let v = Number(raw);
      if (!Number.isFinite(v)) return;
      v = Math.min(spec.max, Math.max(spec.min, v));
      set(v);
      if (fromNumber) range.value = String(v);
      else num.value = fmt(v, spec.step);
    };
    range.addEventListener('input', () => apply(range.value, false));
    range.addEventListener('change', () => this.commit());
    num.addEventListener('change', () => {
      apply(num.value, true);
      this.commit();
    });
    return el('div', { class: 'param', title: spec.help }, [
      el('label', {}, [spec.label, spec.unit ? el('span', { class: 'unit', text: ` ${spec.unit}` }) : '']),
      el('div', { class: 'param-inputs' }, [range, num]),
    ]);
  }

  private checkbox(label: string, value: boolean, set: (v: boolean) => void): HTMLElement {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = value;
    cb.addEventListener('change', () => set(cb.checked));
    return el('label', { class: 'toggle' }, [cb, label]);
  }

  private debugToggles(): HTMLElement[] {
    return (Object.keys(DEBUG_LABELS) as (keyof DebugFlags)[]).map((k) => {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = this.flags[k];
      cb.addEventListener('change', () => {
        this.flags[k] = cb.checked;
        this.cb.onDebugChange(this.flags);
      });
      return el('label', { class: 'toggle' }, [cb, DEBUG_LABELS[k]]);
    });
  }

  private commit(): void {
    this.cb.onConfigChange(this.config);
    this.render(this.config, this.flags);
  }

  private exportJson(): void {
    const text = JSON.stringify(this.config, null, 2);
    this.io.value = text;
    const blob = new Blob([text], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `spinstrike-config-seed${this.config.seed}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    navigator.clipboard?.writeText(text).catch(() => undefined);
    this.flash('Configuration exported (downloaded and shown below).');
  }

  private importJson(text: string): void {
    const res = parseConfigJson(text);
    if (!res.ok) {
      this.messages.className = 'dev-msg error';
      this.messages.replaceChildren(el('strong', { text: 'Import failed:' }), el('ul', {}, res.errors.map((e) => el('li', { text: e }))));
      return;
    }
    this.config = res.config;
    this.commit();
    if (res.notes.length) {
      this.messages.className = 'dev-msg ok';
      this.messages.replaceChildren(
        el('strong', { text: 'Configuration imported.' }),
        el('ul', {}, res.notes.map((n) => el('li', { text: n }))),
      );
    } else this.flash('Configuration imported.');
  }

  private flash(msg: string): void {
    this.messages.className = 'dev-msg ok';
    this.messages.textContent = msg;
  }
}

function fmt(v: number, step: number): string {
  const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step))));
  return v.toFixed(decimals);
}

export const TOP_OPTIONS = STARTER_TOPS.map((t) => ({ id: t.id, label: `${t.name} · ${t.topClass}` }));
