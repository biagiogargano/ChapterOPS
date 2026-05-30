/**
 * starterPackValidation.ts — pure integrity check for a starter pack.
 *
 * A small internal helper (NOT a general schema validator): it confirms a SetupPack
 * is well-formed and that its id references point at things that actually exist
 * (event templates, questionnaire definitions), so a malformed/typo'd pack is caught
 * in tests rather than at runtime. Custom (non-runtime) role keys are reported as
 * WARNINGS, not errors — they are valid pack data that the runtime can't use yet
 * (see lib/rolePackRuntime). Pure: no I/O, never throws.
 */

import type { SetupPack } from './rolePack';
import { LEVEL_RANK, type OrgLevel } from './orgLevels';
import { unsupportedRuntimeRoleKeys } from './rolePackRuntime';
import { EVENT_TEMPLATES } from './eventTemplates';
import { getQuestionnaireDefinition } from './reportDefinitions';

export interface StarterPackValidation {
  valid:    boolean;     // no ERRORS (warnings do not affect validity)
  errors:   string[];    // structural problems that make the pack unusable
  warnings: string[];    // non-fatal notes (e.g. custom keys the runtime can't use)
}

const VALID_LEVELS = new Set<string>(Object.keys(LEVEL_RANK) as OrgLevel[]);

/**
 * Validate a starter pack. Returns { valid, errors, warnings }. Never throws.
 * `valid` is true when there are no ERRORS — warnings (like unsupported runtime role
 * keys) are informational and do not fail the pack.
 */
export function validateStarterPack(pack: SetupPack): StarterPackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Top-level shape ──────────────────────────────────────────────────────────
  if (!pack.orgType || pack.orgType.trim() === '') errors.push('pack orgType is required');
  if (!pack.label || pack.label.trim() === '')     errors.push('pack label is required');
  if (!Array.isArray(pack.defaultEventKinds) || pack.defaultEventKinds.length === 0) {
    warnings.push('pack declares no default event kinds');
  }

  const rp = pack.rolePack;
  if (!rp) {
    errors.push('pack has no role pack');
    return { valid: errors.length === 0, errors, warnings };
  }

  // ── Roles: unique keys, present labels, valid levels ─────────────────────────
  if (!Array.isArray(rp.roles) || rp.roles.length === 0) {
    errors.push('role pack has no roles');
  } else {
    const seen = new Set<string>();
    for (const r of rp.roles) {
      if (!r.key || r.key.trim() === '')       errors.push('a role has an empty key');
      else if (seen.has(r.key))                errors.push(`duplicate role key: ${r.key}`);
      else                                     seen.add(r.key);
      if (!r.label || r.label.trim() === '')   errors.push(`role "${r.key}" has no label`);
      if (!VALID_LEVELS.has(r.level))          errors.push(`role "${r.key}" has invalid level: ${r.level}`);
    }
  }

  // ── Special role sets must reference roles declared in the pack (or be empty) ─
  const declared = new Set(rp.roles?.map(r => r.key) ?? []);
  const refInPack = (key: string, where: string) => {
    if (!declared.has(key)) errors.push(`${where} role "${key}" is not declared in the pack`);
  };
  if (rp.floorRole) refInPack(rp.floorRole, 'floor');
  else              errors.push('role pack has no floorRole');
  for (const k of rp.leadershipRoles ?? []) refInPack(k, 'leadership');
  for (const k of rp.officerRoles ?? [])    refInPack(k, 'officer');

  // ── Default content ids must reference things that exist ─────────────────────
  const knownTemplateIds = new Set(EVENT_TEMPLATES.map(t => t.id));
  for (const id of rp.defaultEventTemplateIds ?? []) {
    if (!knownTemplateIds.has(id)) {
      errors.push(`default event template id "${id}" is not a known active template`);
    }
  }
  for (const id of rp.defaultQuestionnaireIds ?? []) {
    if (getQuestionnaireDefinition(id) === null) {
      errors.push(`default questionnaire id "${id}" is not a known definition`);
    }
  }
  for (const s of rp.defaultAgendaSections ?? []) {
    if (typeof s !== 'string' || s.trim() === '') errors.push('an agenda section id is empty');
  }

  // ── Runtime compatibility: custom keys are a WARNING, not an error ───────────
  const allRoleKeys = [
    ...(rp.roles?.map(r => r.key) ?? []),
    ...(rp.leadershipRoles ?? []),
    ...(rp.officerRoles ?? []),
    ...(rp.floorRole ? [rp.floorRole] : []),
  ];
  const unsupported = unsupportedRuntimeRoleKeys(allRoleKeys);
  if (unsupported.length > 0) {
    warnings.push(`pack has ${unsupported.length} custom role key(s) the runtime can't use yet: ${unsupported.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Convenience diagnostic summary for a pack: valid flag, error/warning counts, and
 * the unsupported runtime role keys. For tests / dev logging. Pure.
 */
export function starterPackDiagnostics(pack: SetupPack): {
  orgType: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  unsupportedRoleKeys: string[];
} {
  const v = validateStarterPack(pack);
  const rp = pack.rolePack;
  const allRoleKeys = rp
    ? [...rp.roles.map(r => r.key), ...rp.leadershipRoles, ...rp.officerRoles, rp.floorRole]
    : [];
  return {
    orgType: pack.orgType,
    valid: v.valid,
    errorCount: v.errors.length,
    warningCount: v.warnings.length,
    unsupportedRoleKeys: unsupportedRuntimeRoleKeys(allRoleKeys),
  };
}
