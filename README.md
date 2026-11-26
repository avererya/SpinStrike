# SpinStrike — v0.4.1 Combat Dynamics & Progression Refinement

SpinStrike is a browser-based, physics-driven spinning-top combat game. Tops, names and art are all original.
**v0.4 turns the combat sandbox into a persistent progression game**: choose a starter top, battle random Bronze
opponents in Quick Battle, earn Credits and XP, level up, buy permanent upgrades, and climb the career ranks.
v0.4.1 refines the combat dynamics and adds launch aiming (below); the
original sandbox is kept as a separate developer mode that never touches your career.

See [Progression and economy](docs/PROGRESSION.md), [Save schema](docs/SAVE_SCHEMA.md) and
[the economy report](docs/economy/v0.4-economy-report.md). The text below the v0.4 section documents the v0.3.1
sandbox and combat engine, which remain accurate.

Live: https://spinstrike.pages.dev/ (Cloudflare Pages, deployed from `main`).

- **Stack:** TypeScript (strict), Vite, Three.js, a custom physics engine, HTML/CSS UI, and Vitest.
- **Runs entirely client-side.** There is no backend. The production build is a static `dist/` folder that Cloudflare Pages can host.
- **Physics is independent of rendering.** `src/sim` has no Three.js or DOM imports, so it runs the same in the browser, in tests and in the headless simulator.

---

## v0.4.1: combat dynamics, launch aiming, refined progression

Full report: [`docs/COMBAT_DYNAMICS_v0.4.1.md`](docs/COMBAT_DYNAMICS_v0.4.1.md).

- **Aim your launch.** Before the timing minigame you aim on a top-down view of the stadium.
  - Drag sideways for direction (−45…+45°, + = toward the centre) and up/down for tilt (0…30°). Sliders and ± buttons work too.
  - The dotted line is your top's real-physics opening path (nominal launch, your top alone).
  - Tilt costs spin and changes how hard the tip drives. There is no damage bonus.
  - Your last aim is remembered for each top, so you can go straight to the timing.
- **No more stalled orbits.** Battles now include small, seeded, physical variation:
  - independent launch placement, heading, speed, tilt and energy per top
  - a slightly uneven floor and grip
  - tip contact that wanders more as spin falls

  Identical tops no longer lock into the same orbit half a lap apart. Battles without a hit by 20 s fell from 15 % to 4.5 %.
- **Class identities.** Titan's Attack is 55 (was 82) and Tempest's Stamina is 95 (was 75).
- **Upgrades.** Stamina no longer compounds at high ranks. Speed is still weak; this is an open design decision.
- **Rewards (temporary).** Difficulty multipliers are Easy 0.75, Normal 1.0, Hard 1.1, Expert 1.2.
- **Saves.** v0.4.0 saves load unchanged. Old history is never back-filled. New records carry the ruleset and aims.
- **Sandbox.** It has movement and aim controls and "Load v0.4.0 baseline" for exact v0.4.0 battles.
- **Developer tools.** Dev-panel physics stats show contacts, hits, gaps and sync time. The scripts are `npm run dynamics` (`--baseline`), `npm run upgrades` and `npm run aim`.

## v0.4: the game (career mode)

Primary loop: **Garage → Quick Battle → rewards → upgrade → level up → advance career → repeat.**

- **Navigation:** bottom tabs Garage / Battle / Collection / Career; Settings and Sandbox are in the ☰ menu.
- **New career:** pick Inferno, Titan, Tempest or Phantom (Common, v0.4.1 stats). Start: level 1, 500 Credits, Bronze III, Classic Arena.
- **Garage:** rotating 3D preview, level and XP, base vs effective stats, upgrade progress, Quick Battle / Upgrade / Top History.
- **Upgrades:** Health, Attack, Defense, Stamina, Speed and Critical Chance, ten ranks each, gated by top level, paid with Credits.
- **Quick Battle:** random Bronze opponent, difficulty Easy to Expert (changes AI launch quality and reward multiplier), Classic Arena. Rewards are granted once per completed battle.
- **Collection / Career / Top History / Settings** (export, import, reset). Saves live in the browser (`localStorage`) only, so export a backup.
- **Sandbox** (☰ menu): the v0.3.1 developer sandbox with manual matchups, seeds, dev panel and replays. It never awards or records career data.

Code layout additions: `src/career/` (pure TypeScript rules, save schema, store, opponents, headless runner), `src/ui/game/` (shell and screens), `src/render/topPreview.ts` (menu 3D previews). Scripts: `npx tsx scripts/economy.ts` regenerates the economy report.

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
| `npm run sim` | Headless combat simulator and balance report (see below) |

### Production build and deploy

```bash
npm run build      # outputs static files to dist/
```

Cloudflare Pages settings: build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=20`.
The build uses relative asset paths (`base: './'`), so it also works from a sub-path.

**Version information (v0.3).** The game version comes from `package.json` and the build id is the short commit SHA, taken from Cloudflare Pages' `CF_PAGES_COMMIT_SHA` (or `git rev-parse` locally). Both are injected at build time (`vite.config.ts` → `src/version.ts`), so nothing has to be edited by hand. They appear next to the logo in the toolbar (e.g. `v0.3.1 · 1a2b3c4`) and at the top of the developer panel; the build time is in the tooltip.

**Caching.** `public/_headers` (copied to `dist/`) tells Cloudflare Pages to revalidate `index.html` and `/` on every load (`no-cache, must-revalidate`), never cache `version.json`, and cache the content-hashed `/assets/*` bundles forever. A new deployment is therefore picked up on the next load, without stale HTML pointing at old bundles. The build also writes `dist/version.json`; the running app fetches it on load and whenever the tab becomes visible again, and if a newer build is live it shows a small **"A newer version is available · Reload / Later"** notice. It never reloads by itself, so an active battle is never interrupted and no reload loop is possible.

### Headless combat simulator

```bash
npm run sim                                  # 16 ordered matchups × 500 seeds = 8,000 battles (~30 s), v0.3 defaults
npm run sim -- --legacy                      # the legacy v0.2 configuration (reproduces v0.2 exactly)
npm run sim -- --launch great                # both launches fixed (poor | good | great | perfect)
npm run sim -- --launch dist                 # both launches from the seeded AI distribution (the default)
npm run sim -- --launch perfect:dist         # player always Perfect vs the AI distribution
npm run sim -- --crits off                   # critical hits on | off
npm run sim -- --set results.drawWindow=0.1  # any config value, including strings (launch.playerQuality=good)
npm run sim -- --battles 100                 # seeds per ordered matchup
npm run sim -- --seed 100001                 # first seed of the seed set (seeds are consecutive)
npm run sim -- --a inferno --b titan         # one ordered matchup
npm run sim -- --max 180                     # maximum battle duration (s)
npm run sim -- --set combat.damageScale=60   # override any config value (repeatable)
npm run sim -- --set top.titan.maxHealth=700 # per-top override (applies in either slot)
npm run sim -- --md report.md                # also write the report as Markdown
npm run sim -- --json                        # machine-readable per-matchup statistics
npm run sim -- --solo                        # each top alone: spin-down reference
```

The report contains a 4×4 matrix by slot (row = player slot), a slot-averaged matrix, an overall summary (finish types, draws, timeouts, duration percentiles, early finishes < 2 / 5 / 10 s, damage, collisions, critical hits, failures), per-top aggregates, mirror-match slot fairness (P1 share of decisive results with a binomial z score), and a per-matchup table. Each matchup row gives:
- Win rates for both slots, draw rate and timeout rate.
- Average and median duration, the P10–P90 range, and the minimum and maximum.
- Burst, knockout and spin finish rates, broken down by winning slot.
- The winner's remaining health and stamina.
- Average damage dealt, average collisions, and the largest single hit.
- Critical hits per battle and as a share of damaging hits, near-simultaneous draws, narrow wins, and early-finish rates.
- Failures: guard trips, non-finite values or exceptions.

**Win rates are the share of all battles in the matchup.** Draws and timeouts count as neither wins nor losses and are listed separately. The simulator imports only `src/sim`, `src/content` and `src/config`, never Three.js or the DOM. Saved reports are in [`docs/balance/`](docs/balance/).

## Using the sandbox

**Battle setup (toolbar)**
- **Player / Opponent:** choose any of the four starter tops on each side. Mirror matches are allowed.
- **Start** opens the **launch** (below). **Pause/Resume** freezes the simulation. **Reset** returns to the launch positions with the same seed, without starting.
- **↻ Same seed** is an **exact replay**: same seed *and* the same recorded launch qualities, so the battle is reproduced exactly.
- **⚄ New seed** starts a fresh battle: new random seed, a new launch attempt and a new AI launch draw.
- **0.25× / 0.5× / 1× / 2×** sets the simulation speed. Speed never changes the outcome of a seeded battle.
- Keyboard: `Space` launches (during the launch), starts or pauses, and `R` replays with the same seed.

**Launch (v0.3).** Pressing Start shows a timing meter under the stadium: a white marker sweeps back and forth (one sweep ≈ 1.25 s) across a golden **Perfect** zone (45–55 %), green **Great** zones (30–70 %), blue **Good** zones (15–85 %) and red **Poor** ends. Press **LAUNCH**, tap it, or press `Space` once. Boundaries count toward the better zone (exactly 45 % is Perfect). If you do not launch within 8 s, the launch is Poor. Your quality and its bonus appear immediately ("Perfect! +10% spin energy") together with the opponent's seeded quality, then the battle starts about 0.85 s later. There is one input per battle and no steering.

| Quality | Starting rotational-energy multiplier | Angular velocity (√ of it) |
| --- | --- | --- |
| Poor | 1.00× | 1.000× |
| Good | 1.03× | 1.015× |
| Great | 1.07× | 1.034× |
| Perfect | 1.10× | 1.049× |

The bonus multiplies launch **energy**; ω follows from ω = √(2E/I), so Perfect is +10 % energy (+4.9 % ω), not +21 %. Nothing else (health, attack, defense, critical chance) changes. The stamina bar is normalised to the energy *actually launched*, so a bonus top also starts at 100 %, and each HUD card shows the quality and bonus separately ("Perfect launch · +10% spin energy").

The **AI** launch is drawn from a configurable, seeded distribution (Poor 15 %, Good 40 %, Great 35 %, Perfect 10 %) using its own keyed random stream (seed, slot), so it is reproducible from the battle seed and independent of frame rate and every other random event. The distribution is data, ready for future difficulty profiles.

**Combat HUD:** each top's card shows the following:
- Its name in its class colour, its class, and whether it is the player or the opponent.
- Its launch quality and energy bonus (after launching).
- A **green health bar** (✚ current / max).
- An **amber stamina bar** (⟳ usable spin: rotational energy above the toppling threshold, relative to the energy actually launched; 0 % exactly when the top topples). Small values get extra precision (e.g. 0.4 %, <0.1 %) and are never rounded to 0 %.
- **Hits** landed, damage **dealt** and damage **taken**.
- Speed (m/s) and angular velocity (rad/s, with rpm on hover).

On phones in portrait, speed and spin are hidden behind the **details** button under the timer so the stadium keeps its space. The bars carry icons and numbers, so they do not rely on colour alone. The HUD refreshes at 15 Hz, independently of the 240 Hz physics.

**Finishes and result:** a battle ends when either top is eliminated:
- **Burst finish:** health reaches 0.
- **Knockout finish:** the top escapes over the rim.
- **Spin finish:** the top stops spinning.

If both tops are eliminated on the same physics step, the battle is a draw. **If both stop spinning within 0.10 simulated seconds of each other, it is also a draw** (draw window, see *Combat model*). Reaching the maximum duration is a timeout, with no winner.

**Critical hits (v0.3).** Every damaging impact gives each top a 5 % chance (per top, configurable) of a critical hit that deals 2× structural damage. A critical hit shows a golden damage number with a **CRITICAL HIT** label on a dark pill, a golden spark burst and a larger impact ring. These appear by default even when ordinary damage numbers are off, and can be turned off separately.

A short finishing presentation plays. The **result card** then shows:
- The winner, the defeated top and the finish type, with a **NARROW VICTORY** badge when a spin win was decided with the winner at ≤ 2 % stamina (presentation only).
- For a **DRAW**, the reason: "both tops stopped spinning almost simultaneously (0.04 s apart, within the 0.10 s draw window)" or "eliminated on the same physics step".
- Each top's launch quality and bonus, health and stamina left at the decisive moment, damage dealt, and hits (critical hits).
- **More statistics** (collapsed): critical damage dealt, crits received, damage taken, each top's strongest hit (and whether it was critical), collisions.
- The strongest single hit, the exact duration and the seed.

Buttons: **New battle** (or a prominent **Rematch** after a draw: same tops and configuration, fresh seed, fresh player launch and a new AI launch draw), **Replay (same seed)** (exact replay) and **Close**.

The winner never shows STOPPED: the result and HUD use the snapshot from the decisive moment, the defeated top stops first, and the winner keeps spinning through the finishing presentation.

### Developer panel (⚙)

Changing any value rebuilds the battle with the current seed (not started), so the effect of each change is reproducible. Hover over a control to see its description.

| Group | Controls |
| --- | --- |
| Debug visualisation | Velocity vectors, collision boundaries, recent contact points, movement path history, stadium slope field (arrows point downhill and are coloured by steepness), FPS, physics statistics (steps per frame, substeps, CPU time per step, guard trips, total energy). All are off by default. |
| Stadium | **Slope** (bowl depth, m), **surface friction** (×), **wall restitution**, **rim lip height** (m, used for knockouts and the drawn lip) |
| Collisions | **Collision restitution**, **collision energy loss** (×), **combat spin drain (stat weight)** |
| Combat | **Critical hits** switch, **global damage scale** G, **impact damage scale** k_imp, **rotational damage contribution** k_rot, **defense effectiveness** e, **defense half-value** K, **attack reference**, **severity reference energy** E_ref, **severity exponent** p, **damage spike cap**, **minimum damaging impact speed**, **contact re-arm separation**, **contact re-arm time**, **rim climb efficiency**, **impact lift**, **impact lift window**, **stability lip factor**, and a **knockouts** switch |
| Ruleset | **v0.3 (current)** or **v0.2 legacy** stats and stat → physics mapping, plus **Load legacy v0.2 configuration** (v0.2 ruleset and combat values, crits off, Poor launches, no draw window; reproduces v0.2 battles exactly) |
| Launch | **Launch minigame** on/off (off = bypass), fixed **player** and **opponent launch quality** (or minigame / AI distribution), **indicator sweep time**, **launch timeout**, the three **zone half-widths**, the four **energy multipliers**, and the four **AI probabilities** (editing one rescales the others to sum to 1) |
| Results | **Spin-finish draw window** (s, 0 = v0.2 rule) and **narrow victory threshold** |
| Presentation | **Cinematic finishes**, **floating damage numbers** (off by default) and **critical hit effects** (on by default) |
| Battle | **Maximum duration** (s) |
| Player / Opponent top | **Maximum health**, **attack**, **defense**, **critical chance**, **critical damage multiplier** (combat values only, per top), then **Mass** (kg), **initial rotational energy** (J), **initial translational velocity** (m/s), **tip friction** (traction μ), **rotational energy decay** (×), **stability** (0–1), **wobble intensity** (rad). Edited values are marked *edited*, and each top can be reset on its own. |
| Configuration | **Reset all to defaults**, **Export JSON** (downloads the file, copies it to the clipboard and shows it), **Import JSON** (paste it or pick a file). The current format is `version: 3`. Imports are fully validated and any errors are listed. **v0.1 (`version: 1`) and v0.2 (`version: 2`) files are migrated** to the legacy v0.2 ruleset: every value in the file is kept, missing values take the v0.2 defaults, and the v0.3 mechanics (critical hits, launch bonuses, draw window) are off, so the file reproduces its original battles; the panel lists what was migrated and how to switch to v0.3 rules. Invalid values are rejected, never silently corrected. |

---

## Architecture

```
src/
  sim/                 Physics engine. Pure TS: no Three.js, no DOM.
    units.ts           Unit conventions, gravity, safety limits
    rng.ts             Seeded PRNG (mulberry32) + stateless keyed hashing (hash32 / keyedUniform) for event-keyed randomness
    launch.ts          v0.3: launch qualities, timing zones, meter, energy bonuses, seeded AI launch distribution
    topParams.ts       TopPhysicsParams: effective physical parameters
    body.ts            TopBody: mutable per-top state (allocation-free fields)
    dynamics.ts        Per-top forces: slope gravity, tip drive, friction, wobble, numerical guards
    collision.ts       Top–top and top–wall impulse resolution, collision events, contact reports
    combat.ts          v0.2: damage formula, contact lifecycle, burst detection, rim-escape (knockout) check; v0.3: critical hits
    world.ts           Fixed-step world: launch, substepping, event + damage queues, eliminations
    battle.ts          Battle lifecycle: finish evaluation (burst / knockout / spin), v0.3 draw window (resolving phase), draws, timeout, frozen result
    runner.ts          Accumulator-based fixed-step driver (speed, pause)
    headless.ts        runBatch(): repeated battles + statistics, percentiles
    stadium/
      types.ts         StadiumSurface interface (height, gradient, friction, wall)
      classicBowl.ts   Classic Bowl implementation
  content/             Data-driven game content
    stats.ts           Gameplay stat types (0–100 design values)
    parts.ts           Tip / ring / disc / core part definitions
    tops.ts            The four starter tops
    derive.ts          The ONLY mapping from gameplay stats + parts → physics params and combat stats (rulesets v0.3 and legacy v0.2)
  config/              Sandbox configuration
    params.ts          Tunable-parameter specs (shared by UI and validation)
    sandboxConfig.ts   Config shape, defaults, overrides, BattleOptions builder
    validate.ts        JSON import validation
  render/              Three.js presentation (reads sim state, never writes it)
    sceneRenderer.ts   Scene, lights, camera framing, interpolation, disposal
    stadiumMesh.ts     Stadium mesh sampled from the physics height function
    topModels.ts       Procedural top models built from four separate part groups (core, ring, disc, tip)
    effects.ts         Pooled trails, sparks and impact rings
    finishFx.ts        Finishing presentation: burst debris, knockout exit, flash, light camera shake
    debugDraw.ts       Debug overlays
    coords.ts          Sim ↔ Three.js coordinate mapping
  ui/                  DOM interface
    app.ts             Wiring: battle lifecycle, launch minigame, frame loop, controls
    hud.ts, devPanel.ts, dom.ts, styles.css
    format.ts          Stamina / health / bonus labels (pure, tested)
    resultText.ts      Result-card wording for wins, narrow wins, draws (pure, tested)
  version.ts           Build-time version / commit id and the newer-deployment check
public/_headers        Cloudflare Pages cache headers
scripts/tune-eval.ts   Development helper used for the v0.3 balance sweeps (in-memory candidate evaluation)
scripts/headless.ts    CLI for the headless simulator
tests/                 Vitest suites
```

**Data flow:** `TopDefinition` (stats + parts) → `deriveTopPhysics()` / `deriveTopCombat()` → `TopPhysicsParams` + `TopCombatStats` → developer overrides → `World`.

**Combat is layered on top of the physics.** `resolveTopPair()` resolves the impulse exactly as in v0.1 and also fills a preallocated `ContactReport`, which holds the pre-impulse approach speed, reduced mass, spins and normal. `combat.ts` reads that report and changes **health only**. Health never feeds back into movement or spin, so the v0.1 motion is unchanged until a finish removes a top from play. With damage and knockouts off and the stat spin-drain weight at 1, v0.2 reproduces v0.1 battles step for step (`tests/regression.test.ts`).

**Presentation is separate from the result.** `Battle` freezes its `BattleResult` (with `Object.freeze`) on the step the finish happens, then disables combat. The finishing presentation only replays the aftermath:
- It slows down the aftermath stepping.
- It spawns debris from the model's own part meshes.
- It animates the knockout arc.

None of this can change the result.
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
- **Impact spin loss.** `energyLoss × (0.15·jn·|vt| + impact KE)` is removed from spin. It is scaled by the opponent's `impactSpinDrain` (from attack) and reduced by the receiving top's `impactSpinResist` (from defense in v0.2, from stamina in v0.3).
- **Anti-overlap.** Positional correction is split by inverse mass with a small slop. Contact hysteresis means a continuous contact counts as one collision.
- **Walls.** The wall uses its own restitution and a small friction against the spinning ring, and wall impacts cost some spin.

## Combat model

v0.2 introduced health, damage and the three finishes. v0.3 keeps that model and adds launch quality, critical hits, blade exposure, the draw window and a cleaner stat → physics mapping. Two rulesets exist (`src/content/derive.ts`): **v0.3** (default) and **v0.2 legacy**, which keeps the v0.2 stats and mapping unchanged for regression runs and migrated configurations.

### Stat → physics mapping (v0.3)

Each stat now has one job. Every constant is provisional tuning (`PARAMS_V03` in `derive.ts`).

| Stat | v0.3 effect | v0.2 effect (legacy ruleset) |
| --- | --- | --- |
| Health | Max health = 10 × stat | same |
| Attack | Damage formula (linear), ring contact friction 0.15–0.55 × ring factor, blade strike ×0.6–1.4, impact spin drain ×0.5–1.6 | same |
| Defense | Damage formula (bounded), restitution ×1.1–0.85 | also stability 0.25–0.9, restitution ×1.2–0.75 and impact spin resistance 0–0.6 |
| Stamina | Passive spin decay ×2.0–0.75 **and** impact spin resistance 0–0.4 | decay only |
| Speed | Launch speed 0.3–1.1 m/s, tip traction ×0.85–1.2 | same |
| Weight | Mass 30–58 g and a small stability term (−0.10 … +0.15) | mass only |

**Stability** now comes from the tip: `stability = tip.stability + weight term`, clamped to 0.05–0.95 (Rush Flat 0.45, Bastion Ball 0.64, Needle Point 0.55, Vector Semi-Flat 0.59). In v0.2, defense fed stability, impact spin resistance and restitution at once, which is what let Titan outlast Phantom despite equal stamina stats. Parts also carry v0.3 values where v0.2 tuning was replaced: tip pivot friction (`spinFrictionV03`: Rush Flat 0.10, Bastion Ball 0.238, Needle Point 0.207), Blaze Fang blade strike (`strikeV03` 0.0176) and Zephyr Halo **blade exposure** (0.37, below).

**Deflective ring profile (v0.3.1).** Two further reusable ring characteristics (defaults are neutral, so every other ring is unchanged and the v0.2 ruleset ignores them): `damageCapFactor` scales the severity ceiling of hits *taken* by the wearer (< 1 flattens the hardest impacts while leaving moderate ones nearly unchanged), and `impactSpinLossFactor` multiplies the spin the wearer loses in impacts (> 1 = a deflective profile scrubs rotational energy: the trade-off between structural protection and rotational energy retention). Zephyr Halo uses 0.45 and 1.5. Both apply to whoever wears the ring, against every attacker, so they are ordinary part properties, not matchup bonuses; a future ring can pick any combination.

**Blade exposure (v0.3).** A ring part's `bladeExposure` (0–1, default 1) is the share of an opposing blade strike that its surface exposes. It multiplies the attacker's rotational (blade) term in the damage formula, so Tempest's smooth, rounded Zephyr Halo takes about a third of the blade damage of a fully exposed ring while still taking full translational (impact) damage. It is a property of the defender's part, applies to every attacker equally, and is shown in the formula below.

### Launch quality (v0.3)

The launch multiplies each top's **starting rotational energy**: `E = E₀ · (1 ± 4 % seeded spread) · m(quality)`, then `ω = √(2E/I)` (Poor 1.00, Good 1.03, Great 1.07, Perfect 1.10). The seeded spread is drawn exactly as in v0.2, so a Poor launch reproduces v0.2. Stamina is normalised to the energy actually launched: `stamina = (E − E_crit) / (E_launch − E_crit)`, where `E_crit` is the energy at the toppling spin. The AI quality is `sample(distribution, hash(seed, slot, aiLaunch stream))`. Exact replays store and reuse both launch qualities (`BattleResult.launches`).

### Critical hits (v0.3)

- One roll **per damaging impact** (the same contact-lifecycle event that deals damage), never per physics update. Each top that would deal damage > 0 rolls independently: `crit ⇔ u < critChance`, with `u = hash(seed, impact index, slot, critical stream)`. Rolls are reproducible from the seed, independent of frame rate, simulation speed and every other random event.
- A crit multiplies **structural damage only** (`× critMultiplier`, default 2). It adds no impulse, knockback, spin drain or energy: trajectories are bit-identical with crits on and off (covered by a test).
- Defaults: 5 % chance and 2× for every starter (`BASE_CRIT_CHANCE`, `BASE_CRIT_MULTIPLIER`). Per-top chance and multiplier are combat values, ready for future upgrades (`MAX_CRIT_CHANCE` 25 %, `CRIT_CHANCE_PER_UPGRADE` 2 % are reserved constants, not used yet).
- Statistics: crits landed and received, crit damage dealt, strongest hit and whether it was critical.

### Draw window and narrow victories (v0.3)

- When one top stops spinning while the other is still spinning, the battle enters a **resolving** phase of `floor(window × 240)` simulation steps (default 0.10 s = 24 steps, inclusive; v0.3 used 0.25 s). It counts simulated time, so it is independent of frame rate and playback speed.
- During that window combat is off and the stopped top is removed from contact: it cannot deal damage, cause a knockout or push the survivor.
- If the survivor also stops within the window, the result is a **near-simultaneous draw** (with the gap reported). Otherwise the survivor wins. Either way, the result time and both tops' snapshots are taken at the **first** stop.
- Burst and knockout finishes stay decisive immediately; same-step eliminations are still draws. A window of 0 reproduces the v0.2 rule.
- A spin win with the winner's stamina at or below **2 %** is labelled a **narrow victory**. This is presentation only and never changes the outcome.


### Health and stamina
- **Health** is structural integrity: `maxHealth = 10 × health stat` (v0.3: Inferno 630, Titan 720, Tempest 690, Phantom 690; v0.2: 600 / 900 / 600 / 650). It starts full every battle, falls only through damaging collisions, is clamped at 0, and burst happens at 0. There are no repairs and no permanent damage.
- **Stamina** is the existing rotational energy. Since v0.3 the bar shows *usable* spin: the energy above the toppling threshold, relative to the energy actually launched, so it reaches 0 % exactly when the top topples. It is drained by friction, movement and collisions exactly as in v0.1, wobble grows as it falls, and toppling is a spin finish.
- The two are independent. Health never changes speed, spin, attack or stability, so there is no death spiral. A top can burst with plenty of spin left, or spin out at full health.

### Damage formula
For each **damaging impact** (see contact lifecycle below), damage from A to B is:

```
gate     : no damage unless vₙ > v_min                        v_min = 0.03 m/s
v_blade  = ringStrike_A · |ω_A| · r_A                           A's blade strike speed, m/s
E_A      = ½ · μ · vₙ · (k_imp · vₙ + k_rot · x_B · v_blade)   strike energy, J (x_B = B's blade exposure, v0.3)
x        = (E_A / E_ref)^p                                       severity
S        = x / (1 + x / x_cap)                                   soft cap
f_att    = attack_A / attack_ref                                 linear
f_def    = K / (K + e · defense_B)                               bounded, diminishing returns
damage   = G · f_att · f_def · S                                 (× critMultiplier on a critical hit, v0.3)
```

| Term | Purpose | Default |
| --- | --- | --- |
| vₙ | Relative approach speed along the contact normal, before the impulse. A glancing contact has small vₙ, so it does little damage even when the rings slip fast. | — |
| μ = m_A·m_B/(m_A+m_B) | Effective (reduced) collision mass. Heavier pairings carry more impact energy. | — |
| v_blade | Rotational striking potential: the existing `ringStrike` (blade protrusion, from the ring part × attack) times the ring's surface speed. It falls as the top loses spin. | — |
| k_imp, k_rot | Weights of the translational and rotational terms. With the defaults the blade term dominates, so damage grows roughly linearly with impact speed and with the attacker's spin. | 1, 9.4 (v0.2: 10) |
| v_min | Gate below which contacts (resting nudges) do no damage. | 0.03 m/s |
| x_B | Defender ring's blade exposure (v0.3). 1 for every ring except Zephyr Halo. | 0.37 / 1 |
| E_ref, p | Severity normalisation and compression. p < 1 narrows the gap between light and heavy hits, so ordinary contacts still matter. | 0.005 J, 0.4 (v0.2: 0.5) |
| x_cap | Soft cap. Hard hits approach `G · f_att · f_def · x_cap` instead of spiking without limit. | 2.45 (v0.2: 2) |
| f_att | Linear attack scaling, so future attack upgrades help proportionally. | attack_ref 65 |
| f_def | Never reaches 0 for any finite defense, so no build becomes invulnerable. Each extra point of defense helps less than the previous one. | K 100, e 0.5 |
| G | Global damage scale (HP per unit severity). | 54 (v0.2: 50) |

Both tops' damage comes from the **same pre-impulse report** and is applied together, so slot order cannot matter. Damage is ≥ 0 and finite for any input, including NaN, Infinity and zero references (all covered by tests). There are **no class-specific multipliers**: Inferno hits harder only because of its attack stat, its jagged ring's strike factor, its speed and its spin. The only randomness is the seeded critical roll (v0.3).

Typical hits with the v0.2 defaults (v0.3 figures are in the balance report):
- Inferno's direct hits on Tempest deal about 20–60 HP.
- Phantom hitting Titan deals about 7–17 HP.
- Titan nudging Tempest deals about 4–6 HP.
- The largest observed single hit in 8,000 battles is 67 HP.

### Contact lifecycle (no repeated-contact damage)
- Each pair of tops is *armed* at the start. An armed approach above v_min is a damaging impact, and it disarms the pair.
- The pair re-arms when the rings separate by more than the **re-arm separation** (1 mm). A genuinely new impact therefore always counts, however soon it comes.
- During one unbroken contact (no separation), a new hard approach counts again after the **re-arm time** (80 ms). A grinding contact therefore cannot deal damage on every physics update (dozens per contact), and quick legitimate re-hits are not lost to a long global cooldown.
- A hit counts as *landed* (HUD and statistics) when it deals at least 1 HP.

### Combat-related spin drain (v0.1 placeholder, now weighted)
v0.1 used attack to increase the spin an impact strips from the opponent (`impactSpinDrain`, ×0.5–1.6) and defense to resist it (`impactSpinResist`, 0–60 %). Attack and defense now act through health damage, so these stat modifiers are blended toward neutral by **`statSpinDrainWeight`**: drain = 1 + w·(drain − 1) and resist = w·resist, with **w = 0.63** in v0.3 (0.5 in v0.2). In v0.3 the resistance comes from **stamina** (0–0.4) instead of defense, and the collision energy loss is 0.59 (v0.2: 0.6).

The physical part of the loss is unchanged: ring chatter, impact energy, Coulomb friction exchange, the energy cost of the blade strike, and wall losses. With w = 1 and damage off, v0.1 is reproduced exactly.

### Knockout (rim escape) approximation
The Classic Bowl's wall is a hard boundary, and normal wall impacts behave exactly as in v0.1. On each wall impact with an outward velocity, `rimEscape()` estimates whether the top hops over the 1.6 cm lip:

```
s      = |∇h| at the top's position (local rim slope)
v_up   = η_climb · vₙ,out · s/√(1+s²)  +  λ_lift · Δv_hit   (Δv_hit = J/m of a damaging top–top hit within the last 0.25 s)
h_hop  = v_up² / (2g)
h_need = lip · (1 + k_stab · stability)
knockout ⇔ h_hop > h_need
```

- **Outward speed and local slope:** the steep rim face turns outward speed into upward speed.
- **Impact-induced lift:** a recent strike's Δv = J/m, so heavy tops are lifted less.
- **Stability:** raises the clearance needed.
- **Rim height:** the lip height.
- **Mechanical energy:** v_up comes from the top's current velocity, which already paid for climbing the bowl.

Only real wall impacts with outward velocity qualify, so positional overlap alone can never knock a top out (covered by tests).

With the defaults (η_climb 0.8, λ_lift 0.7, k_stab 0.5), rim climbing alone can never clear the lip at the speeds reached in the Classic Bowl. A knockout needs a hard hit near the rim. Knockouts happen in about 1 % of all battles (71 of 8,000), almost all of them Inferno knocking out Tempest, often in the opening clash.

When a knockout is confirmed, the top leaves active physics: no further contacts or wall checks. The presentation then flies it over the rim and drops it beside the stadium.

### Finish detection
- The finish conditions of **both** tops are evaluated after the complete fixed step (all substeps). Update order and slot assignment therefore cannot decide a winner.
- **Both eliminated on the same step** (any combination of conditions) is a **draw**. Since v0.3, a second **spin** stop within the draw window (above) is also a draw.
- **One top meeting several conditions on the same step** is classified burst > knockout > spin (`FINISH_PRIORITY`). A burst is the decisive structural failure at impact. A knockout requires travelling over the rim afterwards. A spin-out is the slowest process.
- Once set, the `BattleResult` is frozen and combat is disabled (from the first stop, during the draw window). The aftermath (the winner keeps spinning while the loser topples, bursts or flies out) never changes it.
- The maximum duration (default 180 s) gives a **timeout**, with no winner invented.

### Finishing presentation
All presentation runs after the result is frozen.
- **Burst:** the decisive impact's direction and damage set the burst direction and power. The defeated model's four part groups (core, ring, disc, tip) detach and tumble out along the impact direction with a light gravity and bounce. They settle flat on the bowl surface. Sparks, an impact ring and a short flash play.
- **Knockout:** the top flies outward and upward over the rim, tumbles and drops beside the stadium.
- **Spin:** the existing toppling: wobble grows, the top tilts over and stops.

In every case the winner keeps spinning. With **cinematic finishes** on:
- The aftermath plays at 0.3× for 0.7 s.
- A flash and a small camera shake (≤ 0.035 scene units) play on burst or knockout.
- The **finish banner** (BURST / KNOCKOUT / SPIN FINISH) pops in after 0.25 s.
- The result card appears after 1.6 s.

With cinematic finishes off, the banner shows at once without animation, the result card appears after 0.4 s, and there is no slow motion, flash or shake. Debris and the knockout exit still play, because they show the outcome.

Debris objects are bounded: 4 per burst, plus one pooled flash mesh. Reset and restart clear all debris, the banner, damage numbers and the effect pools before the models are disposed.

### Combat feedback
Damaging hits add sparks and an impact ring scaled to damage ÷ max health. Ordinary low-damage contacts keep the v0.1 effects only. Optional floating damage numbers (Presentation → off by default) use a pool of 12 DOM labels. Heavy hits (≥ 6 % of max health) show larger and orange.

### Numerical safety

`guardBody` replaces any non-finite value, clamps speed (8 m/s), spin (2000 rad/s) and tilt, and keeps bodies inside the stadium. Every intervention increments `guardTrips`, which the tests and the headless runner require to stay at 0.

---

## Balance (v0.4.1, Classic Bowl)

Report: [`docs/COMBAT_DYNAMICS_v0.4.1.md`](docs/COMBAT_DYNAMICS_v0.4.1.md). Raw runs: [`docs/balance/v0.4.1/`](docs/balance/v0.4.1/). The v0.3.1 report is kept in [`docs/balance/BALANCE_REPORT.md`](docs/balance/BALANCE_REPORT.md).

Win rate of the row top against the column top, averaged over both slots. Distributed launches, default player aim, seeded AI aim, 32,000 battles (seeds 100001–102000):

| | Inferno | Titan | Tempest | Phantom | Non-mirror overall |
| --- | --- | --- | --- | --- | --- |
| **Inferno** | 45 % | 40 % | **70 %** | 38 % | 49.3 % |
| **Titan** | **58 %** | 49 % | 29 % | 59 % | 48.5 % |
| **Tempest** | 30 % | **71 %** | 49 % | 53 % | 51.4 % |
| **Phantom** | 59 % | 38 % | 47 % | 46 % | 48.0 % |

Draws are 2.4 %. Finishes are 34 % burst, 4 % knockout and 60 % spin. The median battle is 37 s and the median first damaging hit comes at 2.7 s.

## Known limitations

- **v0.4.1 open items:**
  - Speed upgrades are slightly negative (about −3 to −5 points at rank 10).
  - Phantom beats Inferno about 60 % and loses to Titan about 61 %.
  - The Inferno mirror is short (about 6.5 hits).
  - The Titan mirror's first damaging hit has a median of 18 s.
  - The AI aim does not depend on difficulty.

  See section 9 of the dynamics report. Mobile aiming was checked only in an emulated iPhone 13, not on a physical device.

- **iOS top spacing is unverified on a physical iPhone.** v0.3.1 adds 20 px (16 px landscape) of clearance on iOS touch devices and fixes a CSS rule that reset the safe-area padding on narrow screens; whether the blurred band is cleared must be checked on a device after deployment.
- **Not verified on real devices.** All screenshots use headless Chromium with software WebGL. The iOS top-of-screen changes (toolbar-coloured background, safe-area padding moved into the toolbar, no backdrop blur) are a mitigation; **the blur is not confirmed fixed** until checked on an iPhone. Cloudflare deployment was not verifiable from this environment.
- **Balance is close but not exact.** Inferno vs Tempest is ~70 % (target 65 %, 70–75 % accepted) and Titan vs Tempest ~30 % (target 35 %). Getting there meant lowering Tempest's stamina (85 → 75) and health (69 → 63) to offset its tougher ring; Inferno vs Tempest still ends within 10 s in ~18 % of battles. The Inferno–Tempest and Titan–Tempest results move together (more protection helps against both), so further gains need a different lever such as tactical abilities or equipment.
- **Draw window** is 0.10 s: 2.3 % draws overall and 1–8 % in mirrors (v0.3's 0.25 s gave ~5 % overall and 14–19 % in mirrors; 0 s gives 0.7 %).
- **Launch skill matters a lot.** A Perfect player against the AI distribution wins about 60 % of non-mirror battles versus 48 % for an average (distributed) launch, and 71–86 % of mirror matches (report D5 vs D6). The +10 % energy is a large edge in close matchups; this is within the spec's numbers but worth a design look.
- Stamina-heavy matchups run ~42–69 s, close to targets; Inferno vs Tempest runs ~17 s (target 5–15 s for overwhelming advantage). About 3 % of battles end within 5 s, almost all Inferno vs Tempest opening-clash bursts or knockouts.
- Collision shapes are circles; ring geometry is approximated by friction, strike and exposure parameters. The knockout check is a 2.5D estimate. Debris is cosmetic. The tilt state is kinematic.
- Changing developer parameters rebuilds the battle. Only the Classic Bowl exists.

## Out of scope (still)

Manual steering, special abilities and signature moves, additional tops or stadiums, permanent upgrades, equipment inventory, starter selection, credits, XP, trophies, career, shop, tournaments, accounts, multiplayer, team battles and backend services.
