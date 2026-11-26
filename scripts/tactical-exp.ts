import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { TacticalAI } from '../src/ai/tacticalAi';
import type { Difficulty } from '../src/career/config';
const diff = (process.argv[2] ?? 'hard') as Difficulty;
const N = Number(process.argv[3] ?? 25);
const zero = { interception: 0, knockout: 0, orbitBreak: 0, counter: 0, centerRecovery: 0, evasion: 0, brace: 0 };
const variants: Record<string, object | null> = {
  none: { ...zero }, all: {}, brace: { ...zero, brace: 1 }, evade: { ...zero, evasion: 1 }, recover: { ...zero, centerRecovery: 1 },
  intercept: { ...zero, interception: 1 }, knockout: { ...zero, knockout: 1 }, orbit: { ...zero, orbitBreak: 1 }, counter: { ...zero, counter: 1 },
};
const only = process.argv[4]?.split(',');
for (const [name, pers] of Object.entries(variants)) {
  if (only && !only.includes(name)) continue;
  const byTop: Record<string, [number, number]> = {};
  let used = 0;
  const fin: Record<string, number> = {};
  let stEnd = 0, dmgD = 0, dmgT = 0;
  for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) for (let s = 1; s <= N; s++) for (const swap of [false, true]) {
    const c = defaultConfig(600000 + s); c.launch.minigame = false;
    c.player.topId = swap ? b.id : a.id; c.opponent.topId = swap ? a.id : b.id;
    c.tactical = defaultTacticalConfig();
    if (process.env.COST) { c.tactical.boost.minCost = Number(process.env.COST) / 3; c.tactical.boost.maxCost = Number(process.env.COST); }
    if (process.env.IMP) c.tactical.boost.impulse = Number(process.env.IMP);
    c.tactical.player = { controller: 'passive', difficulty: 'normal' }; c.tactical.opponent = { controller: 'passive', difficulty: 'normal' };
    const o = buildBattleOptions(c);
    const slot = swap ? 1 : 0;
    o.agents = [null, null];
    (o.agents as any)[slot] = new TacticalAI({ difficulty: diff, seed: c.seed, slot, selfClass: a.topClass, opponentClass: b.topClass, personality: pers as any });
    const r = new Battle(o).runToEnd();
    const mk = `${a.id}>${b.id}`;
    const mm = (globalThis as any).__mx ?? ((globalThis as any).__mx = {});
    const cell = mm[name + mk] ?? (mm[name + mk] = [0, 0]);
    cell[1]++; if (r.outcome.kind === 'win' && r.outcome.winner === slot) cell[0]++;
    const t = byTop[a.id] ?? (byTop[a.id] = [0, 0]);
    t[1]++; if (r.outcome.kind === 'win' && r.outcome.winner === slot) t[0]++;
    used += r.tactical!.tops[slot]!.boostsUsed + r.tactical!.tops[slot]!.bracesUsed;
    const k = r.outcome.kind === 'win' ? `${r.outcome.winner === slot ? 'W' : 'L'}-${r.outcome.finish}` : r.outcome.kind;
    fin[k] = (fin[k] ?? 0) + 1;
    stEnd += r.tops[slot]!.stamina - r.tops[1 - slot]!.stamina; dmgD += r.tops[slot]!.damageDealt; dmgT += r.tops[slot]!.damageReceived;
  }
  const tot = Object.values(byTop).reduce((x, y) => [x[0] + y[0], x[1] + y[1]], [0, 0]);
  console.log(name.padEnd(10), (100 * tot[0] / tot[1]).toFixed(1).padStart(5), Object.entries(byTop).map(([k, v]) => `${k} ${(100 * v[0] / v[1]).toFixed(1)}`).join('  '), ' uses/battle', (used / tot[1]).toFixed(2));
  if (process.env.MATRIX) {
    const mm = (globalThis as any).__mx;
    for (const a of STARTER_TOPS) console.log('    ', a.id.padEnd(8), STARTER_TOPS.map((b) => { const c = mm[name + `${a.id}>${b.id}`]; return (100 * c[0] / c[1]).toFixed(0).padStart(4); }).join(''));
  }
  console.log('           ', Object.entries(fin).sort().map(([k, v]) => `${k} ${(100 * v / tot[1]).toFixed(1)}`).join(' '), `Δstamina ${(100 * stEnd / tot[1]).toFixed(1)} dealt ${(dmgD / tot[1]).toFixed(0)} taken ${(dmgT / tot[1]).toFixed(0)}`);
}
