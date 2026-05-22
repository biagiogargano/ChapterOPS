/**
 * memberService.ts — thin Supabase adapter for the identity tables
 * (organizations / members / positions).
 *
 * Phase 1, commit C4: READ-ONLY paths only. There is NO claim/link write here
 * yet (that arrives in C5 as linkAuthUserToMember + resolveIdentity).
 *
 * Rules (mirrors lib/eventService.ts):
 *  - Returns app-native camelCase shapes (Organization / Member / Position /
 *    Membership) so callers never touch the DB schema.
 *  - Every function is guarded by isSupabaseConfigured() and wrapped in
 *    try/catch, returning a safe default (null / []) on error or when Supabase
 *    is unconfigured — the app must keep working with no identity backend.
 *  - Phase 1, commit C5 adds the ONLY mutation: a guarded conditional claim
 *    (linkAuthUserToMember) plus resolveIdentity orchestration. Still not wired
 *    into any provider/screen — IdentityProvider consumes this in C6.
 */

import { supabase } from './supabase';
import { mapClaimStatusToResolution } from './claimStatus';
import type {
  Organization,
  Member,
  Position,
  Membership,
  OrgType,
  MemberStatus,
  MembershipStage,
} from '@/types';

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * True only when the env vars look like a real Supabase project URL.
 * EXPO_PUBLIC_SUPABASE_URL must NOT include a "/rest/v1/" suffix — the client
 * appends that internally. (Same check as eventService.)
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('/rest/v1') &&
    key.length > 10
  );
}

// ─── Row types (match supabase/identity_schema.sql) ───────────────────────────

interface OrgRow {
  id:         string;
  name:       string;
  template:   string;
  join_code:  string | null;
  created_at: string;
}

interface MemberRow {
  id:               string;
  org_id:           string;
  auth_user_id:     string | null;
  full_name:        string;
  email:            string;
  status:           string;
  membership_stage: string;
  pledge_class:     string | null;
  created_at:       string;
}

interface PositionRow {
  id:         string;
  member_id:  string;
  org_id:     string;
  role:       string;
  is_active:  boolean;
  term_start: string | null;
  term_end:   string | null;
  created_at: string;
}

// ─── Shape converters ─────────────────────────────────────────────────────────

function rowToOrganization(r: OrgRow): Organization {
  return {
    id:       r.id,
    name:     r.name,
    template: r.template as OrgType,
    joinCode: r.join_code ?? null,
  };
}

function rowToMember(r: MemberRow): Member {
  return {
    id:              r.id,
    orgId:           r.org_id,
    authUserId:      r.auth_user_id ?? null,
    fullName:        r.full_name,
    email:           r.email,
    status:          r.status as MemberStatus,
    membershipStage: r.membership_stage as MembershipStage,
    pledgeClass:     r.pledge_class ?? null,
  };
}

function rowToPosition(r: PositionRow): Position {
  return {
    id:        r.id,
    memberId:  r.member_id,
    orgId:     r.org_id,
    role:      r.role,
    isActive:  r.is_active,
    termStart: r.term_start ?? null,
    termEnd:   r.term_end ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assemble a full Membership (organization + positions) for a member row.
 * Returns null if the org can't be resolved (orphaned member) so callers can
 * safely skip it.
 */
async function assembleMembership(member: Member): Promise<Membership | null> {
  const organization = await fetchOrganization(member.orgId);
  if (!organization) return null;
  const positions = await fetchPositionsForMember(member.id);
  return { organization, member, positions };
}

// ─── Public read API ──────────────────────────────────────────────────────────

/**
 * Fetch a single organization by id. Returns null if not found, unconfigured,
 * or on error.
 */
export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      console.warn('[memberService] fetchOrganization error:', error.message);
      return null;
    }
    return data ? rowToOrganization(data as OrgRow) : null;
  } catch (err) {
    console.warn('[memberService] fetchOrganization threw:', err);
    return null;
  }
}

/**
 * Fetch all positions for a member. Returns [] if none, unconfigured, or on
 * error (so deriveActingRole([]) safely floors to 'brother').
 */
export async function fetchPositionsForMember(memberId: string): Promise<Position[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('member_id', memberId);

    if (error) {
      console.warn('[memberService] fetchPositionsForMember error:', error.message);
      return [];
    }
    return ((data ?? []) as PositionRow[]).map(rowToPosition);
  } catch (err) {
    console.warn('[memberService] fetchPositionsForMember threw:', err);
    return [];
  }
}

/**
 * Fetch every membership (across all orgs) bound to a Supabase auth user.
 * A user in N orgs yields N memberships. Returns [] if none / unconfigured /
 * error. Orphaned members (org missing) are skipped.
 */
export async function fetchMembershipsByAuthUserId(authUserId: string): Promise<Membership[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('auth_user_id', authUserId);

    if (error) {
      console.warn('[memberService] fetchMembershipsByAuthUserId error:', error.message);
      return [];
    }

    const members = ((data ?? []) as MemberRow[]).map(rowToMember);
    const assembled = await Promise.all(members.map(assembleMembership));
    return assembled.filter((m): m is Membership => m !== null);
  } catch (err) {
    console.warn('[memberService] fetchMembershipsByAuthUserId threw:', err);
    return [];
  }
}

// ─── Claim-by-login: types ────────────────────────────────────────────────────

/**
 * Why a resolution failed. 'transient' is the only auto-retryable reason; the
 * rest are deterministic data states that require human (officer) action.
 */
export type ResolutionErrorReason =
  | 'unconfigured'    // Supabase not configured (provider uses fallback instead)
  | 'missing_email'   // auth user has no email — config/backend anomaly
  | 'transient'       // network/db failure — safe to retry
  | 'ambiguous_email' // 2+ unclaimed roster rows share the email in one org
  | 'claim_conflict'  // candidate got claimed by a different user mid-flow
  | 'email_taken';    // email already bound to a different auth user

/** Result of resolving a logged-in auth user to their chapter membership(s). */
export type MemberResolution =
  | { kind: 'resolved'; memberships: Membership[] }   // ≥1 membership, across orgs
  | { kind: 'not_on_roster' }                          // valid session, no roster row
  | { kind: 'error'; reason: ResolutionErrorReason };

// ─── Claim-by-login: orchestration ────────────────────────────────────────────

/**
 * Resolve a logged-in Supabase auth user to their membership(s).
 *
 *   1. Fast path: already linked by auth_user_id → resolved (no write).
 *   2. Otherwise call the claim_membership_by_email() SECURITY DEFINER RPC, which
 *      derives the uid + verified email from the session, claims any unclaimed
 *      roster rows for that email (activating 'invited' → 'active'), and returns
 *      a status string. On 'resolved' we re-read memberships (now owned, so
 *      RLS-safe) for the payload; other statuses map to not_on_roster / error.
 *
 * The RPC replaces the former direct candidate lookup + per-row link, so this
 * keeps working once identity-table RLS is enabled. `transient` is the only
 * retryable error. The signature is unchanged; the email is now derived inside
 * the RPC from the session JWT (so authEmail is no longer used here).
 */
export async function resolveIdentity(
  authUserId: string,
  _authEmail: string,   // unused: email is derived from the session JWT inside the RPC
): Promise<MemberResolution> {
  if (!isSupabaseConfigured()) return { kind: 'error', reason: 'unconfigured' };

  try {
    // Fast path: already linked (steady state on every later login). No write.
    const existing = await fetchMembershipsByAuthUserId(authUserId);
    if (existing.length > 0) return { kind: 'resolved', memberships: existing };

    // Claim via the SECURITY DEFINER RPC (session-derived uid + verified email).
    const { data, error } = await supabase.rpc('claim_membership_by_email');
    if (error) {
      console.warn('[memberService] claim_membership_by_email error:', error.message);
      return { kind: 'error', reason: 'transient' };
    }

    const status = (data as string | null) ?? '';
    // Re-read memberships only when the claim resolved (now owned → RLS-safe).
    const memberships = status === 'resolved'
      ? await fetchMembershipsByAuthUserId(authUserId)
      : [];
    return mapClaimStatusToResolution(status, memberships);
  } catch (err) {
    console.warn('[memberService] resolveIdentity threw:', err);
    return { kind: 'error', reason: 'transient' };
  }
}

// ─── Onboarding writes (C13) — RPC-backed, transactional ──────────────────────
//
// These call the Postgres functions defined in supabase/identity_join_code.sql
// (create_organization / join_organization_by_code), each a single transaction,
// so an org + creator membership + position are created atomically (no orphans).
// Not wired into any UI yet (C13b).

/** Outcome of an org create/join attempt. */
export type OrgWriteResult =
  | { kind: 'ok'; orgId: string }
  | { kind: 'not_found' }                 // join: code matched no organization
  | { kind: 'error'; message: string };

/**
 * Look up an organization by its (case-insensitive) join code, via the
 * find_org_by_join_code() SECURITY DEFINER RPC — so a not-yet-member can
 * discover the org once organizations RLS is enabled. Returns the org's id +
 * name only (enough for a join picker; the join itself uses the code), or null
 * if not found / unconfigured / error.
 */
export async function findOrgByJoinCode(code: string): Promise<{ id: string; name: string } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const c = code.trim();
    if (!c) return null;
    const { data, error } = await supabase.rpc('find_org_by_join_code', { p_code: c });
    if (error) {
      console.warn('[memberService] find_org_by_join_code error:', error.message);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { id: string; name: string } | undefined;
    return row ? { id: row.id, name: row.name } : null;
  } catch (err) {
    console.warn('[memberService] findOrgByJoinCode threw:', err);
    return null;
  }
}

/**
 * Create a new organization and the creator's President membership, atomically,
 * via the create_organization RPC. Returns the new org id.
 */
export async function createOrganization(
  name:       string,
  template:   string,
  authUserId: string,
  email:      string,
  fullName:   string,
): Promise<OrgWriteResult> {
  if (!isSupabaseConfigured()) return { kind: 'error', message: 'Supabase is not configured.' };
  try {
    const { data, error } = await supabase.rpc('create_organization', {
      p_name:         name.trim(),
      p_template:     template,
      p_auth_user_id: authUserId,
      p_email:        email.trim(),
      p_full_name:    fullName,
    });

    if (error) {
      console.warn('[memberService] createOrganization error:', error.message);
      return { kind: 'error', message: error.message };
    }
    if (!data) return { kind: 'error', message: 'Organization was not created.' };
    return { kind: 'ok', orgId: data as string };
  } catch (err) {
    console.warn('[memberService] createOrganization threw:', err);
    return { kind: 'error', message: 'Could not create organization.' };
  }
}

/**
 * Join an existing organization by code (as a brother), atomically and
 * idempotently, via the join_organization_by_code RPC. Returns the org id, or
 * not_found when the code matches no organization.
 */
export async function joinOrganizationByCode(
  code:       string,
  authUserId: string,
  email:      string,
  fullName:   string,
): Promise<OrgWriteResult> {
  if (!isSupabaseConfigured()) return { kind: 'error', message: 'Supabase is not configured.' };
  try {
    const { data, error } = await supabase.rpc('join_organization_by_code', {
      p_code:         code.trim(),
      p_auth_user_id: authUserId,
      p_email:        email.trim(),
      p_full_name:    fullName,
    });

    if (error) {
      console.warn('[memberService] joinOrganizationByCode error:', error.message);
      return { kind: 'error', message: error.message };
    }
    if (!data) return { kind: 'not_found' };   // RPC returns NULL for an unknown code
    return { kind: 'ok', orgId: data as string };
  } catch (err) {
    console.warn('[memberService] joinOrganizationByCode threw:', err);
    return { kind: 'error', message: 'Could not join organization.' };
  }
}
