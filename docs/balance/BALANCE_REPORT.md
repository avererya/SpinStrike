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
