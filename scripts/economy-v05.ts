/**
 * v0.5 reward check: win rate, Credits/hour and XP/hour per difficulty with
 * tactical abilities, for several player skill levels.
 *
 *   npx tsx scripts/economy-v05.ts [--battles 150] [--seed 700001] [--jobs 4] [--md out.md]
 *
 * Each battle is a fresh Bronze III career with an unupgraded starter (all
 * four starters), so the opponent pool and reward tier stay fixed. The
 * player's launch timing follows HUMAN_LAUNCH; the player's abilities are
 * driven by the tactical AI at the given skill ('passive' = never uses them),
 * a stand-in for people of different skill. Time per battle = simulated
 * duration + OVERHEAD_S (menus, aim, launch minigame, result screen).
 */
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { CareerStore, MemoryStore } from '../src/career/store';
import { playHeadlessBattle, type HeadlessTactics } from '../src/career/headless';
import { DIFFICULTIES, DIFFICULTY_LABEL, DIFFICULTY_REWARD_PERCENT, type Difficulty } from '../src/career/config';
import { STARTER_TOPS } from '../src/content/tops';

const OVERHEAD_S = 25;
const SKILLS: HeadlessTactics[] = ['passive', 'normal', 'hard'];
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

interface Cell { n: number; wins: number; draws: number; credits: number; xp: number; dur: number }

function run(d: Difficulty, skill: HeadlessTactics, battles: number, seed0: number): Cell {
  const c: Cell = { n: 0, wins: 0, draws: 0, credits: 0, xp: 0, dur: 0 };
  for (const t of STARTER_TOPS) for (let i = 0; i < battles; i++) {
    const store = new CareerStore(new MemoryStore(), { version: 'sim' });
    store.startCareer(t.id);
    const { result, settled } = playHeadlessBattle(store, d, seed0 + i * 7 + t.id.length, undefined, skill);
    c.n++;
    if (settled.outcome === 'win') c.wins++;
    if (settled.outcome === 'draw') c.draws++;
    c.credits += settled.reward.credits;
    c.xp += settled.reward.xp;
    c.dur += result.time;
  }
  return c;
}

if (process.env.ECON_CHILD) {
  const { d, skill, battles, seed0 } = JSON.parse(process.env.ECON_CHILD);
  process.send!(run(d, skill, battles, seed0));
  process.exit(0);
} else {
  const battles = Number(arg('battles') ?? 150);
  const seed0 = Number(arg('seed') ?? 700001);
  const jobs = Number(arg('jobs') ?? 4);
  const tasks = DIFFICULTIES.flatMap((d) => SKILLS.map((skill) => ({ d, skill, battles, seed0 })));
  const res: Record<string, Cell> = {};
  let next = 0;
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      while (running < jobs && next < tasks.length) {
        const task = tasks[next++]!;
        running++;
        const ch = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, ECON_CHILD: JSON.stringify(task) }, execArgv: ['--import', 'tsx'] });
        ch.on('message', (m) => (res[`${task.d}:${task.skill}`] = m as Cell));
        ch.on('exit', () => {
          running--;
          if (next >= tasks.length && running === 0) done();
          else launch();
        });
      }
    };
    launch();
  });
  const L: string[] = [
    `Bronze III, unupgraded starters (all four), ${battles} battles per starter per cell = ${battles * 4} per cell, seed ${seed0}. Time per battle = simulated duration + ${OVERHEAD_S} s overhead. Reward multipliers: ${DIFFICULTIES.map((d) => `${DIFFICULTY_LABEL[d]} ${DIFFICULTY_REWARD_PERCENT[d] / 100}×`).join(', ')}.`,
    '',
    '| Difficulty | Player abilities | Win % | Draw % | Avg battle s | Credits / battle | XP / battle | Credits / hour | XP / hour |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const d of DIFFICULTIES) for (const skill of SKILLS) {
    const c = res[`${d}:${skill}`]!;
    const per = c.dur / c.n + OVERHEAD_S;
    const label = skill === 'passive' ? 'not used' : `${skill} skill`;
    L.push(`| ${DIFFICULTY_LABEL[d]} | ${label} | ${((100 * c.wins) / c.n).toFixed(1)} | ${((100 * c.draws) / c.n).toFixed(1)} | ${(c.dur / c.n).toFixed(1)} | ${(c.credits / c.n).toFixed(1)} | ${(c.xp / c.n).toFixed(1)} | ${((c.credits / c.n) * (3600 / per)).toFixed(0)} | ${((c.xp / c.n) * (3600 / per)).toFixed(0)} |`);
  }
  const text = L.join('\n');
  console.log(text);
  const md = arg('md');
  if (md) writeFileSync(md, text + '\n');
}
