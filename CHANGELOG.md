# Changelog

All notable changes to SpinStrike are documented here.

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
