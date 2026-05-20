/**
 * Isolated tests for lib/identityResolution.ts — dependency-free harness (no
 * test framework). Compile with tsc to a temp dir, run with node; non-zero exit
 * on failure. Covers active-org selection, the acting-role 'brother' floor and
 * override rules, and the synthetic fallback identity.
 */

import {
  selectActiveOrg,
  membershipForOrg,
  actingRoleFor,
  buildFallbackIdentity,
  type IdentityPhase,
} from './identityResolution';
import { DEMO_USER, DEMO_CHAPTER } from './demoUser';
import type { Membership, Organization, Member, Position } from '../types';

const proc: { exit(code: number): never } = (globalThis as any).process;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
function org(id: string): Organization {
  return { id, name: id, template: 'sigma_chi' };
}
function member(orgId: string): Member {
  return {
    id: `m_${orgId}`, orgId, authUserId: null, fullName: 'X', email: 'x@x.com',
    status: 'active', membershipStage: 'active', pledgeClass: null,
  };
}
function posn(orgId: string, role: string): Position {
  return { id: `p_${orgId}_${role}`, memberId: `m_${orgId}`, orgId, role, isActive: true, termStart: null, termEnd: null };
}
function mem(orgId: string, roles: string[]): Membership {
  return { organization: org(orgId), member: member(orgId), positions: roles.map(r => posn(orgId, r)) };
}

// ── selectActiveOrg ─────────────────────────────────────────────────────────
{
  const none = selectActiveOrg([]);
  check('select: empty → not_on_roster', none.phase === 'not_on_roster' && none.activeOrgId === null);

  const one = selectActiveOrg([mem('A', ['brother'])]);
  check('select: single → resolved + auto-select A', one.phase === 'resolved' && one.activeOrgId === 'A');

  const multiNoPref = selectActiveOrg([mem('A', ['brother']), mem('B', ['president'])]);
  check('select: multi, no preferred → selecting_org', multiNoPref.phase === 'selecting_org' && multiNoPref.activeOrgId === null);

  const multiPref = selectActiveOrg([mem('A', ['brother']), mem('B', ['president'])], 'B');
  check('select: multi, valid preferred → resolved B', multiPref.phase === 'resolved' && multiPref.activeOrgId === 'B');

  const multiBadPref = selectActiveOrg([mem('A', ['brother']), mem('B', ['president'])], 'C');
  check('select: multi, invalid preferred → selecting_org', multiBadPref.phase === 'selecting_org' && multiBadPref.activeOrgId === null);
}

// ── membershipForOrg ──────────────────────────────────────────────────────────
{
  const ms = [mem('A', ['brother']), mem('B', ['president'])];
  check('membershipForOrg: found', membershipForOrg(ms, 'B')?.organization.id === 'B');
  check('membershipForOrg: null id', membershipForOrg(ms, null) === null);
  check('membershipForOrg: missing', membershipForOrg(ms, 'Z') === null);
}

// ── actingRoleFor: brother floor in every non-resolved phase ──────────────────
{
  const floors: IdentityPhase[] = ['initializing', 'resolving', 'selecting_org', 'not_on_roster', 'error'];
  for (const phase of floors) {
    const r = actingRoleFor({ phase, allowOverride: true, positions: [posn('A', 'president')], override: 'president' });
    check(`actingRoleFor: ${phase} → brother floor`, r === 'brother');
  }
}

// ── actingRoleFor: resolved derivation + override rules ───────────────────────
{
  const ps = [posn('A', 'risk_manager')];
  check('actingRoleFor: resolved, no override → derived risk_manager',
    actingRoleFor({ phase: 'resolved', allowOverride: false, positions: ps, override: null }) === 'risk_manager');
  check('actingRoleFor: resolved, override allowed → president',
    actingRoleFor({ phase: 'resolved', allowOverride: true, positions: ps, override: 'president' }) === 'president');
  check('actingRoleFor: resolved, override NOT allowed → ignored (risk_manager)',
    actingRoleFor({ phase: 'resolved', allowOverride: false, positions: ps, override: 'president' }) === 'risk_manager');
  check('actingRoleFor: fallback, president positions → president',
    actingRoleFor({ phase: 'fallback', allowOverride: true, positions: [posn('A', 'president')], override: null }) === 'president');
}

// ── buildFallbackIdentity ─────────────────────────────────────────────────────
{
  const fb = buildFallbackIdentity();
  check('fallback: org id matches DEMO_CHAPTER', fb.organization.id === DEMO_CHAPTER.id);
  check('fallback: template sigma_chi', fb.organization.template === 'sigma_chi');
  check('fallback: member mirrors DEMO_USER', fb.member.fullName === DEMO_USER.full_name && fb.member.status === 'active');
  check('fallback: one active president position', fb.positions.length === 1 && fb.positions[0].role === 'president' && fb.positions[0].isActive);
}

console.log(`\nidentityResolution.test: ${passed} passed, ${failed} failed`);
proc.exit(failed > 0 ? 1 : 0);
