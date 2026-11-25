import type { Battle } from '../sim/battle';
import type { TopDefinition } from '../content/tops';
import { el, hex } from './dom';

const RAD_TO_RPM = 60 / (2 * Math.PI);

interface Card {
  root: HTMLElement;
  bar: HTMLElement;
  pct: HTMLElement;
  speed: HTMLElement;
  spin: HTMLElement;
  hits: HTMLElement;
  status: HTMLElement;
}

/** Battle information overlay: per-top stats and elapsed time. */
export class Hud {
  readonly root: HTMLElement;
  private cards: Card[] = [];
  private readonly time: HTMLElement;
  private readonly seed: HTMLElement;

  constructor() {
    this.time = el('div', { class: 'hud-time', text: '0.0 s' });
    this.seed = el('div', { class: 'hud-seed' });
    this.root = el('div', { class: 'hud' }, [el('div', { class: 'hud-centre' }, [this.time, this.seed])]);
  }

  setTops(defs: TopDefinition[], seed: number, labels: string[]): void {
    for (const c of this.cards) c.root.remove();
    this.cards = defs.map((d, i) => {
      const bar = el('div', { class: 'bar-fill' });
      bar.style.background = `linear-gradient(90deg, ${hex(d.palette.primary)}, ${hex(d.palette.accent)})`;
      const pct = el('span', { class: 'pct', text: '100%' });
      const speed = el('span', { text: '0.00' });
      const spin = el('span', { text: '0' });
      const hits = el('span', { text: '0' });
      const status = el('span', { class: 'status' });
      const root = el('div', { class: `hud-card side-${i}` }, [
        el('div', { class: 'hud-head' }, [
          el('span', { class: 'swatch', style: `background:${hex(d.palette.primary)}` }),
          el('span', { class: 'name', text: d.name }),
          el('span', { class: 'cls', text: d.topClass }),
          el('span', { class: 'who', text: labels[i] ?? '' }),
        ]),
        el('div', { class: 'bar', title: 'Remaining rotational energy' }, [bar, pct]),
        el('div', { class: 'hud-stats' }, [
          el('span', { class: 'k', text: 'Speed' }),
          speed,
          el('span', { class: 'u', text: 'm/s' }),
          el('span', { class: 'k', text: 'Spin' }),
          spin,
          el('span', { class: 'u', text: 'rad/s' }),
          el('span', { class: 'k', text: 'Hits' }),
          hits,
          status,
        ]),
      ]);
      if (i === 0) this.root.prepend(root);
      else this.root.append(root);
      return { root, bar, pct, speed, spin, hits, status };
    });
    this.seed.textContent = `seed ${seed}`;
  }

  update(battle: Battle): void {
    const w = battle.world;
    this.time.textContent = `${(battle.result ? battle.result.time : w.time).toFixed(1)} s`;
    w.bodies.forEach((b, i) => {
      const c = this.cards[i];
      if (!c) return;
      const f = Math.max(0, Math.min(1, b.spinFraction));
      c.bar.style.transform = `scaleX(${f})`;
      c.pct.textContent = `${(f * 100).toFixed(0)}%`;
      c.speed.textContent = b.speed.toFixed(2);
      c.spin.textContent = Math.abs(b.omega).toFixed(0);
      c.spin.title = `${(Math.abs(b.omega) * RAD_TO_RPM).toFixed(0)} rpm`;
      c.hits.textContent = String(b.collisions);
      c.status.textContent = b.spinning ? '' : 'STOPPED';
      c.root.classList.toggle('stopped', !b.spinning);
    });
  }
}
