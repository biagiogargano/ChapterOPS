-- ─── ChapterOPS · Identity schema (Phase 1) ──────────────────────────────────
--
--   ⚠️  DO NOT RUN YET.
--
-- This is additive identity groundwork for the member-identity foundation. It
-- is committed for design review only and must NOT be executed against any
-- Supabase project until Phase 1 commit C12 (auth rollout) is reached.
--
--   • Additive only — creates THREE new tables (organizations, members,
--     positions). It does NOT alter, drop, or add FKs onto any existing app
--     table (events, rsvps, tasks, update_notices).
--   • No RLS yet — Row Level Security is left DISABLED, consistent with the
--     current event/task schema. RLS is a later hardening phase.
--   • Multi-org-shaped — members are scoped by org_id (not a hardcoded chapter
--     constant). One demo organization is seeded separately in identity_seed.sql.
--   • Reversible — running the DROPs at the top removes only these three new
--     tables; existing data is untouched.
--
-- Run order (when the time comes): identity_schema.sql → identity_seed.sql.

-- Drop in dependency order (positions → members → organizations). These touch
-- ONLY the new identity tables — never existing app tables.
DROP TABLE IF EXISTS positions     CASCADE;
DROP TABLE IF EXISTS members       CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- ─── organizations ────────────────────────────────────────────────────────────
-- The org-scoping unit (chapter / club / org). MVP seeds exactly one row.
-- `template` drives the future role catalog/labels; MVP behaves as 'sigma_chi'.

CREATE TABLE organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  template    text        NOT NULL DEFAULT 'sigma_chi'
    CHECK (template IN ('sigma_chi','generic_fraternity','club','custom')),
  join_code   text,                          -- short human-typeable code for joining (C13)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness for join codes (only when present).
CREATE UNIQUE INDEX organizations_join_code_idx
  ON organizations (lower(join_code)) WHERE join_code IS NOT NULL;

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- ─── members ──────────────────────────────────────────────────────────────────
-- A person's membership in ONE organization. A user who belongs to N orgs has
-- N member rows. `auth_user_id` is nullable: roster members are pre-provisioned
-- (status 'invited') and bound to a Supabase auth user on first login (claim).
--
-- NOTE: auth_user_id is intentionally a plain nullable uuid (no FK to
-- auth.users) for Phase 1 — keeps this schema decoupled from the auth schema
-- and avoids RLS coupling. A FK can be added in a later hardening phase.

CREATE TABLE members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id     uuid,                       -- null until claimed via login
  full_name        text        NOT NULL,
  email            text        NOT NULL,
  status           text        NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','inactive','alumni','removed')),
  membership_stage text        NOT NULL DEFAULT 'active'
    CHECK (membership_stage IN ('pledge','new_member','active','alumni')),
  pledge_class     text,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Per-ORG email uniqueness (never global) — preserves multi-org capability.
  UNIQUE (org_id, email)
);

-- Lookup paths used by identity resolution / claim-by-login.
CREATE INDEX members_auth_user_idx ON members (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX members_org_status_idx ON members (org_id, status);
CREATE INDEX members_org_email_idx  ON members (org_id, lower(email));

ALTER TABLE members DISABLE ROW LEVEL SECURITY;

-- ─── positions ──────────────────────────────────────────────────────────────
-- Role assignments within a membership. `role` is intentionally FREE TEXT (not
-- an enum) so future custom roles need no migration; the app interprets known
-- role strings via lib/roles.ts (the 'sigma_chi' template). Officer transitions
-- close a position (is_active=false, term_end set) rather than deleting it.

CREATE TABLE positions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        text        NOT NULL,          -- free text; app-interpreted
  is_active   boolean     NOT NULL DEFAULT true,
  term_start  date,
  term_end    date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX positions_member_active_idx ON positions (member_id) WHERE is_active;
CREATE INDEX positions_org_role_idx      ON positions (org_id, role) WHERE is_active;

ALTER TABLE positions DISABLE ROW LEVEL SECURITY;

-- ─── End of additive identity schema ──────────────────────────────────────────
-- No existing tables were referenced, altered, or constrained above.
