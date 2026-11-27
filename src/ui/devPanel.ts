import { STARTER_TOPS, getTop } from '../content/tops';
import {
  AI_LAUNCH_PARAMS,
  BOOST_PARAMS,
  BRACE_PARAMS,
  COLLISION_PARAMS,
  COMBAT_PARAMS,
  LAUNCH_BONUS_PARAMS,
  LAUNCH_PARAMS,
  LAUNCH_ZONE_PARAMS,
  MOVEMENT_PARAMS,
  RESULT_PARAMS,
  SIM_LIMITS,
  STADIUM_PARAMS,
  TOP_COMBAT_PARAMS,
  TOP_PARAMS,
  type ParamSpec,
} from '../config/params';
import { TACTICAL_CONTROLLERS, defaultTacticalConfig, legacyV02Config, sandboxDefaultConfig, type TacticalSlotConfig, legacyV040Config, resolveTopCombat, resolveTopParams, type FixedQuality, type SandboxConfig } from '../config/sandboxConfig';
import { RULESETS, type Ruleset } from '../content/derive';
import { LAUNCH_QUALITIES, LAUNCH_QUALITY_LABEL, type LaunchQuality } from '../sim/launch';
import { BUILD_ID, BUILD_TIME, VERSION_LABEL } from '../version';
import { parseConfigJson } from '../config/validate';
import type { DebugFlags } from '../render/debugDraw';
import { el } from './dom';
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../ai/difficulty';
import { AIM_LIMITS, DEFAULT_AI_AIM, DEFAULT_AIM, aiAim } from '../sim/launchGeometry';

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
      el('div', { class: 'dev-header' }, [
        el('div', {}, [el('h2', { text: 'Developer' }), el('div', { class: 'dev-version', text: `SpinStrike ${VERSION_LABEL}`, title: `Build ${BUILD_ID}${BUILD_TIME ? ` · ${BUILD_TIME}` : ''}` })]),
        close,
      ]),
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
    const L = config.launch;
    const ruleset = this.select(
      'Ruleset (stats & stat → physics mapping)',
      RULESETS.map((r) => ({ value: r, label: r === 'v0.2' ? 'v0.2 legacy' : r === 'v0.3' ? 'v0.3 / v0.4.0 baseline' : r === 'v0.4.1' ? 'v0.4.1 (Speed upgrades widen the drive)' : `${r} (current)` })),
      config.ruleset,
      (v) => {
        config.ruleset = v as Ruleset;
        this.commit();
      },
    );
    const legacyBtn = el('button', { class: 'btn small', text: 'Load legacy v0.2 configuration', title: 'v0.2 ruleset and combat values, no crits, Poor launches, no draw window: reproduces v0.2 battles' });
    legacyBtn.addEventListener('click', () => {
      const d = legacyV02Config(this.config.seed);
      d.player.topId = this.config.player.topId;
      d.opponent.topId = this.config.opponent.topId;
      this.config = d;
      this.commit();
      this.flash('Legacy v0.2 configuration loaded.');
    });
    const v040Btn = el('button', { class: 'btn small', text: 'Load v0.4.0 baseline', title: 'v0.4.0 stats, stat mapping, collision/combat values and launch model (no aim, no movement variation): reproduces v0.4.0 battles' });
    v040Btn.addEventListener('click', () => {
      const d = legacyV040Config(this.config.seed);
      d.player.topId = this.config.player.topId;
      d.opponent.topId = this.config.opponent.topId;
      this.config = d;
      this.commit();
      this.flash('v0.4.0 baseline configuration loaded.');
    });
    b.append(this.section('Ruleset', [ruleset, el('div', { class: 'btn-row' }, [v040Btn, legacyBtn])]));
    b.append(this.section('Tactical abilities (v0.5)', this.tacticalControls()));
    b.append(this.section('Movement variation & launch aim (v0.4.1)', this.movementControls()));
    const qOptions = (auto: string) => [
      { value: 'auto', label: auto },
      ...LAUNCH_QUALITIES.map((q) => ({ value: q, label: `${LAUNCH_QUALITY_LABEL[q]} (${config.launch.bonuses[q]}×)` })),
    ];
    b.append(
      this.section('Launch', [
        el('p', { class: 'dev-note', text: 'Launch quality multiplies starting ROTATIONAL ENERGY (ω = √(2E/I)). Zone boundaries count toward the better quality.' }),
        this.checkbox('Launch minigame (off = bypass)', L.minigame, (v) => {
          L.minigame = v;
          this.commit();
        }),
        this.select('Player launch quality', qOptions('Minigame / seeded'), L.playerQuality, (v) => {
          L.playerQuality = v as FixedQuality;
          this.commit();
        }),
        this.select('Opponent launch quality', qOptions('AI distribution (seeded)'), L.opponentQuality, (v) => {
          L.opponentQuality = v as FixedQuality;
          this.commit();
        }),
        ...LAUNCH_PARAMS.map((sp) => this.slider(sp, L[sp.key], (v) => (L[sp.key] = v))),
        ...LAUNCH_ZONE_PARAMS.map((sp) =>
          this.slider(sp, L.zones[sp.key], (v) => {
            L.zones[sp.key] = v;
            // Keep perfect < great < good.
            const z = L.zones;
            if (sp.key === 'perfect') { z.great = Math.max(z.great, v + 0.005); z.good = Math.max(z.good, z.great + 0.005); }
            if (sp.key === 'great') { z.perfect = Math.min(z.perfect, v - 0.005); z.good = Math.max(z.good, v + 0.005); }
            if (sp.key === 'good') { z.great = Math.min(z.great, v - 0.005); z.perfect = Math.min(z.perfect, z.great - 0.005); }
            for (const k of ['perfect', 'great', 'good'] as const) z[k] = Math.min(0.5, Math.max(0.005, Math.round(z[k] * 1000) / 1000));
          }),
        ),
        ...LAUNCH_BONUS_PARAMS.map((sp) => this.slider(sp, L.bonuses[sp.key], (v) => (L.bonuses[sp.key] = v))),
        el('p', { class: 'dev-note', text: 'AI distribution: editing one probability rescales the others so they sum to 1.' }),
        ...AI_LAUNCH_PARAMS.map((sp) => this.slider(sp, L.aiDistribution[sp.key], (v) => renormalise(L.aiDistribution, sp.key, v))),
      ]),
    );
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
        this.checkbox('Critical hits (chance and multiplier are per top, below)', config.combat.criticalHits, (v) => {
          config.combat.criticalHits = v;
          this.commit();
        }),
      ]),
    );
    b.append(
      this.section('Results · draws & narrow victories', RESULT_PARAMS.map((sp) => this.slider(sp, config.results[sp.key], (v) => (config.results[sp.key] = v)))),
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
        this.checkbox('Critical hit effects (golden numbers, label, sparks)', config.presentation.criticalEffects, (v) => {
          config.presentation.criticalEffects = v;
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
      const eff = resolveTopParams(slot, config.ruleset);
      const effC = resolveTopCombat(slot, config.ruleset);
      const def = getTop(slot.topId);
      const rows = [
        ...TOP_COMBAT_PARAMS.map((s) => {
          const row = this.slider(s, effC[s.key], (v) => (slot.overrides[s.key] = v));
          if (slot.overrides[s.key] !== undefined) row.classList.add('overridden');
          return row;
        }),
        ...TOP_PARAMS.map((s) => {
          const row = this.slider(s, eff[s.key] ?? 0, (v) => (slot.overrides[s.key] = v));
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
      const d = sandboxDefaultConfig(this.config.seed);
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

  private tacticalControls(): Node[] {
    const T = this.config.tactical;
    const rows: Node[] = [
      el('p', { class: 'dev-note', text: 'Directional Boost and Defensive Brace. Off = v0.4.1 passive combat (identical results). The battle validates every command; "player" = live input (touch / mouse / keys).' }),
      this.checkbox('Tactical abilities on', T.enabled, (v) => {
        T.enabled = v;
        this.commit();
      }),
    ];
    if (!T.enabled) return rows;
    const ctrlLabel: Record<string, string> = { player: 'Player (live input)', ai: 'AI', passive: 'Passive (no abilities)' };
    const side = (label: string, slot: TacticalSlotConfig) => [
      this.select(`${label} controller`, TACTICAL_CONTROLLERS.map((c) => ({ value: c, label: ctrlLabel[c] ?? c })), slot.controller, (v) => {
        slot.controller = v as TacticalSlotConfig['controller'];
        this.commit();
      }),
      ...(slot.controller === 'ai'
        ? [this.select(`${label} AI difficulty`, DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] })), slot.difficulty, (v) => {
            slot.difficulty = v as Difficulty;
            this.commit();
          })]
        : []),
    ];
    rows.push(...side('Player slot', T.player), ...side('Opponent slot', T.opponent));
    const aiVsAi = el('button', { class: 'btn small', text: 'AI vs AI (Expert vs Hard)' });
    aiVsAi.addEventListener('click', () => {
      T.player = { controller: 'ai', difficulty: 'expert' };
      T.opponent = { controller: 'ai', difficulty: 'hard' };
      this.commit();
    });
    const reset = el('button', { class: 'btn small', text: 'Reset tactics' });
    reset.addEventListener('click', () => {
      this.config.tactical = defaultTacticalConfig();
      this.commit();
    });
    rows.push(el('div', { class: 'btn-row' }, [aiVsAi, reset]));
    rows.push(el('p', { class: 'dev-note', text: 'Boost' }), ...BOOST_PARAMS.map((sp) => this.slider(sp, T.boost[sp.key], (v) => {
      T.boost[sp.key] = sp.step >= 1 ? Math.round(v) : v;
      if (T.boost.minStrength > T.boost.maxStrength) T.boost.maxStrength = T.boost.minStrength;
    })));
    rows.push(el('p', { class: 'dev-note', text: 'Brace' }), ...BRACE_PARAMS.map((sp) => this.slider(sp, T.brace[sp.key], (v) => (T.brace[sp.key] = sp.step >= 1 ? Math.round(v) : v))));
    rows.push(el('p', { class: 'dev-note', text: `Scripted commands: ${T.script.length}. Add them in exported JSON as "tactical.script": [{ "tick": 480, "slot": 0, "ability": "boost", "dirX": 1, "dirY": 0, "strength": 1 }, …] (ticks at 240 Hz) and import.` }));
    return rows;
  }

  private movementControls(): Node[] {
    const config = this.config;
    const M = config.movement;
    const L = config.launch;
    const aimSlider = (label: string, key: 'direction' | 'tilt', get: () => number, set: (v: number) => void) =>
      this.slider({ key, label, min: AIM_LIMITS[key].min, max: AIM_LIMITS[key].max, step: 1, unit: '°', help: key === 'direction' ? '+ = toward the centre, − = away.' : 'Release tilt of the spin axis.' }, get(), set);
    const pa = L.playerAim;
    const oppAuto = L.opponentAim === 'auto';
    const oa = oppAuto ? aiAim(config.seed, 1, L.aiAim) : L.opponentAim as { direction: number; tilt: number };
    const rows: Node[] = [
      el('p', { class: 'dev-note', text: 'Seeded, physically plausible variability. Off = v0.4.0 launch model (no aim), perfect floor and steady tip contact. Each component uses its own keyed random stream.' }),
      this.checkbox('Natural movement variation (and launch aim)', M.naturalVariation, (v) => {
        M.naturalVariation = v;
        this.commit();
      }),
      ...MOVEMENT_PARAMS.map((sp) => this.slider(sp, M[sp.key], (v) => (M[sp.key] = v))),
      el('p', { class: 'dev-note', text: 'Player aim (the aim screen before the timing minigame edits it too).' }),
      aimSlider('Player direction', 'direction', () => pa.direction, (v) => (pa.direction = Math.round(v))),
      aimSlider('Player tilt', 'tilt', () => pa.tilt, (v) => (pa.tilt = Math.round(v))),
      this.checkbox(`Opponent aim: AI (seeded) · this seed: ${oa.direction > 0 ? '+' : ''}${oa.direction}° / ${oa.tilt}°`, oppAuto, (v) => {
        L.opponentAim = v ? 'auto' : { ...oa };
        this.commit();
      }),
    ];
    if (!oppAuto) {
      const o = L.opponentAim as { direction: number; tilt: number };
      rows.push(
        aimSlider('Opponent direction', 'direction', () => o.direction, (v) => (o.direction = Math.round(v))),
        aimSlider('Opponent tilt', 'tilt', () => o.tilt, (v) => (o.tilt = Math.round(v))),
      );
    }
    const range = (label: string, key: 'direction' | 'tilt', end: 'min' | 'max') =>
      this.slider({ key, label, min: AIM_LIMITS[key].min, max: AIM_LIMITS[key].max, step: 1, unit: '°', help: 'Range of the seeded AI aim (uniform).' }, L.aiAim[key][end], (v) => {
        const r = L.aiAim[key];
        r[end] = Math.round(v);
        if (r.min > r.max) end === 'min' ? (r.max = r.min) : (r.min = r.max);
      });
    rows.push(range('AI direction min', 'direction', 'min'), range('AI direction max', 'direction', 'max'), range('AI tilt min', 'tilt', 'min'), range('AI tilt max', 'tilt', 'max'));
    const resetAim = el('button', { class: 'btn small', text: 'Reset aims' });
    resetAim.addEventListener('click', () => {
      L.playerAim = { ...DEFAULT_AIM };
      L.opponentAim = 'auto';
      L.aiAim = { direction: { ...DEFAULT_AI_AIM.direction }, tilt: { ...DEFAULT_AI_AIM.tilt } };
      this.commit();
    });
    rows.push(el('div', { class: 'btn-row' }, [resetAim]));
    return rows;
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

  private select(label: string, options: { value: string; label: string }[], value: string, set: (v: string) => void): HTMLElement {
    const sel = el('select', { 'aria-label': label });
    for (const o of options) sel.append(el('option', { value: o.value, text: o.label }));
    sel.value = value;
    sel.addEventListener('change', () => set(sel.value));
    return el('label', { class: 'dev-select' }, [label, sel]);
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

/** Sets one probability and rescales the others so the four sum to 1. */
export function renormalise(d: Record<LaunchQuality, number>, key: LaunchQuality, v: number): void {
  const val = Math.min(1, Math.max(0, v));
  const others = LAUNCH_QUALITIES.filter((q) => q !== key);
  const rest = others.reduce((a, q) => a + d[q], 0);
  d[key] = val;
  for (const q of others) d[q] = rest > 0 ? (d[q] / rest) * (1 - val) : (1 - val) / others.length;
  // Round to 4 dp and put any rounding residue on the edited key.
  for (const q of LAUNCH_QUALITIES) d[q] = Math.round(d[q] * 10000) / 10000;
  const sum = LAUNCH_QUALITIES.reduce((a, q) => a + d[q], 0);
  d[key] = Math.round((d[key] + 1 - sum) * 10000) / 10000;
}

function fmt(v: number, step: number): string {
  const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step))));
  return v.toFixed(decimals);
}

export const TOP_OPTIONS = STARTER_TOPS.map((t) => ({ id: t.id, label: `${t.name} · ${t.topClass}` }));
