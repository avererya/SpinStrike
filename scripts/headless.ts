/**
 * Headless combat simulator and balance report (no browser, no Three.js).
 *
 *   npm run sim                         16 ordered matchups × 500 seeds (8,000 battles), v0.3 defaults
 *   npm run sim -- --battles 100        seeds per ordered matchup
 *   npm run sim -- --seed 100001        first seed of the seed set
 *   npm run sim -- --a inferno --b titan
 *   npm run sim -- --max 180            maximum battle duration, s
 *   npm run sim -- --legacy             start from the legacy v0.2 configuration (Phase A baseline)
 *   npm run sim -- --launch great       both launches fixed (poor|good|great|perfect), or
 *   npm run sim -- --launch dist        both launches from the AI distribution (identically distributed)
 *   npm run sim -- --launch perfect:dist  player fixed Perfect vs AI distribution (launch-skill analysis)
 *   npm run sim -- --crits off          critical hits off (on|off)
 *   npm run sim -- --set combat.damageScale=25 --set launch.playerQuality=good --set top.inferno.attack=95
 *   npm run sim -- --md report.md       also write a Markdown report
 *   npm run sim -- --json               machine-readable output
 *   npm run sim -- --solo               each top alone: spin-down reference
 *
 * Win rates are reported as a share of ALL battles in the matchup
 * (draws and timeouts count as neither win nor loss and are listed separately).
 */
import { writeFileSync } from 'node:fs';
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, legacyV02Config, type SandboxConfig } from '../src/config/sandboxConfig';
import { percentile, runBatch, type BatchStats } from '../src/sim/headless';
import { World } from '../src/sim/world';
import { isLaunchQuality } from '../src/sim/launch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((v, i) => {
    if (v === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const battles = Number(arg('battles') ?? 500);
const seedStart = Number(arg('seed') ?? 1);
const maxDuration = Number(arg('max') ?? 180);
const onlyA = arg('a');
const onlyB = arg('b');
const json = has('json');
const mdPath = arg('md');
const sets = args('set');
const legacy = has('legacy');
const launchArg = arg('launch');
const critsArg = arg('crits');

/** Applies --set group.key=value overrides (numbers, true/false, or strings). */
function applySets(cfg: SandboxConfig): void {
  for (const s of sets) {
    const m = /^([a-zA-Z]+)\.([a-zA-Z]+)(?:\.([a-zA-Z]+))?=(.+)$/.exec(s);
    if (!m) throw new Error(`Bad --set ${s}`);
    const [, g, k, k2, raw] = m;
    const num = Number(raw);
    const val = raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(num) ? num : raw!;
    const root = cfg as unknown as Record<string, Record<string, unknown>>;
    if (g === 'top' && k2) {
      // top.<topId>.<key>=v  → applies to that top in whichever slot it occupies
      for (const slot of [cfg.player, cfg.opponent]) if (slot.topId === k) (slot.overrides as Record<string, unknown>)[k2] = val;
    } else if (k2) {
      const grp = root[g!]?.[k!] as Record<string, unknown> | undefined;
      if (!grp || !(k2 in grp)) throw new Error(`Unknown setting ${g}.${k}.${k2}`);
      grp[k2] = val;
    } else if (g === 'cfg') {
      if (!(k! in root)) throw new Error(`Unknown setting ${k}`);
      (root as Record<string, unknown>)[k!] = val;
    } else {
      if (!root[g!] || !(k! in root[g!]!)) throw new Error(`Unknown setting ${g}.${k}`);
      root[g!]![k!] = val;
    }
  }
}

function applyLaunch(cfg: SandboxConfig): void {
  if (!launchArg) return;
  const [p, o] = launchArg.includes(':') ? launchArg.split(':') : [launchArg, launchArg];
  const q = (v: string | undefined) => {
    if (v === 'dist' || v === 'auto') return 'auto' as const;
    if (isLaunchQuality(v)) return v;
    throw new Error(`Bad --launch ${launchArg}`);
  };
  cfg.launch.minigame = false;
  cfg.launch.playerQuality = q(p);
  cfg.launch.opponentQuality = q(o);
}

function makeCfg(seed: number, a: string, b: string): SandboxConfig {
  const cfg = legacy ? legacyV02Config(seed) : defaultConfig(seed);
  cfg.player.topId = a;
  cfg.opponent.topId = b;
  cfg.maxDuration = maxDuration;
  cfg.launch.minigame = false;
  applyLaunch(cfg);
  if (critsArg) cfg.combat.criticalHits = critsArg === 'on';
  applySets(cfg);
  return cfg;
}

if (has('solo')) {
  console.log('Solo spin-down (single top, no opponent):');
  for (const t of STARTER_TOPS) {
    const opts = buildBattleOptions(makeCfg(seedStart, t.id, t.id));
    const w = new World({ ...opts, tops: [opts.tops[0]!], topCombat: [opts.topCombat![0]!] });
    const b = w.bodies[0]!;
    while (b.spinning && w.time < maxDuration) w.step();
    console.log(`  ${t.name.padEnd(8)} ${w.time.toFixed(1).padStart(6)} s  wallHits=${b.wallHits}  stability=${b.params.stability.toFixed(3)} critSpin=${b.criticalSpin.toFixed(1)}`);
  }
  process.exit(0);
}

interface Row {
  a: string;
  b: string;
  s: BatchStats;
}
const rows: Row[] = [];
const t0 = Date.now();
for (const a of STARTER_TOPS) {
  if (onlyA && a.id !== onlyA) continue;
  for (const b of STARTER_TOPS) {
    if (onlyB && b.id !== onlyB) continue;
    const s = runBatch((seed) => buildBattleOptions(makeCfg(seed, a.id, b.id)), battles, seedStart);
    rows.push({ a: a.id, b: b.id, s });
    if (s.failureDetails.length) console.error(`${a.name} vs ${b.name} failures:\n  ${s.failureDetails.slice(0, 10).join('\n  ')}`);
  }
}
const wall = (Date.now() - t0) / 1000;

const name = (id: string) => STARTER_TOPS.find((t) => t.id === id)!.name;
const pct = (x: number, n: number) => (n > 0 ? (100 * x) / n : 0);
const f1 = (x: number) => x.toFixed(1);

function summarize(r: Row) {
  const s = r.s;
  const n = s.results.length;
  const durations = s.results.map((x) => x.time);
  let winnerHealth = 0;
  let winnerStamina = 0;
  let winnerHealthMax = 0;
  let dmgA = 0;
  let dmgB = 0;
  let crits = 0;
  let rolls = 0;
  let nearDraws = 0;
  let narrow = 0;
  let u2 = 0;
  let u5 = 0;
  let u10 = 0;
  for (const rec of s.records) {
    const res = rec.result;
    dmgA += res.tops[0]!.damageDealt;
    dmgB += res.tops[1]!.damageDealt;
    crits += res.tops[0]!.critsLanded + res.tops[1]!.critsLanded;
    rolls += rec.damagingHits[0] + rec.damagingHits[1];
    if (res.time < 2) u2++;
    if (res.time < 5) u5++;
    if (res.time < 10) u10++;
    if (res.outcome.kind === 'draw' && res.outcome.reason === 'near-simultaneous') nearDraws++;
    if (res.outcome.kind === 'win') {
      if (res.outcome.narrow) narrow++;
      const w = res.tops[res.outcome.winner]!;
      winnerHealth += w.health;
      winnerHealthMax += w.maxHealth;
      winnerStamina += w.stamina;
    }
  }
  const wins = s.wins[0] + s.wins[1];
  const fin = s.finishes;
  return {
    a: r.a,
    b: r.b,
    matchup: `${name(r.a)} vs ${name(r.b)}`,
    n,
    winA: pct(s.wins[0], n),
    winB: pct(s.wins[1], n),
    winsA: s.wins[0],
    winsB: s.wins[1],
    draws: s.draws,
    nearDraws,
    timeouts: s.timeouts,
    draw: pct(s.draws, n),
    timeout: pct(s.timeouts, n),
    avg: s.avgDuration,
    median: percentile(durations, 50),
    p10: percentile(durations, 10),
    p25: percentile(durations, 25),
    p75: percentile(durations, 75),
    p90: percentile(durations, 90),
    min: s.minDuration,
    max: s.maxDuration,
    under2: pct(u2, n),
    under5: pct(u5, n),
    under10: pct(u10, n),
    burstN: fin.burst[0] + fin.burst[1],
    koN: fin.knockout[0] + fin.knockout[1],
    spinN: fin.spin[0] + fin.spin[1],
    burst: pct(fin.burst[0] + fin.burst[1], n),
    ko: pct(fin.knockout[0] + fin.knockout[1], n),
    spin: pct(fin.spin[0] + fin.spin[1], n),
    finA: `${fin.burst[0]}/${fin.knockout[0]}/${fin.spin[0]}`,
    finB: `${fin.burst[1]}/${fin.knockout[1]}/${fin.spin[1]}`,
    narrow: pct(narrow, n),
    winnerHealthPct: wins ? pct(winnerHealth, winnerHealthMax) : 0,
    winnerHealth: wins ? winnerHealth / wins : 0,
    winnerStaminaPct: wins ? (100 * winnerStamina) / wins : 0,
    dmgA: dmgA / Math.max(1, n),
    dmgB: dmgB / Math.max(1, n),
    critsPerBattle: crits / Math.max(1, n),
    critRate: pct(crits, rolls),
    collisions: s.avgCollisions,
    maxHit: s.maxHit,
    failures: s.failures,
    durations,
  };
}

const sums = rows.map(summarize);
const ids = STARTER_TOPS.map((t) => t.id).filter((id) => !onlyA || id === onlyA || id === onlyB);

function matrixLines(): string[] {
  const lines: string[] = [];
  lines.push(`| Row beats column (row = player slot) | ${ids.map(name).join(' | ')} |`);
  lines.push(`| --- | ${ids.map(() => '---').join(' | ')} |`);
  for (const a of ids) {
    const cells = ids.map((b) => {
      const r = rows.find((x) => x.a === a && x.b === b);
      return r ? `${f1(pct(r.s.wins[0], r.s.results.length))}%` : '–';
    });
    lines.push(`| **${name(a)}** | ${cells.join(' | ')} |`);
  }
  return lines;
}

function symMatrixLines(): string[] {
  const lines: string[] = [];
  lines.push(`| Row beats column (both slot orders) | ${ids.map(name).join(' | ')} |`);
  lines.push(`| --- | ${ids.map(() => '---').join(' | ')} |`);
  for (const a of ids) {
    const cells = ids.map((b) => {
      const r1 = rows.find((x) => x.a === a && x.b === b);
      const r2 = rows.find((x) => x.a === b && x.b === a);
      if (!r1 || !r2) return '–';
      const w = r1.s.wins[0] + r2.s.wins[1];
      const n = r1.s.results.length + r2.s.results.length;
      return `${f1(pct(w, n))}%`;
    });
    lines.push(`| **${name(a)}** | ${cells.join(' | ')} |`);
  }
  return lines;
}

function aggregateLines(): string[] {
  const lines: string[] = [];
  lines.push('| Top | Battles | Win % (all) | Win % (non-mirror) | Loss % | Draw/timeout % | Wins by burst / KO / spin | Losses by burst / KO / spin | Avg damage dealt | Crits landed / battle | Avg duration (s) |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const id of ids) {
    let n = 0, w = 0, l = 0, dt = 0, nm = 0, wm = 0, dmg = 0, dur = 0, cr = 0;
    const wf = { burst: 0, knockout: 0, spin: 0 };
    const lf = { burst: 0, knockout: 0, spin: 0 };
    for (const r of rows) {
      for (const slot of [0, 1] as const) {
        const me = slot === 0 ? r.a : r.b;
        if (me !== id) continue;
        if (r.a === r.b && slot === 1) continue; // count a mirror once
        for (const res of r.s.results) {
          n++;
          dur += res.time;
          dmg += res.tops[slot]!.damageDealt;
          cr += res.tops[slot]!.critsLanded;
          const mirror = r.a === r.b;
          if (!mirror) nm++;
          const o = res.outcome;
          if (o.kind === 'win') {
            if (o.winner === slot) {
              w++;
              wf[o.finish]++;
              if (!mirror) wm++;
            } else {
              l++;
              lf[o.finish]++;
            }
          } else dt++;
        }
      }
    }
    lines.push(
      `| ${name(id)} | ${n} | ${f1(pct(w, n))} | ${f1(pct(wm, nm))} | ${f1(pct(l, n))} | ${f1(pct(dt, n))} | ${wf.burst} / ${wf.knockout} / ${wf.spin} | ${lf.burst} / ${lf.knockout} / ${lf.spin} | ${f1(dmg / Math.max(1, n))} | ${(cr / Math.max(1, n)).toFixed(2)} | ${f1(dur / Math.max(1, n))} |`,
    );
  }
  return lines;
}

function detailLines(): string[] {
  const lines: string[] = [];
  lines.push('| Matchup | Win P1 % | Win P2 % | Draw % (near-sim.) | Timeout % | Avg s | Median s | P10–P90 s | <2 / <5 / <10 s % | Burst % | KO % | Spin % | Narrow % | Winner health left | Winner stamina left | Avg dmg P1 / P2 | Crits / battle | Crit % of damaging hits | Avg collisions | Max hit | Failures |');
  lines.push(`| ${Array(21).fill('---').join(' | ')} |`);
  for (const x of sums) {
    lines.push(
      `| ${x.matchup} | ${f1(x.winA)} | ${f1(x.winB)} | ${f1(x.draw)} (${x.nearDraws}) | ${f1(x.timeout)} | ${f1(x.avg)} | ${f1(x.median)} | ${f1(x.p10)}–${f1(x.p90)} | ${f1(x.under2)} / ${f1(x.under5)} / ${f1(x.under10)} | ${f1(x.burst)} | ${f1(x.ko)} | ${f1(x.spin)} | ${f1(x.narrow)} | ${f1(x.winnerHealth)} HP (${f1(x.winnerHealthPct)}%) | ${f1(x.winnerStaminaPct)}% | ${f1(x.dmgA)} / ${f1(x.dmgB)} | ${x.critsPerBattle.toFixed(2)} | ${f1(x.critRate)} | ${f1(x.collisions)} | ${f1(x.maxHit)} | ${x.failures} |`,
    );
  }
  return lines;
}

/** Mirror slot fairness: P1 share of decisive results, with a two-sided binomial z score. */
function mirrorLines(): string[] {
  const lines = ['| Mirror | Battles | P1 win % | P2 win % | Draw % | Timeout % | P1 share of decisive | z (P1 vs 50 %) |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const x of sums.filter((s) => s.a === s.b)) {
    const dec = x.winsA + x.winsB;
    const share = dec ? x.winsA / dec : 0.5;
    const z = dec ? (x.winsA - dec / 2) / Math.sqrt(dec / 4) : 0;
    lines.push(`| ${x.matchup} | ${x.n} | ${f1(x.winA)} | ${f1(x.winB)} | ${f1(x.draw)} | ${f1(x.timeout)} | ${f1(100 * share)} % | ${z.toFixed(2)} |`);
  }
  return lines;
}

function overallLines(): string[] {
  const total = sums.reduce((a, x) => a + x.n, 0);
  const sum = (f: (x: (typeof sums)[number]) => number) => sums.reduce((a, x) => a + f(x), 0);
  const all = sums.flatMap((x) => x.durations);
  const nonMirror = sums.filter((x) => x.a !== x.b);
  const allNm = nonMirror.flatMap((x) => x.durations);
  return [
    '| Metric | All battles | Non-mirror |',
    '| --- | --- | --- |',
    `| Battles | ${total} | ${allNm.length} |`,
    `| Burst finishes | ${f1(pct(sum((x) => x.burstN), total))} % | ${f1(pct(nonMirror.reduce((a, x) => a + x.burstN, 0), allNm.length))} % |`,
    `| Knockout finishes | ${f1(pct(sum((x) => x.koN), total))} % | ${f1(pct(nonMirror.reduce((a, x) => a + x.koN, 0), allNm.length))} % |`,
    `| Spin finishes | ${f1(pct(sum((x) => x.spinN), total))} % | ${f1(pct(nonMirror.reduce((a, x) => a + x.spinN, 0), allNm.length))} % |`,
    `| Draws (near-simultaneous) | ${f1(pct(sum((x) => x.draws), total))} % (${sum((x) => x.nearDraws)}) | ${f1(pct(nonMirror.reduce((a, x) => a + x.draws, 0), allNm.length))} % |`,
    `| Timeouts | ${f1(pct(sum((x) => x.timeouts), total))} % | ${f1(pct(nonMirror.reduce((a, x) => a + x.timeouts, 0), allNm.length))} % |`,
    `| Mean / median duration | ${f1(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length))} / ${f1(percentile(all, 50))} s | ${f1(allNm.reduce((a, b) => a + b, 0) / Math.max(1, allNm.length))} / ${f1(percentile(allNm, 50))} s |`,
    `| P10 / P25 / P75 / P90 | ${[10, 25, 75, 90].map((p) => f1(percentile(all, p))).join(' / ')} s | ${[10, 25, 75, 90].map((p) => f1(percentile(allNm, p))).join(' / ')} s |`,
    `| Ended < 2 s / < 5 s / < 10 s | ${f1(pct(all.filter((d) => d < 2).length, total))} / ${f1(pct(all.filter((d) => d < 5).length, total))} / ${f1(pct(all.filter((d) => d < 10).length, total))} % | ${f1(pct(allNm.filter((d) => d < 2).length, allNm.length))} / ${f1(pct(allNm.filter((d) => d < 5).length, allNm.length))} / ${f1(pct(allNm.filter((d) => d < 10).length, allNm.length))} % |`,
    `| Avg damage dealt per top | ${f1(sum((x) => (x.dmgA + x.dmgB) * x.n) / 2 / Math.max(1, total))} | |`,
    `| Avg collisions | ${f1(sum((x) => x.collisions * x.n) / Math.max(1, total))} | |`,
    `| Crits per battle / % of damaging hits | ${(sum((x) => x.critsPerBattle * x.n) / Math.max(1, total)).toFixed(2)} / ${f1(sum((x) => x.critRate * x.n) / Math.max(1, total))} % | |`,
    `| Failures (guard trips / non-finite / exceptions) | ${sum((x) => x.failures)} | |`,
  ];
}

const total = rows.reduce((a, r) => a + r.s.results.length, 0);
const failures = rows.reduce((a, r) => a + r.s.failures, 0);
const sample = makeCfg(seedStart, 'inferno', 'titan');
const header = [
  `Seeds ${seedStart}–${seedStart + battles - 1} per ordered matchup, ${total} battles, max duration ${maxDuration} s, ${failures} failures (guard trips / non-finite values / exceptions).`,
  `Ruleset ${sample.ruleset}${legacy ? ' (legacy v0.2 configuration)' : ''} · critical hits ${sample.combat.criticalHits ? 'on' : 'off'} · launch player=${sample.launch.playerQuality} opponent=${sample.launch.opponentQuality} ('auto' = seeded AI distribution) · draw window ${sample.results.drawWindow} s.`,
  sets.length ? `Overrides: ${sets.join(', ')}` : 'Overrides: none',
  `Win rates are the share of ALL battles in a matchup; draws and timeouts are neither wins nor losses and are listed separately.`,
];

if (json) {
  console.log(JSON.stringify({ seedStart, battles, maxDuration, sets, legacy, launch: launchArg, crits: critsArg, matchups: sums.map(({ durations, ...x }) => x) }, null, 2));
} else {
  const out = [
    ...header,
    '',
    '### Matchup matrix (row = player slot)',
    ...matrixLines(),
    '',
    '### Matchup matrix (slot-averaged)',
    ...symMatrixLines(),
    '',
    '### Overall',
    ...overallLines(),
    '',
    '### Per-top aggregate',
    ...aggregateLines(),
    '',
    '### Mirror-match slot fairness',
    ...mirrorLines(),
    '',
    '### Per-matchup detail (P1 = player slot = first name)',
    ...detailLines(),
  ].join('\n');
  console.log(out);
  console.log(`\nRan ${total} battles in ${wall.toFixed(1)} s (wall clock).`);
  if (mdPath) writeFileSync(mdPath, out + '\n');
}
