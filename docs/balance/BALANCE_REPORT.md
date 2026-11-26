# SpinStrike v0.3 balance report (Classic Bowl)

All numbers come from `npm run sim` (headless). Win rates are shares of **all** battles; draws and timeouts are neither wins nor losses. "Slot-averaged" combines both slot orders. Raw reports: [`v0.3/`](v0.3/). The v0.2 report follows below, unchanged.

## Phases and method
- **A: baseline.** The legacy v0.2 configuration (`--legacy`) reproduces the v0.2 matrix exactly (Inferno 0 / 73 / 0.4 %, Titan 100 / 0 / 100 %, …), 0 failures: [A](v0.3/A-legacy-v02-seeds-1-500.md).
- **B: each mechanic alone, on the legacy stats.** Crits alone [B1](v0.3/B1-legacy-crits.md), launch distribution alone [B2](v0.3/B2-legacy-launch-dist.md), both [B3](v0.3/B3-legacy-crits-launch.md), plus the draw window [B4](v0.3/B4-legacy-crits-launch-window.md). Result: none of them fixes the 0/100 % cells (Titan still beats Inferno and Phantom ~100 %, Inferno still loses to Phantom ~99 %). Crits plus launch variance move Inferno vs Tempest to 83 % and Phantom vs Tempest to 71 %. The draw window adds ~4.5 % draws (32 % → mirrors lose ~18 points of decisive results).
- **C: structural rebalance** by hill-climbing with `scripts/tune-eval.ts` on 40–150 seeds, scoring distance to the target matrix, finish mix, early finishes and draws. Only stats, part values (tip stability, tip pivot friction, ring strike, ring blade exposure) and global combat constants were varied. No hidden multipliers, forced winners, rubber-banding, matchup-specific overrides or random stamina loss.
- **D: validation** on seed sets not used in tuning (100001–100500, 200001–200500), 16 matchups × 500 seeds each.

## Parameter changes (v0.2 → v0.3)
| Top | v0.2 stats (H/A/D/St/Sp/W) | v0.3 stats |
| --- | --- | --- |
| Inferno | 60/90/35/45/85/50 | 63/95/35/62/85/50 |
| Titan | 90/40/95/65/30/95 | 72/82/82/60/30/95 |
| Tempest | 60/35/50/100/50/55 | 69/40/65/85/50/55 |
| Phantom | 65/65/65/65/65/65 | 69/72/65/67/65/65 |

Parts: Rush Flat pivot friction 0.16 → 0.10; Bastion Ball stability 0.60 (via defense in v0.2) / pivot 0.20 → 0.238; Needle Point pivot 0.20 → 0.207; Vector Semi stability 0.59; Blaze Fang strike 0.014 → 0.0176; Zephyr Halo blade exposure 1 → 0.37. Combat: damage scale 50 → 54, rotational contribution 10 → 9.4, severity exponent 0.5 → 0.4, cap 2 → 2.45, collision energy loss 0.6 → 0.59, spin-drain weight 0.5 → 0.63. Mapping: defense no longer feeds stability or impact spin resistance (see README).

## Final results (D3, seeds 1–500, distributed launch, crits on)
| Slot-averaged | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| Inferno | 43 % | 32.5 % | **94.9 %** | 43 % |
| Titan | 67 % | 43 % | 26 % | 42 % |
| Tempest | 5 % | 74 % | 48 % | 57 % |
| Phantom | 56 % | 46 % | 42 % | 41 % |

Unseen sets D4 and D6 agree within ±3 points per cell (Inferno vs Tempest 93.9 / 93.6 %). Targets: Inferno–Titan 35, Inferno–Tempest 65, Titan–Tempest 35, others 50.

| Configuration (seeds 1–500) | Inf–Tit | Inf–Tem | Tit–Tem | Burst % | Draws % | Mean s |
| --- | --- | --- | --- | --- | --- | --- |
| D1 equal Good launch, crits off | 19 | 89 | 16 | 21.6 | 6.9 | 41.4 |
| D2 equal Good launch, crits on | 31 | 94 | 24 | 29.8 | 6.8 | 40.7 |
| D3 distributed, crits on | 33 | 95 | 26 | 30.3 | 4.9 | 40.7 |

Non-mirror overall win rate (D3 / D4 / D6): Inferno 57 / 55 / 56 %, Titan 45 / 45 / 45 %, Tempest 45 / 47 / 46 %, Phantom 48 / 48 / 49 %. All three configurations have 0 failures (guard trips, non-finite values, exceptions) and 0 timeouts. Phantom is in the 45–55 % band overall; Inferno is just above, Tempest and Titan just below.

**Finish mix (D3):** burst 30.3 % of all battles (39.9 % non-mirror), knockout 2.9 %, spin 62.0 %, draws 4.9 %. **Durations:** mean 40.7 s, median 42.5 s, P10–P90 21.8–54.9 s. **Early finishes** (all battles): < 2 s 2.3 %, < 5 s 2.6 %, < 10 s 3.2 % (non-mirror 3.1 / 3.2 / 3.8 %), almost all Inferno vs Tempest opening-clash bursts and knockouts. **Crits:** ~2.7 per battle, 4.8 % of damaging hits. Per-matchup winner health/stamina, narrow wins and max hits are in the raw reports.

## Mirror fairness
P1 share of decisive mirror results over 500 seeds (D3): Inferno 50.9 %, Titan 51.9 %, Tempest 50.6 %, Phantom 52.2 % (|z| ≤ 0.9); D4 |z| ≤ 1.4; D6 |z| ≤ 0.5. No slot bias. (In the Perfect-vs-AI run D5, P1 is the Perfect player, so mirror skew there is the launch bonus, not bias.)

## Draw window
| Window | Draws (all) | Mirror draws |
| --- | --- | --- |
| 0 s (v0.2 rule) | 0.7 % | ~0.5 % |
| 0.1 s ([D7](v0.3/D7-final-dist-window-0.1-seeds-200001-200500.md)) | 2.4 % | 7.6–9.2 % |
| 0.25 s (D6) | 4.9 % | 14–19 % |

Win rates are unaffected outside mirrors. 0.25 s is spec-confirmed; 0.1 s would halve mirror draws.

## Launch skill (D5 vs D6)
Perfect player vs AI distribution: Inferno 61 %, Titan 51 %, Tempest 50 %, Phantom 52 % overall win rate (non-mirror 61 / 49 / 44 / 43 %), versus 54 / 44 / 46 / 48 % (non-mirror 59 / 45 / 46 / 49 %) for an average launch (D6). Perfect is a clear edge, mostly in close and mirror matchups (+10 % energy).

## Remaining problems
1. **Inferno vs Tempest ≈ 94 %** (target 65 %), median ~17 s, with 18–22 % of those battles ending within 10 s. Cause: Inferno's blade strike scales with spin and impact speed, and Tempest's low attack gives it no way to punish; lowering blade exposure to 0.2 brought the cell to ~67 % but Phantom vs Tempest collapsed to ~5 %, and raising Tempest health recovers the cell only partially. Recommendation: a design decision such as a dedicated Tempest ring/tip, or adding a defensive property to Zephyr Halo beyond blade exposure.
2. **Mirror draws** are 14–19 % at 0.25 s. Recommendation: 0.1 s.
3. **Early finishes** (~3 % under 5 s) come from opening-clash bursts; acceptable but notable.
4. Duration targets: Inferno vs Tempest (17 s) is a "significant advantage" duration; Titan vs Tempest (42 s) is shorter than the 60–90 s stamina target.

## Titan mirror seed 327532992
v0.1: P2 stopped at step 12654, P1 ten steps (0.042 s) later with 0.40 % raw energy vs 0.38 % at the toppling spin, shown as "0%" by rounded display; the aftermath display also showed P1 STOPPED. v0.2: P2 stopped at step 12326, P1 16 steps later. Conclusion: P1 legitimately stopped slightly later; display rounding and the live aftermath hid it, not ordering bias. With the 0.25 s window the battle is a near-simultaneous draw (test in `tests/results.test.ts`). The HUD now shows `<0.1%` and uses the decisive-moment snapshot.

## iOS top blur
Not verified on a device. Mitigations: the page background matches the toolbar colour, safe-area padding is inside the toolbar, the HUD backdrop blur is removed, `theme-color` and status-bar style are set; the Three.js resolution was not changed. Headless desktop and phone-size screenshots show correct layout only.

---

# SpinStrike v0.2 balance report (Classic Bowl)

All numbers come from `npm run sim` (headless, no rendering). Each ordered matchup (16, including mirrors) was run with 500 consecutive seeds, giving 8,000 battles per run. Win rates are the share of **all** battles: draws and timeouts are neither wins nor losses and are listed separately. "Slot-averaged" combines A-as-player and A-as-opponent.

Raw reports:
- [Initial parameters](v0.2-initial-seeds-1-500.md)
- [Final parameters, seeds 1–500](v0.2-final-seeds-1-500.md)
- [Final parameters, seeds 100001–100500](v0.2-final-seeds-100001-100500.md): a validation set that was not used for tuning.

Reproduce with:
```bash
npm run sim -- --battles 500 --seed 1
npm run sim -- --battles 500 --seed 100001
```

## Targets (provisional, from the v0.2 spec)

| Row beats column | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50 % | 35 % | 65 % | 50 % |
| **Titan** | 65 % | 50 % | 35 % | 50 % |
| **Tempest** | 35 % | 65 % | 50 % | 50 % |
| **Phantom** | 50 % | 50 % | 50 % | 50 % |

## Initial results (first-draft combat parameters)

The first draft used energy-proportional damage with no compression: G = 20, p = 1, k_rot = 1, x_cap = 6, e = 1, v_min = 0.08 m/s and impact lift 0.35. **Every one of the 8,000 battles ended by spin finish**, and the outcome was identical to v0.1's stamina-only order.

The cause was the impact speeds. Measured approach speeds are low: the median is 0.06–0.08 m/s for non-Inferno pairs and about 0.2 m/s for Inferno. With energy ∝ v², non-Inferno contacts did almost nothing, so no burst ever happened.

| Row beats column (slot-averaged) | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50 % | 0 % | 0 % | 0 % |
| **Titan** | 100 % | 50 % | 0 % | 100 % |
| **Tempest** | 100 % | 100 % | 50 % | 100 % |
| **Phantom** | 100 % | 0 % | 0 % | 50 % |

## Balancing process and adjustments

1. **Measured the physics first.** I logged the impact-speed and wall-impact-speed distributions per matchup. I also logged per-hit damage and the damage total per battle (with health made effectively infinite) to see how much damage each pairing can deliver before the stamina finish.
2. **Formula changes (all global, none class-specific):**
   - The speed threshold became a *gate* rather than being subtracted, so 0.06 m/s contacts are not erased.
   - Added the **severity exponent p** to compress the light-to-heavy range.
   - Raised the **blade term** k_rot. This makes damage depend on spin and ring striking characteristics as the spec asks.
   - Lowered the soft cap so opening-clash hits cannot one-shot.
3. **Parameter sweeps.** About 600 configurations were evaluated at 24 seeds per ordered matchup. They covered the damage scale G, exponent p, rotational weight k_rot, defense effectiveness e, soft cap x_cap, collision energy loss and the stat spin-drain weight. The objective combined:
   - distance to the target matrix,
   - distance of each top's aggregate win rate from 50 %,
   - a penalty for Inferno vs Tempest ending in under 12 s.

   The chosen set was then checked on 500 seeds and on a second, unseen seed set.
4. **Final values:**
   - **G 50, p 0.5, k_rot 10, x_cap 2, e 0.5, K 100, v_min 0.03 m/s.**
   - Re-arm 1 mm / 80 ms.
   - Stat spin-drain weight 0.5.
   - Knockout: η_climb 0.8, λ_lift 0.7, lift window 0.25 s, k_stab 0.5, using the existing 1.6 cm lip.
   - Collision energy loss stays at the v0.1 value (0.6). Raising it shortens every battle and changes approved physics.
5. **Stat experiments (not applied).** Using the final combat parameters with 60 seeds per ordered matchup:
   - Titan health 90 → 70: no change. Phantom still cannot reach 700 HP before spinning out.
   - Titan stamina 65 → 50: no change. Titan's endurance comes from its ball tip and its defense-derived stability, not the stamina stat.
   - Inferno stamina 45 → 60: Inferno vs Tempest rose to 88 %, while Inferno vs Titan and vs Phantom stayed at about 0–2 %.

## Final results

### Matchup matrix: slot-averaged (seeds 1–500)

| Row beats column | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50.0 % | 0.0 % | 73.4 % | 0.4 % |
| **Titan** | 100.0 % | 49.7 % | 0.0 % | 100.0 % |
| **Tempest** | 26.6 % | 100.0 % | 50.0 % | 41.8 % |
| **Phantom** | 99.6 % | 0.0 % | 57.8 % | 49.7 % |

The validation seed set (100001–100500) matches within about 3 points: Inferno vs Tempest 72.8 %, Phantom vs Tempest 55.6 %, and every 0 % / 100 % cell unchanged.

### Per-top aggregate (seeds 1–500, 3,500 battles each, mirrors counted once)

| Top | Win % (all) | Win % (non-mirror) | Wins by burst / KO / spin | Losses by burst / KO / spin |
| --- | --- | --- | --- | --- |
| Inferno | 28.6 | 24.6 | 671 / 70 / 260 | 0 / 1 / 2498 |
| Titan | 64.3 | 66.7 | 0 / 0 / 2252 | 0 / 0 / 1245 |
| Tempest | 55.4 | 56.1 | 0 / 0 / 1939 | 1244 / 68 / 245 |
| Phantom | 52.1 | 52.5 | 578 / 0 / 1246 | 4 / 0 / 1665 |

### Finish types, durations and damage per matchup (seeds 1–500)

| Matchup | Avg s | Median s | P10–P90 s | Burst % | KO % | Spin % | Draw % | Winner health left | Winner stamina left | Avg collisions | Max hit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno vs Inferno | 29.0 | 30.7 | 21.7–33.8 | 0.2 | 0.6 | 99.2 | 0.0 | 447.2 HP (74.5%) | 1.7% | 4.6 | 66.8 |
| Inferno vs Titan | 26.5 | 26.9 | 23.3–28.8 | 0.0 | 0.0 | 100.0 | 0.0 | 572.7 HP (63.6%) | 31.0% | 10.6 | 52.0 |
| Inferno vs Tempest | 14.4 | 14.0 | 7.7–22.2 | 66.6 | 7.4 | 26.0 | 0.0 | 353.9 HP (59.0%) | 25.6% | 14.1 | 64.1 |
| Inferno vs Phantom | 24.5 | 24.9 | 20.6–27.2 | 0.4 | 0.0 | 99.6 | 0.0 | 303.2 HP (46.7%) | 21.6% | 10.1 | 57.8 |
| Titan vs Inferno | 26.4 | 26.9 | 23.5–28.6 | 0.0 | 0.0 | 100.0 | 0.0 | 571.5 HP (63.5%) | 31.1% | 10.7 | 52.0 |
| Titan vs Titan | 50.2 | 50.3 | 48.4–52.0 | 0.0 | 0.0 | 99.4 | 0.6 | 814.3 HP (90.5%) | 0.6% | 6.6 | 6.2 |
| Titan vs Tempest | 45.6 | 45.6 | 43.1–47.8 | 0.0 | 0.0 | 100.0 | 0.0 | 246.0 HP (41.0%) | 26.7% | 42.1 | 10.4 |
| Titan vs Phantom | 46.5 | 46.8 | 43.9–48.7 | 0.0 | 0.0 | 100.0 | 0.0 | 496.1 HP (55.1%) | 6.1% | 28.3 | 22.5 |
| Tempest vs Inferno | 14.7 | 14.2 | 7.9–22.4 | 66.6 | 6.2 | 27.2 | 0.0 | 349.3 HP (58.2%) | 25.5% | 14.2 | 64.3 |
| Tempest vs Titan | 45.6 | 45.6 | 43.0–47.8 | 0.0 | 0.0 | 100.0 | 0.0 | 243.2 HP (40.5%) | 26.8% | 42.2 | 10.4 |
| Tempest vs Tempest | 69.0 | 68.9 | 65.7–72.7 | 0.0 | 0.0 | 100.0 | 0.0 | 600.0 HP (100.0%) | 1.1% | 0.0 | 0.0 |
| Tempest vs Phantom | 41.8 | 41.3 | 31.4–50.6 | 60.4 | 0.0 | 39.0 | 0.6 | 301.8 HP (47.9%) | 22.3% | 37.4 | 27.7 |
| Phantom vs Inferno | 24.4 | 25.1 | 20.7–27.2 | 0.4 | 0.0 | 99.6 | 0.0 | 301.7 HP (46.4%) | 21.6% | 10.2 | 58.1 |
| Phantom vs Titan | 46.5 | 46.8 | 43.8–48.8 | 0.0 | 0.0 | 100.0 | 0.0 | 495.2 HP (55.0%) | 6.1% | 28.4 | 22.5 |
| Phantom vs Tempest | 42.3 | 43.0 | 31.9–50.5 | 55.2 | 0.0 | 44.6 | 0.2 | 278.1 HP (44.3%) | 24.2% | 37.3 | 27.3 |
| Phantom vs Phantom | 51.7 | 52.1 | 49.0–53.8 | 0.0 | 0.0 | 99.4 | 0.6 | 438.5 HP (67.5%) | 0.8% | 14.0 | 21.5 |

Across all 8,000 battles there were:
- **1,249 burst finishes** (15.6 %)
- **71 knockouts** (0.9 %)
- **6,670 spin finishes** (83.4 %)
- **10 draws** (0.1 %)
- **0 timeouts**
- **0 failures**: no guard trips, non-finite values or exceptions. The second seed set also had 0.

### Slot fairness
- Mirror matches give P1 between 50.0 % and 52.6 %, with a 500-battle standard error of about 2.2 points, plus a 0–0.6 % draw rate.
- Swapped ordered matchups agree within about 1–3 points.
- Damage for both tops is computed from the same pre-impulse contact report, and finishes are evaluated for both tops after the whole step.

## Assessment

What works:
- **The soft counter cycle emerges naturally and points the right way.**
  - Attack beats Stamina: Inferno bursts or knocks out Tempest in 73 % of battles, averaging 14 s.
  - Stamina beats Defense: Tempest outlasts Titan in 100 % of battles.
  - Defense beats Attack: Titan survives Inferno until Inferno spins out (100 %).
- **Phantom is the most even top**: 52 % aggregate, beating Inferno, close to even with Tempest (58 %), and losing to Titan.
- **Several paths to victory:** bursts decide 67 % of Inferno vs Tempest and 55–60 % of Phantom vs Tempest. Knockouts appear, rarely. Spin finishes decide the defensive matchups.
- **Distinct identities:**
  - Inferno wins fast or not at all.
  - Titan's battles are long, and it ends them with 55–64 % health left.
  - Tempest wins with high remaining stamina (~27 %).
  - Phantom wins through bursts and through stamina.

Discrepancies (not forced):
- **Titan is overpowered** (67 % non-mirror): it wins 100 % against Inferno and Phantom, not 65 % / 50 %.
  - No opponent can deal Titan's 900 HP, after its 95 defense, before running out of spin. The most is about 410 HP per battle from Phantom.
  - Titan's ball tip and high stability give it more endurance than Phantom, even though their stamina stats are equal.
- **Inferno is underpowered** (25 % non-mirror). It wins only against Tempest.
  - Its flat tip burns its spin in about 25 s, and in that time it deals about 330–350 damage to Titan or Phantom.
  - That is not enough to burst either of them (Phantom has 650 HP, Titan 900).
- **Results are too one-sided** (0 % / 100 % instead of 35 / 65) wherever stamina decides the battle. Spin-down times vary by only a few seconds across seeds, so whichever top has the endurance edge wins every time. Combat randomness only appears where bursts are possible.
- **Durations:**
  - Even matchups land in or near the 30–60 s band (Titan and Phantom mirrors 50–52 s, Phantom vs Tempest 42 s).
  - Inferno vs Tempest is a 14 s "significant/overwhelming advantage".
  - The defensive matchup (Titan vs Inferno, 26 s) and the stamina-heavy matchup (Titan vs Tempest, 46 s) run shorter than their 45–75 s and 60–90 s targets.
  - Natural spin-down times were preserved as instructed.
- About 7 % of Inferno vs Tempest battles end in a knockout in the opening clash (within ~1–2 s).

## Recommendations (design decisions for the project owner)

1. **Rein in Titan's endurance edge rather than its health.** Possible levers:
   - Narrow the defense → stability mapping in `derive.ts` (0.25–0.9). Stability lowers the toppling speed, so defense currently doubles as stamina.
   - Give the Bastion Ball tip slightly more drive.

   Either would let Phantom win some stamina races and let bursts matter in Titan matchups.
2. **Give Inferno a little more time or reach,** without raising its damage (which would make Inferno vs Tempest a near-certain 5-second win):
   - Increase launch spin for high-speed tops slightly.
   - Reduce Rush Flat's spin friction.

   Either would let Inferno reach Phantom's and Titan's burst thresholds a fraction of the time.
3. **Add seed-sensitive variation to stamina races,** for example a slightly larger launch-power spread, or let the future launch-timing minigame supply it. That would turn 0 % / 100 % stamina matchups into probabilities.
4. **Future stadiums with knockout pockets** will make knockouts a real path to victory. The rim-escape model already supports a lower lip or a different slope per stadium.
