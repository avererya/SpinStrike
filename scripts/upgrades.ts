/**
 * Upgrade effectiveness matrix (v0.4.1).
 *
 *   npm run upgrades -- --battles 100 [--baseline] [--part k --of n --out f.json]
 *   npm run upgrades -- --merge f0.json f1.json …  [--md report.md]
 *
 * For every starter: unupgraded, each attribute at rank 1 / 5 / 10, three
 * mixed builds and the fully upgraded build, each against all four
 * UNUPGRADED starters (both slot orders, launches from the AI distribution
 * on both sides). Also: fully upgraded vs fully upgraded (stress test) and
 * a representative upgraded opponent (all ranks 5).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { STARTER_TOPS, getTop } from '../src/content/tops';
import { defaultConfig, legacyV040Config, type SandboxConfig } from '../src/config/sandboxConfig';
import { effectiveStats } from '../src/career/progression';
import { UPGRADE_STATS, zeroRanks, type UpgradeRanks } from '../src/career/config';
import { deriveTopPhysics } from '../src/content/derive';
import { measure, aggregate, type BattleMetrics } from './dynamics';

function arg(n: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const baseline = process.argv.includes('--baseline');
const ruleset = baseline ? 'v0.3' : 'v0.4.1';

interface Build {
  id: string;
  ranks: UpgradeRanks;
}
function builds(): Build[] {
  const out: Build[] = [{ id: 'base', ranks: zeroRanks() }];
  for (const k of UPGRADE_STATS) for (const r of [1, 5, 10]) out.push({ id: `${k}${r}`, ranks: { ...zeroRanks(), [k]: r } });
  out.push({ id: 'mixA', ranks: { health: 4, attack: 4, defense: 4, stamina: 4, speed: 4, critChance: 4 } });
  out.push({ id: 'mixB', ranks: { health: 6, attack: 6, defense: 2, stamina: 2, speed: 6, critChance: 2 } });
  out.push({ id: 'mixC', ranks: { health: 6, attack: 2, defense: 6, stamina: 6, speed: 2, critChance: 2 } });
  out.push({ id: 'full', ranks: { health: 10, attack: 10, defense: 10, stamina: 10, speed: 10, critChance: 10 } });
  return out;
}
const OPP_RANKS: Record<string, UpgradeRanks> = {
  base: zeroRanks(),
  r5: { health: 5, attack: 5, defense: 5, stamina: 5, speed: 5, critChance: 5 },
  full: { health: 10, attack: 10, defense: 10, stamina: 10, speed: 10, critChance: 10 },
};

function cfgFor(seed: number, me: string, mine: UpgradeRanks, opp: string, theirs: UpgradeRanks, swap: boolean): SandboxConfig {
  const c = baseline ? legacyV040Config(seed) : defaultConfig(seed);
  const a = effectiveStats(getTop(me), mine, ruleset);
  const b = effectiveStats(getTop(opp), theirs, ruleset);
  const A = { topId: me, overrides: {}, stats: a.stats, critChance: a.critChance };
  const B = { topId: opp, overrides: {}, stats: b.stats, critChance: b.critChance };
  c.player = swap ? B : A;
  c.opponent = swap ? A : B;
  c.launch.minigame = false;
  c.launch.playerQuality = 'auto';
  c.launch.opponentQuality = 'auto';
  return c;
}

type Row = { top: string; build: string; opp: string; oppBuild: string; ms: BattleMetrics[]; mySlot: number[] };

const mergeAt = process.argv.indexOf('--merge');
if (mergeAt < 0) {
  const battles = Number(arg('battles') ?? 100);
  const part = Number(arg('part') ?? 0);
  const of = Number(arg('of') ?? 1);
  const seed0 = Number(arg('seed') ?? 300001);
  const rows: Row[] = [];
  let k = 0;
  const jobs: { top: string; b: Build; opp: string; ob: string }[] = [];
  for (const t of STARTER_TOPS) for (const b of builds()) for (const o of STARTER_TOPS) jobs.push({ top: t.id, b, opp: o.id, ob: 'base' });
  for (const t of STARTER_TOPS) for (const o of STARTER_TOPS) {
    jobs.push({ top: t.id, b: { id: 'full', ranks: OPP_RANKS.full! }, opp: o.id, ob: 'full' });
    jobs.push({ top: t.id, b: { id: 'base', ranks: zeroRanks() }, opp: o.id, ob: 'r5' });
    jobs.push({ top: t.id, b: { id: 'full', ranks: OPP_RANKS.full! }, opp: o.id, ob: 'r5' });
  }
  const only = arg('only')?.split(',');
  for (const j of jobs) {
    if (only && !(only.includes(j.b.id) && j.ob === 'base')) continue;
    if (k++ % of !== part) continue;
    const ms: BattleMetrics[] = [];
    const mySlot: number[] = [];
    for (let i = 0; i < battles; i++) {
      for (const swap of [false, true]) {
        ms.push(measure(cfgFor((seed0 + i) >>> 0, j.top, j.b.ranks, j.opp, OPP_RANKS[j.ob]!, swap)));
        mySlot.push(swap ? 1 : 0);
      }
    }
    rows.push({ top: j.top, build: j.b.id, opp: j.opp, oppBuild: j.ob, ms, mySlot });
  }
  writeFileSync(arg('out') ?? 'upgrades.json', JSON.stringify(rows));
} else {
  const rows: Row[] = [];
  for (const f of process.argv.slice(mergeAt + 1).filter((x) => x.endsWith('.json'))) rows.push(...(JSON.parse(readFileSync(f, 'utf8')) as Row[]));
  const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '–');
  const name = (id: string) => getTop(id).name;
  const wr = (r: Row) => (100 * r.ms.filter((m, i) => m.winner === r.mySlot[i]).length) / r.ms.length;
  const pick = (top: string, build: string, ob = 'base') => rows.filter((r) => r.top === top && r.build === build && r.oppBuild === ob);
  const lines: string[] = [];
  lines.push(`# Upgrade effectiveness (${baseline ? 'v0.4.0 baseline' : 'v0.4.1'})`, '');
  lines.push('Win rate (%) of the upgraded top against each UNUPGRADED starter, both slot orders, AI-distribution launches on both sides. Δ = change vs the same top unupgraded.', '');
  for (const t of STARTER_TOPS) {
    lines.push(`## ${t.name}`, '');
    lines.push(`| Build | vs ${STARTER_TOPS.map((o) => o.name).join(' | vs ')} | Overall | Δ | Dur (s) | Hits | Burst / KO / spin wins % | Dmg dealt | Dmg taken |`);
    lines.push(`| --- | ${STARTER_TOPS.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- | --- | --- |`);
    const baseRows = pick(t.id, 'base');
    const baseAll = baseRows.flatMap((r) => r.ms.map((m, i) => ({ m, s: r.mySlot[i]! })));
    const baseWr = (100 * baseAll.filter((x) => x.m.winner === x.s).length) / Math.max(1, baseAll.length);
    for (const b of builds()) {
      const rs = pick(t.id, b.id);
      if (!rs.length) continue;
      const all = rs.flatMap((r) => r.ms.map((m, i) => ({ m, s: r.mySlot[i]! })));
      const w = (100 * all.filter((x) => x.m.winner === x.s).length) / all.length;
      const wins = all.filter((x) => x.m.winner === x.s);
      const fin = (k: string) => f1((100 * wins.filter((x) => x.m.finish === k).length) / Math.max(1, all.length));
      const g = aggregate(all.map((x) => x.m));
      const dealt = all.reduce((a, x) => a + x.m.dmg[x.s]!, 0) / all.length;
      const taken = all.reduce((a, x) => a + x.m.dmg[1 - x.s]!, 0) / all.length;
      const cells = STARTER_TOPS.map((o) => {
        const r = rs.find((x) => x.opp === o.id);
        return r ? f1(wr(r)) : '–';
      });
      lines.push(`| ${b.id} | ${cells.join(' | ')} | **${f1(w)}** | ${b.id === 'base' ? '' : (w - baseWr >= 0 ? '+' : '') + f1(w - baseWr)} | ${f1(g.durMean)} | ${f1(g.hits)} | ${fin('burst')} / ${fin('knockout')} / ${fin('spin')} | ${f1(dealt)} | ${f1(taken)} |`);
    }
    lines.push('');
  }
  lines.push('## Upgraded opponents and stress tests', '');
  lines.push('| Top (build) | vs opponents (build) | Overall win % | Dur (s) | Hits | Draw+timeout % |', '| --- | --- | --- | --- | --- | --- |');
  for (const [b, ob] of [['full', 'full'], ['base', 'r5'], ['full', 'r5']] as const) {
    for (const t of STARTER_TOPS) {
      const rs = pick(t.id, b, ob);
      if (!rs.length) continue;
      const all = rs.flatMap((r) => r.ms.map((m, i) => ({ m, s: r.mySlot[i]! })));
      const g = aggregate(all.map((x) => x.m));
      lines.push(`| ${t.name} (${b}) | all four starters (${ob}) | ${f1((100 * all.filter((x) => x.m.winner === x.s).length) / all.length)} | ${f1(g.durMean)} | ${f1(g.hits)} | ${f1(g.draw + g.timeout)} |`);
    }
  }
  // Physical property changes at rank 10.
  lines.push('', '## Physical effect of rank 10 (per top)', '', '| Top | Stat | Property | Base | Rank 10 | Change |', '| --- | --- | --- | --- | --- | --- |');
  const props: Record<string, (keyof ReturnType<typeof deriveTopPhysics>)[]> = {
    speed: ['launchSpeed', 'tipTraction', 'tipDriveRadius'],
    stamina: ['spinDecay', 'impactSpinResist'],
    attack: ['ringStrike', 'contactFriction', 'impactSpinDrain'],
    defense: ['restitution'],
  };
  for (const t of STARTER_TOPS) {
    const p0 = deriveTopPhysics(t, { ruleset, stats: effectiveStats(t, zeroRanks(), ruleset).stats });
    for (const [stat, keys] of Object.entries(props)) {
      const p1 = deriveTopPhysics(t, { ruleset, stats: effectiveStats(t, { ...zeroRanks(), [stat]: 10 }, ruleset).stats });
      for (const k of keys) {
        const a = Number(p0[k] ?? 0), b = Number(p1[k] ?? 0);
        lines.push(`| ${name(t.id)} | ${stat} | ${String(k)} | ${a.toPrecision(4)} | ${b.toPrecision(4)} | ${a ? f1((100 * (b - a)) / a) + ' %' : '–'} |`);
      }
    }
  }
  const out = lines.join('\n');
  console.log(out);
  const md = arg('md');
  if (md) writeFileSync(md, out + '\n');
}
