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
 *  - No auth, no RLS, no writes. Not yet imported by any provider/screen.
 */

import { supabase } from './supabase';
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

/** Normalize an email for matching: trimmed + lowercased. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

/**
 * Fetch every membership (across all orgs) whose member email matches (case-
 * insensitive). Used by the claim-by-login candidate lookup in C5. Returns [] if
 * none / unconfigured / error. Orphaned members are skipped. This is a pure read
 * — it does NOT claim or link anything.
 */
export async function fetchMembershipsByEmail(email: string): Promise<Membership[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .ilike('email', normalized);

    if (error) {
      console.warn('[memberService] fetchMembershipsByEmail error:', error.message);
      return [];
    }

    const members = ((data ?? []) as MemberRow[]).map(rowToMember);
    const assembled = await Promise.all(members.map(assembleMembership));
    return assembled.filter((m): m is Membership => m !== null);
  } catch (err) {
    console.warn('[memberService] fetchMembershipsByEmail threw:', err);
    return [];
  }
}
