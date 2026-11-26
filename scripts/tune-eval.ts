/**
 * Balance-tuning helper (development tool, used for the v0.3 Phase C sweeps).
 * Applies a candidate (stat table, part and mapping values, combat params)
 * IN MEMORY and prints matchup statistics as JSON. Never writes files.
 *
 *   npx tsx scripts/tune-eval.ts '<candidate json>' [seeds] [seedStart] [launch: dist|<quality>] [crits: on|off]
 */
import { STARTER_TOPS } from '../src/content/tops';
import { TIPS, RINGS, DISCS } from '../src/content/parts';
import { PARAMS_V03 } from '../src/content/derive';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { isLaunchQuality } from '../src/sim/launch';

interface Candidate {
  stats?: Record<string, Record<string, number>>;
  tips?: Record<string, Record<string, number>>;
  rings?: Record<string, Record<string, number>>;
  discs?: Record<string, Record<string, number>>;
  combat?: Record<string, number>;
  collision?: Record<string, number>;
  params03?: Record<string, [number, number]>;
  drawWindow?: number;
}
const cand = JSON.parse(process.argv[2] ?? '{}') as Candidate;
const seeds = Number(process.argv[3] ?? 40);
const seedStart = Number(process.argv[4] ?? 1);
const launch = process.argv[5] ?? 'dist';
const crits = (process.argv[6] ?? 'on') === 'on';

for (const [id, st] of Object.entries(cand.stats ?? {})) Object.assign(STARTER_TOPS.find((t) => t.id === id)!.stats, st);
for (const [id, v] of Object.entries(cand.tips ?? {})) Object.assign(TIPS[id]!, v);
for (const [id, v] of Object.entries(cand.rings ?? {})) Object.assign(RINGS[id]!, v);
for (const [id, v] of Object.entries(cand.discs ?? {})) Object.assign(DISCS[id]!, v);
for (const [k, v] of Object.entries(cand.params03 ?? {})) (PARAMS_V03 as Record<string, unknown>)[k] = v;

const out: Record<string, unknown> = {};
for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) {
  let w0 = 0, w1 = 0, dr = 0, to = 0, burst = 0, ko = 0, spin = 0, dur = 0, early = 0;
  for (let i = 0; i < seeds; i++) {
    const c = defaultConfig(seedStart + i);
    c.player.topId = a.id;
    c.opponent.topId = b.id;
    c.launch.minigame = false;
    const q = launch === 'dist' ? 'auto' : launch;
    if (q !== 'auto' && !isLaunchQuality(q)) throw new Error('bad launch');
    c.launch.playerQuality = q as never;
    c.launch.opponentQuality = q as never;
    c.combat.criticalHits = crits;
    Object.assign(c.combat, cand.combat ?? {});
    Object.assign(c.collision, cand.collision ?? {});
    if (cand.drawWindow !== undefined) c.results.drawWindow = cand.drawWindow;
    const r = new Battle(buildBattleOptions(c)).runToEnd();
    dur += r.time;
    if (r.time < 5) early++;
    const o = r.outcome;
    if (o.kind === 'win') {
      if (o.winner === 0) w0++;
      else w1++;
      if (o.finish === 'burst') burst++;
      else if (o.finish === 'knockout') ko++;
      else spin++;
    } else if (o.kind === 'draw') dr++;
    else to++;
  }
  out[`${a.id}-${b.id}`] = { w0, w1, dr, to, burst, ko, spin, dur: dur / seeds, early, n: seeds };
}
console.log(JSON.stringify(out));
