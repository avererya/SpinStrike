import type { TopBody } from './body';

/**
 * Battle telemetry (v0.4.1). Pure observation: nothing here feeds back into
 * the physics, so enabling it cannot change a battle. The World updates it
 * once per fixed step and on contact / damage events.
 *
 * Terminology (see docs/COMBAT_DYNAMICS_v0.4.1.md):
 *   physical contact  a new top–top touch (rings were apart, now overlap),
 *                     regardless of speed. Includes grazes.
 *   damaging hit      a contact impact that passed the damage gate (armed,
 *                     approach speed above v_min) and dealt damage > 0.
 *   sustained contact consecutive steps in which the rings stay touching.
 *   repeated impact   a damaging hit inside one sustained contact (re-armed
 *                     by time, not by separation).
 *   synchronized      both tops moving, not touching for a 2 s window,
 *   movement          and either the gap between them or their polar-angle
 *                     difference about the bowl centre stays nearly
 *                     constant (phase lock), or the two positions stay
 *                     (mostly) mirror images through the centre: the "identical orbit" pattern
 *                     from v0.4.0 playtests (mirror-image flower orbits).
 */
export interface TelemetrySummary {
  /** Physical contacts (new touches, any speed). */
  contacts: number;
  /** Damaging hits (impacts that dealt damage). */
  damagingHits: number;
  /** Damaging hits that occurred inside an already sustained contact. */
  repeatedImpacts: number;
  /** Steps during which the rings were touching. */
  contactSteps: number;
  /** Time of the first physical contact, s (null = never). */
  firstContact: number | null;
  /** Time of the first damaging hit, s (null = never). */
  firstHit: number | null;
  /** Times of every damaging hit, s. */
  hitTimes: number[];
  /** Longest interval without a damaging hit (launch → first hit, between hits, last hit → end), s. */
  longestGap: number;
  /** Total time classified as synchronized movement, s. */
  syncTime: number;
  /** Longest continuous synchronized-movement period, s. */
  longestSync: number;
  /** Duration observed, s. */
  duration: number;
  /** Sampled trace (x, y per top) every `traceEvery` steps, when enabled. */
  trace: number[][] | null;
}

/** Sampling interval of the synchronized-movement detector, s. */
const SYNC_SAMPLE = 0.25;
/** Trailing window over which the gap must stay nearly constant, s. */
const SYNC_WINDOW = 2;
/** Maximum gap variation inside the window for it to count as synchronized, m. */
const SYNC_GAP_BAND = 0.02;
/** Minimum clearance between rings (tops clearly apart), m. */
const SYNC_MIN_CLEARANCE = 0.015;
/** Both tops must move at least this fast, m/s. */
const SYNC_MIN_SPEED = 0.12;
/** Maximum variation of the tops' polar-angle difference inside the window (phase lock), rad. */
const SYNC_PHASE_BAND = (25 * Math.PI) / 180;
/** Both tops must be at least this far from the centre for the phase test, m. */
const SYNC_MIN_RADIUS = 0.03;
/** Mirror test: |p_A + p_B| below this share of |p_A − p_B| (point-symmetric positions). */
const SYNC_MIRROR_RATIO = 0.35;

export class BattleTelemetry {
  contacts = 0;
  damagingHits = 0;
  repeatedImpacts = 0;
  contactSteps = 0;
  firstContactStep = -1;
  readonly hitSteps: number[] = [];
  private readonly sampleEvery: number;
  private readonly windowSamples: number;
  private readonly gaps: number[] = [];
  private readonly phases: number[] = [];
  private lastPhase = NaN;
  private readonly mirror: boolean[] = [];
  private contactInWindow = 0;
  private syncSamples = 0;
  private syncRun = 0;
  private longestSyncSamples = 0;

  private sustainedSteps = 0;
  readonly trace: number[][] | null;
  private readonly traceEvery: number;

  constructor(
    readonly stepHz: number,
    opts: { traceEvery?: number } = {},
  ) {
    this.sampleEvery = Math.max(1, Math.round(SYNC_SAMPLE * stepHz));
    this.windowSamples = Math.max(2, Math.round(SYNC_WINDOW / SYNC_SAMPLE));
    this.traceEvery = Math.max(0, Math.floor(opts.traceEvery ?? 0));
    this.trace = this.traceEvery > 0 ? [] : null;
  }

  /** A new physical contact began on `step`. */
  onContactBegin(step: number): void {
    this.contacts++;
    if (this.firstContactStep < 0) this.firstContactStep = step;
  }

  /** A damaging hit happened on `step`. */
  onDamagingHit(step: number): void {
    this.damagingHits++;
    this.hitSteps.push(step);
    if (this.sustainedSteps > 1) this.repeatedImpacts++;
  }

  /** Called once per fixed step after physics. `touching` = rings overlapped during the step. */
  onStep(step: number, a: TopBody, b: TopBody, touching: boolean): void {

    if (touching) {
      this.contactSteps++;
      this.sustainedSteps++;
    } else this.sustainedSteps = 0;
    if (this.trace && step % this.traceEvery === 0) this.trace.push([a.x, a.y, b.x, b.y]);
    if (touching) this.contactInWindow = this.windowSamples * this.sampleEvery;
    else if (this.contactInWindow > 0) this.contactInWindow--;
    if (step % this.sampleEvery !== 0) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const gap = Math.sqrt(dx * dx + dy * dy) - a.params.radius - b.params.radius;
    this.gaps.push(gap);
    if (this.gaps.length > this.windowSamples) this.gaps.shift();
    // Polar-angle difference, unwrapped so a slow drift is continuous.
    let ph = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
    if (Number.isFinite(this.lastPhase)) {
      while (ph - this.lastPhase > Math.PI) ph -= 2 * Math.PI;
      while (ph - this.lastPhase < -Math.PI) ph += 2 * Math.PI;
    }
    this.lastPhase = ph;
    const centred = Math.hypot(a.x, a.y) < SYNC_MIN_RADIUS || Math.hypot(b.x, b.y) < SYNC_MIN_RADIUS;
    this.phases.push(centred ? NaN : ph);
    // Mirror-image movement: the midpoint of the two tops stays near the bowl centre.
    this.mirror.push(Math.hypot(a.x + b.x, a.y + b.y) < SYNC_MIRROR_RATIO * Math.hypot(dx, dy));
    if (this.mirror.length > this.windowSamples) this.mirror.shift();
    if (this.phases.length > this.windowSamples) this.phases.shift();
    let sync = false;
    const moving = a.speed > SYNC_MIN_SPEED && b.speed > SYNC_MIN_SPEED;
    if (this.gaps.length >= this.windowSamples && a.active && b.active && a.spinning && b.spinning && this.contactInWindow === 0 && moving) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const g of this.gaps) {
        if (g < lo) lo = g;
        if (g > hi) hi = g;
      }
      const gapLocked = lo > SYNC_MIN_CLEARANCE && hi - lo < SYNC_GAP_BAND;
      let plo = Infinity;
      let phi = -Infinity;
      let valid = true;
      for (const v of this.phases) {
        if (!Number.isFinite(v)) valid = false;
        if (v < plo) plo = v;
        if (v > phi) phi = v;
      }
      const phaseLocked = valid && lo > SYNC_MIN_CLEARANCE && phi - plo < SYNC_PHASE_BAND;
      const mirrored = lo > SYNC_MIN_CLEARANCE && this.mirror.filter((m) => m).length >= 0.75 * this.mirror.length;
      sync = gapLocked || phaseLocked || mirrored;
    }
    if (sync) {
      this.syncSamples++;
      this.syncRun++;
      if (this.syncRun > this.longestSyncSamples) this.longestSyncSamples = this.syncRun;
    } else this.syncRun = 0;
  }

  summary(endStep: number): TelemetrySummary {
    const dt = 1 / this.stepHz;
    const hits = this.hitSteps.filter((s) => s <= endStep);
    let longest = 0;
    let prev = 0;
    for (const s of hits) {
      longest = Math.max(longest, s - prev);
      prev = s;
    }
    longest = Math.max(longest, endStep - prev);
    // A sync run is only reported once the window was already constant, so add the window length back.
    const syncSec = this.syncSamples * this.sampleEvery * dt;
    const longestSync = this.longestSyncSamples > 0 ? this.longestSyncSamples * this.sampleEvery * dt + SYNC_WINDOW : 0;
    return {
      contacts: this.contacts,
      damagingHits: hits.length,
      repeatedImpacts: this.repeatedImpacts,
      contactSteps: this.contactSteps,
      firstContact: this.firstContactStep >= 0 && this.firstContactStep <= endStep ? this.firstContactStep * dt : null,
      firstHit: hits.length ? hits[0]! * dt : null,
      hitTimes: hits.map((s) => s * dt),
      longestGap: longest * dt,
      syncTime: syncSec,
      longestSync,
      duration: endStep * dt,
      trace: this.trace,
    };
  }
}
