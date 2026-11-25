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
- Three eventual victory conditions: **stamina depletion**, **health depletion (burst)** and **stadium knockout**.
- All tops, artwork, names and branding are original. No copyrighted assets or official branding from existing franchises.

## Starter tops

| Top | Class | Identity | Health | Attack | Defense | Stamina | Speed | Weight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inferno | Attack | Red/black/silver, jagged ring. Fast and aggressive, hits hard, burns spin | 60 | 90 | 35 | 45 | 85 | 50 |
| Titan | Defense | Blue/silver, thick armoured ring. Heavy, stable, settles in the centre | 90 | 40 | 95 | 65 | 30 | 95 |
| Tempest | Stamina | Emerald/gold, smooth ring. Efficient with long endurance | 60 | 35 | 50 | 100 | 50 | 55 |
| Phantom | Balance | Purple/silver/black, moderate winged ring. Well-rounded | 65 | 65 | 65 | 65 | 65 | 65 |

- Names, classes, visual identity and physical identity are **[Confirmed]**.
- The stat values are **[Provisional]** relative design values (0–100), not physical units.
- Part names (Rush Flat, Bastion Ball, Needle Point, Vector Semi-Flat; Blaze Fang, Aegis Wall, Zephyr Halo, Eclipse Wing; disc and core names) are **[Implementation assumption]**: original placeholder names.
- All starter tops spin right (clockwise from above). **[Implementation assumption]**

## v0.1 scope [Confirmed]

A physics sandbox with two tops in the Classic Bowl, a developer interface, and a stamina-only result (win, draw when both stop on the same step, timeout at the maximum duration). Everything else (career, economy, abilities, launch minigame, health/burst, knockout, extra stadiums) is out of scope.

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
  - health → unused in v0.1
- Classic Bowl: 0.20 m radius, 0.03 m depth, raised rim from 82 % of the radius rising a further 0.018 m. **[Provisional]**
- Launch: tops start opposite each other at 62 % of the radius, travelling around the bowl in their natural drive direction angled 0.35 rad inward, with ±0.25 rad and ±4 % seeded spread. **[Implementation assumption]** The launch-timing minigame will later modify launch energy.

## Observed v0.1 behaviour (headless, 50 seeds per matchup) [Provisional, not balance]

- Average battle lengths: even matchups about 48–52 s (Tempest mirror about 73 s), Inferno matchups about 20–29 s.
- With stamina as the only victory condition, cross-class results are almost fully determined by endurance: Tempest > Titan > Phantom > Inferno.
  This is expected until burst and knockout exist, and it has not been artificially balanced.

## Open questions for design

1. Should Attack tops be able to win by stamina at all in the final game, or rely on burst/knockout?
2. Is there a target spin-down time for a lone top of each class? These times anchor every other tuning value.
3. Should left-spin tops exist? The physics already supports `spinDirection = −1`, and opposite-spin contacts behave differently.
4. What is the intended size ratio between stadium and top? The Classic Bowl is currently 8× the top radius.
