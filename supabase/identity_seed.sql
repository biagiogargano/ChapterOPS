-- ─── ChapterOPS · Identity seed (Phase 1) ────────────────────────────────────
--
--   ⚠️  DO NOT RUN YET.
--
-- Design/review only. Run AFTER identity_schema.sql, and only when Phase 1
-- commit C12 (auth rollout) is reached. Executes no changes to existing app
-- tables (events, rsvps, tasks, update_notices) — identity tables only.
--
-- Seeds:
--   • ONE demo organization, id = DEMO_CHAPTER_ID
--     ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0') — matches DEMO_CHAPTER_ID in
--     lib/eventService.ts and the chapter_id used by events_seed.sql, so all
--     existing seed data lives under the same org.
--   • ONE canonical member per current Sigma Chi role (lib/roles.ts), each with
--     one active position. These map 1:1 to the role keys used by the existing
--     rsvpStore seeds and event createdByRole values, so a logged-in "President
--     member" derives actingRole='president' and resolves the existing data.
--   • The President member mirrors DEMO_USER (lib/demoUser.ts) — same name and
--     email — so the no-env fallback identity stays consistent.
--
-- Idempotent: clears the demo org's identity rows then re-inserts.

-- ─── Clear existing demo identity data (safe re-run) ──────────────────────────
DELETE FROM positions WHERE org_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
DELETE FROM members   WHERE org_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';
DELETE FROM organizations WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

-- ─── Organization ─────────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, template) VALUES
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Alpha Lambda', 'sigma_chi');

-- ─── Members (one canonical member per role) ──────────────────────────────────
-- Stable UUIDs so positions can reference them deterministically. status
-- 'active' (already on the roster); auth_user_id NULL (unclaimed) — a real
-- person claims a row by logging in with the matching email.

INSERT INTO members (id, org_id, auth_user_id, full_name, email, status, membership_stage) VALUES
  -- President — mirrors DEMO_USER (lib/demoUser.ts)
  ('a1000000-0000-4000-8000-000000000001', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Biagio Gargano',      'biagio@alphalambda.org',           'active', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Pro Consul',     'pro_consul@alphalambda.org',       'active', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Annotator',      'annotator@alphalambda.org',        'active', 'active'),
  ('a1000000-0000-4000-8000-000000000004', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Risk Manager',   'risk_manager@alphalambda.org',     'active', 'active'),
  ('a1000000-0000-4000-8000-000000000005', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Social Chair',   'social_chair@alphalambda.org',     'active', 'active'),
  ('a1000000-0000-4000-8000-000000000006', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Recruitment Chair','recruitment_chair@alphalambda.org','active', 'active'),
  ('a1000000-0000-4000-8000-000000000007', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', NULL,
    'Demo Brother',        'brother@alphalambda.org',          'active', 'active');

-- ─── Positions (one active position per member; role = Sigma Chi role key) ────
INSERT INTO positions (id, member_id, org_id, role, is_active) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'president',         true),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'pro_consul',        true),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'annotator',         true),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'risk_manager',      true),
  ('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'social_chair',      true),
  ('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'recruitment_chair', true),
  ('a2000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000007', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'brother',           true);

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT m.full_name, m.email, m.status, p.role, p.is_active
FROM members m
JOIN positions p ON p.member_id = m.id
WHERE m.org_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
ORDER BY p.role;
