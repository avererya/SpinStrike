import type { Battle } from '../sim/battle';
import type { TopDefinition } from '../content/tops';
import { el, hex } from './dom';

const RAD_TO_RPM = 60 / (2 * Math.PI);

interface Card {
  root: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  stFill: HTMLElement;
  stText: HTMLElement;
  hits: HTMLElement;
  dealt: HTMLElement;
  taken: HTMLElement;
  speed: HTMLElement;
  spin: HTMLElement;
  status: HTMLElement;
  last: string;
}

/**
 * Combat HUD: per-top health (green, current/max) and stamina (amber, %)
 * bars, hits landed, damage dealt and received, plus speed and angular
 * velocity in an expandable details row. Bars carry text labels and icons
 * so they are readable without relying on colour. Updated at a fixed
 * HUD rate by the app, independent of the physics rate.
 */
export class Hud {
  readonly root: HTMLElement;
  private cards: Card[] = [];
  private readonly time: HTMLElement;
  private readonly seed: HTMLElement;
  private readonly detailsBtn: HTMLButtonElement;

  constructor() {
    this.time = el('div', { class: 'hud-time', text: '0.0 s' });
    this.seed = el('div', { class: 'hud-seed' });
    this.detailsBtn = el('button', { class: 'hud-details-btn', 'aria-pressed': 'false', title: 'Show speed and spin', text: 'details' });
    this.detailsBtn.addEventListener('click', () => {
      const on = !this.root.classList.contains('detailed');
      this.root.classList.toggle('detailed', on);
      this.detailsBtn.setAttribute('aria-pressed', String(on));
    });
    this.root = el('div', { class: 'hud' }, [el('div', { class: 'hud-centre' }, [this.time, this.seed, this.detailsBtn])]);
  }

  setTops(defs: TopDefinition[], seed: number, labels: string[]): void {
    for (const c of this.cards) c.root.remove();
    this.cards = defs.map((d, i) => {
      const hpFill = el('div', { class: 'bar-fill hp' });
      const hpText = el('span', { class: 'bar-text' });
      const stFill = el('div', { class: 'bar-fill st' });
      const stText = el('span', { class: 'bar-text' });
      const hits = el('span', { class: 'v', text: '0' });
      const dealt = el('span', { class: 'v', text: '0' });
      const taken = el('span', { class: 'v', text: '0' });
      const speed = el('span', { class: 'v', text: '0.00' });
      const spin = el('span', { class: 'v', text: '0' });
      const status = el('span', { class: 'status' });
      const root = el('div', { class: `hud-card side-${i}` }, [
        el('div', { class: 'hud-head' }, [
          el('span', { class: 'swatch', style: `background:${hex(d.palette.primary)};box-shadow:0 0 0 2px ${hex(d.palette.accent)}` }),
          el('span', { class: 'name', text: d.name, style: `color:${hex(d.palette.accent)}` }),
          el('span', { class: 'cls', text: d.topClass }),
          el('span', { class: 'who', text: labels[i] ?? '' }),
        ]),
        el('div', { class: 'bar hp-bar', role: 'meter', 'aria-label': `${d.name} health` }, [
          hpFill,
          el('span', { class: 'bar-icon', text: '✚' }),
          hpText,
        ]),
        el('div', { class: 'bar st-bar', role: 'meter', 'aria-label': `${d.name} stamina` }, [
          stFill,
          el('span', { class: 'bar-icon', text: '⟳' }),
          stText,
        ]),
        el('div', { class: 'hud-stats' }, [
          el('span', { class: 'k', text: 'Hits' }),
          hits,
          el('span', { class: 'k', text: 'Dealt' }),
          dealt,
          el('span', { class: 'k', text: 'Taken' }),
          taken,
        ]),
        el('div', { class: 'hud-stats hud-phys' }, [
          el('span', { class: 'k', text: 'Speed' }),
          speed,
          el('span', { class: 'u', text: 'm/s' }),
          el('span', { class: 'k', text: 'Spin' }),
          spin,
          el('span', { class: 'u', text: 'rad/s' }),
        ]),
        status,
      ]);
      if (i === 0) this.root.prepend(root);
      else this.root.append(root);
      return { root, hpFill, hpText, stFill, stText, hits, dealt, taken, speed, spin, status, last: '' };
    });
    this.seed.textContent = `seed ${seed}`;
  }

  update(battle: Battle): void {
    const w = battle.world;
    const r = battle.result;
    this.time.textContent = `${(r ? r.time : w.time).toFixed(1)} s`;
    w.bodies.forEach((b, i) => {
      const c = this.cards[i];
      if (!c) return;
      // After the result, show the frozen result snapshot so numbers never change.
      const snap = r?.tops[i];
      const health = snap ? snap.health : b.health;
      const maxH = b.combat.maxHealth;
      const st = snap ? snap.stamina : b.spinning ? Math.max(0, Math.min(1, b.spinFraction)) : 0;
      const hf = maxH > 0 ? Math.max(0, Math.min(1, health / maxH)) : 0;
      c.hpFill.style.transform = `scaleX(${hf})`;
      c.hpText.textContent = `${Math.ceil(health)} / ${Math.round(maxH)}`;
      c.stFill.style.transform = `scaleX(${st})`;
      c.stText.textContent = `${(st * 100).toFixed(0)}%`;
      c.hits.textContent = String(snap ? snap.hitsLanded : b.hitsLanded);
      c.dealt.textContent = (snap ? snap.damageDealt : b.damageDealt).toFixed(0);
      c.taken.textContent = (snap ? snap.damageReceived : b.damageReceived).toFixed(0);
      c.speed.textContent = b.active ? b.speed.toFixed(2) : '–';
      c.spin.textContent = b.active ? Math.abs(b.omega).toFixed(0) : '–';
      c.spin.title = `${(Math.abs(b.omega) * RAD_TO_RPM).toFixed(0)} rpm`;
      const status = b.eliminated === 'burst' ? 'BURST' : b.eliminated === 'knockout' ? 'KNOCKED OUT' : !b.spinning ? 'STOPPED' : hf < 0.25 ? 'CRITICAL' : '';
      if (status !== c.last) {
        c.status.textContent = status;
        c.root.classList.toggle('stopped', b.eliminated !== null || !b.spinning);
        c.root.classList.toggle('critical', status === 'CRITICAL');
        c.last = status;
      }
    });
  }
}
