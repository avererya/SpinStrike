import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, defaultTacticalConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import type { Difficulty } from '../src/career/config';
const pc = (process.argv[2] ?? 'passive') as 'passive' | Difficulty;
const oc = (process.argv[3] ?? 'normal') as 'passive' | Difficulty;
const N = Number(process.argv[4] ?? 40);
let w0 = 0, w1 = 0, n = 0, boosts = [0, 0], braces = [0, 0], prev = [0, 0], dur = 0, toHit = [0,0], ko=0;
const t0 = Date.now();
for (const a of STARTER_TOPS) for (const b of STARTER_TOPS) for (let s = 1; s <= N; s++) {
  const c = defaultConfig(500000 + s); c.player.topId = a.id; c.opponent.topId = b.id; c.launch.minigame = false;
  c.tactical = defaultTacticalConfig();
  c.tactical.player = pc === 'passive' ? { controller: 'passive', difficulty: 'normal' } : { controller: 'ai', difficulty: pc };
  c.tactical.opponent = oc === 'passive' ? { controller: 'passive', difficulty: 'normal' } : { controller: 'ai', difficulty: oc };
  const r = new Battle(buildBattleOptions(c)).runToEnd();
  n++; dur += r.time;
  if (r.outcome.kind === 'win') { if (r.outcome.winner === 0) w0++; else w1++; if (r.outcome.finish==='knockout') ko++; }
  r.tactical!.tops.forEach((t, i) => { boosts[i]! += t.boostsUsed; braces[i]! += t.bracesUsed; prev[i]! += t.damagePrevented; toHit[i]! += t.boostsToHit; });
}
console.log(`${pc} vs ${oc}: slot0 ${(100*w0/n).toFixed(1)}% slot1 ${(100*w1/n).toFixed(1)}% dur ${(dur/n).toFixed(1)}s KO ${(100*ko/n).toFixed(1)}%`);
console.log(`boosts ${boosts.map(x=>(x/n).toFixed(2))} braces ${braces.map(x=>(x/n).toFixed(2))} prevented ${prev.map(x=>(x/n).toFixed(1))} boost->hit ${toHit.map(x=>(x/n).toFixed(2))}  ${(Date.now()-t0)/1000}s`);
