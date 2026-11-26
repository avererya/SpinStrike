# SpinStrike — Game Design (living document)

This document records the long-term vision and the design decisions made so far. It labels each item as:

- **[Confirmed]**: a design decision from the project owner.
- **[Provisional]**: balancing values or tuning that are expected to change.
- **[Implementation assumption]**: an engineering choice made to fill a gap. Revisit it if it conflicts with the design.

## Vision [Confirmed]

- A browser-based spinning-top combat RPG with physics-based battles, collectible tops, interchangeable equipment, individual stat upgrades and competitive career progression.
- Playable on mobile and desktop browsers, with mobile considered from the start.
- 2.5D gameplay: 3D-rendered tops and stadiums, with movement mostly on a horizontal plane.
- Combat is autonomous and physics-based, with limited manual input. Progression and builds matter much more than reflexes.
- A timing-based launch gives a modest starting spin bonus (future).
- Four classes: **Attack, Defense, Stamina, Balance**. The player chooses one of four starter tops when starting a career.
- More tops can be purchased, earned or unlocked. Combat stats can be upgraded individually.
- Interchangeable battle rings, and possibly other components.
- Ranks: Bronze, Silver, Gold, Platinum, Diamond, Master, Champion.
- Multiple stadium shapes with meaningful physical differences.
- 1v1 battles, with 2v2 team battles later.
- Manually activated special abilities (future).
- Evenly matched battles should generally last 30–60 s. Much stronger tops should be able to win in 10–15 s.
- Three victory conditions: **spin finish** (stamina depletion), **burst finish** (health depletion) and **knockout finish** (leaving the stadium). All three exist from v0.2.
- Top strength, equipment and build quality matter more than player reflexes.
- Players will eventually choose one of four starter tops. More tops are collectible and upgradeable.
- Interchangeable battle rings, competitive ranks, multiple stadium shapes and 2v2 team battles are planned.
- Timing-based launches and manually activated signature abilities come later.
- All tops, artwork, names and branding are original. No copyrighted assets or official branding from existing franchises.

## Starter tops

| Top | Class | Identity | Health | Attack | Defense | Stamina | Speed | Weight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | Attack | Red/black/silver, jagged ring. Fast and aggressive, hits hard, burns spin | 63 | 95 | 35 | 62 | 85 | 50 |
| Titan | Defense | Blue/silver, thick armoured ring. Heavy, stable, settles in the centre | 72 | 82 | 82 | 60 | 30 | 95 |
| Tempest | Stamina | Emerald/gold, smooth ring. Efficient with long endurance | 63 | 40 | 65 | 75 | 50 | 55 |
| Phantom | Balance | Purple/silver/black, moderate winged ring. Well-rounded | 69 | 72 | 65 | 67 | 65 | 65 |

- Names, classes, visual identity and physical identity are **[Confirmed]**.
- The stat values (v0.3 rebalance shown; v0.2 values are kept in `LEGACY_V02_STATS`) are **[Provisional]** relative design values (0–100), not physical units.
- Part names (Rush Flat, Bastion Ball, Needle Point, Vector Semi-Flat; Blaze Fang, Aegis Wall, Zephyr Halo, Eclipse Wing; disc and core names) are **[Implementation assumption]**: original placeholder names.
- All starter tops spin right (clockwise from above). **[Implementation assumption]**

## v0.1 scope [Confirmed, delivered]

A physics sandbox with two tops in the Classic Bowl, a developer interface, and a stamina-only result (win, draw when both stop on the same step, timeout at the maximum duration). The owner approved its movement, visuals, collision frequency and mobile performance after playtesting on an iPhone.

## v0.2 scope [Confirmed, delivered]

v0.2 is a combat sandbox. It adds:
- Independent health and stamina.
- Attack and defense that act through physics-based collision damage.
- Burst, knockout and improved spin finishes, each with a short cinematic presentation.
- A combat HUD and an expanded result card.
- Combat developer controls, with v0.1 configuration import.
- A headless balance simulator.

Permanent progression and everything in "Out of scope" in the README are excluded.

## Combat design (v0.2)

- **Health ≠ stamina.** [Confirmed]
  - Health is structural integrity. It is lost only through damaging collisions, and 0 health means a burst. It resets every battle, with no repairs or permanent damage.
  - Stamina is the existing rotational energy, and running out means a spin finish.
  - Health loss does not affect movement, attack or stability in v0.2, to avoid death spirals. [Confirmed]
- **Health scale:** max health = 10 × health stat. [Implementation assumption]
- **Damage emerges from physics.** [Confirmed principle] It depends on approach speed along the normal, reduced mass, the attacker's ring strike × spin, attack (linear) and defense (K/(K + e·def), never zero). There are no random critical hits and no class multipliers. The exact formula is in the README. The constants are **[Provisional]** tuning.
- **Contact lifecycle:**
  - One damaging impact per contact.
  - A contact re-arms after 1 mm of separation.
  - A hard re-approach during an unbroken contact counts after 80 ms.

  [Implementation assumption]
- **Combat spin drain:** v0.1's attack/defense spin-drain modifiers are kept but weighted at 0.5, so offense is not counted twice. [Provisional]
- **Knockouts** use a bounded 2.5D rim-escape estimate at wall impacts. Outward speed along the rim slope plus impact-induced lift (Δv = J/m) must clear the lip height, raised by stability. Knockouts are rare in the Classic Bowl by design (about 1 %). [Implementation assumption; rarity Confirmed]
- **Finish rules:** [Implementation assumption, consistent with spec]
  - Both tops are evaluated after the whole step.
  - Both eliminated on the same step is a draw.
  - One top meeting several conditions is classified burst > knockout > spin.
  - The result is frozen once decided.
  - The maximum duration gives a timeout with no winner.
- **Finishing presentation** is 1–2 s, separate from the simulation, and can be switched off in the developer panel. A burst separates the core, ring, disc and tip. [Confirmed direction; details are implementation assumptions]

## Soft counter system [Confirmed]

- Attack counters Stamina: Inferno should be able to destroy Tempest before endurance decides.
- Stamina counters Defense: Tempest should outlast Titan.
- Defense counters Attack: Titan should survive Inferno until Inferno exhausts itself.
- Balance: Phantom should be competitive with everyone.
- The balance must emerge from stats, physics and formulas. There are no hidden multipliers, forced outcomes or rubber-banding.
- A sufficiently upgraded top should be able to beat its natural counter.

**Provisional target win rates** (row beats column, equal upgrades, Classic Bowl):

| | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| Inferno | 50 % | 35 % | 65 % | 50 % |
| Titan | 65 % | 50 % | 35 % | 50 % |
| Tempest | 35 % | 65 % | 50 % | 50 % |
| Phantom | 50 % | 50 % | 50 % | 50 % |

**Provisional duration targets:**

| Matchup type | Target |
| --- | --- |
| Overwhelming advantage | 5–15 s |
| Significant advantage | 15–30 s |
| Evenly matched | 30–60 s |
| Defensive matchup | 45–75 s |
| Stamina-heavy matchup | 60–90 s |

**Status after v0.2:** the counter cycle emerges in the right direction, but the magnitudes are too extreme. Titan is overpowered and Inferno underpowered; see `docs/balance/BALANCE_REPORT.md`.

## Future signature abilities [Provisional concepts only: not implemented]

| Top | Ability | Concept |
| --- | --- | --- |
| Inferno | Hellfire Strike | Converts rotational energy into a powerful offensive attack |
| Titan | Iron Fortress | Temporarily increases defense and stability |
| Tempest | Eternal Cyclone | Temporarily reduces stamina consumption |
| Phantom | Phantom Rush | Temporarily increases movement and striking power |

Activating a signature ability and then landing a burst finish should eventually be an especially satisfying moment. The names, activation conditions and numbers are undecided. In the architecture, abilities would temporarily modify `TopPhysicsParams` / `TopCombatStats` and could trigger the existing finish presentation.

## Physics and design decisions

- Gameplay stats are kept separate from physical parameters. Stats map to physics through a single layer (`src/content/derive.ts`). **[Confirmed principle]**
- Equipment will modify a top's effective physical parameters without engine changes. **[Confirmed principle]**
- The engine uses SI internal units (m, kg, s, rad). **[Implementation assumption]**
- Fixed 240 Hz physics with seeded randomness, used only for launch perturbation. **[Implementation assumption]**
- Movement personality emerges from tip physics (contact offset × traction × spin), slope, momentum and wobble. **No opponent-seeking forces exist.** **[Implementation assumption, consistent with the spec]**
- Two documented, bounded, energy-paid approximations stand in for detail that circular collision cannot express:
  - **Blade strike:** jagged or winged rings convert surface slip into a separating impulse, paid for from spin. **[Implementation assumption]**
  - **Impact spin drain/resist:** attack raises how much spin an impact strips from the opponent, and defense reduces how much a top loses. This is a placeholder for the future health/burst system. **[Provisional]**
- The stat → physics mapping is **[Provisional]**:
  - weight → mass 30–58 g
  - speed → launch speed 0.3–1.1 m/s, traction ×0.85–1.2
  - stamina → passive decay ×2.0–0.75
  - defense → stability 0.25–0.9, restitution factor ×1.2–0.75, impact spin resistance 0–0.6
  - attack → contact friction 0.15–0.55 × ring factor, blade strike ×0.6–1.4, impact spin drain ×0.5–1.6
  - health → max health = 10 × stat (v0.2)
  - attack and defense also enter the damage formula directly (v0.2)
- Classic Bowl: 0.20 m radius, 0.03 m depth, raised rim from 82 % of the radius rising a further 0.018 m. **[Provisional]**
- Launch: tops start opposite each other at 62 % of the radius, travelling around the bowl in their natural drive direction angled 0.35 rad inward, with ±0.25 rad and ±4 % seeded spread. **[Implementation assumption]** The launch-timing minigame will later modify launch energy.

## Observed v0.1 behaviour (headless, 50 seeds per matchup) [Provisional, not balance]

- Average battle lengths: even matchups about 48–52 s (Tempest mirror about 73 s), Inferno matchups about 20–29 s.
- With stamina as the only victory condition, cross-class results are almost fully determined by endurance: Tempest > Titan > Phantom > Inferno.
  This is expected until burst and knockout exist, and it has not been artificially balanced.

## Open questions for design

Resolved by the v0.2 spec:
- ~~Should Attack tops be able to win by stamina at all, or rely on burst/knockout?~~ Attack tops are "most effective when defeating opponents quickly". Burst and knockout are their main paths, but spin wins are not prohibited.
- ~~Is there a target spin-down time for a lone top of each class?~~ Keep the v0.1 natural spin-down times for now and judge them by battle durations. The duration targets are listed above.

Still open:
1. Should left-spin tops exist? The physics already supports `spinDirection = −1`, and opposite-spin contacts behave differently.
2. What is the intended size ratio between stadium and top? The Classic Bowl is currently 8× the top radius.

New in v0.2. These need a design decision; see the balance report.

3. **Titan's endurance.** Defense currently also raises stability, which lowers the toppling speed. With its ball tip, that lets Titan outlast Phantom every time even though their stamina stats are equal. Should defense keep feeding stability this strongly, or should Titan's stamina come only from its stamina stat and parts?
4. **Inferno's window.** Inferno's flat tip burns its spin in about 25 s, which is too short to burst Phantom or Titan. Should the Attack class get more launch spin, a more efficient tip, or more damage (which would make Inferno vs Tempest a near-certain 5-second win)?
5. **Stamina races are nearly deterministic** (seed variation changes spin-out times by only a few seconds). Should launch variance increase, or should the future launch-timing minigame supply this variation?
6. **Opening-clash knockouts.** About 7 % of Inferno vs Tempest battles end in a knockout within the first second or two. Is that acceptable drama, or should launches start further from the rim?
7. **Health scale** (×10 per stat point) and per-hit damage scale (typical hits 5–60 HP): do they read well? They are purely presentational relative to the formula.

## v0.3 scope [Confirmed, delivered]

Launch minigame, seeded AI launch quality, critical hits, spin-finish draw window, narrow victories, draw rematch, starter rebalance, version display and iOS mitigations. See the CHANGELOG.

### Confirmed decisions (v0.3 spec)
1. Launch quality multiplies rotational **energy** (Poor 1.00, Good 1.03, Great 1.07, Perfect 1.10), not ω. [Confirmed]
2. Launch zones: Perfect 45–55 %, Great 30–70 %, Good 15–85 %. [Confirmed]
3. AI launch distribution: Poor 15 %, Good 40 %, Great 35 %, Perfect 10 %, seeded. [Confirmed]
4. Critical hits: 5 % base chance, 2× structural damage only, one roll per damaging impact per top. [Confirmed]
5. Starter rebalance targets: Inferno vs Titan 35 %, Inferno vs Tempest 65 %, Titan vs Tempest 35 %, other pairs 50 %. No hidden class multipliers, forced winners, rubber-banding, matchup overrides or random stamina loss. [Confirmed]
6. Inferno is a glass cannon; Titan loses its overlapping defense, stability and stamina advantages. [Confirmed]
7. Draw window 0.25 s of simulation time (changed to 0.10 s in v0.3.1 after playtesting); the defeated top cannot deal damage. [Confirmed]
8. Narrow victory label at ≤ 2 % winner stamina (presentation only). [Confirmed]
9. A draw offers a rematch with a new seed, fresh launch and new AI draw. [Confirmed]
10. Mirror matches must show no P1/P2 bias. [Confirmed]

**Implementation assumptions:** blade exposure on ring parts; stability from tips; stamina-based impact spin resistance; `V03_COLLISION` defaults; sweep 1.25 s and 8 s timeout.

**Status after v0.3.1:** Inferno vs Tempest ≈ 70 %, Titan vs Tempest ≈ 30 %, draws 2.3 % (mirrors 1–8 %). Tempest's ring is a deflective profile (`damageCapFactor` 0.45, `impactSpinLossFactor` 1.5), reusable for future equipment; its stats were lowered (health 63, stamina 75) to keep Titan and Phantom competitive. [Implementation assumption]

**Status after v0.3:** Titan vs Inferno/Tempest and the Phantom matchups are close to target; Inferno vs Tempest is ≈ 94 % (target 65 %). Draw rates in mirrors are high at 0.25 s (consider 0.1 s).


## v0.4 scope: progression foundation [Confirmed, delivered]

Approved design requirements and provisional values are listed separately in `docs/PROGRESSION.md`.

**Loop:** Garage → Quick Battle → rewards → upgrade → level up → advance career.

**Approved:** one currency (Credits); account-wide career rank vs per-top level/XP/upgrades; levels 1-30 with XP 100 + 25(L-1); six attributes x ten ranks with costs 100/200/350/500/750/1000/1500/2000/3000/4500 (Common) and rarity multipliers 1/1.25/1.5/2; rank-10 bonuses Health +50 %, Attack +40 %, Defense +40 %, Stamina +30 %, Speed +25 %, Crit +20 points (5 % to 25 %); level gates for upgrade ranks (L1:2, L5:4, L10:6, L15:8, L20:9, L25:10); rewards by rank tier and difficulty multipliers; outcome shares (win 100 %, defeat 5 %/10 %, draw 15 %/25 %, quit 0); no energy, repair costs, premium currency or progression loss.

**Provisional:** 500 starting Credits; Bronze win requirements 10/20/30; difficulty launch distributions; Bronze opponent build bands; Expert 2x multiplier (under review); the stat-mapping ceiling of 150.

**Future (not implemented):** equipment, signature abilities (levels 10 and 20 reserved), shop, more tops and stadiums, championships, bosses, achievements, cosmetics, multiplayer.
