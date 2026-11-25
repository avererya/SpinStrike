/**
 * Headless battle runner for physics analysis.
 *
 *   npm run sim                       all 16 matchups, 20 seeds each
 *   npm run sim -- --battles 50       more seeds per matchup
 *   npm run sim -- --a inferno --b titan
 *   npm run sim -- --solo             each top alone-ish (spin-down reference)
 *   npm run sim -- --json             machine-readable output
 *
 * Statistics are for physics analysis, not gameplay balancing.
 */
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig } from '../src/config/sandboxConfig';
import { runBatch } from '../src/sim/headless';
import { World } from '../src/sim/world';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const battles = Number(arg('battles') ?? 20);
const seedStart = Number(arg('seed') ?? 1);
const maxDuration = Number(arg('max') ?? 180);
const onlyA = arg('a');
const onlyB = arg('b');
const json = has('json');

if (has('solo')) {
  // Spin-down reference: one top alone in the bowl, time until it stops.
  console.log('Solo spin-down (single top, no opponent):');
  for (const t of STARTER_TOPS) {
    const cfg = defaultConfig(seedStart);
    cfg.player.topId = t.id;
    const opts = buildBattleOptions(cfg);
    const w = new World({ ...opts, tops: [opts.tops[0]!] });
    const b = w.bodies[0]!;
    let maxR = 0;
    let sumR = 0;
    while (b.spinning && w.time < maxDuration) {
      w.step();
      const r = Math.hypot(b.x, b.y);
      maxR = Math.max(maxR, r);
      sumR += r;
    }
    console.log(
      `  ${t.name.padEnd(8)} ${w.time.toFixed(1).padStart(6)} s  ω0=${Math.sqrt((2 * b.launchEnergy) / b.inertia).toFixed(0)} rad/s` +
        `  ωcrit=${b.criticalSpin.toFixed(0)}  maxSpeed=${b.maxSpeed.toFixed(2)} m/s  avgR=${((sumR / w.steps) * 100).toFixed(1)} cm  maxR=${(maxR * 100).toFixed(1)} cm  wallHits=${b.wallHits}`,
    );
  }
  process.exit(0);
}

const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const a of STARTER_TOPS) {
  if (onlyA && a.id !== onlyA) continue;
  for (const b of STARTER_TOPS) {
    if (onlyB && b.id !== onlyB) continue;
    const s = runBatch(
      (seed) => {
        const cfg = defaultConfig(seed);
        cfg.player.topId = a.id;
        cfg.opponent.topId = b.id;
        cfg.maxDuration = maxDuration;
        return buildBattleOptions(cfg);
      },
      battles,
      seedStart,
    );
    rows.push({
      matchup: `${a.name} vs ${b.name}`,
      battles: s.battles,
      avgDur: +s.avgDuration.toFixed(1),
      minDur: +s.minDuration.toFixed(1),
      maxDur: +s.maxDuration.toFixed(1),
      winsA: s.wins[0],
      winsB: s.wins[1],
      draws: s.draws,
      timeouts: s.timeouts,
      avgHits: +s.avgCollisions.toFixed(1),
      maxSpeed: +s.maxTranslationalSpeed.toFixed(2),
      failures: s.failures,
    });
    if (s.failureDetails.length) console.error(`${a.name} vs ${b.name} failures:\n  ${s.failureDetails.join('\n  ')}`);
  }
}
if (json) console.log(JSON.stringify(rows, null, 2));
else {
  console.table(rows);
  console.log(`Ran ${rows.length * battles} battles in ${((Date.now() - t0) / 1000).toFixed(1)} s (wall clock).`);
}
