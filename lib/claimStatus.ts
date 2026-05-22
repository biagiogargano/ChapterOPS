/**
 * claimStatus.ts — pure mapping from the claim_membership_by_email() RPC's
 * status string to the app's MemberResolution shape.
 *
 * ⚠️ STATUS: CP-2a groundwork — INERT. This is exported and unit-tested, but
 *    NOTHING calls it yet. CP-2b will wire it into resolveIdentity once the
 *    claim_membership_by_email() RPC is deployed (CP-3). Pure: no Supabase, no
 *    I/O, no flag reads. Type-only imports keep this module free of runtime
 *    dependencies, so it is safe to unit-test under node.
 */

import type { Membership } from '@/types';
import type { MemberResolution } from './memberService';

/** Status strings returned by the claim_membership_by_email() RPC (see IDENTITY_RLS_MIGRATION_PLAN.md §2.1). */
export type ClaimStatus =
  | 'resolved'
  | 'not_on_roster'
  | 'ambiguous_email'
  | 'email_taken'
  | 'claim_conflict'
  | 'missing_email'
  | 'unauthenticated';

/**
 * Map a claim RPC status to a MemberResolution.
 *
 * `memberships` is the result of the post-claim re-read (fetchMembershipsByAuthUserId)
 * and is only consulted for the 'resolved' case: if the RPC says resolved but the
 * re-read found nothing (a lost race), we surface 'claim_conflict' rather than a
 * false 'resolved'. Unknown/unauthenticated statuses map to the retryable
 * 'transient' error so the caller can retry rather than dead-end.
 */
export function mapClaimStatusToResolution(
  status: string,
  memberships: Membership[],
): MemberResolution {
  switch (status) {
    case 'resolved':
      return memberships.length > 0
        ? { kind: 'resolved', memberships }
        : { kind: 'error', reason: 'claim_conflict' };
    case 'not_on_roster':
      return { kind: 'not_on_roster' };
    case 'ambiguous_email':
      return { kind: 'error', reason: 'ambiguous_email' };
    case 'email_taken':
      return { kind: 'error', reason: 'email_taken' };
    case 'claim_conflict':
      return { kind: 'error', reason: 'claim_conflict' };
    case 'missing_email':
      return { kind: 'error', reason: 'missing_email' };
    case 'unauthenticated':
    default:
      return { kind: 'error', reason: 'transient' };
  }
}
