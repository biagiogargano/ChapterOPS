-- ─── ChapterOPS · Tasks schema (PROPOSAL — NOT YET WIRED) ─────────────────────
--
-- STATUS: This is a forward-looking schema PROPOSAL for persistent tasks.
--   • It is NOT run by the app and NOT required for current functionality.
--   • Tasks today live in mock data (lib/mockTasks.ts MOCK_TASKS + _dynamicTasks)
--     with interaction state in lib/devTaskStore.ts. Both are session-only.
--   • This file is additive (CREATE TABLE only) — it does NOT alter or break the
--     existing `events` / `rsvps` tables. Run it only when task persistence is
--     actually implemented. Do NOT run it as part of normal setup.
--
-- It mirrors the conventions of events_schema.sql: a `chapter_id` scoping column,
-- CHECK constraints matching the TypeScript unions, and RLS disabled (no auth yet).
--
-- ── DESIGN NOTES & DEFERRED DECISIONS ─────────────────────────────────────────
--
-- 1. STATE OWNERSHIP / RSVP DUALITY (most important):
--    Lightweight tasks of kind 'rsvp' and 'name_submission' DERIVE their
--    completion from the `rsvps` table (keyed by event_id + role), NOT from
--    tasks.state. For those rows, tasks.state is "definition only" and should be
--    ignored by readers. tasks.state is authoritative ONLY for:
--      • structured tasks, and
--      • lightweight 'acknowledgment' / 'yes_no' tasks.
--    Do not write RSVP completion into tasks.state — that would double-own state
--    and drift from rsvps. (Current app behavior already reads RSVP tasks from
--    rsvpStore, so this preserves parity.)
--
-- 2. DUE DATES:
--    The app currently uses a denormalized `due_label` string (e.g. "Today by
--    6:00 PM", "Was due Mon, May 12") and a static `urgency`/`state` — overdue is
--    NOT computed. We keep `due_label` for 1:1 parity and ADD an optional
--    `due_at timestamptz` for future machine-readable scheduling. Computing
--    urgency/overdue from due_at is a BEHAVIOR CHANGE and is intentionally
--    deferred — leave due_at NULL until that work is scoped.
--
-- 3. DENORMALIZED DISPLAY FIELDS:
--    `assigned_to` ("All Members", "Risk Manager", "Biagio Gargano (President)")
--    is a display string derivable from assigned_role + roster. Kept as a column
--    for parity; a future normalization could derive it instead.
--
-- 4. DYNAMIC RSVP TASKS:
--    Today, RSVP tasks are generated client-side (eventStore.maybeGenerateRsvpTask)
--    when an officer creates a mandatory/officer event. With persistence, these
--    would be inserted as rows here at event-create time (or via a DB trigger).
--    That generation strategy is deferred — this schema just supports storing them.
--
-- 5. ROLE ARRAYS:
--    `visible_to` and `escalation_chain` are text[] of role keys. `visible_to_all`
--    is a separate boolean for the 'all' sentinel (cleaner than a magic array
--    element). For the small fixed role set, text[] is sufficient — no join table.

-- Drop only the tasks table (NOT events/rsvps). Safe to re-run.
DROP TABLE IF EXISTS tasks CASCADE;

CREATE TABLE tasks (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Org scoping (matches events.chapter_id / DEMO_CHAPTER_ID)
  chapter_id             uuid        NOT NULL,

  title                  text        NOT NULL,

  -- TaskType union
  type                   text        NOT NULL
    CHECK (type IN ('lightweight','structured')),

  -- LightweightKind union (NULL for structured tasks)
  lightweight_kind       text
    CHECK (lightweight_kind IS NULL OR
           lightweight_kind IN ('rsvp','name_submission','acknowledgment','yes_no')),

  -- TaskState union. NOTE: authoritative only for structured + ack/yes_no.
  -- For rsvp/name_submission, completion derives from the rsvps table (see note 1).
  state                  text        NOT NULL DEFAULT 'assigned'
    CHECK (state IN ('assigned','submitted','approved','rejected','overdue','escalated')),

  -- TaskUrgency union (display ordering; static today — see note 2)
  urgency                text        NOT NULL
    CHECK (urgency IN ('overdue','today','week')),

  -- Denormalized due label (parity with current UI). due_at is for FUTURE use.
  due_label              text        NOT NULL DEFAULT '',
  due_at                 timestamptz,                        -- nullable; deferred

  -- Assignment. assigned_role holds a Role key OR the literal 'all'.
  assigned_role          text        NOT NULL,
  assigned_to            text        NOT NULL DEFAULT '',    -- display string (note 3)

  -- Visibility. visible_to_all=true means "everyone"; otherwise visible_to lists roles.
  visible_to_all         boolean     NOT NULL DEFAULT false,
  visible_to             text[]      NOT NULL DEFAULT '{}',

  -- Linked event. linked_event is the denormalized title; linked_event_id FKs to
  -- the specific event instance (used as the RSVP key). ON DELETE CASCADE so an
  -- event's RSVP task disappears with it (mirrors removeDynamicTaskById today).
  linked_event           text,
  linked_event_id        uuid        REFERENCES events(id) ON DELETE CASCADE,

  description            text        NOT NULL DEFAULT '',

  -- Lightweight-specific
  linked_event_mandatory boolean     NOT NULL DEFAULT false,
  requires_covering      boolean     NOT NULL DEFAULT false,

  -- Structured-specific
  requires_proof         boolean     NOT NULL DEFAULT false,
  proof_type             text
    CHECK (proof_type IS NULL OR
           proof_type IN ('text','image','screenshot','document','link')),
  requires_approval      boolean     NOT NULL DEFAULT false,
  reviewer_role          text,

  -- Workflow (self-referential parent/child)
  is_workflow_parent     boolean     NOT NULL DEFAULT false,
  parent_task_id         uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  supervisor_role        text,

  -- Escalation
  escalation_chain       text[]      NOT NULL DEFAULT '{}',
  escalated_to           text,

  -- Interaction state (migrated from devTaskStore). Authoritative for
  -- structured + ack/yes_no tasks only (see note 1).
  proof_content          text        NOT NULL DEFAULT '',
  rejection_note         text        NOT NULL DEFAULT '',

  created_by_role        text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the common read paths (per-chapter listing, workflow children,
-- and event-linked task lookup).
CREATE INDEX tasks_chapter_idx       ON tasks (chapter_id);
CREATE INDEX tasks_parent_idx        ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX tasks_linked_event_idx  ON tasks (linked_event_id) WHERE linked_event_id IS NOT NULL;

-- No auth yet — disable RLS (consistent with events/rsvps).
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
