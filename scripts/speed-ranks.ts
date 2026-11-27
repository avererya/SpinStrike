/**
 * Speed upgrade check (v0.5): each starter at Speed rank 0 / 1 / 5 / 10
 * against all four UNUPGRADED starters, both slot orders, AI-distribution
 * launches. Modes: passive combat under the v0.5 and v0.4.1 rulesets, and
 * tactical combat (both sides Normal AI) under v0.5.
 *
 *   npx tsx scripts/speed-ranks.ts [--seeds 100] [--seed 400001] [--jobs 4] [--md out.md]
 */
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { STARTER_TOPS, getTop } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { effectiveStats } from '../src/career/progression';
import { zeroRanks } from '../src/career/config';
import type { Ruleset } from '../src/content/derive';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RANKS = [0, 1, 5, 10];
const MODES = ['passive v0.5', 'passive v0.4.1', 'tactical v0.5 (Normal AI both)'] as const;

function run(mode: number, topId: string, seeds: number, seed0: number): number[] {
  const ruleset: Ruleset = mode === 1 ? 'v0.4.1' : 'v0.5';
  const tactical = mode === 2;
  return RANKS.map((rank) => {
    const e = effectiveStats(getTop(topId), { ...zeroRanks(), speed: rank }, ruleset);
    let w = 0;
    let n = 0;
    for (const o of STARTER_TOPS) for (let s = 0; s < seeds; s++) for (const swap of [false, true]) {
      const c = defaultConfig(seed0 + s);
      c.ruleset = ruleset;
      c.launch.minigame = false;
      const me = { topId, overrides: {}, stats: e.stats, critChance: e.critChance };
      const them = { topId: o.id, overrides: {} };
      c.player = swap ? them : me;
      c.opponent = swap ? me : them;
      if (tactical) {
        c.tactical = defaultTacticalConfig();
        c.tactical.player = { controller: 'ai', difficulty: 'normal' };
        c.tactical.opponent = { controller: 'ai', difficulty: 'normal' };
      }
      const r = new Battle(buildBattleOptions(c)).runToEnd();
      const slot = swap ? 1 : 0;
      n++;
      w += r.outcome.kind === 'win' ? (r.outcome.winner === slot ? 1 : 0) : 0.5;
    }
    return (100 * w) / n;
  });
}

if (process.env.SPEED_CHILD) {
  const { mode, topId, seeds, seed0 } = JSON.parse(process.env.SPEED_CHILD);
  process.send!(run(mode, topId, seeds, seed0));
  process.exit(0);
} else {
  const seeds = Number(arg('seeds') ?? 100);
  const seed0 = Number(arg('seed') ?? 400001);
  const jobs = Number(arg('jobs') ?? 4);
  const tasks = MODES.flatMap((_, mode) => STARTER_TOPS.map((t) => ({ mode, topId: t.id, seeds, seed0 })));
  const res: Record<string, number[]> = {};
  let next = 0;
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      while (running < jobs && next < tasks.length) {
        const task = tasks[next++]!;
        running++;
        const ch = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, SPEED_CHILD: JSON.stringify(task) }, execArgv: ['--import', 'tsx'] });
        ch.on('message', (m) => (res[`${task.mode}:${task.topId}`] = m as number[]));
        ch.on('exit', () => {
          running--;
          if (next >= tasks.length && running === 0) done();
          else launch();
        });
      }
    };
    launch();
  });
  const lines = [`Speed ranks vs unupgraded starters: ${seeds} seeds × 4 opponents × 2 orientations = ${seeds * 8} battles per cell (seed ${seed0}). Win share, draws = ½.`, ''];
  for (const [mode, name] of MODES.entries()) {
    lines.push(`**${name}**`, '', '| Top | rank 0 | rank 1 | rank 5 | rank 10 | 10 − 0 |', '|---|---|---|---|---|---|');
    for (const t of STARTER_TOPS) {
      const v = res[`${mode}:${t.id}`]!;
      lines.push(`| ${t.name} | ${v.map((x) => x.toFixed(1)).join(' | ')} | ${(v[3]! - v[0]! >= 0 ? '+' : '') + (v[3]! - v[0]!).toFixed(1)} |`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  console.log(text);
  const md = arg('md');
  if (md) writeFileSync(md, text + '\n');
}
