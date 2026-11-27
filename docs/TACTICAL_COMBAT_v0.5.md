# SpinStrike v0.5.0: Tactical Combat & Intelligent AI

This report covers what v0.5 adds, how it works physically, how the AI decides, and what the simulations found. Every number comes from the headless simulator running the real engine. Raw tables are in [`docs/balance/v0.5/`](balance/v0.5/).

## 1. Summary

- **Two abilities, identical for both sides.**
  - **Directional Boost:** 3 charges, 3 s cooldown, strength 33–100 %, costing 1–3 % of launch spin energy.
  - **Defensive Brace:** 2 charges, active for 1.5 s, 5 s cooldown from activation, −30 % damage and −25 % knockback, no stamina cost.
  - Charges never regenerate and refill at the start of each battle.
- **Abilities are on in Quick Battles.** The AI opponent uses the same validated commands, charges, costs and cooldowns as the player.
- **Tactical AI** with reusable class personalities and four difficulty skills. Difficulty never changes stats or charges.
- **Passive combat is unchanged.** 32,000 passive battles (seeds 100001–102000) reproduce the v0.4.1 report exactly, metric for metric: counters 70.0 / 71.3 / 58.7 %, no hit by 20 s 4.5 %, sync ≥ 10 s 0.2 %.
- **32,256 tactical battles** across 12 difficulty pairings. The difficulty order holds in every pairing: Easy < Normal < Hard < Expert.
  - Expert stays beatable: a passive player still wins 46 % against it.
  - Battles stay stable: draws ≤ 2.1 %, no hit by 20 s 2.0–4.3 %, sync ≥ 10 s ≤ 0.3 %.
- **Speed upgrades are now useful in passive combat** (new `v0.5` ruleset, upgrade part only). At rank 10 the gain is Inferno +7.3, Phantom +5.5, Tempest +1.0 and Titan −0.3 points. Under v0.4.1 the gain ranged from −5.5 to +0.2.

## 2. Directional Boost

### Input
- Press anywhere in the stadium, drag, and release. You do not need to touch your own top.
- An arrow is drawn from your top, showing strength and stamina cost. The battle never slows down.
- Strength comes from drag length as a fraction of the displayed stadium diameter:
  - below 6 % the gesture is cancelled;
  - at 36 % or more it reaches 100 %;
  - in between it scales linearly from 33 % to 100 %.

  Because the length is normalised, the same gesture gives the same strength on any screen.
- The screen drag is converted to a floor direction by inverting the camera's local projection, so the angled camera does not skew the aim.
- **Desktop:** hold the arrow keys to aim (strength builds over 0.9 s) and release them all to fire. Escape cancels.
- **Cancellation:** a second finger, `pointercancel`, lost pointer capture, pause, backgrounding (which also auto-pauses), window blur, resize and orientation change all cancel the aim. Nothing is consumed when a gesture is cancelled.
- On release, the battle validates the request again: phase, top in play and spinning, charges, cooldown, strength, direction and stamina. A rejected request shows a short reason and consumes nothing.

### Physics
- A boost is an impulse along the requested direction: `J = strength × 0.06 N·s × boostPower`, so `Δv = J / m`.
  - It adds to the current velocity. Heavier tops gain less speed.
  - There is no homing and no auto-targeting.
- The cost (1–3 % of the battle's launch rotational energy, linear in strength) is removed from spin.
- The kinetic energy a boost adds is capped at 90 % of the energy paid. If an impulse would add more, it is scaled down by solving the quadratic, so **a boost never creates energy**.
- `boostPower = lerp(0.5, 1.5, speed / 100)` is Speed's only effect on Boost. There are no overlapping bonuses.
- Why 0.06 N·s: the tip drive pulls a top back to its driven path at about μ·g (1.2–5 m/s²). Smaller impulses were erased within roughly 0.2 s and changed nothing.
- Full-strength Δv: Inferno ≈ 1.9 m/s (energy-capped), Phantom ≈ 1.4, Tempest ≈ 1.4 and Titan ≈ 0.85 m/s.
- A boost is refused if it would take the top to or below its toppling energy.

## 3. Defensive Brace

- **Activation:** one tap, B or Shift. It can be combined with Boost on the same tick.
- **Damage:** final damage (after criticals and caps) is multiplied by 0.7 for ordinary and critical hits alike. The prevented damage is tracked.
- **Knockback:** the top–top normal impulse and the blade-strike impulse are multiplied by 0.75. This is a more inelastic contact. The impulse is never below the inelastic minimum, so momentum between the tops is conserved, no energy is added, and the tops are never pulled together.
- **Timing:** Brace runs on simulation ticks, so it pauses with the battle. It cannot be re-activated while active (no stacking).
- **Limits:** no heal and no invulnerability. Tests check both.

## 4. Determinism and architecture

- **Commands:** every activation is a command `{tick, slot, ability, dirX, dirY, strength}`. Live input, the AI and sandbox scripts all go through `World.applyCommand`. Validation is pure (`validateCommand`).
- **Replay:** accepted commands are logged. Seed + configuration + command log replays a battle bit-exactly without the AI (tested).
  - The log keeps the requested direction unnormalised, because re-normalising a unit vector can change the last bit.
  - Sandbox "Replay (same seed)" re-applies your recorded commands, so it reproduces the battle exactly.
- **Layers:** input (`ui/tacticalUi.ts`, `ui/app.ts`) → validation and simulation (`sim/tactics.ts`, `sim/world.ts`) → presentation (`render/sceneRenderer.ts`: boost trail, blue Brace shield, impact pulse; cosmetic only).
- **AI:** `ai/tacticalAi.ts` reads only `sim/observation.ts`. It uses its own keyed RNG stream (`aiTactics`), independent of combat, crits and launches.

## 5. Tactical AI

### What it observes
`Observation` contains:
- positions, velocities, health and stamina fractions;
- ability state;
- the stadium radius;
- the time since the last contact;
- each top's public physical characteristics: mass, radius, attack, defense, boost authority, and tip sliding deceleration.

It contains **no** seed, RNG state, impact counter, critical roll, script or opponent intention.

### How it decides
At each decision interval the AI does the following:
1. **Predicts** contact time and approach speed from the current relative motion, with a skill-dependent heading error and a short horizon (0.45–1.2 s).
2. **Scores candidate actions:**
   - Brace before a predicted impact (timing quality depends on skill);
   - evade (perpendicular, blended toward the centre);
   - centre recovery near the rim;
   - interception, planned over lead times with the tip's sliding deceleration;
   - knockout attempts against an opponent near the rim;
   - orbit breaking after long no-contact stretches;
   - counter-attacks right after an exchange;
   - a Brace-then-Boost combo.
3. **Adjusts the scores** for personality, matchup aggression, health and stamina advantage, the opponent's active Brace (skilled AIs wait it out) and a charge budget across the expected battle length.
4. **Checks rim safety:** the AI predicts where its own boost would carry it and penalises paths that leave the stadium. Low skill ignores this.
5. **Acts on the best option** if it clears the difficulty's threshold, after a reaction latency. Low skill sometimes sends a boost 40–90° off, or blunders.

### Personalities
Personalities are reusable profiles. A top can name its own profile with `TopDefinition.tacticalProfile`.

| Profile | Default for | Character |
|---|---|---|
| Striker | Inferno (Attack) | Intercepts, attempts knockouts, breaks orbits early, rarely evades. |
| Bulwark | Titan (Defense) | Braces readily, recovers to the centre, counter-attacks, intercepts little. |
| Endurer | Tempest (Stamina) | Conserves stamina, evades, rarely attacks. |
| Tactician | Phantom (Balance) | Adapts: presses when behind or out-damaging, protects a lead. |

### Learned matchup knowledge
- Most boosts cost more stamina than they gain in spin-finish battles.
- The value of each tactic differs strongly by matchup. For example:
  - an intercept in the Titan mirror is −15 points;
  - an orbit break in the Titan mirror is −34 points;
  - a knockout attempt by Tempest against Inferno is +33 points.
- `scripts/tactical-learn.ts` measured each tactic in isolation: 400 battles per class pair and tactic, against a passive opponent, relative to the same AI doing nothing.
- The result is `MATCHUP_KNOWLEDGE`, with entries within ±0.3 of neutral dropped as noise.
- Higher difficulties weight it more (Easy 0, Normal 0.55, Hard 0.75, Expert 1), the way an experienced player learns matchups. It is public, class-level knowledge.

### Difficulty (skill only)

| | Decision interval | Reaction | Prediction error | Look-ahead | Mistakes | Brace timing | Planning | Knowledge |
|---|---|---|---|---|---|---|---|---|
| Easy | 0.70 s | 0.35–0.65 s | ±0.55 rad | 0.45 s | 35 % | 0.15 | 0.1 | 0 |
| Normal | 0.35 s | 0.22–0.38 s | ±0.25 rad | 0.8 s | 8 % | 0.5 | 0.6 | 0.55 |
| Hard | 0.22 s | 0.14–0.24 s | ±0.12 rad | 1.0 s | 4 % | 0.78 | 0.8 | 0.75 |
| Expert | 0.15 s | 0.10–0.16 s | ±0.05 rad | 1.2 s | 0 % | 0.95 | 1.0 | 1.0 |

Difficulty also sets the career AI's launch quality, as in v0.4, and its **launch aim**:
- **Easy** aims anywhere (±45°, 0–30° tilt).
- **Normal** keeps the v0.4.1 range.
- **Hard and Expert** aim near the aim that suits their top best, from the v0.4.1 aim evaluation, with spreads of ±18°/±8° and ±8°/±4°.

## 6. Tactical simulations (32,256 battles)

`npm run tactics -- --seeds 84 --seed 900001`. Each pairing covers 16 ordered matchups × 84 seeds × both orientations. Full table: [`tactical-sim-seeds-900001-900084.md`](balance/v0.5/tactical-sim-seeds-900001-900084.md).

| Pair (x vs y) | x win share | KO / burst / spin % | Duration s | No hit by 20 s | Boosts / Braces (x) | Boost → hit (x) |
|---|---|---|---|---|---|---|
| Easy vs passive | 45.2 % | 4.8 / 30.3 / 63.1 | 38.7 | 2.6 % | 0.83 / 0.19 | 42 % |
| Normal vs passive | 49.7 % | 6.7 / 31.4 / 60.4 | 38.1 | 4.3 % | 0.90 / 0.23 | 54 % |
| Hard vs passive | 50.8 % | 13.5 / 29.5 / 55.8 | 36.0 | 3.8 % | 1.31 / 0.45 | 60 % |
| Expert vs passive | 53.7 % | 13.3 / 30.8 / 53.8 | 35.8 | 3.9 % | 1.24 / 0.69 | 64 % |
| Normal vs Easy | 54.7 % | 8.3 / 29.0 / 61.1 | 37.3 | 2.3 % | 0.92 / 0.23 | 54 % |
| Hard vs Normal | 51.3 % | 15.2 / 27.9 / 55.1 | 35.1 | 3.5 % | 1.26 / 0.43 | 60 % |
| Expert vs Hard | 51.9 % | 19.6 / 28.6 / 50.0 | 33.4 | 3.6 % | 1.14 / 0.69 | 64 % |
| Expert vs Easy | 58.4 % | 14.7 / 27.8 / 55.4 | 35.3 | 2.2 % | 1.25 / 0.69 | 64 % |
| Easy, Normal, Hard and Expert mirrors | 50.0 % | 6–21 KO | 33–38 | 2.0–4.0 % | 0.8–1.2 / 0.2–0.7 | 43–62 % |

**Findings**
- **Skill matters, but modestly.** Abilities are a real edge in the right moment and a cost in the wrong one. A boost spends 1–3 % of launch spin in battles that mostly end on spin, so careless use loses.
  - The gaps between adjacent difficulties are 1–5 points. Expert vs Easy is 58 %.
  - Easy plays slightly *worse* than not using abilities at all (45 %). That is intended: Easy wastes boosts.
- **Knockouts become a real finish.** The KO share rises from 3.6 % (passive) to 13–21 % at Hard and Expert. Boost→KO attribution is 7–9 % of battles.
- **Fairness.** Slots are balanced: every pairing is run in both orientations, and the mirrors come out at exactly 50.0 %.
  - Per top, Tempest is the strongest user of abilities (55–58 % in AI mirrors), because conserving and evading suits it. The other three sit at 46–51 %.
  - There are no hidden class modifiers. All tops share the same parameters.
- **Stability:** draws 1.2–2.1 %, no NaN, no guard trips, and charges are never exceeded (all covered by tests).

### Titan mirror
- The passive Titan mirror stays slow: 58.8 s, and 51.5 % of battles have no damaging hit by 20 s (200 seeds).
- Skilled AIs learned that boosting there is costly, so they barely boost:
  - Normal: 0.23 boosts per battle, 58.4 s, 50 %;
  - Expert: 0.02 boosts, 58.2 s, 51 %.
- Easy boosts more (2.6 boosts) and the mirror speeds up to 53.7 s with 18.5 % no-hit.
- A player can always break the stalemate with Boost, at a stamina price. Fixing the mirror itself needs a physics or design change and is listed under decisions.

## 7. Speed refinement

v0.4.1 found that Speed upgrades were neutral or harmful. Two parts of the mapping caused it:
- a wider tip drive;
- more traction.

Both make a top run a wider, more spin-wasting orbit. Eight mappings were tested at rank 10 (480 battles per top); see `docs/balance/v0.5/speed-ranks.md`.

**v0.5 ruleset** (the default; `v0.4.1` remains selectable):
- Drive radius and traction follow the top's **base** Speed rating.
- Speed **above the base** (upgrades) *tightens* the tip drive by 0.3 × Δ(speed/100). This is a more controlled, less wasteful driven path.
- Speed above the base still raises launch speed and Boost authority.
- Unupgraded tops are identical to v0.4.1 (tested for all four, and covered by the 32,000-battle regression).

Results against unupgraded starters, 1,200 battles per cell:

| Top | Passive v0.4.1, rank 0 → 10 | Passive v0.5, rank 0 / 1 / 5 / 10 | Tactical v0.5 (Normal AI), rank 0 → 10 |
|---|---|---|---|
| Inferno | 47.8 → 45.2 (−2.6) | 47.8 / 50.1 / 54.4 / 55.2 (+7.3) | 50.3 → 54.7 (+4.4) |
| Titan | 51.3 → 49.5 (−1.8) | 51.3 / 50.5 / 50.6 / 51.0 (−0.3) | 49.5 → 50.0 (+0.5) |
| Tempest | 51.8 → 52.0 (+0.2) | 51.8 / 51.8 / 50.5 / 52.8 (+1.0) | 52.3 → 52.8 (+0.5) |
| Phantom | 49.0 → 43.5 (−5.5) | 49.0 / 49.8 / 50.8 / 54.5 (+5.5) | 48.0 → 52.4 (+4.4) |

- Speed is worth the most to the fast tops. Titan's +25 % is only +7.5 stat points on a base of 30.
- The +25 % maximum is unchanged.

## 8. Fully upgraded balance

All six attributes at rank 10, full vs full, 240 battles per cell ([`full-builds-percent.md`](balance/v0.5/full-builds-percent.md)):

| | Inferno | Titan | Tempest | Phantom |
|---|---|---|---|---|
| Passive overall (v0.5) | 50.9 % | **62.2 %** | **35.9 %** | 51.0 % |
| Tactical overall (Normal AI) | 51.4 % | 59.6 % | 39.3 % | 49.7 % |

- **Cause.** Upgrades add a *percentage of each top's own base stat*. Titan has the largest Health (80) and Defense (90) bases, so it gains the most points. Tempest's weak Attack (40) gains the fewest.
- **Option tested.** The same percentages, but of the **roster-average** base stat (`UPGRADE_BONUS_BASIS = 'reference'`), so every top gains the same points per rank. There is no class modifier. Results ([`full-builds-reference.md`](balance/v0.5/full-builds-reference.md)):
  - Passive: 41.4 / 56.0 / 44.7 / 57.8 %.
  - Tactical: 43.3 / 55.4 / 45.6 / 55.7 %.
  - The spread narrows from 26 points to 16 (passive) and 12 (tactical), but it does not reach 45–55 for every top. Inferno ends lowest.
- **Not switched on.** It changes the approved upgrade values of existing tops; for example, a maxed Titan loses Health and Defense points. The option is implemented and selectable in code and scripts, and the default stays `'percent'`. This needs your decision (section 10).

## 9. Rewards

Measured with `npm run economy:v05`: Bronze III, unupgraded starters, 600 battles per cell. Time per battle = duration + 25 s overhead. The player's abilities are driven by the AI at a given skill as a stand-in. [`docs/economy/v0.5-rewards.md`](economy/v0.5-rewards.md).

| Difficulty (multiplier) | Win % (abilities unused / Normal-skill / Hard-skill) | Credits per hour | XP per hour |
|---|---|---|---|
| Easy (0.75×) | 51.3 / 48.7 / 52.5 | 2,199–2,410 | 1,173–1,277 |
| Normal (1.0×) | 43.2 / 43.3 / 44.7 | 2,558–2,767 | 1,360–1,466 |
| Hard (1.1×) | 41.7 / 38.5 / 38.2 | 2,713–2,870 | 1,467–1,538 |
| Expert (1.2×) | 35.2 / 33.2 / 35.8 | 2,560–2,812 | 1,399–1,524 |

- With the temporary multipliers, Normal, Hard and Expert pay about the same per hour (±6 %). Easy pays about 13 % less.
- The harder AI is offset almost exactly by the higher multiplier. No difficulty is an exploit, but Expert is not more rewarding than Hard per hour.
- **Recommendation:** keep 0.75 / 1.0 / 1.1 / 1.2. The evidence does not *clearly* call for a change.
- If you want Expert to pay noticeably more per hour than Hard, 1.3× would add about 8 %. That needs your approval.

## 10. Decisions that need your approval

1. **Upgrade bonus basis.** Switch from "% of own base" to "% of roster-average base" (`UPGRADE_BONUS_BASIS`)?
   - Full-vs-full spread goes from 36–62 % to 41–58 %.
   - It changes the effective stats of already-upgraded tops.
   - Recommended, but it is not on.
2. **Speed upgrade mapping (on by default in the `v0.5` ruleset).** Upgrade Speed now tightens the tip drive instead of widening it. Unupgraded tops are unchanged. Please confirm; `v0.4.1` is still selectable in the sandbox.
3. **Expert reward multiplier:** keep 1.2× (recommended), or raise it to 1.3×.
4. **Titan mirror:** still slow and needs a physics or design change in a later version. Options include tip or ring tuning for Titan, or a stadium feature.

## 11. Verification

- 267 automated tests pass (34 new tactical tests plus updated career, config and save tests). Typecheck and production build are clean.
- **Visual playtests** were run with Playwright in an **emulated** iPhone 13 (portrait and landscape) and in desktop Chromium at 1440×900. Screenshots and recordings were made.
  - Not verified on a physical iPhone.
  - Not verified on the live deployment.
