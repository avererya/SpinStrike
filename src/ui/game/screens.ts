import { el, hex } from '../dom';
import { STARTER_TOPS, getTop, type TopDefinition } from '../../content/tops';
import { baseStats } from '../../content/derive';
import {
  DIFFICULTIES,
  DIFFICULTY_DESCRIPTION,
  DIFFICULTY_LABEL,
  DIFFICULTY_REWARD_PERCENT,
  MAX_LEVEL,
  MAX_UPGRADE_RANK,
  RANK_LADDER,
  RARITY_LABEL,
  STARTING_CREDITS,
  UPGRADE_STATS,
  UPGRADE_STAT_LABEL,
  xpToNextLevel,
  type UpgradeStat,
} from '../../career/config';
import {
  effectiveStats,
  maxRankForLevel,
  rankProgress,
  statValueAtRank,
  upgradeCompletion,
  calculateReward,
} from '../../career/progression';
import { winRate, FINISH_KINDS, type BattleRecord, type TopStats } from '../../career/history';
import type { OwnedTop } from '../../career/save';
import { LAUNCH_QUALITIES, LAUNCH_QUALITY_LABEL } from '../../sim/launch';
import { FINISH_LABEL } from '../resultText';
import type { GameContext } from './context';
import {
  accentStyle,
  button,
  chip,
  classChip,
  fmtDuration,
  fmtInt,
  fmtPct,
  fmtStat,
  kv,
  meter,
  pips,
  rarityChip,
  section,
  statBars,
  STAT_ROWS,
  traitsOf,
} from './widgets';

const CREDIT = '◈';
const stadiumName = (id: string) => (id === 'classic' ? 'Classic Arena' : id);

function preview(ctx: GameContext, def: TopDefinition, cls = '', dim = false): HTMLElement {
  const box = el('div', { class: `preview-box ${cls}`.trim(), style: accentStyle(def) });
  box.append(ctx.previews.create(def, { dim }));
  return box;
}

function page(cls: string, children: (Node | string)[]): HTMLElement {
  return el('div', { class: `page ${cls}` }, children);
}
function pageTitle(title: string, sub = '', back?: Node): HTMLElement {
  return el('div', { class: 'page-title' }, [back ?? el('span'), el('div', {}, [el('h2', { text: title }), sub ? el('div', { class: 'sub', text: sub }) : el('span')])]);
}
function backBtn(ctx: GameContext, label = '◀ Garage', to: Parameters<GameContext['go']>[0] = { name: 'garage' }): HTMLElement {
  return button(label, 'small back', () => ctx.go(to));
}

// ================================================================ starter
export function starterScreen(ctx: GameContext): HTMLElement {
  let selected: string = STARTER_TOPS[0]!.id;
  const cards: HTMLElement[] = [];
  const begin = button('', 'primary big', () => ctx.beginCareer(selected));
  const status = ctx.store.loadStatus;
  const refreshSel = () => {
    cards.forEach((c, i) => c.classList.toggle('selected', STARTER_TOPS[i]!.id === selected));
    begin.textContent = `Begin career with ${getTop(selected).name}`;
    begin.style.setProperty('--btn-accent', hex(getTop(selected).palette.accent));
  };
  const grid = el('div', { class: 'starter-grid' });
  for (const def of STARTER_TOPS) {
    const s = baseStats(def);
    const t = traitsOf(s);
    const card = el('button', { class: 'starter-card', style: accentStyle(def), 'aria-label': `Choose ${def.name}` }, [
      preview(ctx, def, 'small'),
      el('div', { class: 'sc-head' }, [el('span', { class: 'sc-name', text: def.name }), classChip(def.topClass), rarityChip(RARITY_LABEL.common)]),
      el('div', { class: 'sc-desc', text: def.description }),
      statBars(s),
      el('div', { class: 'sc-traits' }, [el('span', { class: 'good', text: `Strong: ${t.strong.join(', ')}` }), el('span', { class: 'bad', text: t.weak.length ? `Weak: ${t.weak.join(', ')}` : 'No major weakness' })]),
    ]);
    card.addEventListener('click', () => {
      selected = def.id;
      refreshSel();
    });
    cards.push(card);
    grid.append(card);
  }
  refreshSel();
  const notes: Node[] = [];
  if (status.kind === 'unreadable') {
    notes.push(el('div', { class: 'notice err', text: `Your previous career save could not be read (${status.errors.join(' ')}). A copy of the unreadable data was kept in this browser. Starting a new career replaces the main save.` }));
  }
  if (status.kind === 'newer') {
    return page('starter', [
      pageTitle('Save from a newer version'),
      el('div', { class: 'notice err', text: status.errors.join(' ') }),
      el('div', { class: 'notice', text: 'Your save has not been changed. Reload to get the latest version, or open the Sandbox from the menu.' }),
      button('Open Sandbox', '', () => ctx.openSandbox()),
    ]);
  }
  return page('starter', [
    pageTitle('Choose your starter top', 'You begin with one Common top, 500 Credits and Bronze III rank. All four are viable.'),
    ...notes,
    grid,
    el('div', { class: 'starter-foot' }, [begin, el('div', { class: 'hint', text: `Starting Credits: ${fmtInt(STARTING_CREDITS)} ${CREDIT} · Classic Arena unlocked · more tops arrive in later updates.` })]),
  ]);
}

// ================================================================= garage
function statRow(def: TopDefinition, top: OwnedTop, key: keyof ReturnType<typeof baseStats>, label: string): HTMLElement {
  const base = baseStats(def);
  const eff = effectiveStats(def, top.upgrades);
  const rank = key === 'weight' ? null : top.upgrades[key as UpgradeStat];
  const b = base[key];
  const e = eff.stats[key];
  const delta = e - b;
  return el('div', { class: 'stat-row' }, [
    el('span', { class: 'sr-k', text: label }),
    meter(e / 100, `${label} ${fmtStat(e)}`, delta > 0 ? 'up' : ''),
    el('span', { class: 'sr-v' }, [fmtStat(e), delta > 0.04 ? el('small', { class: 'delta', text: ` +${fmtStat(delta)}` }) : '']),
    rank === null ? el('span', { class: 'sr-r', text: 'gear' }) : el('span', { class: 'sr-r', text: `${rank}/${MAX_UPGRADE_RANK}` }),
  ]);
}

export function garageScreen(ctx: GameContext): HTMLElement {
  const top = ctx.store.activeTop!;
  const def = getTop(top.definitionId);
  const eff = effectiveStats(def, top.upgrades);
  const base = baseStats(def);
  const maxed = top.level >= MAX_LEVEL;
  const need = xpToNextLevel(top.level);
  const comp = upgradeCompletion(top.upgrades);
  const rows = [
    ...STAT_ROWS.slice(0, 5).map((r) => statRow(def, top, r.key, r.label)),
    el('div', { class: 'stat-row' }, [
      el('span', { class: 'sr-k', text: 'Crit Chance' }),
      meter(eff.critChance / 0.25, `Critical chance ${fmtPct(eff.critChance)}`, top.upgrades.critChance > 0 ? 'up' : ''),
      el('span', { class: 'sr-v' }, [`${Math.round(eff.critChance * 100)}%`, top.upgrades.critChance > 0 ? el('small', { class: 'delta', text: ` +${Math.round((eff.critChance - 0.05) * 100)}` }) : '']),
      el('span', { class: 'sr-r', text: `${top.upgrades.critChance}/${MAX_UPGRADE_RANK}` }),
    ]),
    statRow(def, top, 'weight', 'Weight'),
  ];
  void base;
  const unlockNote = (() => {
    const cap = maxRankForLevel(top.level);
    if (cap >= MAX_UPGRADE_RANK) return 'All upgrade ranks unlocked.';
    const next = [1, 5, 10, 15, 20, 25].find((l) => l > top.level);
    return `Upgrade ranks up to ${cap} unlocked${next ? ` · rank ${maxRankForLevel(next)} at level ${next}` : ''}.`;
  })();
  const info = el('div', { class: 'garage-info' }, [
    el('div', { class: 'g-head' }, [el('h2', { text: def.name }), classChip(def.topClass), rarityChip(RARITY_LABEL[top.rarity])]),
    el('div', { class: 'level-block' }, [
      el('div', { class: 'lvl-line' }, [el('strong', { text: `Level ${top.level}` }), el('span', { class: 'muted', text: maxed ? 'Max level' : `${top.xp} / ${need} XP` })]),
      meter(maxed ? 1 : top.xp / need, maxed ? 'Max level' : `XP ${top.xp} of ${need}`, 'xp'),
      el('div', { class: 'hint', text: unlockNote }),
    ]),
    el('div', { class: 'stat-head' }, [el('span', { text: 'Effective stats' }), el('span', { class: 'muted', text: `Upgrades ${comp.purchased}/${comp.total}` })]),
    el('div', { class: 'stat-list' }, rows),
    el('div', { class: 'hint', text: 'Bars show effective (upgraded) stats; the green +value is what upgrades add to the base.' }),
    el('div', { class: 'g-actions' }, [
      button('Quick Battle', 'primary big', () => ctx.go({ name: 'battle' })),
      button('Upgrade', 'big', () => ctx.go({ name: 'upgrades' })),
      button('Top History', 'big', () => ctx.go({ name: 'history' })),
    ]),
  ]);
  return page('garage', [el('div', { class: 'garage-grid' }, [el('div', { class: 'garage-stage' }, [preview(ctx, def, 'large'), el('div', { class: 'stage-caption', text: def.description })]), info])]);
}

// ================================================================ upgrades
export function upgradesScreen(ctx: GameContext): HTMLElement {
  const top = ctx.store.activeTop!;
  const def = getTop(top.definitionId);
  const cap = maxRankForLevel(top.level);
  const list = el('div', { class: 'upgrade-list' });
  const message = el('div', { class: 'notice hidden', role: 'status' });
  for (const stat of UPGRADE_STATS) {
    const rank = top.upgrades[stat];
    const check = ctx.store.canUpgrade(top, stat);
    const nowVal = statValueAtRank(def, top.upgrades, stat, rank);
    const isCrit = stat === 'critChance';
    const fmt = (v: number) => (isCrit ? `${Math.round(v * 100)}%` : fmtStat(v));
    const nextVal = rank < MAX_UPGRADE_RANK ? statValueAtRank(def, top.upgrades, stat, rank + 1) : null;
    let label = 'Maxed';
    if (check.ok) label = `Upgrade · ${fmtInt(check.cost)} ${CREDIT}`;
    else if (check.reason === 'level') label = `Requires level ${check.requiredLevel}`;
    else if (check.reason === 'credits') label = `Need ${fmtInt(parseInt(check.message.replace(/\D/g, ''), 10) || 0)} more ${CREDIT}`;
    const btn = button(label, check.ok ? 'primary' : '', () => {
      const r = ctx.store.upgrade(top.instanceId, stat);
      if (!r.ok) {
        message.textContent = r.message;
        message.classList.remove('hidden');
        return;
      }
      ctx.refresh();
    });
    btn.disabled = !check.ok;
    const cost = check.ok ? check.cost : null;
    const card = el('div', { class: `upgrade-card${rank >= MAX_UPGRADE_RANK ? ' maxed' : ''}${!check.ok && check.reason === 'level' ? ' locked' : ''}` }, [
      el('div', { class: 'uc-head' }, [el('strong', { text: UPGRADE_STAT_LABEL[stat] }), el('span', { class: 'uc-rank', text: `Rank ${rank}/${MAX_UPGRADE_RANK}` })]),
      pips(rank, MAX_UPGRADE_RANK),
      el('div', { class: 'uc-vals' }, [
        el('span', { text: `Now ${fmt(nowVal)}` }),
        nextVal !== null ? el('span', { class: 'next', text: `Next ${fmt(nextVal)} (${isCrit ? '+2 pts' : `+${fmtStat(nextVal - nowVal)}`})` }) : el('span', { class: 'next', text: 'Fully upgraded' }),
      ]),
      btn,
    ]);
    if (cost !== null && cost <= 0) card.append();
    list.append(card);
  }
  return page('upgrades', [
    pageTitle(`Upgrade ${def.name}`, `Level ${top.level} · upgrade ranks up to ${cap} available`, backBtn(ctx)),
    el('div', { class: 'upgrade-top' }, [preview(ctx, def, 'mini'), el('div', {}, [el('div', { class: 'credits-big', text: `${CREDIT} ${fmtInt(ctx.store.save!.credits)}` }), el('div', { class: 'hint', text: 'Credits are shared by your whole career. Upgrades are permanent.' })])]),
    message,
    list,
  ]);
}

// ============================================================ battle setup
export function battleScreen(ctx: GameContext): HTMLElement {
  const save = ctx.store.save!;
  const top = ctx.store.activeTop!;
  const def = getTop(top.definitionId);
  const rank = rankProgress(save.rank);
  const diffs = el('div', { class: 'diff-grid', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const rewardBox = el('div', { class: 'reward-preview' });
  const warn = el('div', { class: 'hint' });
  const renderRewards = () => {
    const r = calculateReward('bronze', ctx.difficulty, 'win');
    rewardBox.replaceChildren(
      el('div', { class: 'rp-title', text: 'Victory reward' }),
      el('div', { class: 'rp-line' }, [el('strong', { text: `${CREDIT} ${r.credits}` }), el('strong', { text: `${r.xp} XP` })]),
      el('div', { class: 'hint', text: `Defeat ${(() => { const l = calculateReward('bronze', ctx.difficulty, 'loss'); return `${l.credits} ${CREDIT} · ${l.xp} XP`; })()} · Draw ${(() => { const d = calculateReward('bronze', ctx.difficulty, 'draw'); return `${d.credits} ${CREDIT} · ${d.xp} XP`; })()} · Quitting earns nothing.` }),
    );
    warn.textContent = ctx.difficulty === 'expert' ? 'Expert currently changes only the opponent’s launch quality (no tactical AI yet), so its 2× rewards are under review.' : '';
  };
  const buttons: HTMLElement[] = [];
  for (const d of DIFFICULTIES) {
    const b = el('button', { class: 'diff-btn', role: 'radio' }, [
      el('strong', { text: DIFFICULTY_LABEL[d] }),
      el('span', { class: 'diff-mult', text: `${DIFFICULTY_REWARD_PERCENT[d] / 100}× rewards` }),
      el('span', { class: 'diff-desc', text: DIFFICULTY_DESCRIPTION[d] }),
    ]);
    b.addEventListener('click', () => {
      ctx.setDifficulty(d);
      sync();
    });
    buttons.push(b);
    diffs.append(b);
  }
  const sync = () => {
    DIFFICULTIES.forEach((d, i) => {
      buttons[i]!.classList.toggle('active', d === ctx.difficulty);
      buttons[i]!.setAttribute('aria-checked', String(d === ctx.difficulty));
    });
    renderRewards();
  };
  sync();
  return page('battle', [
    pageTitle('Quick Battle', 'A random opponent from your rank · Classic Arena'),
    el('div', { class: 'qb-top panel' }, [
      preview(ctx, def, 'mini'),
      el('div', {}, [el('strong', { text: def.name }), el('div', { class: 'muted', text: `Level ${top.level} · ${rank.rank.label}` }), el('div', { class: 'hint', text: 'Opponent is chosen at random; you cannot pick a favourable matchup.' })]),
    ]),
    section('Difficulty', [diffs, warn]),
    el('div', { class: 'panel' }, [rewardBox]),
    el('div', { class: 'qb-foot' }, [
      kv('Arena', 'Classic Arena'),
      kv('Opponent rank', `${rank.rank.label} (Bronze rewards)`),
      button('Start Battle', 'primary big', () => ctx.startQuickBattle(ctx.difficulty)),
    ]),
  ]);
}

// ============================================================== collection
export function collectionScreen(ctx: GameContext): HTMLElement {
  const save = ctx.store.save!;
  const grid = el('div', { class: 'collection-grid' });
  for (const def of STARTER_TOPS) {
    const owned = save.tops.find((t) => t.definitionId === def.id);
    const head = el('div', { class: 'sc-head' }, [el('span', { class: 'sc-name', text: def.name }), classChip(def.topClass), rarityChip(RARITY_LABEL.common)]);
    if (owned) {
      const comp = upgradeCompletion(owned.upgrades);
      const wr = winRate(owned.stats);
      const active = owned.instanceId === save.activeTopId;
      grid.append(
        el('div', { class: `coll-card owned${active ? ' active' : ''}`, style: accentStyle(def) }, [
          preview(ctx, def, 'small'),
          head,
          active ? chip('Active top', 'ok') : button('Make active', 'small', () => { ctx.store.setActiveTop(owned.instanceId); ctx.refresh(); }),
          kv('Level', String(owned.level)),
          kv('Upgrades', `${comp.purchased}/${comp.total} (${fmtPct(comp.purchased / comp.total)})`),
          kv('Win rate', owned.stats.battles ? `${fmtPct(wr)} (${owned.stats.wins}-${owned.stats.losses}-${owned.stats.draws})` : 'No battles yet'),
          button('Top History', 'small', () => ctx.go({ name: 'history' })),
        ]),
      );
    } else {
      grid.append(
        el('div', { class: 'coll-card unowned', style: accentStyle(def) }, [
          preview(ctx, def, 'small', true),
          head,
          chip('Not owned', 'muted'),
          el('div', { class: 'hint', text: 'Acquisition coming in a future update.' }),
        ]),
      );
    }
  }
  const owned = save.tops.length;
  return page('collection', [pageTitle('Collection', `${owned} of ${STARTER_TOPS.length} tops owned`), grid]);
}

// ================================================================== career
export function careerScreen(ctx: GameContext): HTMLElement {
  const save = ctx.store.save!;
  const rp = rankProgress(save.rank);
  const pct = rp.required ? rp.wins / rp.required : 1;
  const ladder = el('ol', { class: 'ladder' });
  RANK_LADDER.forEach((r) => {
    const cur = r.id === save.rank.id;
    const done = RANK_LADDER.findIndex((x) => x.id === r.id) < RANK_LADDER.findIndex((x) => x.id === save.rank.id);
    ladder.append(el('li', { class: `${cur ? 'current' : ''} ${done ? 'done' : ''} ${r.implemented ? '' : 'future'}`.trim() }, [el('span', { class: 'rl-name', text: r.label }), el('span', { class: 'rl-note', text: cur ? 'Current' : done ? 'Cleared' : r.implemented ? `${r.winsToAdvance} wins` : 'Coming later' })]));
  });
  const nextText = rp.atLimit
    ? rp.qualified
      ? 'Bronze Championship qualified!'
      : `${rp.required! - rp.wins} wins to qualify for the Bronze Championship`
    : `${rp.required! - rp.wins} more wins to reach ${rp.nextLabel}`;
  return page('career', [
    pageTitle('Career', 'Rank belongs to you, not to a single top'),
    el('div', { class: 'panel rank-hero' }, [
      el('div', { class: 'rank-name', text: rp.rank.label }),
      meter(pct, `Rank progress ${rp.wins} of ${rp.required}`, 'rank'),
      el('div', { class: 'lvl-line' }, [el('span', { text: `${rp.wins} / ${rp.required} victories in this rank` }), el('span', { class: 'muted', text: nextText })]),
      rp.qualified
        ? el('div', { class: 'notice ok', text: 'You qualified for the Bronze Championship! Championships are coming in a future release. Until then you can keep battling, earning Credits, levelling up and upgrading.' })
        : el('div', { class: 'hint', text: 'Only victories advance your rank. You can never be demoted.' }),
    ]),
    section('Career totals', [
      kv('Battles', String(save.totals.battles)),
      kv('Victories', String(save.totals.wins)),
      kv('Credits earned', `${CREDIT} ${fmtInt(save.totals.creditsEarned)}`),
      kv('XP earned', fmtInt(save.totals.xpEarned)),
      kv('Credits', `${CREDIT} ${fmtInt(save.credits)}`),
    ]),
    section('Rank ladder', [ladder, el('div', { class: 'hint', text: 'Silver and above arrive in future updates.' })]),
  ]);
}

// ================================================================ history
function tallyTable(title: string, rows: { name: string; t: { battles: number; wins: number; losses: number; draws: number } }[]): HTMLElement {
  const body = rows.map((r) =>
    el('tr', {}, [el('td', { text: r.name }), el('td', { text: String(r.t.battles) }), el('td', { text: `${r.t.wins}-${r.t.losses}-${r.t.draws}` }), el('td', { text: r.t.battles ? fmtPct(winRate(r.t)) : '—' })]),
  );
  if (!rows.length) body.push(el('tr', {}, [el('td', { colspan: '4', class: 'muted', text: 'No battles yet.' })]));
  return section(title, [el('table', { class: 'tbl' }, [el('thead', {}, [el('tr', {}, ['', 'Battles', 'W-L-D', 'Win rate'].map((h) => el('th', { text: h })))]), el('tbody', {}, body)])]);
}

function recordRow(r: BattleRecord): HTMLElement {
  const res = r.result === 'win' ? 'Victory' : r.result === 'loss' ? 'Defeat' : 'Draw';
  const fin = r.finish === 'draw' ? 'Draw' : r.finish === 'timeout' ? 'Time up' : FINISH_LABEL[r.finish].replace(' FINISH', '').toLowerCase();
  const name = (() => { try { return getTop(r.opponent.topId).name; } catch { return r.opponent.topId; } })();
  return el('li', { class: `rec ${r.result}` }, [
    el('span', { class: 'rec-res', text: res }),
    el('span', { class: 'rec-main', text: `vs ${name} · ${r.difficulty} · ${fin} · ${fmtDuration(r.duration)}` }),
    el('span', { class: 'rec-sub', text: `Launch ${LAUNCH_QUALITY_LABEL[r.launch]}${r.aim ? ` · aim ${r.aim.direction > 0 ? '+' : ''}${r.aim.direction}° / ${r.aim.tilt}°` : ''} · +${r.rewards.credits} ${CREDIT} +${r.rewards.xp} XP${r.ruleset ? (r.ruleset === 'v0.4.1' ? ' · v0.4.1 rules' : '') : ' · v0.4.0 rules'}` }),
    ...(r.tactical
      ? [el('span', { class: 'rec-sub', text: `You: ${r.tactical.player.boosts} boost${r.tactical.player.boosts === 1 ? '' : 's'}, ${r.tactical.player.braces} brace${r.tactical.player.braces === 1 ? '' : 's'} · Opponent: ${r.tactical.opponent.boosts} / ${r.tactical.opponent.braces}` })]
      : []),
  ]);
}

function tacticsRows(s: TopStats): Node[] {
  const t = s.tactics;
  if (!t.battles) return [el('div', { class: 'muted', text: 'No battles with abilities yet. Battles before v0.5 had no Boost or Brace and are not counted here.' })];
  const per = (x: number) => (t.battles ? (x / t.battles).toFixed(1) : '0');
  return [
    kv('Battles with abilities', String(t.battles)),
    kv('Boosts used (per battle)', `${t.boostsUsed} (${per(t.boostsUsed)})`),
    kv('Braces used (per battle)', `${t.bracesUsed} (${per(t.bracesUsed)})`),
    kv('Stamina spent on boosts', `${t.staminaSpent.toFixed(1)} % of launch spin`),
    kv('Boost → hit (within 1 s)', t.boostsUsed ? `${t.boostsToHit} of ${t.boostsUsed} (${fmtPct(t.boostsToHit / t.boostsUsed)})` : '—'),
    kv('Boost → knockout (within 1.5 s)', String(t.boostKnockouts)),
    kv('Hits taken while braced', String(t.braceImpacts)),
    kv('Damage prevented by Brace', fmtInt(t.damagePrevented)),
    kv('Battles / wins without abilities', `${t.noAbilityBattles} / ${t.noAbilityWins}`),
    el('div', { class: 'hint', text: 'Counted since v0.5. Earlier battles are not back-filled.' }),
  ];
}

export function historyScreen(ctx: GameContext, tab: 'overview' | 'matchups' | 'stadiums' = 'overview'): HTMLElement {
  const top = ctx.store.activeTop!;
  const def = getTop(top.definitionId);
  const s: TopStats = top.stats;
  const tabs = el('div', { class: 'seg tabs-seg', role: 'tablist' });
  for (const [id, label] of [['overview', 'Overview'], ['matchups', 'Matchups'], ['stadiums', 'Stadiums']] as const) {
    const b = el('button', { class: `seg-btn${tab === id ? ' active' : ''}`, text: label, role: 'tab', 'aria-selected': String(tab === id) });
    b.addEventListener('click', () => ctx.go({ name: 'history', tab: id }));
    tabs.append(b);
  }
  let body: HTMLElement[];
  if (tab === 'overview') {
    const lq = el('div', { class: 'lq' });
    const totalL = LAUNCH_QUALITIES.reduce((a, q) => a + s.launches[q], 0);
    for (const q of LAUNCH_QUALITIES) {
      lq.append(el('div', { class: 'lq-row' }, [el('span', { text: LAUNCH_QUALITY_LABEL[q] }), meter(totalL ? s.launches[q] / totalL : 0, `${LAUNCH_QUALITY_LABEL[q]} launches`), el('span', { class: 'muted', text: String(s.launches[q]) })]));
    }
    const recent = [...s.recent].reverse();
    const shown = recent.slice(0, 15);
    const recList = el('ol', { class: 'rec-list' }, shown.map(recordRow));
    const more: HTMLButtonElement | null = recent.length > shown.length ? button(`Show all ${recent.length}`, 'small', () => { recList.replaceChildren(...recent.map(recordRow)); more?.remove(); }) : null;
    body = [
      section('Record', [
        el('div', { class: 'big-stats' }, [
          el('div', {}, [el('strong', { text: String(s.battles) }), el('span', { text: 'Battles' })]),
          el('div', {}, [el('strong', { text: `${s.wins}-${s.losses}-${s.draws}` }), el('span', { text: 'W-L-D' })]),
          el('div', {}, [el('strong', { text: s.battles ? fmtPct(winRate(s)) : '—' }), el('span', { text: 'Win rate' })]),
          el('div', {}, [el('strong', { text: `${s.streak} / ${s.bestStreak}` }), el('span', { text: 'Streak / best' })]),
        ]),
        el('div', { class: 'hint', text: 'Win rate = victories ÷ all completed battles, draws included.' }),
      ]),
      section('Finishes', [
        ...FINISH_KINDS.map((f) => kv(`${FINISH_LABEL[f].replace(' FINISH', '').toLowerCase()} — won / lost`, `${s.winsByFinish[f]} / ${s.lossesByFinish[f]}`)),
        kv('Fastest victory', fmtDuration(s.fastestWin)),
        kv('Longest battle', fmtDuration(s.longestBattle)),
      ]),
      section('Combat & earnings', [
        kv('Damage dealt', fmtInt(s.damageDealt)),
        kv('Damage received', fmtInt(s.damageReceived)),
        kv('Critical hits', String(s.critsLanded)),
        kv('Lifetime Credits', `${CREDIT} ${fmtInt(s.creditsEarned)}`),
        kv('Lifetime XP', fmtInt(top.lifetimeXp)),
      ]),
      section('Tactics (Boost & Brace)', tacticsRows(s)),
      section('Launch quality', [lq]),
      section('Recent battles', [s.recent.length ? recList : el('div', { class: 'muted', text: 'No battles yet. Your first Quick Battle starts the record.' }), ...(more ? [more] : [])]),
    ];
  } else if (tab === 'matchups') {
    body = [
      tallyTable('By opponent class', Object.entries(s.vsClass).map(([name, t]) => ({ name, t }))),
      tallyTable('By opponent top', Object.entries(s.vsTop).map(([id, t]) => ({ name: (() => { try { return getTop(id).name; } catch { return id; } })(), t }))),
    ];
  } else {
    body = [tallyTable('By stadium', Object.entries(s.byStadium).map(([id, t]) => ({ name: stadiumName(id), t })))];
    if (!Object.keys(s.byStadium).length) body.push(el('div', { class: 'hint', text: 'Only the Classic Arena has career statistics for now.' }));
  }
  return page('history', [pageTitle(`${def.name} history`, `Level ${top.level} · lifetime statistics`, backBtn(ctx)), tabs, ...body]);
}

// ================================================================ settings
export function settingsScreen(ctx: GameContext): HTMLElement {
  const save = ctx.store.save;
  const msg = el('div', { class: 'notice hidden', role: 'status' });
  const show = (text: string | Node[], cls = '') => {
    msg.className = `notice ${cls}`;
    msg.replaceChildren(...(typeof text === 'string' ? [text] : text));
  };
  const out: Node[] = [pageTitle('Settings', `SpinStrike v${ctx.version} · build ${ctx.build}`)];
  const st = ctx.store.loadStatus;
  if (st.kind === 'ok' && st.warnings.length) out.push(el('div', { class: 'notice', text: `Save notes: ${st.warnings.join(' ')}` }));
  if (ctx.store.lastSaveError) out.push(el('div', { class: 'notice err', text: ctx.store.lastSaveError }));

  out.push(
    section('Career save', [
      el('div', { class: 'notice', text: 'Your career is saved only in this browser on this device. Clearing site data or switching browsers loses it unless you export a backup.' }),
      save ? kv('Last saved', save.updatedAt ? new Date(save.updatedAt).toLocaleString() : '—') : el('span'),
      save ? kv('Save revision', String(save.revision)) : el('span'),
    ]),
  );

  // Export
  const exportBtn = button('Download backup (.json)', 'primary', () => {
    const json = ctx.store.exportJson();
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `spinstrike-career-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    show('Backup downloaded.', 'ok');
  });
  const copyBtn = button('Copy to clipboard', '', () => {
    const json = ctx.store.exportJson();
    if (!json) return;
    navigator.clipboard?.writeText(json).then(() => show('Save copied to the clipboard.', 'ok'), () => show('Could not access the clipboard; use Download instead.', 'err'));
  });
  exportBtn.disabled = copyBtn.disabled = !save;
  out.push(section('Export save', [el('div', { class: 'btn-row' }, [exportBtn, copyBtn])]));

  // Import
  const area = el('textarea', { class: 'import-text', rows: '4', placeholder: 'Paste exported save JSON here, or choose a file', 'aria-label': 'Save JSON' }) as HTMLTextAreaElement;
  const file = el('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Choose save file' }) as HTMLInputElement;
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) f.text().then((t) => { area.value = t; preview(); }, () => show('Could not read the file.', 'err'));
  });
  const confirmBox = el('div', { class: 'confirm hidden' });
  const preview = () => {
    confirmBox.classList.add('hidden');
    const text = area.value.trim();
    if (!text) return show('Paste or choose a save first.', 'err');
    const r = ctx.store.previewImport(text);
    if (!r.ok) return show([el('strong', { text: 'This save cannot be imported:' }), el('ul', {}, r.errors.map((e) => el('li', { text: e })))], 'err');
    const a = r.save;
    const top = a.tops.find((t) => t.instanceId === a.activeTopId)!;
    show(`Valid save: ${getTop(top.definitionId).name} level ${top.level}, ${fmtInt(a.credits)} Credits, ${rankProgress(a.rank).rank.label}, ${a.totals.battles} battles.${r.warnings.length ? ` Notes: ${r.warnings.join(' ')}` : ''}`, 'ok');
    confirmBox.classList.remove('hidden');
    confirmBox.replaceChildren(
      el('div', { text: save ? 'Importing REPLACES your current career on this device.' : 'Import this career?' }),
      button('Replace my career with this save', 'danger', () => {
        const res = ctx.store.importJson(text);
        if (!res.ok) return show(res.errors.join(' '), 'err');
        area.value = '';
        confirmBox.classList.add('hidden');
        ctx.go({ name: 'garage' });
      }),
    );
  };
  out.push(section('Import save', [file, area, el('div', { class: 'btn-row' }, [button('Check save', '', preview)]), confirmBox]));
  out.push(msg);

  // Reset
  if (save) {
    const resetBox = el('div', { class: 'confirm hidden' });
    const phrase = el('input', { type: 'text', class: 'reset-input', placeholder: 'Type RESET to confirm', 'aria-label': 'Type RESET to confirm', autocomplete: 'off', autocapitalize: 'characters' }) as HTMLInputElement;
    const doReset = button('Permanently delete my career', 'danger', () => {
      if (phrase.value.trim().toUpperCase() !== 'RESET') return show('Type RESET to confirm.', 'err');
      ctx.store.reset();
      ctx.go({ name: 'starter' });
    });
    doReset.disabled = true;
    phrase.addEventListener('input', () => { doReset.disabled = phrase.value.trim().toUpperCase() !== 'RESET'; });
    resetBox.append(el('div', { text: 'This permanently deletes your tops, Credits, rank and statistics from this browser. Export a backup first if you might want them back.' }), phrase, doReset, button('Cancel', '', () => { resetBox.classList.add('hidden'); phrase.value = ''; doReset.disabled = true; }));
    out.push(section('Reset career', [el('div', { class: 'hint', text: 'Start over with a new starter. The Sandbox is not affected.' }), button('Reset career…', 'danger', () => resetBox.classList.remove('hidden')), resetBox], 'danger-zone'));
  }
  out.push(section('Sandbox', [el('div', { class: 'hint', text: 'The developer sandbox is separate from your career: it never earns Credits, XP, rank progress or statistics.' }), button('Open Sandbox', '', () => ctx.openSandbox())]));
  return page('settings', out);
}
