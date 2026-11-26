import { Battle } from '../sim/battle';
import { FixedStepRunner, SIM_SPEEDS } from '../sim/runner';
import { randomSeed } from '../sim/rng';
import { getTop, type TopDefinition } from '../content/tops';
import { autoLaunches, buildBattleOptions, cloneConfig, defaultConfig, rematchConfig, type SandboxConfig } from '../config/sandboxConfig';
import { SceneRenderer } from '../render/sceneRenderer';
import { DEFAULT_DEBUG_FLAGS, type DebugFlags } from '../render/debugDraw';
import { DevPanel, TOP_OPTIONS } from './devPanel';
import { Hud } from './hud';
import { el, hex } from './dom';
import { formatBonus, formatHealth, formatStamina } from './format';
import { FINISH_LABEL, describeResult } from './resultText';
import { LAUNCH_QUALITY_LABEL, meterPosition, playerLaunchQuality, type TopLaunch } from '../sim/launch';
import { BUILD_ID, VERSION_LABEL } from '../version';
import type { BattleResult } from '../sim/battle';
import type { CareerBattleSetup } from '../career/battle';

/**
 * Hooks of a career battle (v0.4). The stage knows nothing about rewards:
 * the shell settles the result exactly once in `onFinished` and returns the
 * summary to display.
 */
export interface CareerBattleHooks {
  /** Called once when the result is decided. Returns the rewards panel to show in the result card. */
  onFinished(result: BattleResult): HTMLElement | null;
  /** "Battle Again": the shell prepares a fresh opponent + seed and calls startCareerBattle again. */
  onAgain(): void;
  /** Return to Garage, or quit an unfinished battle (no rewards). */
  onExit(finished: boolean): void;
}

/** Presentation timings (real seconds). Never affect the simulated result. */
const SLOWMO_FACTOR = 0.3;
const SLOWMO_TIME = 0.7;
const BANNER_DELAY = 0.25;
const RESULT_DELAY_CINEMATIC = 1.6;
const RESULT_DELAY_PLAIN = 0.4;
const DAMAGE_NUMBER_POOL = 12;
const DAMAGE_NUMBER_LIFE = 0.9;
const CRIT_NUMBER_LIFE = 1.15;
const DAMAGE_NUMBER_MIN = 1;
/** Real seconds the launch result is shown before combat starts. */
const LAUNCH_REVEAL = 0.85;
/** Real seconds the launch qualities are shown when the minigame is bypassed. */
const LAUNCH_REVEAL_BYPASS = 0.5;

interface DamageNumber {
  el: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

type Status = 'ready' | 'launching' | 'running' | 'paused' | 'finished';

/**
 * Sandbox application: wires the simulation, renderer and DOM UI together.
 * Owns no physics logic itself.
 *
 * Battle flow (v0.3): Start → launch minigame (or bypass) → launch result
 * reveal → autonomous battle → finish presentation → result card.
 *   - "New battle" / "Again" / Rematch: fresh seed and a fresh launch.
 *   - "Replay (same seed)": exact replay of the last battle, reusing its
 *     recorded launch qualities, so the outcome is identical.
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
  /** Launch of the current battle (null until launched). Reused by exact replays. */
  private launches: readonly TopLaunch[] | null = null;
  /** Seed the recorded launches belong to. */
  private launchSeed = -1;
  /** Minigame clock (real seconds) and reveal countdown. */
  private launchClock = 0;
  private revealClock = -1;
  /** Career battle in progress (null in sandbox mode). */
  private career: { setup: CareerBattleSetup; hooks: CareerBattleHooks; finished: boolean; label: string } | null = null;
  /** Sandbox configuration kept while a career battle uses `config`. */
  private sandboxConfig: SandboxConfig | null = null;
  private active = true;
  private loopRunning = false;
  /** Set by the shell: leaves the sandbox. */
  onExitSandbox: (() => void) | null = null;
  private readonly careerBar: HTMLElement;
  private readonly careerLabel: HTMLElement;
  private readonly careerPause: HTMLButtonElement;
  private readonly quitBox: HTMLElement;

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
  private readonly resultBadge: HTMLElement;
  private readonly resultSub: HTMLElement;
  private readonly resultTable: HTMLElement;
  private readonly resultButtons: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly errorBox: HTMLElement;
  // Launch minigame
  private readonly launchBox: HTMLElement;
  private readonly launchMeter: HTMLElement;
  private readonly launchNeedle: HTMLElement;
  private readonly launchBtn: HTMLButtonElement;
  private readonly launchMsg: HTMLElement;
  private readonly launchOpp: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.canvas = el('canvas', { class: 'stage-canvas', 'aria-label': 'Battle stadium' });
    this.playerSel = this.topSelect('Player top');
    this.oppSel = this.topSelect('Opponent top');
    this.startBtn = el('button', { class: 'btn primary', text: 'Start', title: 'Start battle (Space)' });
    this.pauseBtn = el('button', { class: 'btn', text: 'Pause' });
    const resetBtn = el('button', { class: 'btn', text: 'Reset', title: 'Reset to launch position (same seed)' });
    const sameBtn = el('button', { class: 'btn', title: 'Exact replay: same seed and same launch qualities (R)' }, ['↻', el('span', { class: 'btn-label', text: ' Same seed' })]);
    const newBtn = el('button', { class: 'btn', title: 'New battle with a new random seed and a fresh launch' }, ['⚄', el('span', { class: 'btn-label', text: ' New seed' })]);
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
    sameBtn.addEventListener('click', () => this.replay());
    newBtn.addEventListener('click', () => this.freshBattle());
    devBtn.addEventListener('click', () => this.dev.toggle());
    this.playerSel.addEventListener('change', () => {
      this.config.player = { topId: this.playerSel.value, overrides: {} };
      this.onConfigEdited();
    });
    this.oppSel.addEventListener('change', () => {
      this.config.opponent = { topId: this.oppSel.value, overrides: {} };
      this.onConfigEdited();
    });

    const menuBtn = el('button', { class: 'btn', title: 'Back to the main menu' }, ['◀', el('span', { class: 'btn-label', text: ' Menu' })]);
    menuBtn.addEventListener('click', () => this.onExitSandbox?.());
    const toolbar = el('header', { class: 'toolbar sandbox-toolbar' }, [
      menuBtn,
      el('div', { class: 'brand' }, [el('span', { class: 'logo', text: 'SpinStrike Sandbox' }), el('span', { class: 'tag', text: VERSION_LABEL, title: `Build ${BUILD_ID}` })]),
      el('div', { class: 'tb-group picks' }, [
        el('label', { class: 'pick' }, [el('span', { text: 'Player' }), this.playerSel]),
        el('span', { class: 'vs', text: 'vs' }),
        el('label', { class: 'pick' }, [el('span', { text: 'Opponent' }), this.oppSel]),
      ]),
      el('div', { class: 'tb-group actions' }, [this.startBtn, this.pauseBtn, resetBtn, sameBtn, newBtn]),
      el('div', { class: 'tb-group' }, [speedGroup, devBtn]),
    ]);

    this.resultText = el('div', { class: 'result-title' });
    this.resultBadge = el('div', { class: 'result-badge' });
    this.resultSub = el('div', { class: 'result-sub' });
    this.resultTable = el('div', { class: 'result-table' });
    this.resultButtons = el('div', { class: 'btn-row' });
    this.result = el('div', { class: 'result', role: 'dialog', 'aria-live': 'polite' }, [
      this.resultText,
      this.resultBadge,
      this.resultSub,
      this.resultTable,
      this.resultButtons,
    ]);
    this.banner = el('div', { class: 'finish-banner', 'aria-live': 'assertive' });
    this.dmgLayer = el('div', { class: 'dmg-layer', 'aria-hidden': 'true' });
    for (let i = 0; i < DAMAGE_NUMBER_POOL; i++) {
      const label = el('span', { class: 'dmg-label', text: 'CRITICAL HIT' });
      const value = el('span', { class: 'dmg-value' });
      const d = el('div', { class: 'dmg-num' }, [label, value]);
      this.dmgLayer.append(d);
      this.dmgNums.push({ el: d, label, value, x: 0, y: 0, life: 0, maxLife: DAMAGE_NUMBER_LIFE });
    }

    // Launch minigame overlay.
    this.launchNeedle = el('div', { class: 'launch-needle' });
    this.launchMeter = el('div', { class: 'launch-meter', role: 'img', 'aria-label': 'Launch timing meter' }, [
      el('div', { class: 'zone z-good' }),
      el('div', { class: 'zone z-great' }),
      el('div', { class: 'zone z-perfect' }),
      this.launchNeedle,
    ]);
    this.launchBtn = el('button', { class: 'btn primary launch-btn', text: 'LAUNCH', title: 'Launch (Space or tap)' });
    this.launchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pressLaunch();
    });
    this.launchBtn.addEventListener('click', (e) => e.preventDefault());
    this.launchMsg = el('div', { class: 'launch-msg' });
    this.launchOpp = el('div', { class: 'launch-opp' });
    this.launchBox = el('div', { class: 'launch-box', 'aria-live': 'polite' }, [
      el('div', { class: 'launch-title', text: 'Time your launch' }),
      this.launchMeter,
      this.launchMsg,
      this.launchOpp,
      this.launchBtn,
      el('div', { class: 'launch-hint', text: 'Stop the marker in the centre · Space or tap' }),
    ]);

    // Career battle bar (replaces the sandbox toolbar in career battles).
    const quitBtn = el('button', { class: 'btn small', text: '✕ Quit' });
    this.careerPause = el('button', { class: 'btn small', text: 'Pause' });
    this.careerLabel = el('div', { class: 'career-label' });
    quitBtn.addEventListener('click', () => this.quitBox.classList.add('show'));
    this.careerPause.addEventListener('click', () => this.togglePause());
    this.careerBar = el('header', { class: 'career-bar' }, [quitBtn, this.careerLabel, this.careerPause]);
    const quitYes = el('button', { class: 'btn primary', text: 'Quit battle' });
    const quitNo = el('button', { class: 'btn', text: 'Keep fighting' });
    this.quitBox = el('div', { class: 'quit-box', role: 'dialog' }, [
      el('div', { class: 'quit-title', text: 'Quit this battle?' }),
      el('div', { class: 'quit-text', text: 'An abandoned battle earns no Credits, XP or rank progress.' }),
      el('div', { class: 'btn-row' }, [quitYes, quitNo]),
    ]);
    quitNo.addEventListener('click', () => this.quitBox.classList.remove('show'));
    quitYes.addEventListener('click', () => {
      this.quitBox.classList.remove('show');
      const c = this.career;
      if (c) c.hooks.onExit(false);
    });

    this.stats = el('pre', { class: 'stats' });
    this.errorBox = el('div', { class: 'error-box' });
    this.stage = el('main', { class: 'stage' }, [this.canvas, this.dmgLayer, this.hud.root, this.banner, this.launchBox, this.result, this.quitBox, this.stats, this.errorBox]);

    this.dev = new DevPanel({
      onConfigChange: (c) => {
        this.config = c;
        this.playerSel.value = c.player.topId;
        this.oppSel.value = c.opponent.topId;
        this.launches = null;
        this.rebuild(false, false);
      },
      onDebugChange: (f) => {
        this.flags = f;
        this.updateOverlays();
      },
    });
    this.root.append(toolbar, this.careerBar, this.stage, this.dev.root);
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
      if (!this.active) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (this.status === 'launching') this.pressLaunch();
        else if (this.career) {
          if (this.status === 'running' || this.status === 'paused') this.togglePause();
        } else if (this.status === 'ready' || this.status === 'finished') this.startBattle();
        else this.togglePause();
      } else if (e.key === 'r' && !this.career) this.replay();
    });
    this.lastTime = performance.now();
    this.loopRunning = true;
    requestAnimationFrame(this.frame);
  }

  /** Pauses rendering and simulation while the stage is not on screen (saves battery). */
  setActive(on: boolean): void {
    this.active = on;
    if (on && !this.loopRunning && this.renderer) {
      this.loopRunning = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this.frame);
    }
    if (on) this.resize();
  }

  /** Sandbox mode: restores the sandbox configuration (never career data). */
  enterSandbox(): void {
    this.career = null;
    if (this.sandboxConfig) {
      this.config = this.sandboxConfig;
      this.sandboxConfig = null;
    }
    this.root.classList.remove('career-battle');
    this.quitBox.classList.remove('show');
    this.playerSel.value = this.config.player.topId;
    this.oppSel.value = this.config.opponent.topId;
    this.launches = null;
    this.rebuild(false);
  }

  /**
   * Career mode: runs `config` (built by the career layer, never a sandbox
   * config) and reports the result through `hooks`. The sandbox
   * configuration is kept aside untouched.
   */
  startCareerBattle(setup: CareerBattleSetup, config: SandboxConfig, hooks: CareerBattleHooks, label: string): void {
    if (!this.sandboxConfig && !this.career) this.sandboxConfig = this.config;
    this.career = { setup, hooks, finished: false, label };
    this.config = config;
    this.launches = null;
    this.root.classList.add('career-battle');
    this.quitBox.classList.remove('show');
    this.careerLabel.textContent = label;
    this.rebuild(false);
    this.beginLaunch();
  }

  /**
   * Rebuilds the battle from the current config. `launches` = launch record
   * to use (exact replay / just launched); without it the tops are placed at
   * their launch positions waiting for a launch.
   */
  rebuild(startNow: boolean, rerenderDev = true, launches?: readonly TopLaunch[]): void {
    const ls = launches ?? autoLaunches(this.config);
    this.battle = new Battle(buildBattleOptions(this.config, ls));
    this.runner = new FixedStepRunner(this.battle);
    this.runner.speed = this.speed;
    this.runner.paused = !startNow;
    const defs: TopDefinition[] = [getTop(this.config.player.topId), getTop(this.config.opponent.topId)];
    this.renderer.setWorld(this.battle.world, defs);
    const mirror = defs[0]!.id === defs[1]!.id;
    this.hud.setTops(defs, this.config.seed, mirror ? ['P1', 'P2'] : ['Player', 'Opponent']);
    this.hud.setLaunches(launches ?? null);
    this.hud.update(this.battle);
    this.status = startNow ? 'running' : 'ready';
    this.resultShown = false;
    this.result.classList.remove('show', 'career');
    this.hideLaunch();
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
    this.launches = null;
    this.rebuild(false);
  }

  /** Start / Again: launch the prepared battle (fresh launch). */
  private startBattle(): void {
    if (this.status === 'finished') {
      this.freshBattle();
      return;
    }
    if (this.status !== 'ready') return;
    this.beginLaunch();
  }

  /** New seed + fresh launch (New seed button, Again, Rematch). */
  private freshBattle(): void {
    this.config = rematchConfig(this.config, randomSeed());
    this.launches = null;
    this.rebuild(false);
    this.beginLaunch();
  }

  /**
   * Exact replay: same seed and the recorded launch qualities, so both the
   * launch parameters and the simulated outcome are reproduced. Without a
   * recorded launch for this seed it falls back to the automatic launch.
   */
  private replay(): void {
    const ls = this.launches && this.launchSeed === this.config.seed ? this.launches : null;
    if (!ls && this.needsMinigame()) {
      this.rebuild(false);
      this.beginLaunch();
      return;
    }
    this.rebuild(true, true, ls ?? autoLaunches(this.config));
    this.recordLaunch(this.battle.launches);
  }

  private needsMinigame(): boolean {
    return this.config.launch.minigame && this.config.launch.playerQuality === 'auto';
  }

  private beginLaunch(): void {
    if (!this.needsMinigame()) {
      // Bypass: qualities come from the fixed settings / seeded distribution.
      this.launchWith(autoLaunches(this.config), LAUNCH_REVEAL_BYPASS);
      return;
    }
    this.status = 'launching';
    this.launchClock = 0;
    this.revealClock = -1;
    const z = this.config.launch.zones;
    const zone = (cls: string, half: number) => {
      const e = this.launchMeter.querySelector<HTMLElement>(`.${cls}`)!;
      e.style.left = `${(0.5 - half) * 100}%`;
      e.style.width = `${2 * half * 100}%`;
    };
    zone('z-good', z.good);
    zone('z-great', z.great);
    zone('z-perfect', z.perfect);
    this.launchMsg.textContent = '';
    this.launchMsg.className = 'launch-msg';
    this.launchOpp.textContent = '';
    this.launchBtn.disabled = false;
    this.launchBox.classList.remove('revealing', 'bypass');
    this.launchBox.classList.add('show');
    this.updateButtons();
  }

  /** The player pressed LAUNCH (button, tap or Space). */
  private pressLaunch(): void {
    if (this.status !== 'launching' || this.revealClock >= 0) return;
    const L = this.config.launch;
    this.launchNeedle.style.left = `${meterPosition(this.launchClock, L.sweepTime) * 100}%`;
    const q = playerLaunchQuality(this.launchClock, this.launchClock, L.sweepTime, L.zones, L.timeout)!;
    this.launchWith(autoLaunches(this.config, q), LAUNCH_REVEAL);
  }

  /** Builds the battle with the decided launches and shows the reveal. */
  private launchWith(ls: readonly TopLaunch[], reveal: number): void {
    this.rebuild(false, false, ls);
    this.recordLaunch(ls);
    this.status = 'launching';
    this.revealClock = reveal;
    const [p, o] = ls;
    const name = (i: number) => getTop(i === 0 ? this.config.player.topId : this.config.opponent.topId).name;
    this.launchMsg.textContent = `${LAUNCH_QUALITY_LABEL[p!.quality]}! ${formatBonus(p!.energyMultiplier)} spin energy`;
    this.launchMsg.className = `launch-msg q-${p!.quality}`;
    this.launchOpp.textContent = `${name(1)}: ${LAUNCH_QUALITY_LABEL[o!.quality]} launch · ${formatBonus(o!.energyMultiplier)}`;
    this.launchBtn.disabled = true;
    this.launchBox.classList.add('show', 'revealing');
    this.launchBox.classList.toggle('bypass', reveal === LAUNCH_REVEAL_BYPASS);
    this.updateButtons();
  }

  private recordLaunch(ls: readonly TopLaunch[]): void {
    this.launches = ls;
    this.launchSeed = this.config.seed;
    this.hud.setLaunches(ls);
  }

  private hideLaunch(): void {
    this.revealClock = -1;
    this.launchBox.classList.remove('show', 'revealing', 'bypass');
  }

  private updateLaunch(dt: number): void {
    if (this.status !== 'launching') return;
    if (this.revealClock >= 0) {
      this.revealClock -= dt;
      if (this.revealClock < 0) {
        this.hideLaunch();
        this.runner.paused = false;
        this.status = 'running';
        this.updateButtons();
      }
      return;
    }
    this.launchClock += dt;
    this.launchNeedle.style.left = `${meterPosition(this.launchClock, this.config.launch.sweepTime) * 100}%`;
    const L = this.config.launch;
    if (playerLaunchQuality(null, this.launchClock, L.sweepTime, L.zones, L.timeout) === 'poor') {
      // No launch in time: a Poor launch (configurable timeout).
      this.launchWith(autoLaunches(this.config, 'poor'), LAUNCH_REVEAL);
      this.launchMsg.textContent = `Too slow: Poor launch · ${formatBonus(this.config.launch.bonuses.poor)}`;
    }
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
    this.startBtn.disabled = this.status === 'running' || this.status === 'paused' || this.status === 'launching';
    this.startBtn.textContent = this.status === 'finished' ? 'Again' : 'Start';
    this.pauseBtn.disabled = !(this.status === 'running' || this.status === 'paused');
    this.pauseBtn.textContent = this.status === 'paused' ? 'Resume' : 'Pause';
    this.careerPause.disabled = !(this.status === 'running' || this.status === 'paused');
    this.careerPause.textContent = this.status === 'paused' ? 'Resume' : 'Pause';
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
    if (!this.active) {
      this.loopRunning = false;
      return;
    }
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.08;
    this.updateLaunch(dt);

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
      const p = this.config.presentation;
      this.renderer.onDamage(dmg, p.criticalEffects);
      for (const ev of dmg) {
        const bA = this.battle.world.bodies[ev.a]!;
        const bB = this.battle.world.bodies[ev.b]!;
        // Critical numbers appear by default even when ordinary numbers are off.
        const showB = ev.damageToB >= DAMAGE_NUMBER_MIN && (p.damageNumbers || (ev.critToB && p.criticalEffects));
        const showA = ev.damageToA >= DAMAGE_NUMBER_MIN && (p.damageNumbers || (ev.critToA && p.criticalEffects));
        // Critical numbers sit at the impact point (offset toward the target) so they read as part of the hit.
        const critB = ev.critToB && p.criticalEffects;
        const critA = ev.critToA && p.criticalEffects;
        if (showB) this.spawnDamageNumber(critB ? ev.x + ev.nx * 0.012 : bB.x, critB ? ev.y + ev.ny * 0.012 : bB.y, ev.damageToB, ev.b, critB);
        if (showA) this.spawnDamageNumber(critA ? ev.x - ev.nx * 0.012 : bA.x, critA ? ev.y - ev.ny * 0.012 : bA.y, ev.damageToA, ev.a, critA);
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

  private spawnDamageNumber(x: number, y: number, dmg: number, target: number, crit: boolean): void {
    const d = this.dmgNums[this.dmgNext]!;
    this.dmgNext = (this.dmgNext + 1) % this.dmgNums.length;
    d.x = x;
    d.y = y;
    d.maxLife = crit ? CRIT_NUMBER_LIFE : DAMAGE_NUMBER_LIFE;
    d.life = d.maxLife;
    const max = this.battle.world.bodies[target]!.combat.maxHealth;
    d.value.textContent = `-${Math.round(dmg)}`;
    d.el.classList.toggle('heavy', !crit && dmg / max >= 0.06);
    d.el.classList.toggle('crit', crit);
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
      const t = 1 - d.life / d.maxLife;
      // The overlay covers the stage; the canvas may be offset inside it (mobile HUD above).
      const ox = this.canvas.offsetLeft;
      const oy = this.canvas.offsetTop;
      const pop = d.el.classList.contains('crit') ? 1 + 0.35 * Math.max(0, 1 - t * 5) : 1;
      d.el.style.transform = `translate(${(p.x + ox).toFixed(1)}px, ${(p.y + oy - 18 - t * 34).toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
      d.el.style.opacity = String(Math.min(1, d.life / 0.3));
    }
  }

  private showBanner(): void {
    this.bannerShown = true;
    const o = this.battle.result!.outcome;
    let text: string;
    let kind: string;
    if (o.kind === 'win') {
      text = o.narrow ? 'NARROW VICTORY' : FINISH_LABEL[o.finish];
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
    const content = describeResult(r, label);
    this.resultText.textContent = content.title;
    this.resultText.style.color = r.outcome.kind === 'win' ? hex(defs[r.outcome.winner]!.palette.accent) : '';
    this.resultBadge.textContent = content.badge;
    this.resultBadge.classList.toggle('show', content.badge !== '');
    this.resultSub.textContent = content.sub;
    const row = (k: string, f: (i: number) => string) =>
      [el('span', { class: 'rk', text: k }), el('span', { text: f(0) }), el('span', { text: f(1) })];
    const head = [el('span'), ...[0, 1].map((i) => el('span', { class: 'rh', text: label(i), style: `color:${hex(defs[i]!.palette.accent)}` }))];
    const s = r.strongestHit;
    const strongest = s.by >= 0 ? `${s.damage.toFixed(0)} by ${label(s.by)}${s.critical ? ' (critical hit)' : ''}` : 'none';
    this.resultTable.replaceChildren(
      el('div', { class: 'rgrid' }, [
        ...head,
        ...row('Launch', (i) => `${LAUNCH_QUALITY_LABEL[r.launches[i]!.quality]} ${formatBonus(r.launches[i]!.energyMultiplier)}`),
        ...row('Health left', (i) => formatHealth(r.tops[i]!.health, r.tops[i]!.maxHealth)),
        ...row('Stamina left', (i) => formatStamina(r.tops[i]!.stamina)),
        ...row('Damage dealt', (i) => r.tops[i]!.damageDealt.toFixed(0)),
        ...row('Hits (crits)', (i) => `${r.tops[i]!.hitsLanded} (${r.tops[i]!.critsLanded})`),
      ]),
      el('details', { class: 'rmore' }, [
        el('summary', { text: 'More statistics' }),
        el('div', { class: 'rgrid' }, [
          ...head.map((h) => h.cloneNode(true)),
          ...row('Crit damage dealt', (i) => r.tops[i]!.critDamageDealt.toFixed(0)),
          ...row('Crits received', (i) => String(r.tops[i]!.critsReceived)),
          ...row('Damage taken', (i) => r.tops[i]!.damageReceived.toFixed(0)),
          ...row('Strongest hit', (i) => `${r.tops[i]!.strongestHit.toFixed(0)}${r.tops[i]!.strongestHitCritical ? ' crit' : ''}`),
          ...row('Collisions', (i) => String(r.tops[i]!.collisions)),
        ]),
      ]),
      el('div', { class: 'rmeta' }, [`Strongest hit: ${strongest}`, el('br'), `Duration ${r.time.toFixed(2)} s · seed ${r.seed}`]),
    );
    const btn = (text: string, cls: string, fn: () => void, title = '') => {
      const b = el('button', { class: `btn ${cls}`, text, title });
      b.addEventListener('click', fn);
      return b;
    };
    const car = this.career;
    if (car) {
      // Career: settle rewards exactly once, then show them above the statistics.
      let panel: HTMLElement | null = null;
      if (!car.finished) {
        car.finished = true;
        panel = car.hooks.onFinished(r);
      }
      if (panel) this.resultTable.prepend(panel);
      const again = btn('Battle Again', 'primary', () => car.hooks.onAgain(), 'Fight a fresh opponent with a new seed');
      const home = btn('Return to Garage', '', () => car.hooks.onExit(true));
      this.resultButtons.replaceChildren(again, home);
      this.result.classList.add('show', 'career');
      return;
    }
    this.result.classList.remove('career');
    const close = btn('Close', '', () => this.result.classList.remove('show'));
    const replay = btn('Replay (same seed)', '', () => this.replay(), 'Exact replay: same seed and launch');
    const fresh = btn(r.outcome.kind === 'draw' ? 'Rematch' : 'New battle', 'primary', () => this.freshBattle(), 'Same tops, new seed, fresh launch');
    if (r.outcome.kind === 'draw') fresh.classList.add('rematch');
    this.resultButtons.replaceChildren(fresh, replay, close);
    this.result.classList.add('show');
  }

  private topSelect(label: string): HTMLSelectElement {
    const s = el('select', { 'aria-label': label });
    for (const o of TOP_OPTIONS) s.append(el('option', { value: o.id, text: o.label }));
    return s;
  }

  /** Shows a small, dismissible "new version available" notice (no automatic reload). */
  showUpdateNotice(version: string, build: string): void {
    if (this.root.querySelector('.update-notice')) return;
    const reload = el('button', { class: 'btn small primary', text: 'Reload' });
    reload.addEventListener('click', () => location.reload());
    const dismiss = el('button', { class: 'btn small', text: 'Later' });
    const box = el('div', { class: 'update-notice', role: 'status' }, [
      el('span', { text: `A newer version is available (v${version} · ${build}).` }),
      reload,
      dismiss,
    ]);
    dismiss.addEventListener('click', () => box.remove());
    this.stage.append(box);
  }

  /** For console debugging: a snapshot of the active configuration. */
  get currentConfig(): SandboxConfig {
    return cloneConfig(this.config);
  }
}

