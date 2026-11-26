/**
 * Launch-aim evaluation (v0.4.1).
 *
 *   npm run aim -- --battles 100 [--seed 1] [--md out.md] [--part k --of n --raw f.json] [--merge f…]
 *
 * For every starter (as the player, slot 0) and each representative aim
 * (direction −45 / 0 / +45 ° × tilt 0 / 15 / 30 °) against every starter
 * opponent using the seeded AI aim, reports: player win rate, damaging hits,
 * contacts, time to first hit, opening clashes (decided < 3 s by burst/KO),
 * duration, and the player's remaining stamina. Launch qualities come from
 * the AI distribution on both sides, so only the aim differs between rows.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { STARTER_TOPS } from '../src/content/tops';
import { defaultConfig } from '../src/config/sandboxConfig';
import { measure, type BattleMetrics } from './dynamics';
import { percentile } from '../src/sim/headless';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const battles = Number(arg('battles') ?? 100);
const seed0 = Number(arg('seed') ?? 1);
const DIRS = [-45, 0, 45];
const TILTS = [0, 15, 30];
const key = (a: string, d: number, t: number) => `${a}|${d}|${t}`;

const data: Record<string, BattleMetrics[]> = {};
const mergeAt = process.argv.indexOf('--merge');
if (mergeAt >= 0) {
  for (const f of process.argv.slice(mergeAt + 1).filter((x) => x.endsWith('.json'))) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Record<string, BattleMetrics[]>)) (data[k] ??= []).push(...v);
  }
} else {
  const part = Number(arg('part') ?? 0);
  const of = Math.max(1, Number(arg('of') ?? 1));
  let k = 0;
  for (const A of STARTER_TOPS) for (const d of DIRS) for (const t of TILTS) {
    if (k++ % of !== part) continue;
    const ms: BattleMetrics[] = [];
    for (const B of STARTER_TOPS) {
      for (let i = 0; i < battles; i++) {
        const c = defaultConfig((seed0 + i) >>> 0);
        c.player.topId = A.id;
        c.opponent.topId = B.id;
        c.launch.minigame = false;
        c.launch.playerAim = { direction: d, tilt: t };
        ms.push(measure(c));
      }
    }
    data[key(A.id, d, t)] = ms;
  }
  const raw = arg('raw');
  if (raw) {
    writeFileSync(raw, JSON.stringify(data));
    process.exit(0);
  }
}

const f = (x: number, n = 1) => (Number.isFinite(x) ? x.toFixed(n) : '–');
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const lines = [
  `Launch-aim evaluation · ${battles} seeds × 4 opponents per row (seeded AI aim, AI launch distribution both sides)`,
  '',
  '| Player | Direction ° | Tilt ° | Player win % | Draw % | Hits | Contacts | 1st hit med s | Opening clash % | Duration med s | Player stamina % (end) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
for (const A of STARTER_TOPS) for (const d of DIRS) for (const t of TILTS) {
  const ms = data[key(A.id, d, t)];
  if (!ms) continue;
  const n = ms.length;
  lines.push(
    `| ${A.name} | ${d > 0 ? '+' : ''}${d} | ${t} | ${f((100 * ms.filter((m) => m.winner === 0).length) / n)} | ${f((100 * ms.filter((m) => m.winner < 0).length) / n)} | ${f(mean(ms.map((m) => m.hits)))} | ${f(mean(ms.map((m) => m.contacts)))} | ${f(percentile(ms.map((m) => m.firstHit ?? m.duration), 50))} | ${f((100 * ms.filter((m) => m.duration < 3 && m.finish !== 'spin').length) / n)} | ${f(percentile(ms.map((m) => m.duration), 50))} | ${f(100 * mean(ms.map((m) => m.stamina[0])))} |`,
  );
}
const out = lines.join('\n');
console.log(out);
const md = arg('md');
if (md) writeFileSync(md, out + '\n');
