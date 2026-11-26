# SpinStrike v0.4.1 combat dynamics report

This report covers why v0.4.0 battles sometimes stalled, what v0.4.1 changed, and what those changes did. It also covers the starter stats, upgrades, launch aiming and the economy. Every number comes from the headless simulator running the real engine (`npm run dynamics`, `npm run upgrades`, `npm run aim`, `npx tsx scripts/economy.ts`). Raw tables are in [`docs/balance/v0.4.1/`](balance/v0.4.1/).

**Validation sets**
- Main set: 16 ordered matchups × 2,000 seeds (100001–102000) = **32,000 battles** for v0.4.1, and the same 32,000 seeds for v0.4.0 through the preserved baseline path. Both sides use AI-distribution launches. In v0.4.1 the player keeps the default aim (0°, 4°) and the opponent uses the seeded AI aim.
- Second set: 16 × 500 seeds (1–500) = 8,000 more battles.
- Tuning used other seeds (1–300 and 200001–200300), so the validation sets were never used to pick values.

## 1. What went wrong in v0.4.0

### Diagnostic case: seed 3782078522
The reported battle was reconstructed exactly with `legacyV040Config`. It was an Inferno vs Inferno mirror:
- Player ranks: Health 1, Attack 1, Stamina 2. Opponent ranks: Attack 1, Stamina 1.
- Launches: Perfect vs Great.
- Result: 59.26 s, 157 / 193 damage, a narrow spin win, **4 damaging hits, the first at 29.9 s**.

Trace: both tops settled into the same orbit about 170–180° apart and stayed there for about 30 s, with no contact at all. The test `tests/v041.test.ts` reproduces the battle exactly. Under v0.4.1 the same seed and builds meet at 0.8 s and end in an opening knockout at 0.9 s.

### Root cause: neutral phase in a shared limit cycle
- A top's translation is driven by its tip: the slip at the contact point (v + ω ẑ × c) produces friction that pushes the top along a curve set by its spin, lean and the bowl slope.
- Two identical tops started point-symmetrically (exactly π apart, mirrored headings, as in v0.4.0) therefore follow the **same limit cycle, half a lap apart**.
- Nothing in the physics pulls the phases together. The phase difference is neutral: it only drifts slowly through launch-energy differences. So identical or near-identical tops could circle for tens of seconds without touching.
- Launch speed did not break the pattern, because the drive field forgets the initial velocity within about a second.

| v0.4.0 baseline (32,000 battles) | All | Inferno mirror | Titan mirror | Tempest mirror | Phantom mirror |
| --- | --- | --- | --- | --- | --- |
| First damaging hit, median (p90) | 3.0 s (26.0) | 15.8 s (34.0) | 21.5 s (42.4) | never | 18.3 s (28.6) |
| No damaging hit by 10 s | 23.9 % | 67.3 % | 99.8 % | 100 % | 96.0 % |
| No damaging hit by 20 s | 15.0 % | 37.3 % | 62.1 % | 100 % | 40.0 % |
| Battles with < 5 damaging hits | 10.3 % | 13.8 % | 13.4 % | **100 %** | 0.8 % |
| Synchronised orbit ≥ 10 s | 5.7 % | 11.8 % | **54.3 %** | 0 % | 24.7 % |

The Tempest mirror never produced a damaging hit: two needle tips at the same speed only graze. Non-mirror matchups were mostly fine, with a first hit at a median of 2.1 s.

## 2. What changed (mechanisms)

All changes are physical, seeded and deterministic. There is no homing, no attraction, no scripted contact, no class damage multiplier, no teleporting and no comeback mechanic. Each random component has its own keyed stream (`RNG_STREAM.launchGeometry`, `floor`, `wander`, `aiAim`), so turning one off or changing its amount never shifts the others. The same seed and the same aims always give the same battle.

| Mechanism | What it is | Where |
| --- | --- | --- |
| Launch variation | Each top's placement angle (±0.45 rad around its nominal spot), radius (±12 %), heading (±0.1 rad around the aim), speed (±8 %), release tilt (±0.025 rad) and launch energy (±4 %) are drawn independently per slot. Launches are no longer point-symmetric. | `src/sim/launchGeometry.ts`, `World.launchV041` |
| Floor micro-relief | Six long-wavelength cosine waves (7–20 cm, 0.15 mm RMS) added to the bowl height field, with analytic gradients. Conservative: it is part of the potential, so it adds no energy. | `ClassicBowl` `relief` |
| Floor grip variation | Friction varies ±5 % RMS across the floor. Dissipative only. | `ClassicBowl` |
| Contact wander (tip property) | The tip's contact point wanders smoothly (three sines per axis, 0.25–1.1 Hz, seeded phases). The amplitude is a tip property and grows as spin falls (`wanderSpinGain`), as a real worn tip skates more when slow. Flat Rush tip 0.04, Bastion Ball 0.04, Needle 0.025, Vector Semi 0.035. | `TipPart.v041`, `dynamics.ts` |
| Ball-tip centre recovery | `axisSettleRate` 1.5 for Bastion Ball: a ball tip rolls back toward upright, so Titan settles in the centre instead of orbiting. | `TipPart.v041` |
| Rolling resistance per tip | Ball 0.5, needle 0.12, semi 0.1, flat 0.05: a ball tip loses translation faster, a flat tip keeps moving. | `TipPart.v041` |
| Impact lift 0.7 → 0.55 | More contacts briefly raised knockouts to 11 % in tuning; the lower lift restores a 3–4 % KO share. | `DEFAULT_COMBAT.impactLift` |

**Alternatives tested and rejected**
- **Launch variation alone made synchronisation worse.** Tops still converged onto the shared orbit, just from more varied starts, and the slightly unequal starts sometimes locked them closer to anti-phase.
- **Floor relief alone barely helped.** At amplitudes that stay invisible and conservative it does not break the limit cycle.
- **Contact wander was the effective lever.** A small, smooth, spin-dependent perturbation of the drive gives each top its own slow phase drift, so the phase is no longer neutral.
- **Spin-slip softening (rejected).** This reduced tip drive at high slip. At every strength tried (0.5, 1, 2) it wrecked balance: Tempest mirrors went to 100+ hits and nearly everything ended in bursts. It was removed completely.

## 3. Results: entertainment metrics (32,000 battles each, matched seeds)

| Metric | v0.4.0 | **v0.4.1** |
| --- | --- | --- |
| First damaging hit, median (p90) | 3.0 s (26.0) | **2.7 s (12.5)** |
| No damaging hit by 5 / 10 / 20 s | 31.4 / 23.9 / 15.0 % | **33.9 / 12.7 / 4.5 %** |
| Battles with < 5 damaging hits | 10.3 % | **3.7 %** |
| Synchronised orbit (share of battle time) | 2.9 % | **1.0 %** |
| Battles with a synchronised stretch ≥ 10 s | 5.7 % | **0.2 %** |
| Longest gap between damaging hits, mean | 13.5 s | **12.0 s** |
| Damaging hits, mean (median) | 27.4 (22) | 27.0 (20) |
| Hits per minute | 44.8 | 46.2 |
| Duration, mean (median) | 40.1 s (41.7) | 39.4 s (37.1) |
| Finishes: burst / KO / spin | 28.2 / 2.8 / 66.7 % | 33.9 / 3.6 / 60.1 % |
| Draws + timeouts | 2.3 % | 2.4 % |
| Opening clash (decided < 3 s by burst/KO) | 2.35 % | 2.93 % |
| Winner health / stamina at the end | 34.3 / 9.7 % | 35.7 / 14.0 % |

"No hit by 5 s" rose slightly because Titan and Tempest now spend their first seconds settling (ball-tip centre recovery) before their first damaging contact. Long stalls (10 s and 20 s) fell by half and by two thirds.

**Mirrors**

| Mirror | First hit median (p90) v0.4.0 → v0.4.1 | No hit by 20 s | Hits mean | Sync ≥ 10 s | Duration median | Draws |
| --- | --- | --- | --- | --- | --- | --- |
| Inferno | 15.8 (34.0) → **2.0 (5.2)** | 37.3 → **0.1 %** | 8.2 → 6.5 | 11.8 → 0.1 % | 39.8 → 16.7 s | 5.9 → 9.3 % |
| Titan | 21.5 (42.4) → **18.0 (36.2)** | 62.1 → 48.6 % | 19.9 → 20.1 | 54.3 → **0 %** | 45.9 → 58.7 s | 6.2 → 2.7 % |
| Tempest | never → **9.7 (14.4)** | 100 → **1.8 %** | 0 → **25.2** | 0 → 0 % | 58.6 → 80.4 s | 1.3 → 1.7 % |
| Phantom | 18.3 (28.6) → **8.3 (19.7)** | 40.0 → 9.8 % | 22.8 → 25.1 | 24.7 → 2.9 % | 53.5 → 54.7 s | 7.3 → 7.3 % |

**Tradeoffs and remaining weak spots**
- **Inferno mirror:** it now opens within 2 s, but it is short (median 16.7 s, about 6.5 hits) and decisive. 35 % of these battles end in knockouts, and draws rose to 9.3 %. Two same-spin flat tips chatter against each other and drain spin fast. The 15–30-hit target is not met.
- **Titan mirror:** the synchronised orbits are gone (0 % ≥ 10 s), but two heavy ball tips sitting in the centre still take a median of 18 s to land a damaging hit, and about half take more than 20 s. They touch earlier, but softly.
- **Tempest mirror:** it now has real exchanges (about 25 hits), but it is long (median 80 s).

## 4. Starter stats and class identity

| Top | Class | Health | Attack | Defense | Stamina | Speed | Weight | v0.4.0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | Attack | 60 | 95 | 35 | 64 | 90 | 50 | 63 / 95 / 35 / 62 / 85 / 50 |
| Titan | Defense | 80 | **55** | 90 | 70 | 30 | 95 | 72 / **82** / 82 / 60 / 30 / 95 |
| Tempest | Stamina | 65 | 40 | 45 | **95** | 55 | 55 | 63 / 40 / 65 / **75** / 50 / 55 |
| Phantom | Balance | 65 | 67 | 56 | 66 | 65 | 65 | 69 / 72 / 65 / 67 / 65 / 65 |

- Titan's Attack is now 40 below Inferno's, and Tempest's Stamina is clearly the highest.
- Totals (including Weight) are 394 / 420 / 355 / 384. Stats are not a budget: ring and tip parts carry much of each top's strength, for example Zephyr Halo's damage cap.
- The v0.4.0 stats are kept in `LEGACY_V040_STATS` and used by the `v0.3` ruleset (the v0.4.0 baseline path).

**Zephyr Halo (v0.4.1 values):** blade exposure 0.55, `damageCapFactor` 0.7 (was 0.45), `impactSpinLossFactor` 1.3 (was 1.5). Tempest's extra stamina replaced part of the ring protection.

**Stamina mapping:** `spinDecay = 2 / (1 + 1.6667 · stamina / 100)`, a hyperbola. In v0.4.0 the straight line extended past 100 kept removing the same amount of decay per point, so the last ranks compounded.

**Speed mapping:** launch speed 0.3–1.1 m/s, traction ×0.85–1.2, and (new) tip drive radius ×0.85–1.15.

### Soft-counter matrix (row's win % against column, both slot orders)

| Seeds 100001–102000 | Inferno | Titan | Tempest | Phantom | Non-mirror overall |
| --- | --- | --- | --- | --- | --- |
| **Inferno** (Attack) | 45.4 | 40.1 | **70.0** | 37.6 | 49.3 % |
| **Titan** (Defense) | **58.1** | 48.6 | 28.8 | 58.7 | 48.5 % |
| **Tempest** (Stamina) | 29.9 | **71.3** | 49.1 | 53.0 | 51.4 % |
| **Phantom** (Balance) | 59.1 | 38.1 | 46.8 | 46.4 | 48.0 % |

Seeds 1–500: Inferno 48.0 %, Titan 50.2 %, Tempest 49.3 %, Phantom 49.7 %. The v0.4.0 baseline on the same seeds was 47.5 / 48.1 / 50.0 / 51.5 %.

- **The counters hold.** Attack beats Stamina (70 %), Stamina beats Defense (71 %), and Defense beats Attack (58 %, target about 65 %).
- **Phantom is broad overall (48 %) but not even.** It beats Inferno about 60 % of the time and loses to Titan about 61 % of the time. In tuning, Phantom's results against Titan and Inferno moved together:
  - Lowering Phantom's Attack enough to stop it beating Inferno made it collapse against Titan's 90 Defense (14 % at Attack 62).
  - Raising Inferno's health changed nothing, because Inferno loses that matchup on spin.
- **Slot bias.** Overall slot 0 vs slot 1 was 49.6 / 48.0 % on the main set and 50.1 / 47.5 % on seeds 1–500. On other seed sets slot 1 was ahead by 0.4–1.1 points. All 16 matchups reuse the same seeds, so results are correlated and the effective sample is smaller than the battle count.
  - Direct check: four mirrors × 3,000 seeds with identical aims gave slot differences of −1.1, −0.8, +1.1 and +0.5 points. There is no systematic slot bias.
  - The test suite also guards the Phantom mirror.

## 5. Launch aiming

**Player controls**
- **Direction** −45° … +45° (+ = toward the centre) and **tilt** 0° … 30°, chosen on a top-down view before the timing minigame.
- The dotted preview is a real physics run of the player's top alone for 1 s. It uses the nominal launch with no jitter, relief, wander or opponent, so it shows the opening path, not the battle. The preview is tested to be deterministic and unaffected by the variation settings.

**Physics of the aim**
- **Direction** rotates the launch heading.
- **Tilt** sets the initial spin-axis tilt. It is phased so the tip drive pushes along the heading. A tilted top runs harder off its tip and costs spin through the existing tip–floor coupling, and pivot friction grows with tilt. In the test, after 2 s alone, tilt 30° keeps less spin than tilt 10°, which keeps less than 0°.
- Small seeded variation still applies on top of the aim, and the launch-quality energy bonus is unchanged.
- **No damage bonus:** combat parameters are identical for every aim (tested).

**AI aim:** uniform in direction −30…+30° and tilt 0…14°, on its own stream and configurable in the sandbox. It is currently the same on every difficulty.

**Effect (100 seeds × 4 opponents per row, seeds 300001+; full table in [`aim-evaluation.md`](balance/v0.4.1/aim-evaluation.md))**

| Player | Best aim (win %) | Worst aim (win %) | What tilt does |
| --- | --- | --- | --- |
| Inferno | −45° / 0° (51.5) | −45° / 30° (38.8) | Tilt costs Inferno spin (stamina at the end 8 % → 4–7 %) and raises opening clashes (7–9 % → 10–11 %). |
| Titan | +45° / 30° (55.8) | −45° / 30° (42.8) | Aiming in and tilted helps Titan reach the centre fast; aiming out and tilted hurts. |
| Tempest | 0° / 15° (53.3) | +45° / 0° (48.0) | Nearly indifferent: 48–53 % across all nine aims. |
| Phantom | −45° / 0° (53.0) | ±45° / 15–30° (42–43) | Low tilt is best. |

- **No aim is universally best.** Each top's best aim is different, and the spread is about ±6 points around 47–50 %.
- Hit counts, first contact (1.4–6.6 s), duration and stamina move a little, but no aim produces stalls or sure wins.
- Aiming is a real but modest skill choice, in line with "not universally optimal".

## 6. Upgrades (60 seeds × 4 unupgraded opponents × 2 slot orders per row)

Change in overall win rate against unupgraded starters. Full tables: [`upgrades-v0.4.1.md`](balance/v0.4.1/upgrades-v0.4.1.md) and [`upgrades-v0.4.0-baseline.md`](balance/v0.4.1/upgrades-v0.4.0-baseline.md).

| Rank 10 | Inferno v0.4.0 → v0.4.1 | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| Health | +1.0 → +4.6 | +9.0 → +17.9 | +34.2 → +31.5 | +14.6 → +11.7 |
| Attack | +38.5 → +36.7 | +40.6 → +33.1 | +16.9 → +8.8 | +32.7 → +36.7 |
| Defense | −0.8 → +5.4 | +7.9 → +10.2 | +14.2 → +7.1 | +9.8 → +8.1 |
| **Stamina** | **+44.4 → +16.7** | **+46.2 → +18.1** | +22.1 → +10.0 | **+40.4 → +27.3** |
| **Speed** | **+0.4 → −4.4** | **+2.1 → −4.4** | **+2.3 → −5.4** | **+0.6 → −3.1** |
| Crit chance | +28.3 → +29.0 | +23.5 → +16.0 | 0 → 0 | +18.5 → +19.4 |
| Full build | +49.4 → +47.1 | +51.5 → +48.8 | +47.3 → +46.5 | +49.6 → +51.7 |

- **Stamina fixed.** It no longer dominates: it went from the strongest single upgrade to a mid-strength one.
- **Speed is not fixed.** It was worth about 0 in v0.4.0 and is slightly negative in v0.4.1. Isolating each part of the mapping (rank 10 with one component held at its rank-0 value, 800 battles per top):
  - Growing tip drive and traction costs 1–3 points.
  - Launch speed alone is neutral.

  The physical reasons:
  - The drive field forgets launch speed within about a second.
  - Damage grows only with roughly the 0.4 power of impact speed.
  - A faster, harder-driving top runs a wider, more spin-wasting orbit.
  - Collision outcomes depend on relative velocity, which both tops share.

  Making Speed positive needs a design decision (section 9). Costs were not changed.
- **Crit chance does nothing for Tempest.** Tempest never bursts anyone, so crits cannot win its battles. This is unchanged from v0.4.0.
- **Stress tests.** A full build wins 92–99 % against unupgraded starters and 71–96 % against all-rank-5 opponents. Unupgraded tops win 8–11 % against all-rank-5 opponents. Full vs full is uneven: Titan 63 %, Phantom 52 %, Inferno 44 %, Tempest 37 %. Titan's percentage bonuses apply to the largest Health and Defense base. The upgrade matrix had no simulation failures (draws + timeouts 0.2–3.5 %). The no-NaN and energy checks are in the test suite.

## 7. Economy (temporary difficulty multipliers)

**Rewards are now** Easy 0.75, Normal 1.0, Hard 1.1, Expert 1.2 (were 0.5 / 1 / 1.5 / 2), with one half-up integer rounding. Bronze wins pay 75 / 100 / 110 / 120 Credits and 38 / 50 / 55 / 60 XP.

**Projection** ([`v0.4.1-economy-report.md`](economy/v0.4.1-economy-report.md), Bronze only, real engine):
- Full upgrade on Normal: 13–21 h depending on the starter.
- Inferno: Easy 17.1 h, Hard 12.2 h, Expert 11.6 h.
- Credits remain the bottleneck: about 3.2× the XP requirement.

## 8. Save compatibility and records
- v0.4.0 saves load unchanged; there is no schema bump.
  - Ranks, Credits, XP and history are kept.
  - Effective stats are recalculated from the ranks with the v0.4.1 base stats.
  - Old battle records keep their values and get **no** ruleset or aim, so nothing is fabricated.
- New records carry `ruleset: 'v0.4.1'` and both aims, and the last aim is saved per owned top.
- The sandbox keeps the v0.4.0 baseline ("Load v0.4.0 baseline": `v0.3` ruleset, v0.4.0 stats, collision and combat values, movement variation off) and the v0.2 legacy path.
- Sandbox config files are version 4. Version 3 files import with movement variation off, so they reproduce their battles.

## 9. Decisions for the designer
1. **Speed upgrades:** pick one.
   - (a) Make Speed scale the v0.5 directional boost or brace (recommended: it gives Speed a physical job that the drive field cannot erase).
   - (b) Remap Speed to grip / knockout resistance.
   - (c) Lower its price, or hide it until v0.5.
   Today a fully paid Speed track costs 13,900 Credits and slightly lowers win rate.
2. **Phantom's spread:** it beats Inferno about 60 % and loses to Titan about 61 %, while its overall rate is 48 %. Accept, or tune with part properties in v0.5.
3. **Inferno mirror:** fast and decisive (median 17 s, about 6.5 hits, 9 % draws). Accept this as the attack-class identity, or lengthen it with a flat-tip property.
4. **Titan mirror:** a slow first hit (median 18 s), now without synchronised orbits.
5. **Fully upgraded Titan leads full-vs-full (63 %) and Tempest trails (37 %).** Percentage bonuses favour Titan's large Health/Defense base. Revisit when higher ranks arrive.
6. **AI aim is identical across difficulties:** Expert could aim better, for example by choosing the aim that is best for its top.
7. **Stat totals differ** (394 / 420 / 355 / 384 including weight). Parts carry the rest; confirm this is acceptable.
8. **Reward multipliers are temporary** until difficulty means more than AI launch quality.

## 10. Prepared for v0.5 (not implemented)
- Boost and brace are not implemented.
- The launch-aim plumbing already provides the pieces those abilities need:
  - per-slot aims recorded in results and history
  - a keyed AI-decision stream (`RNG_STREAM.aiAim`)
  - a physics-only preview runner (`aimPreview`)
  - telemetry for contacts, hits and gaps (`BattleTelemetry`)

  Telemetry is how a boost's effect on contact rate would be measured.
