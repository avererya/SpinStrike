/**
 * Combat dynamics / entertainment report (v0.4.1).
 *
 *   npm run dynamics                               16 ordered matchups × 500 seeds, current ruleset
 *   npm run dynamics -- --baseline                 the preserved v0.4.0 baseline path
 *   npm run dynamics -- --battles 2000 --seed 1    seeds per ordered matchup / first seed
 *   npm run dynamics -- --launch dist              launches: dist (AI distribution both sides, default) | good | perfect:dist …
 *   npm run dynamics -- --json out.json            write per-matchup metrics as JSON
 *   npm run dynamics -- --md out.md                write a Markdown report
 *   npm run dynamics -- --a inferno --b inferno    single matchup
 *   npm run dynamics -- --part 0 --of 4 --raw p0.json   run every 4th matchup, dump per-battle metrics
 *   npm run dynamics -- --merge p0.json p1.json … --md out.md   report from dumped parts
 *
 * Reports, overall and per ordered matchup: win rates, finish mix,
 * durations, time to first contact / first damaging hit, contacts, damaging
 * hits, hits per minute, mean and longest gap between damaging hits, share
 * of battles without a damaging hit in the first 5 / 10 / 20 s, share with
 * fewer than five damaging hits, opening-clash finishes, winner health /
 * stamina, and synchronized-movement time.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { STARTER_TOPS } from '../src/content/tops';
import { buildBattleOptions, defaultConfig, legacyV040Config, type SandboxConfig } from '../src/config/sandboxConfig';
import { Battle } from '../src/sim/battle';
import { isLaunchQuality } from '../src/sim/launch';
import { percentile } from '../src/sim/headless';
import { ClassicBowl } from '../src/sim/stadium/classicBowl';
import { DEFAULT_LAUNCH_VARIATION } from '../src/sim/launchGeometry';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);
const battles = Number(arg('battles') ?? 500);
const seedStart = Number(arg('seed') ?? 1);
const baseline = has('baseline');
const launchArg = arg('launch') ?? 'dist';
const onlyA = arg('a');
const onlyB = arg('b');
const jsonPath = arg('json');
const mdPath = arg('md');

function applyLaunch(cfg: SandboxConfig): void {
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

export interface BattleMetrics {
  seed: number;
  winner: number; // -1 draw/timeout
  finish: string; // burst | knockout | spin | draw | timeout
  duration: number;
  firstContact: number | null;
  firstHit: number | null;
  contacts: number;
  hits: number;
  repeated: number;
  longestGap: number;
  meanGap: number | null;
  syncTime: number;
  longestSync: number;
  winnerHealth: number | null;
  winnerStamina: number | null;
  dmg: [number, number];
  /** Usable stamina of each top at the decisive moment (0–1). */
  stamina: [number, number];
}

const EXP = process.env.EXP ? JSON.parse(process.env.EXP) : null;
export function measure(cfg: SandboxConfig): BattleMetrics {
  const opts = buildBattleOptions(cfg);
  if (EXP) {
    if (EXP.variation) opts.launch = { ...opts.launch, variation: { ...DEFAULT_LAUNCH_VARIATION, ...EXP.variation } };
    if (EXP.relief) opts.stadium = new ClassicBowl({ ...(opts.stadium as ClassicBowl).params, relief: { amplitude: EXP.relief[0], frictionVariation: EXP.relief[1], seed: cfg.seed ^ 0x5a5a } });
    if (EXP.aims) opts.aims = EXP.aims;
    if (EXP.wander) opts.tops = opts.tops.map((t) => ({ ...t, contactWander: EXP.wander[0], wanderSpinGain: EXP.wander[1] }));
  }
  const b = new Battle(opts);
  const r = b.runToEnd();
  const t = b.world.telemetry.summary(r.steps);
  const o = r.outcome;
  let meanGap: number | null = null;
  if (t.hitTimes.length >= 2) meanGap = (t.hitTimes[t.hitTimes.length - 1]! - t.hitTimes[0]!) / (t.hitTimes.length - 1);
  return {
    seed: cfg.seed,
    winner: o.kind === 'win' ? o.winner : -1,
    finish: o.kind === 'win' ? o.finish : o.kind,
    duration: r.time,
    firstContact: t.firstContact,
    firstHit: t.firstHit,
    contacts: t.contacts,
    hits: t.damagingHits,
    repeated: t.repeatedImpacts,
    longestGap: t.longestGap,
    meanGap,
    syncTime: t.syncTime,
    longestSync: t.longestSync,
    winnerHealth: o.kind === 'win' ? r.tops[o.winner]!.health / r.tops[o.winner]!.maxHealth : null,
    winnerStamina: o.kind === 'win' ? r.tops[o.winner]!.stamina : null,
    dmg: [r.tops[0]!.damageDealt, r.tops[1]!.damageDealt],
    stamina: [r.tops[0]!.stamina, r.tops[1]!.stamina],
  };
}

export function aggregate(ms: readonly BattleMetrics[]) {
  const n = Math.max(1, ms.length);
  const pct = (k: number) => (100 * k) / n;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const fh = ms.map((m) => m.firstHit ?? m.duration);
  const fc = ms.map((m) => m.firstContact ?? m.duration);
  const noHitBy = (s: number) => pct(ms.filter((m) => m.firstHit === null || m.firstHit > s).filter((m) => m.duration > s || m.firstHit === null).length);
  const gaps = ms.map((m) => m.meanGap).filter((g): g is number => g !== null);
  const hpm = ms.map((m) => (m.duration > 0 ? (60 * m.hits) / m.duration : 0));
  const wins = ms.filter((m) => m.winner >= 0);
  return {
    n: ms.length,
    winSlot0: pct(ms.filter((m) => m.winner === 0).length),
    winSlot1: pct(ms.filter((m) => m.winner === 1).length),
    draw: pct(ms.filter((m) => m.finish === 'draw').length),
    timeout: pct(ms.filter((m) => m.finish === 'timeout').length),
    burst: pct(ms.filter((m) => m.finish === 'burst').length),
    knockout: pct(ms.filter((m) => m.finish === 'knockout').length),
    spin: pct(ms.filter((m) => m.finish === 'spin').length),
    durMean: mean(ms.map((m) => m.duration)),
    durMedian: percentile(ms.map((m) => m.duration), 50),
    durP10: percentile(ms.map((m) => m.duration), 10),
    durP90: percentile(ms.map((m) => m.duration), 90),
    under5: pct(ms.filter((m) => m.duration < 5).length),
    under15: pct(ms.filter((m) => m.duration < 15).length),
    openingClash: pct(ms.filter((m) => m.duration < 3 && m.finish !== 'spin').length),
    firstContactMedian: percentile(fc, 50),
    firstHitMedian: percentile(fh, 50),
    firstHitP90: percentile(fh, 90),
    contacts: mean(ms.map((m) => m.contacts)),
    hits: mean(ms.map((m) => m.hits)),
    hitsMedian: percentile(ms.map((m) => m.hits), 50),
    repeated: mean(ms.map((m) => m.repeated)),
    hitsPerMin: mean(hpm),
    meanGap: mean(gaps),
    longestGapMean: mean(ms.map((m) => m.longestGap)),
    longestGapP90: percentile(ms.map((m) => m.longestGap), 90),
    noHit5: noHitBy(5),
    noHit10: noHitBy(10),
    noHit20: noHitBy(20),
    fewerThan5Hits: pct(ms.filter((m) => m.hits < 5).length),
    syncShare: (100 * ms.reduce((a, m) => a + m.syncTime, 0)) / Math.max(1e-9, ms.reduce((a, m) => a + m.duration, 0)),
    longestSyncMean: mean(ms.map((m) => m.longestSync)),
    sync10: pct(ms.filter((m) => m.longestSync >= 10).length),
    winnerHealth: 100 * mean(wins.map((m) => m.winnerHealth!)),
    winnerStamina: 100 * mean(wins.map((m) => m.winnerStamina!)),
    dmg0: mean(ms.map((m) => m.dmg[0])),
    dmg1: mean(ms.map((m) => m.dmg[1])),
  };
}
export type Agg = ReturnType<typeof aggregate>;

function makeCfg(seed: number, a: string, b: string): SandboxConfig {
  const cfg = baseline ? legacyV040Config(seed) : defaultConfig(seed);
  cfg.player.topId = a;
  cfg.opponent.topId = b;
  applyLaunch(cfg);
  return cfg;
}

const isMain = process.argv[1]?.endsWith('dynamics.ts');
if (isMain) {
  const t0 = Date.now();
  const part = Number(arg('part') ?? 0);
  const of = Math.max(1, Number(arg('of') ?? 1));
  const mergeAt = process.argv.indexOf('--merge');
  const data: Record<string, BattleMetrics[]> = {};
  let label = `Ruleset: ${baseline ? 'v0.4.0 baseline' : 'current'} · seeds ${seedStart}…${seedStart + battles - 1} per ordered matchup · launches ${launchArg}`;
  if (mergeAt >= 0) {
    const files = process.argv.slice(mergeAt + 1).filter((x) => x.endsWith('.json'));
    for (const file of files) {
      const j = JSON.parse(readFileSync(file, 'utf8')) as { label: string; data: Record<string, BattleMetrics[]> };
      label = j.label;
      for (const [k, v] of Object.entries(j.data)) (data[k] ??= []).push(...v);
    }
  } else {
    let k = 0;
    for (const A of STARTER_TOPS) {
      for (const B of STARTER_TOPS) {
        if (onlyA && A.id !== onlyA) continue;
        if (onlyB && B.id !== onlyB) continue;
        if (k++ % of !== part) continue;
        const ms: BattleMetrics[] = [];
        for (let i = 0; i < battles; i++) ms.push(measure(makeCfg((seedStart + i) >>> 0, A.id, B.id)));
        data[`${A.id}:${B.id}`] = ms;
      }
    }
    const raw = arg('raw');
    if (raw) {
      writeFileSync(raw, JSON.stringify({ label, data }));
      process.exit(0);
    }
  }
  const rows: { a: string; b: string; agg: Agg }[] = [];
  const all: BattleMetrics[] = [];
  const nonMirror: BattleMetrics[] = [];
  for (const A of STARTER_TOPS) {
    for (const B of STARTER_TOPS) {
      const ms = data[`${A.id}:${B.id}`];
      if (!ms) continue;
      rows.push({ a: A.id, b: B.id, agg: aggregate(ms) });
      all.push(...ms);
      if (A.id !== B.id) nonMirror.push(...ms);
    }
  }
  const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const overall = aggregate(all);
  const head = `| Matchup | Win A / B / draw % | Burst / KO / spin % | Dur mean (med) s | 1st contact med s | 1st hit med (p90) s | Contacts | Hits (med) | Hits/min | Mean gap s | Longest gap s | No hit by 5/10/20 s % | <5 hits % | Sync % time | Sync≥10 s % |`;
  const sep = `| ${head.split('|').slice(1, -1).map(() => '---').join(' | ')} |`;
  const line = (label: string, g: Agg) =>
    `| ${label} | ${f(g.winSlot0)} / ${f(g.winSlot1)} / ${f(g.draw + g.timeout)} | ${f(g.burst)} / ${f(g.knockout)} / ${f(g.spin)} | ${f(g.durMean)} (${f(g.durMedian)}) | ${f(g.firstContactMedian)} | ${f(g.firstHitMedian)} (${f(g.firstHitP90)}) | ${f(g.contacts)} | ${f(g.hits)} (${f(g.hitsMedian, 0)}) | ${f(g.hitsPerMin)} | ${f(g.meanGap)} | ${f(g.longestGapMean)} | ${f(g.noHit5)} / ${f(g.noHit10)} / ${f(g.noHit20)} | ${f(g.fewerThan5Hits)} | ${f(g.syncShare)} | ${f(g.sync10)} |`;
  const name = (id: string) => STARTER_TOPS.find((t) => t.id === id)!.name;
  const lines = [
    `${label} · ${all.length} battles${mergeAt >= 0 ? ' (merged parts)' : ` · ${((Date.now() - t0) / 1000).toFixed(0)} s`}`,
    '',
    head,
    sep,
    line('**All**', overall),
    line('**Non-mirror**', aggregate(nonMirror)),
    ...rows.map((r) => line(`${name(r.a)} vs ${name(r.b)}`, r.agg)),
  ];
  // Symmetric class matrix (both slot orders).
  const ids = [...new Set(rows.map((r) => r.a))];
  lines.push('', `| Row beats column (both slots) | ${ids.map(name).join(' | ')} |`, `| --- | ${ids.map(() => '---').join(' | ')} |`);
  for (const a of ids) {
    const cells = ids.map((b) => {
      const r1 = rows.find((x) => x.a === a && x.b === b);
      const r2 = rows.find((x) => x.a === b && x.b === a);
      if (!r1 || !r2) return '–';
      return `${f((r1.agg.winSlot0 * r1.agg.n + r2.agg.winSlot1 * r2.agg.n) / (r1.agg.n + r2.agg.n))}%`;
    });
    lines.push(`| **${name(a)}** | ${cells.join(' | ')} |`);
  }
  lines.push('', `Overall non-mirror win rate by top (both slots):`);
  for (const id of ids) {
    let w = 0;
    let n = 0;
    for (const r of rows) {
      if (r.a === r.b) continue;
      if (r.a === id) (w += (r.agg.winSlot0 * r.agg.n) / 100), (n += r.agg.n);
      if (r.b === id) (w += (r.agg.winSlot1 * r.agg.n) / 100), (n += r.agg.n);
    }
    lines.push(`- ${name(id)}: ${f((100 * w) / Math.max(1, n))}%`);
  }
  lines.push('', `Slot bias (all battles): slot 0 ${f(overall.winSlot0, 2)}% vs slot 1 ${f(overall.winSlot1, 2)}%. Winner health ${f(overall.winnerHealth)}%, winner stamina ${f(overall.winnerStamina)}%. Opening-clash (<3 s, burst/KO) ${f(overall.openingClash, 2)}%.`);
  const out = lines.join('\n');
  console.log(out);
  if (mdPath) writeFileSync(mdPath, out + '\n');
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ overall, rows }, null, 1));
}
