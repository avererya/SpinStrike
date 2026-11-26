# Changelog

All notable changes to SpinStrike are documented here.

## [0.3.0] — 2026-11-26 · Launch, Critical Hits & Combat Refinement

### Added
- **Launch minigame:** sweeping timing meter (≈1.25 s), Space/tap to launch, timeout = Poor. Zones Perfect 45–55 %, Great 30–70 %, Good 15–85 % (inclusive toward the better zone, configurable). Energy bonuses Poor 1.00, Good 1.03, Great 1.07, Perfect 1.10 multiply rotational energy (ω scales by the square root). Stamina is normalised to the energy actually launched. Quality and bonus are shown separately.
- **Seeded AI launch quality** (Poor 15 / Good 40 / Great 35 / Perfect 10 %), event-keyed and frame-rate independent.
- **Critical hits:** 5 % chance, 2× structural damage, one roll per damaging impact per top, event-keyed seeded RNG, no extra impulse or spin drain. Golden numbers, CRITICAL HIT label and stronger sparks (separate toggle). Crit statistics on the result card.
- **Spin-finish draw window** (0.25 s of simulated time): a second stop within it is a near-simultaneous draw; a defeated top cannot deal damage or cause a knockout. **Narrow victory** label at ≤ 2 % winner stamina. Accurate decisive-moment snapshots; the winner is never shown STOPPED. **Rematch** after a draw uses a new seed, a fresh launch and a new AI draw.
- **Rulesets:** v0.3 (default) and v0.2 legacy; `legacyV02Config()` reproduces v0.2 exactly (regression-tested on 32 recorded battles).
- **Blade exposure** ring property (Zephyr Halo 0.37).
- **Version display** (`v0.3.0 · commit`), `version.json`, Cloudflare `_headers` (no-cache HTML, immutable hashed assets) and a non-reloading "newer version" notice.
- **Developer panel:** launch, critical-hit, result and ruleset controls, "Load legacy v0.2 configuration". Config format v3; v1/v2 files migrate to the legacy ruleset.
- **Headless simulator:** `--legacy`, `--launch`, `--crits`, duration and early-finish statistics, crit statistics, draw reasons, mirror fairness with z scores. `scripts/tune-eval.ts` for balance sweeps.

### Changed
- **Stat → physics mapping:** defense no longer feeds stability or impact spin resistance; stability comes from the tip (+ weight); stamina now provides impact spin resistance.
- **Starter rebalance** (stats, tip stability and pivot friction, Blaze Fang strike, damage constants). See `docs/balance/BALANCE_REPORT.md`.
- iOS: toolbar-coloured page background, safe-area padding inside the toolbar, HUD backdrop blur removed (mitigation, unverified on device).

### Known issues
- Inferno vs Tempest ≈ 94 % (target 65 %). iOS blur and deployment unverified. See README.


## [0.2.0] — 2026-11-25 · Combat & Finishes

### Added
- **Health and combat stats.**
  - `deriveTopCombat()` maps the stats to combat values: max health = 10 × health stat, plus attack and defense.
  - Health is independent of stamina (rotational energy) and resets every battle.
- **Physics-based collision damage** (`src/sim/combat.ts`):
  - Damage depends on normal impact speed, reduced mass, the attacker's ring strike × spin, attack (linear) and defense (bounded K/(K + e·def)).
  - A severity exponent and a soft cap keep hits bounded.
  - There is no randomness and there are no class multipliers.
  - The formula is documented in the README.
- **Contact lifecycle:** one damaging impact per contact. A contact re-arms after a 1 mm separation, or after 80 ms for a hard re-approach during an unbroken contact.
- **Three finish types:**
  - **Burst** (health 0).
  - **Knockout:** a 2.5D rim-escape check at wall impacts, using outward speed × rim slope plus impact lift J/m against lip height × stability.
  - **Spin** (existing toppling).

  Both tops are evaluated after each full step. Simultaneous eliminations are draws. A top meeting several conditions on one step is classified burst > knockout > spin. The result is frozen, and combat is disabled after it.
- **Cinematic finishing presentation** (`src/render/finishFx.ts`):
  - Brief slow motion of the aftermath, an impact flash and a light camera shake.
  - The burst splits the model into its core, ring, disc and tip, which tumble and settle.
  - A knocked-out top flies over the rim and drops beside the stadium.
  - The banner reads BURST / KNOCKOUT / SPIN FINISH.
  - A developer toggle turns it off.
  - Reset and restart clear all debris and effects.
- **Combat feedback:** sparks and impact rings scaled by damage, plus optional floating damage numbers (pooled, off by default).
- **Combat HUD:** green health bar (current/max) and amber stamina bar (%), with icons and numbers, plus hits landed and damage dealt and taken. Speed and spin collapse behind a "details" button in phone portrait.
- **Result card:** winner, defeated top, finish type, duration, health and stamina left, damage dealt and hits for both tops, the strongest single hit, and the seed.
- **Developer panel:**
  - Combat section with all formula, contact and knockout parameters.
  - Knockout switch.
  - Presentation toggles: cinematic finishes and damage numbers.
  - Per-top max health, attack and defense.
  - Rim lip height.
  - Combat spin-drain weight.
- **Configuration format v2.** v0.1 files (version 1) are migrated on import: all values are kept, new values take their defaults, and the migration notes are shown. Invalid values are still rejected.
- **Headless combat simulator** (`npm run sim`):
  - Defaults to 500 seeds per ordered matchup (8,000 battles).
  - Reports the 4×4 matrix (by slot and slot-averaged), per-top aggregates, finish-type rates, duration mean, median and percentiles, the winner's remaining health and stamina, damage, collisions, max hit and failures.
  - Supports `--set` overrides and Markdown or JSON output.
- **Balance report** and saved runs in `docs/balance/`.
- **Tests:** 44 new tests, 104 in total (all 60 v0.1 tests unchanged). They cover:
  - health init, reset and clamping
  - attack and defense scaling and bounded defense
  - high vs low and glancing vs direct impacts
  - symmetric and asymmetric damage
  - repeated-contact prevention and legitimate re-hits
  - burst, spin and knockout detection
  - ordinary rim contact and overlap without a knockout
  - draws and deterministic classification
  - slot fairness, timeout and result immutability
  - seeded reproducibility
  - v2 validation and v0.1 migration
  - invalid numerical inputs
  - presentation lifecycle and cleanup
  - a v0.1 step-exact regression

### Changed
- `resolveTopPair()` also fills an optional `ContactReport`. The impulse maths is unchanged.
- The v0.1 attack/defense spin drain is now weighted by `collision.statSpinDrainWeight` (default 0.5; 1 = v0.1). With damage off and the weight at 1, v0.2 reproduces v0.1 battles step for step (`tests/regression.test.ts`).
- `BattleOutcome`: a win carries `finish: 'burst' | 'knockout' | 'spin'`, and a draw carries `finishes`. This replaces v0.1's `reason: 'spin-out'`. `BattleResult` also holds frozen per-top statistics, the strongest hit and the seed.
- Procedural top models now group their meshes into four part groups (core, ring, disc, tip). The appearance is unchanged.
- No v0.1 test needed modification.

### Known limitations
- Balance misses the provisional targets: Titan is overpowered (100 % vs Inferno and Phantom) and Inferno is underpowered (it wins only against Tempest). See `docs/balance/BALANCE_REPORT.md`.
- Real-device performance of v0.2 has not been verified.

## [0.1.0] — 2026-11-25 · Physics Sandbox

### Added
- **Physics engine** (`src/sim`), independent of rendering. Includes:
  - A fixed 240 Hz step with accumulator and interpolation, plus speed-based substepping for tunnelling protection.
  - Seeded launches and numerical guards.
  - Slope gravity and spin-driven tip traction that is strictly dissipative.
  - Rolling resistance, pivot friction and air drag.
  - A sleeping-top stability criterion, smooth precessing wobble, and gyroscopic tilt response to impacts.
  - Spin-aware impulse collisions with Coulomb friction, blade strike, impact spin loss, anti-overlap correction and contact hysteresis.
  - Wall collisions.
- **Stadium abstraction** (`StadiumSurface`) and the **Classic Bowl**: a parabolic basin with a steeper raised rim.
- **Four starter tops**, Inferno (Attack), Titan (Defense), Tempest (Stamina) and Phantom (Balance), as data-driven definitions built from separate tip, disc, ring and core parts. Gameplay stats map to physics through `derive.ts`.
- **Battle lifecycle**: stamina win, same-step draw, timeout at a configurable maximum duration, and a run-down after the result.
- **Three.js renderer**:
  - A stadium mesh sampled from the physics height function, with concentric markings, a metal lip and housing.
  - Procedural 3D tops with distinct ring silhouettes and emblems.
  - Shadows, an environment-lit metal look, motion trails, collision sparks and impact rings scaled to intensity, and visible tilt and wobble.
  - A fixed angled camera that refits for any aspect ratio, a pixel ratio capped at 2, pooled effects and resource disposal.
- **Sandbox UI**:
  - Top selection for both sides, mirror matches, start, pause/resume, reset, same-seed restart and new seed.
  - Speeds of 0.25×, 0.5×, 1× and 2×.
  - A HUD showing energy %, speed, angular velocity, hits and time.
  - A result card.
  - A responsive layout for desktop and for phone portrait and landscape.
- **Developer panel**: stadium, collision, battle and per-top parameters, reset to defaults, JSON export, validated JSON import, and debug toggles (velocity, boundaries, contacts, path history, slope field, FPS and physics statistics).
- **Headless simulator** (`npm run sim`) and `runBatch()` for repeated battles and statistics.
- **Tests**: 60 Vitest tests covering:
  - momentum
  - collision resolution
  - mass-dependent displacement
  - direct vs glancing impacts
  - rotational energy depletion
  - energy non-creation
  - arena slope
  - friction
  - numerical safety
  - seeded reproducibility
  - battle termination (win, draw, timeout)
  - configuration validation
  - simulation-speed independence
  - high-speed collisions
  - extended runs of all 16 matchups
- Documentation: README, GAME_DESIGN.md, CHANGELOG.md.

### Known limitations
See the README's "Known limitations" section. The most important are that real-device visuals and performance have not been verified, and that stamina-only victories currently produce a fixed class order.
