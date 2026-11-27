/**
 * Tactical battle simulations (v0.5): AI vs AI and passive vs AI across the
 * starter roster, both orientations (so slot bias cancels), parallel workers.
 *
 *   npm run tactics                                   default pair set, 84 seeds (32,256 battles)
 *   npm run tactics -- --seeds 20 --pairs easy:normal,hard:passive
 *   npm run tactics -- --jobs 4 --seed 900001 --json out.json --md out.md
 *
 * A pair "x:y" reports side x's results against side y; "passive" = no
 * abilities. Every ordered top matchup (4 × 4) runs `seeds` seeds × 2
 * orientations, so each pair is 32 × seeds battles. Win share counts a draw
 * or timeout as half a win.
 */
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig, type TacticalSlotConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { isDifficulty } from '../src/config/sandboxConfig';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export const DEFAULT_PAIRS = [
  'easy:easy', 'normal:normal', 'hard:hard', 'expert:expert',
  'easy:passive', 'normal:passive', 'hard:passive', 'expert:passive',
  'normal:easy', 'hard:normal', 'expert:hard', 'expert:easy',
];

interface Acc {
  n: number;
  /** Side x's win share (draw = ½). */
  xScore: number;
  draws: number;
  ko: number;
  burst: number;
  spin: number;
  dur: number;
  noHit20: number;
  sync10: number;
  syncTime: number;
  boosts: [number, number];
  braces: [number, number];
  boostEnergy: [number, number];
  toHit: [number, number];
  boostKo: [number, number];
  braceImpacts: [number, number];
  prevented: [number, number];
  rejected: [number, number];
  /** Side x's score per top id it played. */
  byTop: Record<string, [number, number]>;
  /** Side x's score per ordered top matchup "x>y". */
  byMatch: Record<string, [number, number]>;
}

function slotCfg(s: string): TacticalSlotConfig {
  if (s === 'passive') return { controller: 'passive', difficulty: 'normal' };
  if (!isDifficulty(s)) throw new Error(`bad side ${s}`);
  return { controller: 'ai', difficulty: s };
}

function runPair(pair: string, seeds: number, seed0: number): Acc {
  const [xs, ys] = pair.split(':') as [string, string];
  const acc: Acc = {
    n: 0, xScore: 0, draws: 0, ko: 0, burst: 0, spin: 0, dur: 0, noHit20: 0, sync10: 0, syncTime: 0,
    boosts: [0, 0], braces: [0, 0], boostEnergy: [0, 0], toHit: [0, 0], boostKo: [0, 0], braceImpacts: [0, 0], prevented: [0, 0], rejected: [0, 0],
    byTop: {}, byMatch: {},
  };
  for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) for (let s = 0; s < seeds; s++) for (const swap of [false, true]) {
    const c = defaultConfig(seed0 + s);
    c.launch.minigame = false;
    // x plays top a, y plays top b; swap puts x in slot 1.
    const xSlot = swap ? 1 : 0;
    c.player.topId = swap ? b.id : a.id;
    c.opponent.topId = swap ? a.id : b.id;
    c.tactical = defaultTacticalConfig();
    c.tactical.player = slotCfg(swap ? ys : xs);
    c.tactical.opponent = slotCfg(swap ? xs : ys);
    const battle = new Battle(buildBattleOptions(c));
    const r = battle.runToEnd();
    const t = battle.world.telemetry.summary(r.steps);
    const o = r.outcome;
    const score = o.kind === 'win' ? (o.winner === xSlot ? 1 : 0) : 0.5;
    acc.n++;
    acc.xScore += score;
    if (o.kind !== 'win') acc.draws++;
    else if (o.finish === 'knockout') acc.ko++;
    else if (o.finish === 'burst') acc.burst++;
    else acc.spin++;
    acc.dur += r.time;
    if ((t.firstHit === null || t.firstHit > 20) && r.time > 20) acc.noHit20++;
    if (t.longestSync >= 10) acc.sync10++;
    acc.syncTime += t.syncTime;
    r.tactical!.tops.forEach((tp, slot) => {
      const side = slot === xSlot ? 0 : 1;
      acc.boosts[side] += tp.boostsUsed;
      acc.braces[side] += tp.bracesUsed;
      acc.boostEnergy[side] += tp.boostCost;
      acc.toHit[side] += tp.boostsToHit;
      acc.boostKo[side] += tp.boostKnockout ? 1 : 0;
      acc.braceImpacts[side] += tp.braceImpacts;
      acc.prevented[side] += tp.damagePrevented;
      acc.rejected[side] += Object.values(tp.rejected).reduce((x, y) => x + (y ?? 0), 0);
    });
    const bt = (acc.byTop[a.id] ??= [0, 0]);
    bt[0] += score;
    bt[1]++;
    const bm = (acc.byMatch[`${a.id}>${b.id}`] ??= [0, 0]);
    bm[0] += score;
    bm[1]++;
  }
  return acc;
}

function merge(a: Acc, b: Acc): Acc {
  const out = structuredClone(a);
  for (const k of ['n', 'xScore', 'draws', 'ko', 'burst', 'spin', 'dur', 'noHit20', 'sync10', 'syncTime'] as const) out[k] += b[k];
  for (const k of ['boosts', 'braces', 'boostEnergy', 'toHit', 'boostKo', 'braceImpacts', 'prevented', 'rejected'] as const) {
    out[k][0] += b[k][0];
    out[k][1] += b[k][1];
  }
  for (const k of ['byTop', 'byMatch'] as const)
    for (const [id, v] of Object.entries(b[k])) {
      const c = (out[k][id] ??= [0, 0]);
      c[0] += v[0];
      c[1] += v[1];
    }
  return out;
}

if (process.env.TSIM_CHILD) {
  const { pair, seeds, seed0 } = JSON.parse(process.env.TSIM_CHILD);
  process.send!(runPair(pair, seeds, seed0));
  process.exit(0);
} else {
  const seeds = Number(arg('seeds') ?? 84);
  const seed0 = Number(arg('seed') ?? 900001);
  const jobs = Number(arg('jobs') ?? 4);
  const pairs = (arg('pairs') ?? DEFAULT_PAIRS.join(',')).split(',');
  // Split each pair into seed chunks so the workers stay busy.
  const CHUNK = Math.max(1, Math.ceil(seeds / 4));
  const tasks: { pair: string; seeds: number; seed0: number }[] = [];
  for (const p of pairs) for (let s = 0; s < seeds; s += CHUNK) tasks.push({ pair: p, seeds: Math.min(CHUNK, seeds - s), seed0: seed0 + s });
  const results: Record<string, Acc> = {};
  const t0 = Date.now();
  let next = 0;
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      while (running < jobs && next < tasks.length) {
        const task = tasks[next++]!;
        running++;
        const ch = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, TSIM_CHILD: JSON.stringify(task) }, execArgv: ['--import', 'tsx'] });
        ch.on('message', (m) => {
          const r = m as Acc;
          results[task.pair] = results[task.pair] ? merge(results[task.pair]!, r) : r;
        });
        ch.on('exit', () => {
          running--;
          if (next >= tasks.length && running === 0) done();
          else launch();
        });
      }
    };
    launch();
  });
  const f = (x: number, d = 1) => x.toFixed(d);
  const lines = [
    `Tactical simulations: ${pairs.length} pairs × 16 matchups × ${seeds} seeds × 2 orientations = ${Object.values(results).reduce((a, r) => a + r.n, 0)} battles (seed ${seed0}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`,
    '',
    '| Pair (x vs y) | x win share | draws | KO / burst / spin | duration s | no hit by 20 s | sync ≥10 s | boosts x / y | braces x / y | boost→hit x / y | boost→KO x / y | prevented HP x / y |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const p of pairs) {
    const r = results[p]!;
    const n = r.n;
    const pc = (k: number) => f((100 * k) / n);
    const per = (v: [number, number], d = 2) => `${f(v[0] / n, d)} / ${f(v[1] / n, d)}`;
    const rate = (h: [number, number], b: [number, number]) => `${b[0] ? f((100 * h[0]) / b[0], 0) : '–'} % / ${b[1] ? f((100 * h[1]) / b[1], 0) : '–'} %`;
    lines.push(`| ${p.replace(':', ' vs ')} | ${pc(r.xScore)} % | ${pc(r.draws)} % | ${pc(r.ko)} / ${pc(r.burst)} / ${pc(r.spin)} % | ${f(r.dur / n)} | ${pc(r.noHit20)} % | ${pc(r.sync10)} % | ${per(r.boosts)} | ${per(r.braces)} | ${rate(r.toHit, r.boosts)} | ${pc(r.boostKo[0])} / ${pc(r.boostKo[1])} % | ${per(r.prevented, 1)} |`);
  }
  lines.push('', 'Side x win share per top played (all opponents):', '');
  lines.push(`| Pair | ${STARTER_TOPS.map((t) => t.name).join(' | ')} |`, `|---|${STARTER_TOPS.map(() => '---').join('|')}|`);
  for (const p of pairs) {
    const r = results[p]!;
    lines.push(`| ${p.replace(':', ' vs ')} | ${STARTER_TOPS.map((t) => { const v = r.byTop[t.id]!; return `${f((100 * v[0]) / v[1])} %`; }).join(' | ')} |`);
  }
  const text = lines.join('\n');
  console.log(text);
  const md = arg('md');
  if (md) writeFileSync(md, text + '\n');
  const js = arg('json');
  if (js) writeFileSync(js, JSON.stringify({ seeds, seed0, pairs, results }, null, 2));
}
