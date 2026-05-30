/**
 * Isolated tests for lib/starterPackValidation.ts — dependency-free harness.
 * Confirms registered packs are well-formed, custom role keys are warnings (not
 * errors), and malformed fixture packs fail safely (no throw).
 */

import { validateStarterPack, starterPackDiagnostics } from './starterPackValidation';
import { STARTER_PACKS, SIGMA_CHI_STARTER_PACK, getStarterPack } from './starterPacks';
import type { SetupPack } from './rolePack';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── All registered packs are valid ────────────────────────────────────────────
for (const pack of STARTER_PACKS) {
  const v = validateStarterPack(pack);
  check(`${pack.orgType} validates (no errors)`, v.valid === true);
  if (!v.valid) console.error(`    errors: ${v.errors.join(' | ')}`);
}

// ── sigma_chi: clean, no unsupported runtime roles ────────────────────────────
{
  const v = validateStarterPack(SIGMA_CHI_STARTER_PACK);
  check('sigma_chi has no errors', v.errors.length === 0);
  check('sigma_chi has no unsupported-role warning', v.warnings.every(w => !w.includes('custom role key')));
  check('sigma_chi diagnostics: 0 unsupported keys',
    starterPackDiagnostics(SIGMA_CHI_STARTER_PACK).unsupportedRoleKeys.length === 0);
}

// ── club: valid pack, BUT custom keys reported as a warning ───────────────────
{
  const club = getStarterPack('club')!;
  const v = validateStarterPack(club);
  check('club is valid (custom keys are not fatal)', v.valid === true);
  check('club warns about custom runtime role keys',
    v.warnings.some(w => w.includes('custom role key')));
  const diag = starterPackDiagnostics(club);
  check('club diagnostics report unsupported keys',
    diag.unsupportedRoleKeys.includes('vice_president') && diag.unsupportedRoleKeys.includes('event_chair'));
  check('club diagnostics still valid', diag.valid === true);
}

// ── Malformed fixtures fail safely (no throw, valid=false) ────────────────────
function baseValidPack(): SetupPack {
  return {
    orgType: 'fix', label: 'Fixture',
    rolePack: {
      id: 'fix', label: 'Fixture',
      roles: [
        { key: 'president', label: 'President', level: 'owner' },
        { key: 'member', label: 'Member', level: 'members' },
      ],
      floorRole: 'member',
      leadershipRoles: ['president'],
      officerRoles: [],
      assignmentExceptions: [],
    },
    defaultEventKinds: ['social'],
  };
}

{
  // sanity: the base fixture is valid
  check('base fixture is valid', validateStarterPack(baseValidPack()).valid === true);

  // missing label
  const noLabel = baseValidPack(); noLabel.label = '';
  check('missing label → invalid', validateStarterPack(noLabel).valid === false);

  // duplicate role key
  const dup = baseValidPack();
  dup.rolePack.roles.push({ key: 'president', label: 'Dup', level: 'officers' });
  check('duplicate role key → invalid', validateStarterPack(dup).valid === false);

  // invalid level
  const badLevel = baseValidPack();
  (badLevel.rolePack.roles[0] as any).level = 'supreme_leader';
  check('invalid level → invalid', validateStarterPack(badLevel).valid === false);

  // floor role not declared in the pack
  const badFloor = baseValidPack(); badFloor.rolePack.floorRole = 'ghost';
  check('undeclared floor role → invalid', validateStarterPack(badFloor).valid === false);

  // leadership role not declared
  const badLead = baseValidPack(); badLead.rolePack.leadershipRoles = ['nobody'];
  check('undeclared leadership role → invalid', validateStarterPack(badLead).valid === false);

  // unknown default event template id
  const badTmpl = baseValidPack(); badTmpl.rolePack.defaultEventTemplateIds = ['no_such_template'];
  check('unknown event template id → invalid', validateStarterPack(badTmpl).valid === false);

  // unknown questionnaire id
  const badQ = baseValidPack(); badQ.rolePack.defaultQuestionnaireIds = ['no_such_questionnaire'];
  check('unknown questionnaire id → invalid', validateStarterPack(badQ).valid === false);

  // empty agenda section
  const badAgenda = baseValidPack(); badAgenda.rolePack.defaultAgendaSections = ['ok', ''];
  check('empty agenda section → invalid', validateStarterPack(badAgenda).valid === false);
}

// ── Never throws on a degenerate pack ─────────────────────────────────────────
{
  let threw = false;
  try {
    const broken = { orgType: '', label: '', rolePack: undefined as any, defaultEventKinds: [] } as SetupPack;
    const v = validateStarterPack(broken);
    check('degenerate pack → invalid, no throw', v.valid === false);
  } catch { threw = true; }
  check('validation never throws', threw === false);
}

console.log(`\nstarterPackValidation.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
