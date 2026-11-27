/**
 * Fully upgraded balance (v0.5): every starter with ALL attributes at rank 10
 * against every other fully upgraded starter (4 × 4 ordered matchups, both
 * slot orders), passive and tactical (Normal AI on both sides).
 *
 *   npx tsx scripts/full-builds.ts [--seeds 150] [--seed 500001] [--jobs 4] [--bonus percent|reference] [--md out.md]
 *
 * --bonus percent    upgrade bonuses as a percentage of each top's own base
 *                    stat (the v0.4 rule).
 * --bonus reference  the same percentages of the ROSTER-AVERAGE base stat, so
 *                    every top gains the same number of stat points per rank
 *                    (the v0.5 rule; see UPGRADE_BONUS_BASIS).
 */
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { STARTER_TOPS, getTop } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { effectiveStats } from '../src/career/progression';
import { MAX_UPGRADE_RANK, type UpgradeBonusBasis } from '../src/career/config';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const FULL = { health: MAX_UPGRADE_RANK, attack: MAX_UPGRADE_RANK, defense: MAX_UPGRADE_RANK, stamina: MAX_UPGRADE_RANK, speed: MAX_UPGRADE_RANK, critChance: MAX_UPGRADE_RANK };

function run(topId: string, tactical: boolean, basis: UpgradeBonusBasis, seeds: number, seed0: number): Record<string, number> {
  const out: Record<string, number> = {};
  const slot = (id: string) => {
    const e = effectiveStats(getTop(id), FULL, undefined, basis);
    return { topId: id, overrides: {}, stats: e.stats, critChance: e.critChance };
  };
  for (const o of STARTER_TOPS) {
    let w = 0;
    let n = 0;
    for (let s = 0; s < seeds; s++) for (const swap of [false, true]) {
      const c = defaultConfig(seed0 + s);
      c.launch.minigame = false;
      c.player = swap ? slot(o.id) : slot(topId);
      c.opponent = swap ? slot(topId) : slot(o.id);
      if (tactical) {
        c.tactical = defaultTacticalConfig();
        c.tactical.player = { controller: 'ai', difficulty: 'normal' };
        c.tactical.opponent = { controller: 'ai', difficulty: 'normal' };
      }
      const r = new Battle(buildBattleOptions(c)).runToEnd();
      const me = swap ? 1 : 0;
      n++;
      w += r.outcome.kind === 'win' ? (r.outcome.winner === me ? 1 : 0) : 0.5;
    }
    out[o.id] = (100 * w) / n;
  }
  return out;
}

if (process.env.FULL_CHILD) {
  const { topId, tactical, basis, seeds, seed0 } = JSON.parse(process.env.FULL_CHILD);
  process.send!(run(topId, tactical, basis, seeds, seed0));
  process.exit(0);
} else {
  const seeds = Number(arg('seeds') ?? 150);
  const seed0 = Number(arg('seed') ?? 500001);
  const jobs = Number(arg('jobs') ?? 4);
  const basis = (arg('bonus') ?? 'reference') as UpgradeBonusBasis;
  const tasks = [false, true].flatMap((tactical) => STARTER_TOPS.map((t) => ({ topId: t.id, tactical, basis, seeds, seed0 })));
  const res: Record<string, Record<string, number>> = {};
  let next = 0;
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      while (running < jobs && next < tasks.length) {
        const task = tasks[next++]!;
        running++;
        const ch = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, FULL_CHILD: JSON.stringify(task) }, execArgv: ['--import', 'tsx'] });
        ch.on('message', (m) => (res[`${task.tactical}:${task.topId}`] = m as Record<string, number>));
        ch.on('exit', () => {
          running--;
          if (next >= tasks.length && running === 0) done();
          else launch();
        });
      }
    };
    launch();
  });
  const lines = [`Fully upgraded vs fully upgraded, bonus basis "${basis}": ${seeds} seeds × 2 orientations = ${seeds * 2} battles per cell (seed ${seed0}). Row top's win share (draws = ½).`, ''];
  for (const tactical of [false, true]) {
    lines.push(`**${tactical ? 'Tactical (Normal AI on both sides)' : 'Passive'}**`, '', `| Top | ${STARTER_TOPS.map((t) => `vs ${t.name}`).join(' | ')} | overall |`, `|---|${STARTER_TOPS.map(() => '---').join('|')}|---|`);
    for (const t of STARTER_TOPS) {
      const r = res[`${tactical}:${t.id}`]!;
      const vals = STARTER_TOPS.map((o) => r[o.id]!);
      lines.push(`| ${t.name} | ${vals.map((v) => v.toFixed(1)).join(' | ')} | ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)} |`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  console.log(text);
  const md = arg('md');
  if (md) writeFileSync(md, text + '\n');
}
