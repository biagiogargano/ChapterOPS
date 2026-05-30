# Goals Persistence Plan (planning only — NO SQL APPLIED)

The storage design for the first-class Goals system. **Planning only.** No SQL is
applied, no Supabase command is run. A draft SQL file
(`supabase/goals_v1_draft.sql`) accompanies this for clarity — it is **DRAFT, DO
NOT RUN**.

Mirrors the proven pattern from `docs/REPORTS_V1_PERSISTENCE_PLAN.md` +
`supabase/reports_v1_task_report_submissions.sql`: RLS-on / no-policies (deny by
default), `REVOKE` from anon/authenticated, access only via SECURITY DEFINER RPCs,
org scoping + role checks via the existing `auth_user_roles_for_org(uuid)`.

Models live in `lib/goals.ts` (inert types) + `lib/goalHelpers.ts` (pure helpers).

---

## 1. Proposed tables

### `goals` (NEW — required)

A goal is a top-level, org-scoped, persistent object (not task-derived), so it
carries `org_id` directly.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `org_id` | uuid NOT NULL | org isolation (→ `organizations`/`chapters`) |
| `owner_role` | text | pack-shaped role key (nullable) |
| `owner_member_id` | uuid | `members.id` for person-owned goals (nullable) |
| `created_by` | uuid | `members.id` (audit) |
| `title` | text NOT NULL | prompt/title (CHECK non-empty) |
| `description` | text | optional |
| `target_value` | numeric | nullable (milestone/boolean goals) |
| `current_value` | numeric | nullable; default 0 where measurable |
| `unit` | text | e.g. 'members', '$', 'hours' |
| `cadence` | text NOT NULL | CHECK in (daily, weekly, monthly, custom) |
| `custom_period_days` | int | for cadence='custom' |
| `update_definition_id` | text | StructuredResponseDefinition id for updates |
| `status` | text NOT NULL | CHECK in (active, completed, archived); default 'active' |
| `reviewer_role` | text | nullable |
| `visibility` | text | nullable v1 (see §6) — default leadership+owner in RPC |
| `created_at` / `updated_at` | timestamptz | default now() |
| `completed_at` / `archived_at` | timestamptz | set by complete/archive RPCs |

Index on `org_id` (+ later `(org_id, status)`), matching the reports table's
`_org_idx`.

### Goal updates — **reuse `task_report_submissions` for v1** (recommended)

A goal *update* is exactly what that table already stores: a per-task structured
answer set keyed by `task_id` + `definition_id` + `answers` jsonb. For v1, the
update task IS the report task; its submission IS the goal update. **Do not add a
`goal_updates` table for v1** — instead link the goal ↔ update via the task:

- An update task carries `reportDefinitionId` (already exists) = the goal's
  `update_definition_id`, and a deterministic id encoding the goal + period (e.g.
  `goalupd_<goalId>_<periodKey>`).
- The submission row (in `task_report_submissions`) holds the answers, including the
  reported value, "no update", "help needed", "completion requested" as answer keys.
- `goalPeriodKey()` (pure helper) provides the periodKey; one submission per task =
  one update per period (the table's `unique(task_id)` enforces it).

**When a dedicated `goal_updates` table becomes worth it (v2):** if we need to query
update *history per goal* efficiently (trend charts, "last 5 values"), or store a
numeric `new_value`/`previous_value` as first-class columns rather than inside
`answers`. At that point add `goal_updates(goal_id, task_id, period_key,
previous_value, new_value, no_update, help_needed, completion_requested,
submitted_by, submitted_at)` and backfill from submissions. v1 avoids it by reading
answers from the existing table and the value from `goals.current_value`.

## 2. RLS / read-write model

Same posture as the reports table: **RLS enabled, zero policies, REVOKE from
anon/authenticated, all access via definer RPCs.** Org isolation via `org_id` +
`auth_user_roles_for_org(org_id)`.

- **Read a goal:** the goal's owner (owner_member_id = caller, or caller holds
  owner_role) OR leadership (president/pro_consul) OR annotator (compiles
  progress/agenda). Mirrors the reports read set.
- **Create a goal:** leadership (president/pro_consul) and annotator for alpha;
  later, any officer for their own domain / members for personal goals (§6).
- **Update / complete / archive a goal:** the owner OR leadership. Reviewer role may
  be required to *approve* completion later (§6 open decision).
- **Advisors:** excluded by default (no advisor role mapped; view-only later).
- **Goal updates:** reuse the existing report RPC authorization unchanged (writer =
  assignee-role or leadership; reader = submitter/annotator/leadership).

## 3. RPC model

Definer RPCs only (no direct table access), names mirroring the reports RPCs.

**v1:**
- `create_goal(p_title, p_target, p_current, p_cadence, p_owner_role, p_update_definition_id, …)` → uuid
- `list_goals_for_org()` → goals the caller may read in their active org
- `list_my_goals()` → goals owned by the caller (owner_member_id or owner_role)
- `update_goal(p_goal_id, …mutable fields…)` → updates value/title/cadence/etc.
- `complete_goal(p_goal_id)` / `archive_goal(p_goal_id)` → status + timestamp
- Goal updates: **reuse the existing** `upsert_task_report_submission` /
  `get_task_report_submission` (no new RPC for v1).

**Later (v2):**
- `submit_goal_update(...)` only if a dedicated `goal_updates` table lands.
- `list_goal_updates(p_goal_id)` for history/trend.

Keep v1 minimal: create/list/update/complete/archive + reuse update RPCs.

## 4. Relationship to tasks

- Goals **persist**; tasks are the **reminder/action** layer.
- An **update task is generated from a goal** (cadence + `goalPeriodKey`), reusing
  `generateQuestionnaireTasks` with the goal's `update_definition_id` + a
  goal+period task id. **No scheduler** — generation is caller-triggered (manual
  for v1, like questionnaire generation today).
- Opening that task shows the **goal-update form** (the existing Task Detail form).
- **Task completion reflects a submitted update**: submit writes the
  `task_report_submissions` row and flips the task done (existing flow), and the app
  bumps `goals.current_value` via `update_goal`.
- The task id **encodes the goal + period** so the link is derivable without a join
  table in v1.

## 5. Relationship to questionnaires / reports

- The current questionnaire/report code **is the goal-update/submission layer** —
  reused as-is (see `docs/GOALS_FIRST_SYSTEM_PLAN.md` §1, §7).
- "Weekly Officer Report" becomes one **goal-update questionnaire template**
  (`update_definition_id`).
- **`task_report_submissions` is reused** for goal-update answers (§1).
- **Do NOT rename** the live table/RPCs or the `report_*` code now — reuse under the
  existing names; a rename is a migration, deferred (possibly never if reuse holds).

## 6. Open product decisions (needed before applying)

1. **Owner: role vs person?** Support both columns now, or role-only for alpha?
2. **Officer-only goals in alpha,** or can members create **personal goals**?
3. **Reviewer defaults** — president? pro_consul? per-goal `reviewer_role`?
4. **Does completion need approval** (reviewer marks done) or owner self-completes?
5. **Advisor visibility** — stays excluded for v1?
6. **Cadence/window defaults** — default weekly? default update window length?
7. **Visibility model** — leadership+owner by default, or per-goal visibility list?
8. **Bulk creation** — `create_goal` one-at-a-time + client loops `parseGoalPrompts`,
   or a `create_goals(p_titles text[])` batch RPC?
9. **Reuse vs new `goal_updates` table** — confirm v1 reuse is acceptable.

## 7. Draft SQL

`supabase/goals_v1_draft.sql` — **DRAFT ONLY, DO NOT RUN.** Sketches the `goals`
table (RLS-on/no-policies/REVOKE) + the v1 RPCs in the reports pattern, with the
open decisions flagged inline as `-- DECISION:` comments. It exists to make this
plan concrete; it is **not** applied and **not** verified.

## 8. What remains gated

- **Applying any SQL** → explicit approval + a deliberate apply checkpoint (like
  reports v1 had). Not now.
- **The Goals tab, generated update tasks, agenda-from-goals, notifications, AI** →
  later sequence steps (`GOALS_FIRST_SYSTEM_PLAN.md` §10).
- **Device-verifying the questionnaire round-trip** (`NEXT_BUILDABLE_WORK.md` #1)
  should land first — goal updates ride on that exact path.

---

*Planning/record only. No SQL applied, no Supabase command run, no app behavior,
schema, RLS, RPC, flag, push, or EAS change. The draft SQL is illustrative and
unapplied.*
