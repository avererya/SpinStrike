import { STARTER_TOPS } from '../content/tops';
import { RULESETS, type Ruleset } from '../content/derive';
import { LAUNCH_QUALITIES, isLaunchQuality, validDistribution, type LaunchDistribution } from '../sim/launch';
import {
  AI_LAUNCH_PARAMS,
  COLLISION_PARAMS,
  COMBAT_PARAMS,
  LAUNCH_BONUS_PARAMS,
  LAUNCH_PARAMS,
  LAUNCH_ZONE_PARAMS,
  MOVEMENT_PARAMS,
  RESULT_PARAMS,
  SIM_LIMITS,
  STADIUM_PARAMS,
  TOP_COMBAT_PARAMS,
  TOP_PARAMS,
  type ParamSpec,
} from './params';
import { AIM_LIMITS, type LaunchAim } from '../sim/launchGeometry';
import {
  CONFIG_VERSION,
  defaultConfig,
  legacyMovementConfig,
  legacyV02Config,
  type FixedQuality,
  type LaunchConfig,
  type PresentationConfig,
  type SandboxConfig,
  type TopOverrides,
  type TopSlotConfig,
} from './sandboxConfig';

export type ValidationResult =
  | { ok: true; config: SandboxConfig; /** Notes about migrated / defaulted fields (v0.1/v0.2 imports). */ notes: string[] }
  | { ok: false; errors: string[] };

const ALL_TOP_SPECS: readonly ParamSpec[] = [...TOP_PARAMS, ...TOP_COMBAT_PARAMS];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkNumber(errors: string[], path: string, v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path} must be a finite number`);
    return undefined;
  }
  if (v < min || v > max) {
    errors.push(`${path} must be between ${min} and ${max} (got ${v})`);
    return undefined;
  }
  return v;
}

/**
 * Validates a group of numeric parameters. Keys listed in `optional` may be
 * missing (filled from `defaults`, with a note); all present keys must be
 * valid and unknown keys are rejected.
 */
function checkGroup(
  errors: string[],
  notes: string[],
  path: string,
  raw: unknown,
  specs: readonly ParamSpec[],
  defaults: Record<string, number>,
  optional: ReadonlySet<string>,
  extraKeys: readonly string[] = [],
): Record<string, number> | undefined {
  if (raw === undefined && specs.every((s) => optional.has(s.key))) {
    notes.push(`${path}: missing, using defaults`);
    return { ...defaults };
  }
  if (!isObj(raw)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const s of specs) {
    if (raw[s.key] === undefined && optional.has(s.key)) {
      out[s.key] = defaults[s.key]!;
      notes.push(`${path}.${s.key}: not in file, using default ${defaults[s.key]}`);
      continue;
    }
    const v = checkNumber(errors, `${path}.${s.key}`, raw[s.key], s.min, s.max);
    if (v !== undefined) out[s.key] = v;
  }
  for (const k of Object.keys(raw)) {
    if (!specs.some((s) => s.key === k) && !extraKeys.includes(k)) errors.push(`${path}.${k} is not a recognised parameter`);
  }
  return out;
}

function checkSlot(errors: string[], path: string, raw: unknown): TopSlotConfig | undefined {
  if (!isObj(raw)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  const topId = raw.topId;
  if (typeof topId !== 'string' || !STARTER_TOPS.some((t) => t.id === topId)) {
    errors.push(`${path}.topId must be one of: ${STARTER_TOPS.map((t) => t.id).join(', ')}`);
  }
  const overrides: TopOverrides = {};
  const rawOv = raw.overrides ?? {};
  if (!isObj(rawOv)) {
    errors.push(`${path}.overrides must be an object`);
  } else {
    for (const [k, v] of Object.entries(rawOv)) {
      const spec = ALL_TOP_SPECS.find((s) => s.key === k);
      if (!spec) {
        errors.push(`${path}.overrides.${k} is not a recognised parameter`);
        continue;
      }
      const n = checkNumber(errors, `${path}.overrides.${k}`, v, spec.min, spec.max);
      if (n !== undefined) (overrides as Record<string, number>)[spec.key] = n;
    }
  }
  return typeof topId === 'string' ? { topId, overrides } : undefined;
}

function checkBool(errors: string[], notes: string[] | null, path: string, v: unknown, def: boolean, optional: boolean): boolean {
  if (v === undefined) {
    if (!optional) {
      errors.push(`${path} must be true or false`);
      return def;
    }
    notes?.push(`${path}: not in file, using default ${def}`);
    return def;
  }
  if (typeof v !== 'boolean') {
    errors.push(`${path} must be true or false`);
    return def;
  }
  return v;
}

function checkQuality(errors: string[], path: string, v: unknown): FixedQuality {
  if (v === 'auto' || isLaunchQuality(v)) return v;
  errors.push(`${path} must be one of: auto, ${LAUNCH_QUALITIES.join(', ')}`);
  return 'auto';
}

function checkAim(errors: string[], path: string, v: unknown, allowAuto: boolean): LaunchAim | 'auto' | undefined {
  if (allowAuto && v === 'auto') return 'auto';
  if (!isObj(v)) {
    errors.push(`${path} must be ${allowAuto ? "'auto' or " : ''}an object {direction, tilt}`);
    return undefined;
  }
  const dir = checkNumber(errors, `${path}.direction`, v.direction, AIM_LIMITS.direction.min, AIM_LIMITS.direction.max);
  const tilt = checkNumber(errors, `${path}.tilt`, v.tilt, AIM_LIMITS.tilt.min, AIM_LIMITS.tilt.max);
  for (const k of Object.keys(v)) if (k !== 'direction' && k !== 'tilt') errors.push(`${path}.${k} is not a recognised parameter`);
  return dir !== undefined && tilt !== undefined ? { direction: dir, tilt } : undefined;
}

function checkRange(errors: string[], path: string, v: unknown, lim: { min: number; max: number }): { min: number; max: number } | undefined {
  if (!isObj(v)) {
    errors.push(`${path} must be an object {min, max}`);
    return undefined;
  }
  const lo = checkNumber(errors, `${path}.min`, v.min, lim.min, lim.max);
  const hi = checkNumber(errors, `${path}.max`, v.max, lim.min, lim.max);
  if (lo !== undefined && hi !== undefined && lo > hi) errors.push(`${path}.min must not exceed ${path}.max`);
  return lo !== undefined && hi !== undefined ? { min: lo, max: hi } : undefined;
}

function checkLaunch(errors: string[], raw: unknown, d: LaunchConfig, v3: boolean): LaunchConfig {
  const notes: string[] = [];
  if (!isObj(raw)) {
    errors.push('launch must be an object');
    return d;
  }
  const none = new Set<string>();
  const nums = checkGroup(errors, notes, 'launch', raw, LAUNCH_PARAMS, d as unknown as Record<string, number>, none, [
    'minigame',
    'playerQuality',
    'opponentQuality',
    'zones',
    'bonuses',
    'aiDistribution',
    'playerAim',
    'opponentAim',
    'aiAim',
  ]);
  // Aim fields are new in v0.4.1 (version 4); version 3 files get the defaults.
  let playerAim: LaunchAim = d.playerAim;
  let opponentAim: LaunchAim | 'auto' = d.opponentAim;
  let aiAimProfile = d.aiAim;
  if (!v3 || raw.playerAim !== undefined) playerAim = (checkAim(errors, 'launch.playerAim', raw.playerAim, false) as LaunchAim | undefined) ?? d.playerAim;
  if (!v3 || raw.opponentAim !== undefined) opponentAim = checkAim(errors, 'launch.opponentAim', raw.opponentAim, true) ?? d.opponentAim;
  if (!v3 || raw.aiAim !== undefined) {
    const a = isObj(raw.aiAim) ? raw.aiAim : {};
    if (!isObj(raw.aiAim)) errors.push('launch.aiAim must be an object');
    const dr = checkRange(errors, 'launch.aiAim.direction', a.direction, AIM_LIMITS.direction);
    const tr = checkRange(errors, 'launch.aiAim.tilt', a.tilt, AIM_LIMITS.tilt);
    if (dr && tr) aiAimProfile = { direction: dr, tilt: tr };
  }
  const zones = checkGroup(errors, notes, 'launch.zones', raw.zones, LAUNCH_ZONE_PARAMS, d.zones as unknown as Record<string, number>, none);
  const bonuses = checkGroup(errors, notes, 'launch.bonuses', raw.bonuses, LAUNCH_BONUS_PARAMS, d.bonuses as unknown as Record<string, number>, none);
  const dist = checkGroup(errors, notes, 'launch.aiDistribution', raw.aiDistribution, AI_LAUNCH_PARAMS, d.aiDistribution as unknown as Record<string, number>, none);
  if (zones && zones.perfect !== undefined && zones.great !== undefined && zones.good !== undefined) {
    if (!(zones.perfect < zones.great && zones.great < zones.good)) errors.push('launch.zones must satisfy perfect < great < good');
  }
  if (dist && Object.keys(dist).length === 4 && !validDistribution(dist as unknown as LaunchDistribution)) {
    errors.push('launch.aiDistribution probabilities must sum to 1');
  }
  return {
    minigame: checkBool(errors, null, 'launch.minigame', raw.minigame, d.minigame, false),
    playerQuality: checkQuality(errors, 'launch.playerQuality', raw.playerQuality),
    opponentQuality: checkQuality(errors, 'launch.opponentQuality', raw.opponentQuality),
    sweepTime: nums?.sweepTime ?? d.sweepTime,
    timeout: nums?.timeout ?? d.timeout,
    zones: (zones as unknown as LaunchConfig['zones']) ?? d.zones,
    bonuses: (bonuses as unknown as LaunchConfig['bonuses']) ?? d.bonuses,
    aiDistribution: (dist as unknown as LaunchConfig['aiDistribution']) ?? d.aiDistribution,
    playerAim,
    opponentAim,
    aiAim: aiAimProfile,
  };
}

/**
 * Validates untrusted JSON (e.g. an imported file) into a SandboxConfig.
 *
 * Accepts the current format (version 3) and older files:
 *   - version 1 (SpinStrike v0.1) and version 2 (v0.2) are MIGRATED to the
 *     legacy v0.2 ruleset: every value in the file is kept exactly; values
 *     the file does not contain take the v0.2 defaults; the v0.3 mechanics
 *     (critical hits, launch bonuses, draw window) are OFF so the imported
 *     configuration reproduces its original battles. Notes explain how to
 *     switch to the v0.3 ruleset and mechanics in the developer panel.
 *   - Nothing valid is discarded; anything invalid is reported as an error
 *     rather than silently corrected.
 */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const notes: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Configuration must be a JSON object'] };
  const version = raw.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== CONFIG_VERSION) {
    return { ok: false, errors: [`version must be 1 (v0.1), 2 (v0.2), 3 (v0.3 – v0.4.0) or ${CONFIG_VERSION} (v0.4.1) (got ${JSON.stringify(version)})`] };
  }
  const v1 = version === 1;
  const v3 = version === 3;
  if (v3) {
    notes.push(
      'Migrated a version 3 (v0.3 – v0.4.0) configuration: every value is kept, and the v0.4.1 movement variability (launch variation, aiming, floor relief, contact wander) is off so it reproduces its original battles. Turn on natural variation and choose the v0.4.1 ruleset in the developer panel to play it under v0.4.1 rules.',
    );
  }
  const legacy = version === 1 || version === 2;
  if (legacy) {
    notes.push(
      `Migrated a ${v1 ? 'v0.1 (version 1)' : 'v0.2 (version 2)'} configuration to the legacy v0.2 ruleset: all values in the file are kept, missing values use v0.2 defaults, and the v0.3 mechanics (critical hits, launch bonuses, draw window) are off so it reproduces the original battles. Switch the ruleset to v0.3 and enable the new mechanics in the developer panel to play it under v0.3 rules.`,
    );
  }
  const d = legacy ? legacyV02Config(0) : defaultConfig(0);

  const seed = raw.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    errors.push('seed must be an integer between 0 and 4294967295');
  }
  checkNumber(errors, 'maxDuration', raw.maxDuration, SIM_LIMITS.maxDuration.min, SIM_LIMITS.maxDuration.max);

  let ruleset: Ruleset = d.ruleset;
  if (!legacy) {
    if (typeof raw.ruleset === 'string' && (RULESETS as readonly string[]).includes(raw.ruleset)) ruleset = raw.ruleset as Ruleset;
    else errors.push(`ruleset must be one of: ${RULESETS.join(', ')}`);
  }

  // Fields new in v0.2 are optional in v1 files only.
  const stadiumOpt = new Set<string>(v1 ? ['rimLipHeight'] : []);
  const collisionOpt = new Set<string>(v1 ? ['statSpinDrainWeight'] : []);
  const combatOpt = new Set<string>(v1 ? COMBAT_PARAMS.map((s) => s.key) : []);
  const stadium = checkGroup(errors, notes, 'stadium', raw.stadium, STADIUM_PARAMS, d.stadium, stadiumOpt);
  const collision = checkGroup(errors, notes, 'collision', raw.collision, COLLISION_PARAMS, d.collision, collisionOpt);
  const rawCombat = raw.combat;
  const combatNums = checkGroup(errors, notes, 'combat', rawCombat, COMBAT_PARAMS, d.combat as unknown as Record<string, number>, combatOpt, [
    'knockouts',
    'criticalHits',
  ]);
  const rc = isObj(rawCombat) ? rawCombat : {};
  const knockouts = checkBool(errors, v1 ? notes : null, 'combat.knockouts', rc.knockouts, d.combat.knockouts, v1 && rawCombat === undefined);
  // Critical hits did not exist before v0.3: legacy files get them off.
  const criticalHits = legacy
    ? (rc.criticalHits === undefined ? false : checkBool(errors, null, 'combat.criticalHits', rc.criticalHits, false, true))
    : checkBool(errors, null, 'combat.criticalHits', rc.criticalHits, d.combat.criticalHits, false);

  let presentation: PresentationConfig = { ...d.presentation };
  const rawPres = raw.presentation;
  if (rawPres === undefined && v1) {
    notes.push('presentation: not in file, using defaults');
  } else if (!isObj(rawPres)) {
    errors.push('presentation must be an object');
  } else {
    presentation = {
      cinematicFinishes: checkBool(errors, notes, 'presentation.cinematicFinishes', rawPres.cinematicFinishes, d.presentation.cinematicFinishes, false),
      damageNumbers: checkBool(errors, notes, 'presentation.damageNumbers', rawPres.damageNumbers, d.presentation.damageNumbers, false),
      criticalEffects: checkBool(errors, legacy ? null : notes, 'presentation.criticalEffects', rawPres.criticalEffects, d.presentation.criticalEffects, legacy),
    };
    for (const k of Object.keys(rawPres)) {
      if (!['cinematicFinishes', 'damageNumbers', 'criticalEffects'].includes(k)) errors.push(`presentation.${k} is not a recognised parameter`);
    }
  }

  // v0.3 groups: required in version 3, defaulted (legacy: mechanics off) in older files.
  let launch = d.launch;
  let results = d.results;
  if (!legacy) {
    launch = checkLaunch(errors, raw.launch, d.launch, v3);
    const res = checkGroup(errors, notes, 'results', raw.results, RESULT_PARAMS, d.results as unknown as Record<string, number>, new Set());
    if (res) results = res as unknown as SandboxConfig['results'];
  }

  let movement = legacy || v3 ? legacyMovementConfig() : d.movement;
  if (!legacy && !v3) {
    const rm = raw.movement;
    const nums = checkGroup(errors, notes, 'movement', rm, MOVEMENT_PARAMS, d.movement as unknown as Record<string, number>, new Set(), ['naturalVariation']);
    const nv = checkBool(errors, null, 'movement.naturalVariation', isObj(rm) ? rm.naturalVariation : undefined, true, false);
    if (nums) movement = { ...(nums as unknown as SandboxConfig['movement']), naturalVariation: nv };
  } else if (raw.movement !== undefined) errors.push(`movement is not valid in a version ${version as number} file`);

  const player = checkSlot(errors, 'player', raw.player);
  const opponent = checkSlot(errors, 'opponent', raw.opponent);
  const known = ['version', 'ruleset', 'seed', 'maxDuration', 'stadium', 'collision', 'combat', 'launch', 'movement', 'results', 'presentation', 'player', 'opponent'];
  for (const k of Object.keys(raw)) if (!known.includes(k)) errors.push(`${k} is not a recognised setting`);
  if (legacy) for (const k of ['ruleset', 'launch', 'results']) if (raw[k] !== undefined) errors.push(`${k} is not valid in a version ${version as number} file`);

  if (errors.length > 0 || !stadium || !collision || !combatNums || !player || !opponent) {
    return { ok: false, errors: errors.length ? errors : ['Invalid configuration'] };
  }
  return {
    ok: true,
    notes,
    config: {
      version: CONFIG_VERSION,
      ruleset,
      seed: seed as number,
      maxDuration: raw.maxDuration as number,
      stadium: stadium as SandboxConfig['stadium'],
      collision: collision as SandboxConfig['collision'],
      combat: { ...(combatNums as unknown as SandboxConfig['combat']), knockouts, criticalHits },
      launch: JSON.parse(JSON.stringify(launch)) as LaunchConfig,
      movement: { ...movement },
      results: { ...results },
      presentation,
      player,
      opponent,
    },
  };
}

export function parseConfigJson(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  return validateConfig(raw);
}
