import { STARTER_TOPS } from '../content/tops';
import { COLLISION_PARAMS, SIM_LIMITS, STADIUM_PARAMS, TOP_PARAMS, type ParamSpec } from './params';
import { CONFIG_VERSION, type SandboxConfig, type TopOverrides, type TopSlotConfig } from './sandboxConfig';

export type ValidationResult = { ok: true; config: SandboxConfig } | { ok: false; errors: string[] };

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

function checkGroup(
  errors: string[],
  path: string,
  raw: unknown,
  specs: readonly ParamSpec[],
): Record<string, number> | undefined {
  if (!isObj(raw)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const s of specs) {
    const v = checkNumber(errors, `${path}.${s.key}`, raw[s.key], s.min, s.max);
    if (v !== undefined) out[s.key] = v;
  }
  for (const k of Object.keys(raw)) {
    if (!specs.some((s) => s.key === k)) errors.push(`${path}.${k} is not a recognised parameter`);
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
      const spec = TOP_PARAMS.find((s) => s.key === k);
      if (!spec) {
        errors.push(`${path}.overrides.${k} is not a recognised parameter`);
        continue;
      }
      const n = checkNumber(errors, `${path}.overrides.${k}`, v, spec.min, spec.max);
      if (n !== undefined) overrides[spec.key] = n;
    }
  }
  return typeof topId === 'string' ? { topId, overrides } : undefined;
}

/** Validates untrusted JSON (e.g. an imported file) into a SandboxConfig. */
export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Configuration must be a JSON object'] };
  if (raw.version !== CONFIG_VERSION) errors.push(`version must be ${CONFIG_VERSION}`);
  const seed = raw.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    errors.push('seed must be an integer between 0 and 4294967295');
  }
  checkNumber(errors, 'maxDuration', raw.maxDuration, SIM_LIMITS.maxDuration.min, SIM_LIMITS.maxDuration.max);
  const stadium = checkGroup(errors, 'stadium', raw.stadium, STADIUM_PARAMS);
  const collision = checkGroup(errors, 'collision', raw.collision, COLLISION_PARAMS);
  const player = checkSlot(errors, 'player', raw.player);
  const opponent = checkSlot(errors, 'opponent', raw.opponent);
  if (errors.length > 0 || !stadium || !collision || !player || !opponent) {
    return { ok: false, errors: errors.length ? errors : ['Invalid configuration'] };
  }
  return {
    ok: true,
    config: {
      version: CONFIG_VERSION,
      seed: seed as number,
      maxDuration: raw.maxDuration as number,
      stadium: stadium as SandboxConfig['stadium'],
      collision: collision as SandboxConfig['collision'],
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
