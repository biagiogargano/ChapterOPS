-- ─── ChapterOPS · Identity join codes + onboarding RPCs (Phase 1, C13) ────────
--
--   ⚠️  DO NOT RUN until you are ready to test C13 onboarding.
--
-- Non-destructive: adds the join_code column (if missing), a unique index, two
-- transactional RPC functions for create/join, and backfills the demo org's
-- code. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE). Touches ONLY the
-- identity tables — never events/rsvps/tasks. No RLS.
--
-- Run AFTER identity_schema.sql + identity_seed.sql. On a fresh install the
-- column/index already exist (added in identity_schema.sql), so the ALTER/INDEX
-- here are no-ops; the RPCs and backfill still apply.

-- ─── Column + unique index (idempotent) ───────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_join_code_idx
  ON organizations (lower(join_code)) WHERE join_code IS NOT NULL;

-- ─── Helper: generate a unique 6-char join code ───────────────────────────────
-- Alphabet excludes ambiguous chars (0/O/1/I). Retries on collision.
CREATE OR REPLACE FUNCTION _gen_join_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  i          int;
  attempts   int := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM organizations WHERE lower(join_code) = lower(v_code)
    );
    attempts := attempts + 1;
    IF attempts > 25 THEN
      RAISE EXCEPTION 'could not generate a unique join code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ─── create_organization (transactional) ──────────────────────────────────────
-- Creates the org + the creator's membership (President) atomically.
-- Returns the new organization id.
CREATE OR REPLACE FUNCTION create_organization(
  p_name         text,
  p_template     text,
  p_auth_user_id uuid,
  p_email        text,
  p_full_name    text
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id    uuid := gen_random_uuid();
  v_member_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO organizations (id, name, template, join_code)
    VALUES (v_org_id, p_name, COALESCE(NULLIF(p_template, ''), 'sigma_chi'), _gen_join_code());

  INSERT INTO members (id, org_id, auth_user_id, full_name, email, status, membership_stage)
    VALUES (v_member_id, v_org_id, p_auth_user_id, p_full_name, p_email, 'active', 'active');

  INSERT INTO positions (member_id, org_id, role, is_active)
    VALUES (v_member_id, v_org_id, 'president', true);

  RETURN v_org_id;
END;
$$;

-- ─── join_organization_by_code (transactional, idempotent) ────────────────────
-- Joins the org matching the code as a 'brother'. Returns the org id, or NULL
-- when the code matches no organization. If the user is already a member (by
-- auth user or email), it links/returns the existing membership instead of
-- duplicating.
CREATE OR REPLACE FUNCTION join_organization_by_code(
  p_code         text,
  p_auth_user_id uuid,
  p_email        text,
  p_full_name    text
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id    uuid;
  v_member_id uuid;
  v_existing  uuid;
BEGIN
  SELECT id INTO v_org_id
    FROM organizations
    WHERE lower(join_code) = lower(p_code)
    LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;  -- bad / unknown code
  END IF;

  -- Idempotent: already a member of this org?
  SELECT id INTO v_existing
    FROM members
    WHERE org_id = v_org_id
      AND (auth_user_id = p_auth_user_id OR lower(email) = lower(p_email))
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE members SET auth_user_id = p_auth_user_id
      WHERE id = v_existing AND auth_user_id IS NULL;
    RETURN v_org_id;
  END IF;

  v_member_id := gen_random_uuid();
  INSERT INTO members (id, org_id, auth_user_id, full_name, email, status, membership_stage)
    VALUES (v_member_id, v_org_id, p_auth_user_id, p_full_name, p_email, 'active', 'active');
  INSERT INTO positions (member_id, org_id, role, is_active)
    VALUES (v_member_id, v_org_id, 'brother', true);

  RETURN v_org_id;
END;
$$;

-- ─── Backfill the demo org with a known, testable join code ───────────────────
UPDATE organizations
  SET join_code = 'ALPHA1'
  WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0' AND join_code IS NULL;

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT id, name, template, join_code FROM organizations
WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
