# SpinStrike — v0.1 Physics Sandbox

SpinStrike is a browser-based, physics-driven spinning-top combat game. Tops, names and art are all original.
This repository holds **v0.1**: a development sandbox in which two procedurally modelled 3D tops
battle autonomously in a concave stadium. It is a foundation for later milestones, not the
player-facing game.

- **Stack:** TypeScript (strict), Vite, Three.js, a custom physics engine, HTML/CSS UI, and Vitest.
- **Runs entirely client-side.** There is no backend. The production build is a static `dist/` folder that Cloudflare Pages can host.
- **Physics is independent of rendering.** `src/sim` has no Three.js or DOM imports, so it runs the same in the browser, in tests and in the headless simulator.

---

## Quick start

Requires **Node 18+** (Node 20 recommended, which is what Cloudflare Pages uses).

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc`), then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc` only |
| `npm run sim` | Headless battle statistics (see below) |

### Production build and deploy

```bash
npm run build      # outputs static files to dist/
```

Cloudflare Pages settings: build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=20`.
The build uses relative asset paths (`base: './'`), so it also works from a sub-path.

### Headless simulator

```bash
npm run sim                          # all 16 matchups × 20 seeds
npm run sim -- --battles 50          # more seeds per matchup
npm run sim -- --a inferno --b titan # one matchup
npm run sim -- --seed 1000 --max 120 # seed range start / max duration (s)
npm run sim -- --solo                # each top alone: spin-down reference
npm run sim -- --json                # machine-readable output
```

For each matchup it reports the average, minimum and maximum battle duration, the stamina outcomes (wins, draws and timeouts), the average collision count, the maximum translational speed, and any unexpected simulation failures (non-finite values or numerical-guard trips). These numbers are for **physics analysis, not game balance**.

---

## Using the sandbox

**Battle setup (toolbar)**
- **Player / Opponent:** choose any of the four starter tops on each side. Mirror matches are allowed.
- **Start** launches both tops. **Pause/Resume** freezes the simulation. **Reset** returns to the launch positions with the same seed, without starting.
- **↻ Same seed** restarts immediately with the same seed, which reproduces the battle exactly.
- **⚄ New seed** restarts immediately with a new random seed.
- **0.25× / 0.5× / 1× / 2×** sets the simulation speed. Speed never changes the outcome of a seeded battle.
- Keyboard: `Space` starts or pauses the battle and `R` restarts it with the same seed.

**Battle information (HUD):** for each top it shows the name and class, remaining rotational energy (%), translational speed (m/s), angular velocity (rad/s, with rpm on hover) and hit count. It also shows the elapsed battle time and the seed.

**Result:** the battle ends when a top stops spinning (that top loses). It is a draw when both tops stop on the same physics step, and a timeout when the maximum duration is reached with both tops still spinning. After the result the tops keep running down for a few seconds so you can watch them.

### Developer panel (⚙)

Changing any value rebuilds the battle with the current seed (not started), so the effect of each change is reproducible. Hover over a control to see its description.

| Group | Controls |
| --- | --- |
| Debug visualisation | Velocity vectors, collision boundaries, recent contact points, movement path history, stadium slope field (arrows point downhill and are coloured by steepness), FPS, physics statistics (steps per frame, substeps, CPU time per step, guard trips, total energy). All are off by default. |
| Stadium | **Slope** (bowl depth, m), **surface friction** (×), **wall restitution** |
| Collisions | **Collision restitution**, **collision energy loss** (×) |
| Battle | **Maximum duration** (s) |
| Player / Opponent top | **Mass** (kg), **initial rotational energy** (J), **initial translational velocity** (m/s), **tip friction** (traction μ), **rotational energy decay** (×), **stability** (0–1), **wobble intensity** (rad). Edited values are marked *edited*, and each top can be reset on its own. |
| Configuration | **Reset all to defaults**, **Export JSON** (downloads the file, copies it to the clipboard and shows it), **Import JSON** (paste it or pick a file). Imports are fully validated, and any errors are listed. |

---

## Architecture

```
src/
  sim/                 Physics engine. Pure TS: no Three.js, no DOM.
    units.ts           Unit conventions, gravity, safety limits
    rng.ts             Seeded PRNG (mulberry32)
    topParams.ts       TopPhysicsParams: effective physical parameters
    body.ts            TopBody: mutable per-top state (allocation-free fields)
    dynamics.ts        Per-top forces: slope gravity, tip drive, friction, wobble, numerical guards
    collision.ts       Top–top and top–wall impulse resolution, collision events
    world.ts           Fixed-step world: launch, substepping, event queue
    battle.ts          Battle lifecycle and stamina result (win / draw / timeout)
    runner.ts          Accumulator-based fixed-step driver (speed, pause)
    headless.ts        runBatch(): repeated battles + statistics
    stadium/
      types.ts         StadiumSurface interface (height, gradient, friction, wall)
      classicBowl.ts   Classic Bowl implementation
  content/             Data-driven game content
    stats.ts           Gameplay stat types (0–100 design values)
    parts.ts           Tip / ring / disc / core part definitions
    tops.ts            The four starter tops
    derive.ts          The ONLY mapping from gameplay stats + parts → physics params
  config/              Sandbox configuration
    params.ts          Tunable-parameter specs (shared by UI and validation)
    sandboxConfig.ts   Config shape, defaults, overrides, BattleOptions builder
    validate.ts        JSON import validation
  render/              Three.js presentation (reads sim state, never writes it)
    sceneRenderer.ts   Scene, lights, camera framing, interpolation, disposal
    stadiumMesh.ts     Stadium mesh sampled from the physics height function
    topModels.ts       Procedural top models built from separate parts
    effects.ts         Pooled trails, sparks and impact rings
    debugDraw.ts       Debug overlays
    coords.ts          Sim ↔ Three.js coordinate mapping
  ui/                  DOM interface
    app.ts             Wiring: battle lifecycle, frame loop, controls
    hud.ts, devPanel.ts, dom.ts, styles.css
scripts/headless.ts    CLI for the headless simulator
tests/                 Vitest suites
```

**Data flow:** `TopDefinition` (stats + parts) → `deriveTopPhysics()` → `TopPhysicsParams` → developer overrides → `World`.
A future equipment system only has to change `TopPhysicsParams` (or the parts that feed `derive.ts`). The engine never reads gameplay stats.

**Extending stadiums:** implement `StadiumSurface` (`height`, `gradient`, `friction`, `wallContact`, `contains`). The renderer builds the mesh by sampling `height()`, so the visuals stay in sync automatically. Oval or polygonal boundaries, raised centres, pockets, multiple basins and friction zones all fit this interface.

**Extending collisions:** `resolveTopPair` works with circles today. Ring shape effects are approximated by per-ring parameters (`contactFriction`, `ringStrike`), and real non-circular contact can replace this function without changing the world loop.

---

## Physics model

The simulation is a **stable, physically inspired approximation**. It is not an exact rigid-body gyroscope.
Translation happens on the horizontal plane. Height and orientation come from the stadium surface and the tilt state.

### Internal units

SI throughout: **metres, kilograms, seconds, radians**. Velocities are in m/s, spin in rad/s, energy in J and forces in N.
Typical values: bowl radius 0.20 m, tops 0.025 m in radius and 0.04–0.06 kg, launch spin about 550–700 rad/s (5–6.5k rpm).
The plane is (x, y) with +z up, and positive ω is counter-clockwise from above. "Right spin", which the starter tops use, is clockwise from above (ω < 0).
Gameplay stats (0–100) are not physical units. `src/content/derive.ts` maps them to physical parameters.

### Time stepping

- **Fixed 240 Hz step.** Each frame adds real time × speed to an accumulator and runs whole steps (at most 64 per frame). Rendering interpolates between the last two steps.
- **Speed independence:** speed only changes how many fixed steps run per frame and never changes the step size, so seeded outcomes are identical at 0.25×–2× (covered by a test).
- **Substeps:** a step is split so that no top moves more than ¼ of a radius per substep (up to 8 substeps), which prevents tunnelling at high speed.
- **Determinism:** the seeded RNG is used only for launch perturbation. The engine never calls `Math.random`.

### Forces on a spinning top (`dynamics.ts`)

1. **Slope gravity.** The horizontal acceleration is −g·∇h/(1+|∇h|²), the tangential gravity component along the surface. This pulls tops toward the centre of the bowl.
2. **Tip drive (spin → movement).** The tip touches the floor at an offset **c** from the spin axis. The offset is `tipDriveRadius × (surface lean + axis tilt)`, capped at a lean of 0.2. The contact point slides over the floor at **v + ω ẑ×c**, and Coulomb friction (μ = tip traction × surface friction) opposes that slip.
   This pushes the top sideways, which is why tops run around the bowl, and it applies a counter-torque that drains spin.
   The force is capped so that one step can at most cancel the slip. The coupling is therefore **strictly dissipative**: spin can become motion, but energy is never created (covered by a test).
   - Wide, grippy flat tips (Attack) have a large offset and high traction. They drive hard and burn spin.
   - Sharp tips (Stamina) have almost no offset or traction, so they settle in the centre and spin for a long time.
   - Ball tips (Defense) and semi-flat tips (Balance) sit in between.
3. **Rolling resistance:** a small linear drag, scaled by surface friction.
4. **Passive spin loss:** tip pivot friction μₛ·N·r and air drag k·ω, scaled by the rotational-decay multiplier. The pivot radius grows with tilt, so friction rises as a top wobbles.

### Wobble and stability

- The **critical spin** comes from the sleeping-top criterion ω² = 4·m·g·l·I⊥ / I². Stability lowers the effective centre-of-mass height l. When |ω| falls to the critical spin, the top topples. That is when it "stops spinning" for battle purposes.
- **Tilt** relaxes toward a target of `baseWobble + wobbleIntensity·(ω_crit/ω)²`, and its direction **precesses** at the gyroscopic rate Ω = m·g·l/(I·ω). This gives slow, smooth wobble at high spin that turns wide and fast as the top dies. There is no random noise.
- Tip rocking (`baseWobble`, which is larger for flat tips) precesses the contact offset. That swings the drive direction and produces looping "flower" sweeps through the bowl.
- Collisions kick the tilt gyroscopically: the axis moves by h·(ẑ×J)/(I·ω), so a low-spin top gets knocked around more.

### Collisions (`collision.ts`)

- **Circle–circle impulse** at the contact point with restitution e = global × √(eA·eB). Below 0.03 m/s the contact is treated as resting (e = 0), which prevents jitter.
- **Spin-aware friction.** The relative contact velocity includes each ring's surface speed (ω×r). Tangential impulse is Coulomb-limited and never exceeds the stick impulse, so friction cannot add energy. Same-spin tops meet with opposing ring surfaces and exchange spin violently.
- **Mass and angle.** The impulse scales with the normal approach speed and the reduced mass. Head-on hits transfer several times more impulse than glancing ones, and heavier tops change velocity less. Both are covered by tests.
- **Blade strike (approximation).** At the start of a new contact, ring protrusions turn some of the tangential surface slip into a separating impulse (`ringStrike`, which is largest for jagged Attack rings). The kinetic energy this adds is paid for out of the strikers' spin, at 50 % efficiency.
- **Impact spin loss.** `energyLoss × (0.15·jn·|vt| + impact KE)` is removed from spin. It is scaled by the opponent's `impactSpinDrain` (from attack) and reduced by the receiving top's `impactSpinResist` (from defense).
- **Anti-overlap.** Positional correction is split by inverse mass with a small slop. Contact hysteresis means a continuous contact counts as one collision.
- **Walls.** The wall uses its own restitution and a small friction against the spinning ring, and wall impacts cost some spin.

### Numerical safety

`guardBody` replaces any non-finite value, clamps speed (8 m/s), spin (2000 rad/s) and tilt, and keeps bodies inside the stadium. Every intervention increments `guardTrips`, which the tests and the headless runner require to stay at 0.

---

## Known limitations

- **Visual quality, mobile performance and physics "feel" have not been verified on real devices.** Screenshots were taken with headless Chrome using software WebGL (SwiftShader) at desktop, phone-portrait and phone-landscape sizes. That checks layout and rendering, but its frame rate (about 5–10 FPS in software) says nothing about real hardware.
- **Outcomes are currently decided almost entirely by stamina class.** With only the spin-out victory condition, the default parameters give a strict order of Tempest > Titan > Phantom > Inferno in cross-class matchups, and seeds rarely change the winner. As the spec says, balance is not forced. Attack types need the future burst and knockout conditions to be competitive.
- Inferno battles are short (about 20–30 s) because its tip burns its own spin. Even matchups land at about 50 s and the Tempest mirror at about 73 s.
- Collision shapes are circles. Ring geometry is approximated with friction and strike parameters.
- Continuous resting contact (for example, two stamina tops grinding in the centre) counts as one collision or none, because only new contacts above 0.05 m/s are counted.
- The tilt and wobble state is kinematic: it affects contact and visuals but stores no energy.
- The visual lean of a top includes half the local surface slope. This is a presentation choice, not simulated.
- Changing developer parameters rebuilds the battle. They cannot be changed mid-battle.
- Only the Classic Bowl exists, and its wall is a hard circular boundary with no knockout.

## Out of scope for v0.1

Accounts, multiplayer, career, trophies, XP, credits, shops, upgrades, equipment inventory, onboarding, saves, loot,
tournaments, special abilities, team battles, additional stadiums, the launch-timing minigame, and health/burst damage.
