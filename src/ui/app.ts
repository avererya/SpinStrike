import { Battle } from '../sim/battle';
import { FixedStepRunner, SIM_SPEEDS } from '../sim/runner';
import { randomSeed } from '../sim/rng';
import { getTop, type TopDefinition } from '../content/tops';
import { buildBattleOptions, cloneConfig, defaultConfig, type SandboxConfig } from '../config/sandboxConfig';
import { SceneRenderer } from '../render/sceneRenderer';
import { DEFAULT_DEBUG_FLAGS, type DebugFlags } from '../render/debugDraw';
import { DevPanel, TOP_OPTIONS } from './devPanel';
import { Hud } from './hud';
import { el, hex } from './dom';
import type { FinishKind } from '../sim/combat';

const FINISH_LABEL: Record<FinishKind, string> = { burst: 'BURST FINISH', knockout: 'KNOCKOUT FINISH', spin: 'SPIN FINISH' };
/** Presentation timings (real seconds). Never affect the simulated result. */
const SLOWMO_FACTOR = 0.3;
const SLOWMO_TIME = 0.7;
const BANNER_DELAY = 0.25;
const RESULT_DELAY_CINEMATIC = 1.6;
const RESULT_DELAY_PLAIN = 0.4;
const DAMAGE_NUMBER_POOL = 12;
const DAMAGE_NUMBER_LIFE = 0.9;
const DAMAGE_NUMBER_MIN = 1;

interface DamageNumber {
  el: HTMLElement;
  x: number;
  y: number;
  life: number;
}

type Status = 'ready' | 'running' | 'paused' | 'finished';

/**
 * Sandbox application: wires the simulation, renderer and DOM UI together.
 * Owns no physics logic itself.
 */
export class SandboxApp {
  private config: SandboxConfig = defaultConfig(randomSeed());
  private battle!: Battle;
  private runner!: FixedStepRunner;
  private renderer!: SceneRenderer;
  private flags: DebugFlags = { ...DEFAULT_DEBUG_FLAGS };
  private status: Status = 'ready';
  private resultShown = false;
  /** Seconds since the result was decided (presentation clock), −1 before. */
  private finishClock = -1;
  private bannerShown = false;
  private readonly banner: HTMLElement;
  private readonly dmgLayer: HTMLElement;
  private readonly dmgNums: DamageNumber[] = [];
  private dmgNext = 0;
  private lastTime = 0;
  private fps = 60;
  private stepMs = 0;
  private hudTimer = 0;
  private speed = 1;

  // DOM
  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly hud = new Hud();
  private readonly dev: DevPanel;
  private readonly startBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly playerSel: HTMLSelectElement;
  private readonly oppSel: HTMLSelectElement;
  private readonly speedBtns: HTMLButtonElement[] = [];
  private readonly result: HTMLElement;
  private readonly resultText: HTMLElement;
  private readonly resultSub: HTMLElement;
  private readonly resultTable: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly errorBox: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.canvas = el('canvas', { class: 'stage-canvas', 'aria-label': 'Battle stadium' });
    this.playerSel = this.topSelect('Player top');
    this.oppSel = this.topSelect('Opponent top');
    this.startBtn = el('button', { class: 'btn primary', text: 'Start', title: 'Start battle (Space)' });
    this.pauseBtn = el('button', { class: 'btn', text: 'Pause' });
    const resetBtn = el('button', { class: 'btn', text: 'Reset', title: 'Reset to launch position (same seed)' });
    const sameBtn = el('button', { class: 'btn', title: 'Restart immediately with the same seed' }, ['↻', el('span', { class: 'btn-label', text: ' Same seed' })]);
    const newBtn = el('button', { class: 'btn', title: 'Restart immediately with a new random seed' }, ['⚄', el('span', { class: 'btn-label', text: ' New seed' })]);
    const devBtn = el('button', { class: 'btn', title: 'Developer panel' }, ['⚙', el('span', { class: 'btn-label', text: ' Dev' })]);
    const speedGroup = el('div', { class: 'seg', role: 'group', 'aria-label': 'Simulation speed' });
    for (const s of SIM_SPEEDS) {
      const b = el('button', { class: 'seg-btn', text: `${s}×` });
      b.addEventListener('click', () => this.setSpeed(s));
      this.speedBtns.push(b);
      speedGroup.append(b);
    }

    this.startBtn.addEventListener('click', () => this.startBattle());
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    resetBtn.addEventListener('click', () => this.rebuild(false));
    sameBtn.addEventListener('click', () => this.rebuild(true));
    newBtn.addEventListener('click', () => {
      this.config.seed = randomSeed();
      this.rebuild(true);
    });
    devBtn.addEventListener('click', () => this.dev.toggle());
    this.playerSel.addEventListener('change', () => {
      this.config.player = { topId: this.playerSel.value, overrides: {} };
      this.onConfigEdited();
    });
    this.oppSel.addEventListener('change', () => {
      this.config.opponent = { topId: this.oppSel.value, overrides: {} };
      this.onConfigEdited();
    });

    const toolbar = el('header', { class: 'toolbar' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'logo', text: 'SpinStrike' }), el('span', { class: 'tag', text: 'v0.2 combat sandbox' })]),
      el('div', { class: 'tb-group picks' }, [
        el('label', { class: 'pick' }, [el('span', { text: 'Player' }), this.playerSel]),
        el('span', { class: 'vs', text: 'vs' }),
        el('label', { class: 'pick' }, [el('span', { text: 'Opponent' }), this.oppSel]),
      ]),
      el('div', { class: 'tb-group actions' }, [this.startBtn, this.pauseBtn, resetBtn, sameBtn, newBtn]),
      el('div', { class: 'tb-group' }, [speedGroup, devBtn]),
    ]);

    this.resultText = el('div', { class: 'result-title' });
    this.resultSub = el('div', { class: 'result-sub' });
    this.resultTable = el('div', { class: 'result-table' });
    const rSame = el('button', { class: 'btn primary', text: 'Restart (same seed)' });
    rSame.addEventListener('click', () => this.rebuild(true));
    const rNew = el('button', { class: 'btn', text: 'New seed' });
    rNew.addEventListener('click', () => {
      this.config.seed = randomSeed();
      this.rebuild(true);
    });
    const rClose = el('button', { class: 'btn', text: 'Close' });
    rClose.addEventListener('click', () => this.result.classList.remove('show'));
    this.result = el('div', { class: 'result', role: 'dialog', 'aria-live': 'polite' }, [
      this.resultText,
      this.resultSub,
      this.resultTable,
      el('div', { class: 'btn-row' }, [rSame, rNew, rClose]),
    ]);
    this.banner = el('div', { class: 'finish-banner', 'aria-live': 'assertive' });
    this.dmgLayer = el('div', { class: 'dmg-layer', 'aria-hidden': 'true' });
    for (let i = 0; i < DAMAGE_NUMBER_POOL; i++) {
      const d = el('div', { class: 'dmg-num' });
      this.dmgLayer.append(d);
      this.dmgNums.push({ el: d, x: 0, y: 0, life: 0 });
    }
    this.stats = el('pre', { class: 'stats' });
    this.errorBox = el('div', { class: 'error-box' });
    this.stage = el('main', { class: 'stage' }, [this.canvas, this.dmgLayer, this.hud.root, this.banner, this.result, this.stats, this.errorBox]);

    this.dev = new DevPanel({
      onConfigChange: (c) => {
        this.config = c;
        this.playerSel.value = c.player.topId;
        this.oppSel.value = c.opponent.topId;
        this.rebuild(false, false);
      },
      onDebugChange: (f) => {
        this.flags = f;
        this.updateOverlays();
      },
    });
    this.root.append(toolbar, this.stage, this.dev.root);
  }

  start(): void {
    try {
      this.renderer = new SceneRenderer(this.canvas);
    } catch (e) {
      this.errorBox.textContent = `WebGL could not be initialised: ${(e as Error).message}`;
      this.errorBox.classList.add('show');
      return;
    }
    this.playerSel.value = this.config.player.topId;
    this.oppSel.value = this.config.opponent.topId;
    this.setSpeed(1);
    this.rebuild(false);
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    this.resize();
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.status === 'ready') this.startBattle();
        else this.togglePause();
      } else if (e.key === 'r') this.rebuild(true);
    });
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Rebuilds the battle from the current config. */
  rebuild(startNow: boolean, rerenderDev = true): void {
    this.battle = new Battle(buildBattleOptions(this.config));
    this.runner = new FixedStepRunner(this.battle);
    this.runner.speed = this.speed;
    this.runner.paused = !startNow;
    const defs: TopDefinition[] = [getTop(this.config.player.topId), getTop(this.config.opponent.topId)];
    this.renderer.setWorld(this.battle.world, defs);
    const mirror = defs[0]!.id === defs[1]!.id;
    this.hud.setTops(defs, this.config.seed, mirror ? ['P1', 'P2'] : ['Player', 'Opponent']);
    this.hud.update(this.battle);
    this.status = startNow ? 'running' : 'ready';
    this.resultShown = false;
    this.result.classList.remove('show');
    this.finishClock = -1;
    this.bannerShown = false;
    this.banner.className = 'finish-banner';
    this.banner.textContent = '';
    for (const d of this.dmgNums) {
      d.life = 0;
      d.el.classList.remove('show');
    }
    this.renderer.cinematic = this.config.presentation.cinematicFinishes;
    if (rerenderDev) this.dev.render(this.config, this.flags);
    this.updateButtons();
  }

  private onConfigEdited(): void {
    this.rebuild(false);
  }

  private startBattle(): void {
    if (this.status === 'finished') {
      this.rebuild(true);
      return;
    }
    this.runner.paused = false;
    this.status = 'running';
    this.updateButtons();
  }

  private togglePause(): void {
    if (this.status === 'running') {
      this.runner.paused = true;
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.runner.paused = false;
      this.status = 'running';
    }
    this.updateButtons();
  }

  private setSpeed(s: number): void {
    this.speed = s;
    if (this.runner) this.runner.speed = s;
    SIM_SPEEDS.forEach((v, i) => this.speedBtns[i]!.classList.toggle('active', v === s));
  }

  private updateButtons(): void {
    this.startBtn.disabled = this.status === 'running' || this.status === 'paused';
    this.startBtn.textContent = this.status === 'finished' ? 'Again' : 'Start';
    this.pauseBtn.disabled = !(this.status === 'running' || this.status === 'paused');
    this.pauseBtn.textContent = this.status === 'paused' ? 'Resume' : 'Pause';
    this.root.dataset.status = this.status;
  }

  private updateOverlays(): void {
    this.stats.classList.toggle('show', this.flags.fps || this.flags.physicsStats);
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.renderer.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.08;

    // Finishing presentation: brief slow motion right after the decisive
    // moment. Only the playback rate of the post-result aftermath changes;
    // the result is already frozen.
    if (this.finishClock >= 0) {
      if (!this.runner.paused) this.finishClock += dt;
      const slow = this.config.presentation.cinematicFinishes && this.finishClock < SLOWMO_TIME;
      this.runner.speed = this.speed * (slow ? SLOWMO_FACTOR : 1);
    }
    const t0 = performance.now();
    const alpha = this.runner.advance(dt);
    const t1 = performance.now();
    if (this.runner.stepsLastFrame > 0) this.stepMs += ((t1 - t0) / this.runner.stepsLastFrame - this.stepMs) * 0.1;

    const events = this.battle.world.drainEvents();
    if (events.length) this.renderer.onCollisions(events, this.flags.contacts);
    const dmg = this.battle.world.drainDamage();
    if (dmg.length) {
      this.renderer.onDamage(dmg);
      if (this.config.presentation.damageNumbers) {
        for (const ev of dmg) {
          const bA = this.battle.world.bodies[ev.a]!;
          const bB = this.battle.world.bodies[ev.b]!;
          if (ev.damageToB >= DAMAGE_NUMBER_MIN) this.spawnDamageNumber(bB.x, bB.y, ev.damageToB, ev.b);
          if (ev.damageToA >= DAMAGE_NUMBER_MIN) this.spawnDamageNumber(bA.x, bA.y, ev.damageToA, ev.a);
        }
      }
    }
    if (this.battle.phase === 'finished' && this.finishClock < 0) this.finishClock = 0;
    const effectDt = this.runner.paused ? 0 : dt * this.runner.speed;
    this.renderer.render(alpha, effectDt, this.flags);

    this.hudTimer += dt;
    if (this.hudTimer > 1 / 15) {
      this.hudTimer = 0;
      this.hud.update(this.battle);
      if (this.flags.fps || this.flags.physicsStats) this.renderStats();
    }
    this.updateDamageNumbers(this.runner.paused ? 0 : dt);
    if (this.battle.phase === 'finished') {
      const cinematic = this.config.presentation.cinematicFinishes;
      if (!this.bannerShown && this.finishClock >= (cinematic ? BANNER_DELAY : 0)) this.showBanner();
      if (!this.resultShown && this.finishClock >= (cinematic ? RESULT_DELAY_CINEMATIC : RESULT_DELAY_PLAIN)) this.showResult();
    }
    requestAnimationFrame(this.frame);
  };

  private spawnDamageNumber(x: number, y: number, dmg: number, target: number): void {
    const d = this.dmgNums[this.dmgNext]!;
    this.dmgNext = (this.dmgNext + 1) % this.dmgNums.length;
    d.x = x;
    d.y = y;
    d.life = DAMAGE_NUMBER_LIFE;
    const max = this.battle.world.bodies[target]!.combat.maxHealth;
    d.el.textContent = `-${Math.round(dmg)}`;
    d.el.classList.toggle('heavy', dmg / max >= 0.06);
    d.el.classList.add('show');
  }

  private updateDamageNumbers(dt: number): void {
    for (const d of this.dmgNums) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.el.classList.remove('show');
        continue;
      }
      const p = this.renderer.project(d.x, d.y, 0.04);
      if (!p) continue;
      const t = 1 - d.life / DAMAGE_NUMBER_LIFE;
      // The overlay covers the stage; the canvas may be offset inside it (mobile HUD above).
      const ox = this.canvas.offsetLeft;
      const oy = this.canvas.offsetTop;
      d.el.style.transform = `translate(${(p.x + ox).toFixed(1)}px, ${(p.y + oy - 18 - t * 34).toFixed(1)}px) translate(-50%, -50%)`;
      d.el.style.opacity = String(Math.min(1, d.life / 0.3));
    }
  }

  private showBanner(): void {
    this.bannerShown = true;
    const o = this.battle.result!.outcome;
    let text: string;
    let kind: string;
    if (o.kind === 'win') {
      text = FINISH_LABEL[o.finish];
      kind = o.finish;
    } else if (o.kind === 'draw') {
      text = 'DRAW';
      kind = 'draw';
    } else {
      text = 'TIME UP';
      kind = 'timeout';
    }
    this.banner.textContent = text;
    this.banner.className = `finish-banner show ${kind}${this.config.presentation.cinematicFinishes ? ' animated' : ''}`;
  }

  private renderStats(): void {
    const lines: string[] = [];
    if (this.flags.fps) lines.push(`FPS ${this.fps.toFixed(0)}`);
    if (this.flags.physicsStats) {
      const s = this.battle.world.stats;
      lines.push(
        `step ${(1000 * this.battle.world.dt).toFixed(2)} ms fixed (${(1 / this.battle.world.dt).toFixed(0)} Hz)`,
        `steps ${s.steps}  this frame ${this.runner.stepsLastFrame}`,
        `substeps last ${s.substepsLast}  max ${s.maxSubsteps}`,
        `avg substeps ${(s.substepsTotal / Math.max(1, s.steps)).toFixed(2)}`,
        `cpu/step ${(this.stepMs * 1000).toFixed(1)} µs`,
        `guard trips ${this.battle.world.bodies.reduce((a, b) => a + b.guardTrips, 0)}`,
        `energy ${this.battle.world.totalEnergy().toFixed(3)} J`,
      );
    }
    this.stats.textContent = lines.join('\n');
  }

  private showResult(): void {
    this.resultShown = true;
    this.status = 'finished';
    this.updateButtons();
    this.banner.classList.add('dim');
    const r = this.battle.result!;
    const defs = [getTop(this.config.player.topId), getTop(this.config.opponent.topId)];
    const mirror = defs[0]!.id === defs[1]!.id;
    const label = (i: number) => (mirror ? `${defs[i]!.name} (${i === 0 ? 'P1' : 'P2'})` : defs[i]!.name);
    const o = r.outcome;
    const finishText: Record<FinishKind, (l: string) => string> = {
      burst: (l) => `${l} burst apart`,
      knockout: (l) => `${l} was knocked out of the stadium`,
      spin: (l) => `${l} stopped spinning`,
    };
    if (o.kind === 'win') {
      this.resultText.textContent = `${label(o.winner)} wins!`;
      this.resultText.style.color = hex(defs[o.winner]!.palette.accent);
      this.resultSub.textContent = `${FINISH_LABEL[o.finish]} · ${finishText[o.finish](label(o.loser))} · ${r.time.toFixed(1)} s`;
    } else if (o.kind === 'draw') {
      this.resultText.textContent = 'Draw';
      this.resultText.style.color = '';
      this.resultSub.textContent = `Both tops were eliminated on the same physics step (${o.finishes.map((f) => FINISH_LABEL[f].toLowerCase()).join(' + ')}) · ${r.time.toFixed(1)} s`;
    } else {
      this.resultText.textContent = 'Time up';
      this.resultText.style.color = '';
      this.resultSub.textContent = `Both tops still in play after ${r.time.toFixed(0)} s (maximum duration). No winner.`;
    }
    const row = (k: string, f: (i: number) => string) =>
      [el('span', { class: 'rk', text: k }), el('span', { text: f(0) }), el('span', { text: f(1) })];
    const head = [el('span'), ...[0, 1].map((i) => el('span', { class: 'rh', text: label(i), style: `color:${hex(defs[i]!.palette.accent)}` }))];
    const strongest = r.strongestHit.by >= 0 ? `${r.strongestHit.damage.toFixed(0)} by ${label(r.strongestHit.by)}` : 'none';
    this.resultTable.replaceChildren(
      el('div', { class: 'rgrid' }, [
        ...head,
        ...row('Health left', (i) => `${Math.ceil(r.tops[i]!.health)} / ${Math.round(r.tops[i]!.maxHealth)}`),
        ...row('Stamina left', (i) => `${(r.tops[i]!.stamina * 100).toFixed(0)}%`),
        ...row('Damage dealt', (i) => r.tops[i]!.damageDealt.toFixed(0)),
        ...row('Hits landed', (i) => String(r.tops[i]!.hitsLanded)),
      ]),
      el('div', { class: 'rmeta' }, [`Strongest hit: ${strongest}`, el('br'), `Duration ${r.time.toFixed(1)} s · seed ${r.seed}`]),
    );
    this.result.classList.add('show');
  }

  private topSelect(label: string): HTMLSelectElement {
    const s = el('select', { 'aria-label': label });
    for (const o of TOP_OPTIONS) s.append(el('option', { value: o.id, text: o.label }));
    return s;
  }

  /** For console debugging: a snapshot of the active configuration. */
  get currentConfig(): SandboxConfig {
    return cloneConfig(this.config);
  }
}
