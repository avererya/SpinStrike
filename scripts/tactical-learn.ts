/**
 * Learns MATCHUP_KNOWLEDGE (v0.5): for every class pair and tactic, the
 * win-rate change when a Hard AI uses ONLY that tactic against a passive
 * opponent, relative to the same AI using nothing (same seeds, both slots).
 *
 *   npx tsx scripts/tactical-learn.ts --battles 100 [--seed 800001] [--jobs 4] [--out knowledge.json]
 */
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { TacticalAI } from '../src/ai/tacticalAi';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const ZERO = { interception: 0, knockout: 0, orbitBreak: 0, counter: 0, centerRecovery: 0, evasion: 0, brace: 0 };
export const VARIANTS: Record<string, { pers: object; combo?: boolean }> = {
  none: { pers: ZERO },
  brace: { pers: { ...ZERO, brace: 1 } },
  evade: { pers: { ...ZERO, evasion: 1 } },
  recover: { pers: { ...ZERO, centerRecovery: 1 } },
  intercept: { pers: { ...ZERO, interception: 1 } },
  combo: { pers: { ...ZERO, interception: 1 }, combo: true },
  knockout: { pers: { ...ZERO, knockout: 1 } },
  orbit: { pers: { ...ZERO, orbitBreak: 1 } },
  counter: { pers: { ...ZERO, counter: 1 } },
};

function runVariant(name: string, N: number, seed0: number): Record<string, [number, number]> {
  const v = VARIANTS[name]!;
  const out: Record<string, [number, number]> = {};
  for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) for (let s = 0; s < N; s++) for (const swap of [false, true]) {
    const c = defaultConfig(seed0 + s); c.launch.minigame = false;
    c.player.topId = swap ? b.id : a.id; c.opponent.topId = swap ? a.id : b.id;
    c.tactical = defaultTacticalConfig();
    c.tactical.player.controller = 'passive'; c.tactical.opponent.controller = 'passive';
    const o = buildBattleOptions(c);
    const slot = swap ? 1 : 0;
    const agents: (TacticalAI | null)[] = [null, null];
    agents[slot] = new TacticalAI({ difficulty: 'hard', seed: c.seed, slot, selfClass: a.topClass, opponentClass: b.topClass, personality: v.pers as never, skill: { knowledge: 0 }, forceCombo: v.combo });
    o.agents = agents;
    const r = new Battle(o).runToEnd();
    const k = `${a.topClass}>${b.topClass}`;
    const cell = out[k] ?? (out[k] = [0, 0]);
    cell[1]++;
    if (r.outcome.kind === 'win' && r.outcome.winner === slot) cell[0]++;
    else if (r.outcome.kind !== 'win') cell[0] += 0.5;
  }
  return out;
}

if (process.env.LEARN_CHILD) {
  const { name, N, seed0 } = JSON.parse(process.env.LEARN_CHILD);
  process.send!(runVariant(name, N, seed0));
  process.exit(0);
} else {
  const N = Number(arg('battles') ?? 100);
  const seed0 = Number(arg('seed') ?? 800001);
  const names = Object.keys(VARIANTS);
  const jobs = Number(arg('jobs') ?? 4);
  const results: Record<string, Record<string, [number, number]>> = {};
  let next = 0;
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      while (running < jobs && next < names.length) {
        const name = names[next++]!;
        running++;
        const ch = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, LEARN_CHILD: JSON.stringify({ name, N, seed0 }) }, execArgv: ['--import', 'tsx'] });
        ch.on('message', (m) => { results[name] = m as never; });
        ch.on('exit', () => { running--; if (next >= names.length && running === 0) done(); else launch(); });
      }
    };
    launch();
  });
  const base = results.none!;
  const table: Record<string, Record<string, Record<string, number>>> = {};
  const lines: string[] = [];
  for (const [k, cell] of Object.entries(base)) {
    const [sc, oc] = k.split('>') as [string, string];
    const b0 = (100 * cell[0]) / cell[1];
    const row: string[] = [`${k.padEnd(18)} base ${b0.toFixed(1)}`];
    for (const n of names) {
      if (n === 'none') continue;
      const c = results[n]![k]!;
      const d = (100 * c[0]) / c[1] - b0;
      // Δ win-rate points → multiplier: +10 pts ≈ 2×, −10 pts ≈ 0× (shrunk toward 1 for noise).
      const m = Math.max(0, Math.min(2, 1 + d / 10));
      ((table[sc] ??= {})[oc] ??= {})[n] = Math.round(m * 100) / 100;
      row.push(`${n} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`);
    }
    lines.push(row.join('  '));
  }
  console.log(lines.join('\n'));
  console.log(JSON.stringify(table));
  const out = arg('out');
  if (out) writeFileSync(out, JSON.stringify({ battles: N, seed0, results, table }, null, 2));
}
