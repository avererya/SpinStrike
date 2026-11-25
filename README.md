# SpinStrike — v0.2 Combat & Finishes

SpinStrike is a browser-based, physics-driven spinning-top combat game. Tops, names and art are all original.
This repository holds **v0.2**: a combat sandbox in which two procedurally modelled 3D tops battle
autonomously in a concave stadium. v0.2 adds health, physics-based collision damage, three finish
types (burst, knockout, spin) with short cinematic finishing presentations, a combat HUD, and a
headless balance simulator. It is still a development sandbox, not the player-facing game.

Live: https://spinstrike.pages.dev/ (Cloudflare Pages, deployed from `main`).

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
| `npm run sim` | Headless combat simulator and balance report (see below) |

### Production build and deploy

```bash
npm run build      # outputs static files to dist/
```

Cloudflare Pages settings: build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=20`.
The build uses relative asset paths (`base: './'`), so it also works from a sub-path.

### Headless combat simulator

```bash
npm run sim                                  # 16 ordered matchups × 500 seeds = 8,000 battles (~35 s)
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

The report contains a 4×4 matrix by slot (row = player slot), a slot-averaged matrix, per-top aggregates, and a per-matchup table. Each matchup row gives:
- Win rates for both slots, draw rate and timeout rate.
- Average and median duration, the P10–P90 range, and the minimum and maximum.
- Burst, knockout and spin finish rates, broken down by winning slot.
- The winner's remaining health and stamina.
- Average damage dealt, average collisions, and the largest single hit.
- Failures: guard trips, non-finite values or exceptions.

**Win rates are the share of all battles in the matchup.** Draws and timeouts count as neither wins nor losses and are listed separately. The simulator imports only `src/sim`, `src/content` and `src/config`, never Three.js or the DOM. Saved reports are in [`docs/balance/`](docs/balance/).

## Using the sandbox

**Battle setup (toolbar)**
- **Player / Opponent:** choose any of the four starter tops on each side. Mirror matches are allowed.
- **Start** launches both tops. **Pause/Resume** freezes the simulation. **Reset** returns to the launch positions with the same seed, without starting.
- **↻ Same seed** restarts immediately with the same seed, which reproduces the battle exactly.
- **⚄ New seed** restarts immediately with a new random seed.
- **0.25× / 0.5× / 1× / 2×** sets the simulation speed. Speed never changes the outcome of a seeded battle.
- Keyboard: `Space` starts or pauses the battle and `R` restarts it with the same seed.

**Combat HUD:** each top's card shows the following:
- Its name in its class colour, its class, and whether it is the player or the opponent.
- A **green health bar** (✚ current / max).
- An **amber stamina bar** (⟳ % of launch rotational energy).
- **Hits** landed, damage **dealt** and damage **taken**.
- Speed (m/s) and angular velocity (rad/s, with rpm on hover).

On phones in portrait, speed and spin are hidden behind the **details** button under the timer so the stadium keeps its space. The bars carry icons and numbers, so they do not rely on colour alone. The HUD refreshes at 15 Hz, independently of the 240 Hz physics.

**Finishes and result:** a battle ends when either top is eliminated:
- **Burst finish:** health reaches 0.
- **Knockout finish:** the top escapes over the rim.
- **Spin finish:** the top stops spinning.

If both tops are eliminated on the same physics step, the battle is a draw. Reaching the maximum duration is a timeout, with no winner.

A short finishing presentation plays. The **result card** then shows:
- The winner, the defeated top and the finish type.
- The battle duration.
- Health and stamina left for both tops.
- Damage dealt and hits landed by each top.
- The strongest single hit.
- The seed.

The card also has **Restart (same seed)** and **New seed** buttons.

### Developer panel (⚙)

Changing any value rebuilds the battle with the current seed (not started), so the effect of each change is reproducible. Hover over a control to see its description.

| Group | Controls |
| --- | --- |
| Debug visualisation | Velocity vectors, collision boundaries, recent contact points, movement path history, stadium slope field (arrows point downhill and are coloured by steepness), FPS, physics statistics (steps per frame, substeps, CPU time per step, guard trips, total energy). All are off by default. |
| Stadium | **Slope** (bowl depth, m), **surface friction** (×), **wall restitution**, **rim lip height** (m, used for knockouts and the drawn lip) |
| Collisions | **Collision restitution**, **collision energy loss** (×), **combat spin drain (stat weight)** |
| Combat | **Global damage scale** G, **impact damage scale** k_imp, **rotational damage contribution** k_rot, **defense effectiveness** e, **defense half-value** K, **attack reference**, **severity reference energy** E_ref, **severity exponent** p, **damage spike cap**, **minimum damaging impact speed**, **contact re-arm separation**, **contact re-arm time**, **rim climb efficiency**, **impact lift**, **impact lift window**, **stability lip factor**, and a **knockouts** switch |
| Presentation | **Cinematic finishes** (slow motion, flash and camera shake on or off) and **floating damage numbers** (off by default) |
| Battle | **Maximum duration** (s) |
| Player / Opponent top | **Maximum health**, **attack**, **defense** (combat values only, per top), then **Mass** (kg), **initial rotational energy** (J), **initial translational velocity** (m/s), **tip friction** (traction μ), **rotational energy decay** (×), **stability** (0–1), **wobble intensity** (rad). Edited values are marked *edited*, and each top can be reset on its own. |
| Configuration | **Reset all to defaults**, **Export JSON** (downloads the file, copies it to the clipboard and shows it), **Import JSON** (paste it or pick a file). Imports are fully validated and any errors are listed. v0.1 files (`version: 1`) are migrated: every v0.1 value is kept, new v0.2 values take their defaults, and the panel lists what was defaulted. Invalid values are rejected, never silently corrected. |

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
    collision.ts       Top–top and top–wall impulse resolution, collision events, contact reports
    combat.ts          v0.2: damage formula, contact lifecycle, burst detection, rim-escape (knockout) check
    world.ts           Fixed-step world: launch, substepping, event + damage queues, eliminations
    battle.ts          Battle lifecycle: finish evaluation (burst / knockout / spin), draws, timeout, frozen result
    runner.ts          Accumulator-based fixed-step driver (speed, pause)
    headless.ts        runBatch(): repeated battles + statistics, percentiles
    stadium/
      types.ts         StadiumSurface interface (height, gradient, friction, wall)
      classicBowl.ts   Classic Bowl implementation
  content/             Data-driven game content
    stats.ts           Gameplay stat types (0–100 design values)
    parts.ts           Tip / ring / disc / core part definitions
    tops.ts            The four starter tops
    derive.ts          The ONLY mapping from gameplay stats + parts → physics params and combat stats
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
    app.ts             Wiring: battle lifecycle, frame loop, controls
    hud.ts, devPanel.ts, dom.ts, styles.css
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
- **Impact spin loss.** `energyLoss × (0.15·jn·|vt| + impact KE)` is removed from spin. It is scaled by the opponent's `impactSpinDrain` (from attack) and reduced by the receiving top's `impactSpinResist` (from defense).
- **Anti-overlap.** Positional correction is split by inverse mass with a small slop. Contact hysteresis means a continuous contact counts as one collision.
- **Walls.** The wall uses its own restitution and a small friction against the spinning ring, and wall impacts cost some spin.

## Combat model (v0.2)

### Health and stamina
- **Health** is structural integrity: `maxHealth = 10 × health stat` (Inferno 600, Titan 900, Tempest 600, Phantom 650). It starts full every battle, falls only through damaging collisions, is clamped at 0, and burst happens at 0. There are no repairs and no permanent damage.
- **Stamina** is the existing rotational energy (shown as % of launch energy). It is drained by friction, movement and collisions exactly as in v0.1, wobble grows as it falls, and toppling is a spin finish.
- The two are independent. Health never changes speed, spin, attack or stability, so there is no death spiral. A top can burst with plenty of spin left, or spin out at full health.

### Damage formula
For each **damaging impact** (see contact lifecycle below), damage from A to B is:

```
gate     : no damage unless vₙ > v_min                        v_min = 0.03 m/s
v_blade  = ringStrike_A · |ω_A| · r_A                           A's blade strike speed, m/s
E_A      = ½ · μ · vₙ · (k_imp · vₙ + k_rot · v_blade)         strike energy, J
x        = (E_A / E_ref)^p                                       severity
S        = x / (1 + x / x_cap)                                   soft cap
f_att    = attack_A / attack_ref                                 linear
f_def    = K / (K + e · defense_B)                               bounded, diminishing returns
damage   = G · f_att · f_def · S
```

| Term | Purpose | Default |
| --- | --- | --- |
| vₙ | Relative approach speed along the contact normal, before the impulse. A glancing contact has small vₙ, so it does little damage even when the rings slip fast. | — |
| μ = m_A·m_B/(m_A+m_B) | Effective (reduced) collision mass. Heavier pairings carry more impact energy. | — |
| v_blade | Rotational striking potential: the existing `ringStrike` (blade protrusion, from the ring part × attack) times the ring's surface speed. It falls as the top loses spin. | — |
| k_imp, k_rot | Weights of the translational and rotational terms. With the defaults the blade term dominates, so damage grows roughly linearly with impact speed and with the attacker's spin. | 1, 10 |
| v_min | Gate below which contacts (resting nudges) do no damage. | 0.03 m/s |
| E_ref, p | Severity normalisation and compression. p < 1 narrows the gap between light and heavy hits, so ordinary contacts still matter. | 0.005 J, 0.5 |
| x_cap | Soft cap. Hard hits approach `G · f_att · f_def · x_cap` instead of spiking without limit. | 2 |
| f_att | Linear attack scaling, so future attack upgrades help proportionally. | attack_ref 65 |
| f_def | Never reaches 0 for any finite defense, so no build becomes invulnerable. Each extra point of defense helps less than the previous one. | K 100, e 0.5 |
| G | Global damage scale (HP per unit severity). | 50 |

Both tops' damage comes from the **same pre-impulse report** and is applied together, so slot order cannot matter. Damage is ≥ 0 and finite for any input, including NaN, Infinity and zero references (all covered by tests). There are **no random critical hits and no class-specific multipliers**: Inferno hits harder only because of its attack stat, its jagged ring's strike factor, its speed and its spin.

Typical hits with the defaults:
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
v0.1 used attack to increase the spin an impact strips from the opponent (`impactSpinDrain`, ×0.5–1.6) and defense to resist it (`impactSpinResist`, 0–60 %). Attack and defense now act through health damage, so these stat modifiers are blended toward neutral by **`statSpinDrainWeight`**: drain = 1 + w·(drain − 1) and resist = w·resist, with **w = 0.5** by default.

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
- **Both eliminated on the same step** (any combination of conditions) is a **draw**.
- **One top meeting several conditions on the same step** is classified burst > knockout > spin (`FINISH_PRIORITY`). A burst is the decisive structural failure at impact. A knockout requires travelling over the rim afterwards. A spin-out is the slowest process.
- Once set, the `BattleResult` is frozen and combat is disabled. The aftermath (the winner keeps spinning while the loser topples, bursts or flies out) never changes it.
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

## Balance (v0.2, Classic Bowl)

Full reports:
- [`docs/balance/BALANCE_REPORT.md`](docs/balance/BALANCE_REPORT.md): the summary.
- [`v0.2-final-seeds-1-500.md`](docs/balance/v0.2-final-seeds-1-500.md): the final 8,000-battle run.
- [`v0.2-final-seeds-100001-100500.md`](docs/balance/v0.2-final-seeds-100001-100500.md): a second seed set used for validation.
- [`v0.2-initial-seeds-1-500.md`](docs/balance/v0.2-initial-seeds-1-500.md): the initial parameters.

Slot-averaged win rate of the row top against the column top (seeds 1–500, both slot orders; draws and timeouts count as neither):

| | Inferno | Titan | Tempest | Phantom |
| --- | --- | --- | --- | --- |
| **Inferno** | 50 % | 0 % | 73 % | 0.4 % |
| **Titan** | 100 % | 50 % | 0 % | 100 % |
| **Tempest** | 27 % | 100 % | 50 % | 42 % |
| **Phantom** | 99.6 % | 0 % | 58 % | 50 % |

The approved counter **cycle emerges in the right direction**: Inferno beats Tempest, Tempest beats Titan, and Titan beats Inferno. The magnitudes, however, are far more extreme than the 55–70 % targets, and **Titan is overpowered**: it wins every battle against Inferno and Phantom. See *Known limitations*.

## Known limitations

- **Real-device performance and feel of v0.2 are unverified.** Screenshots were taken with headless Chromium using software WebGL at desktop, phone-portrait and phone-landscape sizes. That checks layout and effects, not real-device frame rates. The combat layer adds negligible simulation cost: about 0.76 µs per step with combat on vs 0.73–0.86 µs off, measured headless.
- **Balance misses the targets** (see the balance report):
  - Titan beats Inferno and Phantom in 100 % of battles. Nobody can burst it (900 HP and high defense) before running out of spin, and its ball tip and high stability outlast Phantom's.
  - Inferno wins only against Tempest.
  - These matchups are decided by stamina, which barely varies by seed, so they stay 0 % / 100 % rather than 35/65. No global combat parameter in the sweeps fixed this without making Inferno destroy Tempest in seconds. Fixing it needs a design decision on stats or parts, not a hidden multiplier.
- **Durations:**
  - Stamina-heavy matchups (Titan vs Tempest, 46 s) run shorter than the 60–90 s target.
  - The defensive matchup (Titan vs Inferno, 26 s) runs shorter than 45–75 s, because Inferno runs out of spin at about 25 s.
  - Even mirrors land at about 29–69 s.
- **Opening-clash knockouts:** about 7 % of Inferno vs Tempest battles end in a knockout within the first second, when the first collision throws Tempest into the rim.
- Collision shapes are circles. Ring geometry is approximated by friction and strike parameters. Damage is attributed per contact, not per blade.
- The knockout check is a 2.5D estimate made at wall impacts. There is no true vertical motion, and the escape arc is presentation only.
- Debris is cosmetic: it does not collide with the surviving top or with other debris, only with the bowl surface and wall.
- The tilt and wobble state is kinematic: it affects contact and visuals but stores no energy.
- The visual lean of a top includes half the local surface slope. This is a presentation choice, not simulated.
- Changing developer parameters rebuilds the battle. They cannot be changed mid-battle.
- Only the Classic Bowl exists.

## Out of scope for v0.2

Launch-timing minigame, manual steering, special abilities and signature moves, critical hits, additional tops or stadiums, permanent upgrades, equipment inventory, starter selection, credits, XP, trophies, career, shop, tournaments, accounts, multiplayer, team battles and backend services.
