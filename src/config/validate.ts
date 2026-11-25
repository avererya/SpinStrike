import { STARTER_TOPS } from '../content/tops';
import {
  COLLISION_PARAMS,
  COMBAT_PARAMS,
  SIM_LIMITS,
  STADIUM_PARAMS,
  TOP_COMBAT_PARAMS,
  TOP_PARAMS,
  type ParamSpec,
} from './params';
import { CONFIG_VERSION, defaultConfig, type SandboxConfig, type TopOverrides, type TopSlotConfig } from './sandboxConfig';

export type ValidationResult =
  | { ok: true; config: SandboxConfig; /** Notes about migrated / defaulted fields (v0.1 imports). */ notes: string[] }
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

function checkBool(errors: string[], notes: string[], path: string, v: unknown, def: boolean): boolean {
  if (v === undefined) {
    notes.push(`${path}: not in file, using default ${def}`);
    return def;
  }
  if (typeof v !== 'boolean') {
    errors.push(`${path} must be true or false`);
    return def;
  }
  return v;
}

/**
 * Validates untrusted JSON (e.g. an imported file) into a SandboxConfig.
 *
 * Accepts the current format (version 2) and SpinStrike v0.1 files
 * (version 1). v0.1 files are migrated: every v0.1 value is kept exactly,
 * and the parameters that did not exist in v0.1 (combat, rim lip, combat
 * spin-drain weight, presentation switches, per-top health/attack/defense)
 * take their v0.2 defaults. Nothing valid is discarded; anything invalid is
 * reported as an error rather than silently corrected.
 */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const notes: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Configuration must be a JSON object'] };
  const version = raw.version;
  if (version !== 1 && version !== CONFIG_VERSION) {
    return { ok: false, errors: [`version must be 1 (v0.1) or ${CONFIG_VERSION} (got ${JSON.stringify(version)})`] };
  }
  const v1 = version === 1;
  if (v1) notes.push('Migrated a v0.1 (version 1) configuration: new v0.2 parameters use their defaults.');
  const d = defaultConfig(0);

  const seed = raw.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    errors.push('seed must be an integer between 0 and 4294967295');
  }
  checkNumber(errors, 'maxDuration', raw.maxDuration, SIM_LIMITS.maxDuration.min, SIM_LIMITS.maxDuration.max);

  // Fields new in v0.2 are optional in v1 files only.
  const stadiumOpt = new Set<string>(v1 ? ['rimLipHeight'] : []);
  const collisionOpt = new Set<string>(v1 ? ['statSpinDrainWeight'] : []);
  const combatOpt = new Set<string>(v1 ? COMBAT_PARAMS.map((s) => s.key) : []);
  const stadium = checkGroup(errors, notes, 'stadium', raw.stadium, STADIUM_PARAMS, d.stadium, stadiumOpt);
  const collision = checkGroup(errors, notes, 'collision', raw.collision, COLLISION_PARAMS, d.collision, collisionOpt);
  const rawCombat = raw.combat;
  const combatNums = checkGroup(errors, notes, 'combat', rawCombat, COMBAT_PARAMS, d.combat as unknown as Record<string, number>, combatOpt, ['knockouts']);
  const knockouts = checkBool(
    errors,
    v1 ? notes : [],
    'combat.knockouts',
    isObj(rawCombat) ? rawCombat.knockouts : undefined,
    d.combat.knockouts,
  );
  if (!v1 && isObj(rawCombat) && rawCombat.knockouts === undefined) errors.push('combat.knockouts must be true or false');

  let presentation = d.presentation;
  const rawPres = raw.presentation;
  if (rawPres === undefined && v1) {
    notes.push('presentation: not in file, using defaults');
  } else if (!isObj(rawPres)) {
    errors.push('presentation must be an object');
  } else {
    presentation = {
      cinematicFinishes: checkBool(errors, notes, 'presentation.cinematicFinishes', rawPres.cinematicFinishes, d.presentation.cinematicFinishes),
      damageNumbers: checkBool(errors, notes, 'presentation.damageNumbers', rawPres.damageNumbers, d.presentation.damageNumbers),
    };
    for (const k of Object.keys(rawPres)) {
      if (k !== 'cinematicFinishes' && k !== 'damageNumbers') errors.push(`presentation.${k} is not a recognised parameter`);
    }
  }

  const player = checkSlot(errors, 'player', raw.player);
  const opponent = checkSlot(errors, 'opponent', raw.opponent);
  const known = ['version', 'seed', 'maxDuration', 'stadium', 'collision', 'combat', 'presentation', 'player', 'opponent'];
  for (const k of Object.keys(raw)) if (!known.includes(k)) errors.push(`${k} is not a recognised setting`);

  if (errors.length > 0 || !stadium || !collision || !combatNums || !player || !opponent) {
    return { ok: false, errors: errors.length ? errors : ['Invalid configuration'] };
  }
  return {
    ok: true,
    notes,
    config: {
      version: CONFIG_VERSION,
      seed: seed as number,
      maxDuration: raw.maxDuration as number,
      stadium: stadium as SandboxConfig['stadium'],
      collision: collision as SandboxConfig['collision'],
      combat: { ...(combatNums as Omit<SandboxConfig['combat'], 'knockouts'>), knockouts },
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
