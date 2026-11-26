import { el, hex } from '../dom';
import { SandboxApp, type CareerBattleHooks } from '../app';
import { PreviewHub } from '../../render/topPreview';
import { CareerStore, type KeyValueStore, MemoryStore, type SettledBattle } from '../../career/store';
import { createBattleSetup, buildCareerConfig, opponentRankLabel, type CareerBattleSetup } from '../../career/battle';
import { DIFFICULTY_LABEL, MAX_LEVEL, xpToNextLevel, type Difficulty, DIFFICULTIES } from '../../career/config';
import { rankProgress } from '../../career/progression';
import { randomSeed } from '../../sim/rng';
import { getTop } from '../../content/tops';
import type { BattleResult } from '../../sim/battle';
import { FINISH_LABEL } from '../resultText';
import { APP_VERSION, BUILD_ID } from '../../version';
import type { GameContext, Route } from './context';
import { battleScreen, careerScreen, collectionScreen, garageScreen, historyScreen, settingsScreen, starterScreen, upgradesScreen, } from './screens';
import { fmtDuration, fmtInt, meter } from './widgets';
import { defaultIds } from '../../career/store';

const PREFS_KEY = 'spinstrike.prefs.v1';

function browserStorage(): KeyValueStore {
  try {
    const s = window.localStorage;
    const k = '__spinstrike_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return new MemoryStore();
  }
}

const TABS: { id: Route['name']; label: string; icon: string }[] = [
  { id: 'garage', label: 'Garage', icon: '⌂' },
  { id: 'battle', label: 'Battle', icon: '⚔' },
  { id: 'collection', label: 'Collection', icon: '▦' },
  { id: 'career', label: 'Career', icon: '★' },
];
/** Which tab lights up for each route. */
const TAB_OF: Record<Route['name'], Route['name'] | null> = {
  starter: null,
  garage: 'garage',
  upgrades: 'garage',
  history: 'garage',
  battle: 'battle',
  collection: 'collection',
  career: 'career',
  settings: null,
};

/**
 * The game shell (v0.4): navigation (Garage / Battle / Collection / Career,
 * Sandbox and Settings from the menu), the career store, and the wiring
 * between career battles and the battle stage. The stage itself
 * (SandboxApp) stays unaware of progression.
 */
export class GameShell implements GameContext {
  readonly store: CareerStore;
  readonly previews = new PreviewHub();
  readonly version = APP_VERSION;
  readonly build = BUILD_ID;
  difficulty: Difficulty = 'normal';
  private route: Route = { name: 'garage' };
  private stage: SandboxApp | null = null;
  private mode: 'menu' | 'battle' | 'sandbox' = 'menu';
  private readonly menuRoot: HTMLElement;
  private readonly host: HTMLElement;
  private readonly battleHost: HTMLElement;
  private readonly credits: HTMLElement;
  private readonly rankChip: HTMLElement;
  private readonly tabbar: HTMLElement;
  private readonly menuPop: HTMLElement;
  private readonly banner: HTMLElement;

  constructor(root: HTMLElement) {
    this.store = new CareerStore(browserStorage(), { version: APP_VERSION });
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { difficulty?: string };
      if ((DIFFICULTIES as readonly string[]).includes(p.difficulty ?? '')) this.difficulty = p.difficulty as Difficulty;
    } catch {
      /* defaults */
    }

    this.credits = el('span', { class: 'chip credits', title: 'Credits' });
    this.rankChip = el('span', { class: 'chip rank', title: 'Career rank' });
    const menuBtn = el('button', { class: 'icon-btn', 'aria-label': 'Menu', title: 'Menu', text: '☰' });
    const brand = el('button', { class: 'brand-btn', text: 'SpinStrike' });
    brand.addEventListener('click', () => this.go({ name: 'garage' }));
    const topbar = el('header', { class: 'topbar' }, [brand, el('span', { class: 'ver', text: `v${APP_VERSION}` }), el('div', { class: 'chips' }, [this.credits, this.rankChip]), menuBtn]);
    this.menuPop = el('div', { class: 'menu-pop hidden', role: 'menu' });
    for (const [label, fn] of [
      ['Settings & save', () => this.go({ name: 'settings' })],
      ['Sandbox (developer)', () => this.openSandbox()],
    ] as [string, () => void][]) {
      const b = el('button', { class: 'menu-item', text: label, role: 'menuitem' });
      b.addEventListener('click', () => {
        this.menuPop.classList.add('hidden');
        fn();
      });
      this.menuPop.append(b);
    }
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menuPop.classList.toggle('hidden');
    });
    document.addEventListener('click', () => this.menuPop.classList.add('hidden'));
    this.banner = el('div', { class: 'banner hidden' });
    this.host = el('main', { class: 'screen-host' });
    this.tabbar = el('nav', { class: 'tabbar', 'aria-label': 'Main' });
    for (const t of TABS) {
      const b = el('button', { class: 'tab', 'data-tab': t.id, 'aria-label': t.label }, [el('span', { class: 'tab-icon', text: t.icon }), el('span', { class: 'tab-label', text: t.label })]);
      b.addEventListener('click', () => this.go({ name: t.id } as Route));
      this.tabbar.append(b);
    }
    this.menuRoot = el('div', { class: 'menu-root' }, [topbar, this.menuPop, this.banner, this.host, this.tabbar]);
    this.battleHost = el('div', { class: 'battle-host hidden' });
    root.append(this.menuRoot, this.battleHost);
  }

  /** Small dismissible "new version available" notice (no automatic reload). */
  showUpdateNotice(version: string, build: string): void {
    if (document.querySelector('.update-notice')) return;
    const reload = el('button', { class: 'btn small primary', text: 'Reload' });
    reload.addEventListener('click', () => location.reload());
    const dismiss = el('button', { class: 'btn small', text: 'Later' });
    const box = el('div', { class: 'update-notice fixed', role: 'status' }, [el('span', { text: `A newer version is available (v${version} · ${build}).` }), reload, dismiss]);
    dismiss.addEventListener('click', () => box.remove());
    document.body.append(box);
  }

  start(): void {
    this.store.load();
    this.route = this.store.save ? { name: 'garage' } : { name: 'starter' };
    this.render();
    this.store.subscribe(() => this.updateChrome());
    // Test / debugging hook (no effect on gameplay).
    (window as unknown as { spinstrikeGame: GameShell }).spinstrikeGame = this;
  }

  // ------------------------------------------------------------ routing
  go(route: Route): void {
    if (this.mode !== 'menu') this.showMenu();
    if (route.name !== 'starter' && !this.store.save && route.name !== 'settings') route = { name: 'starter' };
    this.route = route;
    this.host.scrollTop = 0;
    this.render();
  }
  refresh(): void {
    const y = this.host.scrollTop;
    this.render();
    this.host.scrollTop = y;
  }

  private render(): void {
    const r = this.route;
    const hasCareer = !!this.store.save;
    this.menuRoot.classList.toggle('no-career', !hasCareer);
    let view: HTMLElement;
    if (!hasCareer && r.name !== 'settings') view = starterScreen(this);
    else {
      switch (r.name) {
        case 'garage': view = garageScreen(this); break;
        case 'upgrades': view = upgradesScreen(this); break;
        case 'history': view = historyScreen(this, r.tab); break;
        case 'battle': view = battleScreen(this); break;
        case 'collection': view = collectionScreen(this); break;
        case 'career': view = careerScreen(this); break;
        case 'settings': view = settingsScreen(this); break;
        default: view = starterScreen(this);
      }
    }
    this.host.replaceChildren(view);
    const tab = TAB_OF[this.route.name];
    for (const b of this.tabbar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.tab === tab);
    this.updateChrome();
  }

  private updateChrome(): void {
    const s = this.store.save;
    this.credits.textContent = s ? `◈ ${fmtInt(s.credits)}` : '';
    this.rankChip.textContent = s ? rankProgress(s.rank).rank.label : '';
    this.credits.classList.toggle('hidden', !s);
    this.rankChip.classList.toggle('hidden', !s);
    const err = this.store.lastSaveError;
    this.banner.textContent = err ?? '';
    this.banner.classList.toggle('hidden', !err);
  }

  // ------------------------------------------------------------- career
  beginCareer(starterId: string): void {
    this.store.startCareer(starterId);
    this.go({ name: 'garage' });
  }
  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ difficulty: d }));
    } catch {
      /* ignore */
    }
  }

  private ensureStage(): SandboxApp {
    if (!this.stage) {
      this.stage = new SandboxApp(this.battleHost);
      this.stage.onExitSandbox = () => this.go({ name: 'garage' });
      this.stage.start();
    }
    return this.stage;
  }

  private showStage(mode: 'battle' | 'sandbox'): SandboxApp {
    const stage = this.ensureStage();
    this.mode = mode;
    this.menuRoot.classList.add('hidden');
    this.battleHost.classList.remove('hidden');
    this.battleHost.classList.toggle('is-sandbox', mode === 'sandbox');
    stage.setActive(true);
    return stage;
  }
  private showMenu(): void {
    this.mode = 'menu';
    this.stage?.setActive(false);
    this.battleHost.classList.add('hidden');
    this.menuRoot.classList.remove('hidden');
  }

  openSandbox(): void {
    this.menuPop.classList.add('hidden');
    const stage = this.showStage('sandbox');
    stage.enterSandbox();
  }

  startQuickBattle(difficulty: Difficulty): void {
    const save = this.store.save;
    const top = this.store.activeTop;
    if (!save || !top) return;
    this.setDifficulty(difficulty);
    this.launchCareerBattle(difficulty);
  }

  private launchCareerBattle(difficulty: Difficulty): void {
    const save = this.store.save!;
    const top = this.store.activeTop!;
    const setup = createBattleSetup({
      battleId: defaultIds('battle'),
      seed: randomSeed(),
      opponentSeed: randomSeed(),
      difficulty,
      playerRankId: save.rank.id,
      playerInstanceId: top.instanceId,
      playerTopId: top.definitionId,
    });
    const config = buildCareerConfig(setup, top);
    const stage = this.showStage('battle');
    const hooks: CareerBattleHooks = {
      onFinished: (result) => this.settle(setup, result),
      onAgain: () => this.launchCareerBattle(this.difficulty),
      onExit: () => this.go({ name: 'garage' }),
    };
    const opp = getTop(setup.opponent.topId);
    stage.startCareerBattle(setup, config, hooks, `${DIFFICULTY_LABEL[difficulty]} · ${opponentRankLabel(setup)} · vs ${opp.name}`);
  }

  /** Settles a finished battle exactly once and builds the rewards panel. */
  private settle(setup: CareerBattleSetup, result: BattleResult): HTMLElement | null {
    const s = this.store.settleBattle(setup, result);
    if (!s) return el('div', { class: 'notice err', text: 'Rewards for this battle could not be recorded.' });
    this.updateChrome();
    return rewardPanel(s, result, setup, this.store.lastSaveError);
  }
}

// -------------------------------------------------------- rewards panel
export function rewardPanel(s: SettledBattle, result: BattleResult, setup: CareerBattleSetup, saveError: string | null): HTMLElement {
  const head = s.outcome === 'win' ? 'VICTORY' : s.outcome === 'loss' ? 'DEFEAT' : 'DRAW';
  const o = result.outcome;
  const finish = o.kind === 'win' ? FINISH_LABEL[o.finish] : o.kind === 'draw' ? 'DRAW' : 'TIME UP';
  const opp = getTop(setup.opponent.topId);
  const need = (l: number) => xpToNextLevel(l);
  const afterFrac = s.top.after.level >= MAX_LEVEL ? 1 : s.top.after.xp / need(s.top.after.level);
  const lvl = s.top.after.level;
  const rows: Node[] = [
    el('div', { class: `rw-head ${s.outcome}` }, [el('span', { class: 'rw-title', text: head }), el('span', { class: 'rw-sub', text: `${finish} · ${fmtDuration(result.time)}` })]),
    el('div', { class: 'rw-sub2', text: `vs ${opp.name} (${opponentRankLabel(setup)}) · ${DIFFICULTY_LABEL[setup.difficulty]}` }),
    el('div', { class: 'rw-gains' }, [el('div', { class: 'gain' }, [el('strong', { text: `+${fmtInt(s.reward.credits)}` }), el('span', { text: 'Credits' })]), el('div', { class: 'gain' }, [el('strong', { text: `+${fmtInt(s.reward.xp)}` }), el('span', { text: 'XP' })])]),
    el('div', { class: 'rw-xp' }, [
      el('div', { class: 'lvl-line' }, [el('strong', { text: `Level ${lvl}` }), el('span', { class: 'muted', text: s.top.maxLevel ? 'Max level' : `${s.top.after.xp} / ${need(lvl)} XP` })]),
      meter(afterFrac, 'XP progress', 'xp'),
    ]),
  ];
  for (const lu of s.top.levelUps) {
    rows.push(el('div', { class: 'levelup' }, [el('strong', { text: `LEVEL UP! Level ${lu.to}` }), lu.newMaxRank ? el('span', { text: `Upgrade ranks up to ${lu.newMaxRank} unlocked` }) : el('span', { text: '' })]));
  }
  const rb = s.rank.before;
  const ra = s.rank.after;
  const rp = rankProgress(ra);
  if (s.outcome === 'win') {
    if (s.rank.promotedTo) rows.push(el('div', { class: 'promo', text: `PROMOTED to ${rankProgress(ra).rank.label}!` }));
    else if (s.rank.qualifiedNow) rows.push(el('div', { class: 'promo', text: 'You qualified for the Bronze Championship! Championships are coming in a future release.' }));
    rows.push(el('div', { class: 'rw-rank' }, [el('span', { text: `${rp.rank.label}: ${ra.wins}/${rp.required} victories` }), meter(rp.required ? ra.wins / rp.required : 1, 'Rank progress', 'rank')]));
    void rb;
  } else {
    rows.push(el('div', { class: 'hint', text: 'Only victories advance your career rank.' }));
  }
  if (saveError) rows.push(el('div', { class: 'notice err', text: saveError }));
  return el('div', { class: 'rewards', style: `--res:${hex(0)}` }, rows);
}
