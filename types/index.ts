import type { Role } from '../lib/roles';

export type { Role };

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  chapter_id: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  organization: string;
  created_at: string;
}

// ─── Phase 1 identity model (multi-org-shaped) ────────────────────────────────
// These types describe the future member-identity foundation. They are additive
// and not yet consumed by any provider, store, screen, or service. See the
// Phase 1 identity/auth blueprint for the full design.

/** Organization template — drives role catalog/labels later. MVP behaves as 'sigma_chi'. */
export type OrgType = 'sigma_chi' | 'generic_fraternity' | 'club' | 'custom';

/** Membership account status within an organization. */
export type MemberStatus = 'invited' | 'active' | 'inactive' | 'alumni' | 'removed';

/** Where a member sits in the membership lifecycle. */
export type MembershipStage = 'pledge' | 'new_member' | 'active' | 'alumni';

/** A chapter/club/organization — the org-scoping unit. One demo row for MVP. */
export interface Organization {
  id:        string;          // uuid; demo = DEMO_CHAPTER_ID
  name:      string;
  template:  OrgType;         // default 'sigma_chi'
  joinCode?: string | null;   // optional; present once join codes exist (C13)
}

/** A person's membership in ONE organization. A user in N orgs has N member rows. */
export interface Member {
  id:              string;
  orgId:           string;          // → Organization.id (was chapter_id)
  authUserId:      string | null;   // null until claimed via login
  fullName:        string;
  email:           string;
  status:          MemberStatus;
  membershipStage: MembershipStage;
  pledgeClass:     string | null;
}

/**
 * A role assignment within a membership. `role` is intentionally a free-text
 * string (not the Role union) so future custom roles need no migration; the app
 * interprets known role strings via lib/roles.ts (the 'sigma_chi' template).
 */
export interface Position {
  id:        string;
  memberId:  string;
  orgId:     string;
  role:      string;          // free text; interpreted app-side
  isActive:  boolean;
  termStart: string | null;
  termEnd:   string | null;
}

/** The unit returned by identity resolution: a membership plus its positions. */
export interface Membership {
  organization: Organization;
  member:       Member;
  positions:    Position[];
}
