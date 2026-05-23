/**
 * identityResolution.ts — pure, deterministic helpers behind IdentityProvider.
 *
 * Side-effect free (no React, no I/O): active-organization selection, the
 * acting-role computation with its 'brother' floor, and the synthetic
 * no-env/dev fallback identity. Kept separate from identityStore.tsx so this
 * decision logic is unit-testable in isolation.
 */

import { type Role, ROLES } from './roles';
import { deriveActingRole } from './positions';
import { DEMO_USER, DEMO_CHAPTER } from './demoUser';
import type { Membership, Organization, Member, Position } from '../types';

/** Lifecycle phase of identity resolution. */
export type IdentityPhase =
  | 'initializing'   // auth state not yet known / no session
  | 'resolving'      // session known, fetching membership(s)
  | 'selecting_org'  // >1 membership, none chosen (dormant in MVP)
  | 'resolved'       // active membership selected
  | 'not_on_roster'  // valid session, no membership anywhere
  | 'error'          // transient or deterministic resolution failure
  | 'fallback';      // no-env demo / dev-bypass synthetic identity

export interface ActiveOrgSelection {
  phase:       'resolved' | 'selecting_org' | 'not_on_roster';
  activeOrgId: string | null;
}

/**
 * Choose the active organization from a user's memberships.
 *   0 → not_on_roster · 1 → auto-select · >1 → preferred if valid, else
 *   selecting_org. (The >1 path is dormant in MVP's single-org world.)
 */
export function selectActiveOrg(
  memberships: Membership[],
  preferredOrgId?: string | null,
): ActiveOrgSelection {
  if (memberships.length === 0) return { phase: 'not_on_roster', activeOrgId: null };
  if (memberships.length === 1) {
    return { phase: 'resolved', activeOrgId: memberships[0].organization.id };
  }
  if (preferredOrgId && memberships.some(m => m.organization.id === preferredOrgId)) {
    return { phase: 'resolved', activeOrgId: preferredOrgId };
  }
  return { phase: 'selecting_org', activeOrgId: null };
}

/**
 * Deterministic default org for a multi-org user with no stored preference.
 *
 * Returns the organization id of the membership that sorts first by
 * organization NAME (case-insensitive, locale-aware), with organization ID as a
 * stable tie-breaker. Determinism matters more than which org is chosen: the
 * user can switch in one tap and the choice is then persisted, so this only
 * decides the very-first-login default and must be the SAME across logins.
 *
 * Pure. INERT for now (CP planning): not wired into identityStore yet — a later
 * step uses it in the selecting_org restore fallback. Returns '' for an empty
 * list (callers only invoke it when memberships exist).
 */
export function pickDefaultOrg(memberships: Membership[]): string {
  if (memberships.length === 0) return '';
  const sorted = [...memberships].sort((a, b) => {
    const byName = a.organization.name.localeCompare(b.organization.name, undefined, {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    return a.organization.id.localeCompare(b.organization.id);   // stable tie-breaker
  });
  return sorted[0].organization.id;
}

/** The membership for a given org id, or null. */
export function membershipForOrg(
  memberships: Membership[],
  orgId: string | null,
): Membership | null {
  if (!orgId) return null;
  return memberships.find(m => m.organization.id === orgId) ?? null;
}

/**
 * The single role the member acts as.
 *   - Any phase that isn't 'resolved' or 'fallback' → 'brother' (least-privilege
 *     floor; prevents a privileged flash before resolution completes).
 *   - When overrides are allowed (dev/fallback) an explicit override wins.
 *   - Otherwise derived from the active org's positions.
 */
export function actingRoleFor(opts: {
  phase:         IdentityPhase;
  allowOverride: boolean;        // __DEV__ || isFallback
  positions:     Position[];
  override:      Role | null;
}): Role {
  const { phase, allowOverride, positions, override } = opts;
  const resolvedLike = phase === 'resolved' || phase === 'fallback';
  if (!resolvedLike) return ROLES.BROTHER;
  if (allowOverride && override) return override;
  return deriveActingRole(positions);
}

/**
 * Synthetic identity for the no-env demo / dev-bypass sandbox. Mirrors
 * DEMO_USER / DEMO_CHAPTER so the fallback experience matches today's app
 * (President, single demo org).
 */
export function buildFallbackIdentity(): {
  organization: Organization;
  member:       Member;
  positions:    Position[];
} {
  const organization: Organization = {
    id:       DEMO_CHAPTER.id,
    name:     DEMO_CHAPTER.name,
    template: 'sigma_chi',
  };
  const member: Member = {
    id:              DEMO_USER.id,
    orgId:           DEMO_CHAPTER.id,
    authUserId:      null,
    fullName:        DEMO_USER.full_name,
    email:           DEMO_USER.email,
    status:          'active',
    membershipStage: 'active',
    pledgeClass:     null,
  };
  const positions: Position[] = [
    {
      id:        'fallback-pos-president',
      memberId:  DEMO_USER.id,
      orgId:     DEMO_CHAPTER.id,
      role:      'president',
      isActive:  true,
      termStart: null,
      termEnd:   null,
    },
  ];
  return { organization, member, positions };
}

/** A fallback identity packaged as a single Membership (how the store stores it). */
export function buildFallbackMembership(): Membership {
  const { organization, member, positions } = buildFallbackIdentity();
  return { organization, member, positions };
}
