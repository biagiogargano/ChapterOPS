# Reports V1 — Persistence Implementation Plan

Concrete plan for the `task_report_submissions` storage boundary, to review
**before** touching Supabase. Planning only — **no SQL is applied, no RPC
deployed, no RLS changed** by this document or the accompanying draft file.

Builds on:
- `docs/REPORTS_V1_PLAN.md` (architecture decision: separate table, not extending
  `task_submissions`).
- `docs/STRUCTURED_RESPONSES_FOUNDATION.md` + `lib/structuredResponses.ts`,
  `lib/reportDefinitions.ts`, `lib/reportTasks.ts` (the pure foundation already
  shipped).
- The live precedent `supabase/proof_v1a_task_submissions.sql` (table + RLS +
  SECURITY DEFINER RPCs + `auth_user_roles_for_org` helper).

Draft SQL: `supabase/reports_v1_task_report_submissions.sql` (committed as a
DRAFT, **not applied**).

---

## 1. Proposed table — `public.task_report_submissions`

Mirrors the `task_submissions` shape, but stores **answers JSON** instead of
proof, with a **broader read set** (adds the annotator).

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `task_id` | `text NOT NULL` → `tasks(id) ON DELETE CASCADE` | the report TASK (`report_<role>_<cycle>`) |
| `org_id` | `uuid NOT NULL` | org scoping = `tasks.chapter_id` |
| `definition_id` | `text NOT NULL` | which `StructuredResponseDefinition` (e.g. `weekly_officer_report`) |
| `answers` | `jsonb NOT NULL` | the answer map (see §1a) |
| `submitted_by` | `uuid` | `members.id` (audit; not RLS-keyed) |
| `submitted_role` | `text` | role at submit time (audit) |
| `submitted_at` | `timestamptz NOT NULL default now()` | |
| `updated_at` | `timestamptz NOT NULL default now()` | |

Constraints / indexes:
- `UNIQUE (task_id)` — **one submission per report task** (a report task is
  already per-role-per-cycle, so this is the natural key).
- `CHECK (jsonb_typeof(answers) = 'object')` — answers is always an object map.
- `CHECK (definition_id <> '')`.
- index on `(org_id)`; index on `(task_id)` is covered by the unique constraint.

**Status/timestamps:** no separate status column. The **report task's
`tasks.state`** remains the source of truth for status (assigned → submitted),
exactly like proof. The submission row only holds answers + audit timestamps.

### 1a. `answers` JSON shape

The serialized `StructuredAnswerMap` from `lib/structuredResponses.ts`:

```jsonc
{
  "accomplishments": { "key": "accomplishments", "value": "Tabled twice, 6 leads" },
  "goals":           { "key": "goals", "value": "Confirm venue" },
  "blockers":        { "key": "blockers", "noUpdate": true },
  "announcements":   { "key": "announcements", "value": "Formal date set" }
}
```

The client validates against the definition with `validateAnswers` **before**
calling the RPC; the DB only enforces "is a JSON object" (it does not know the
definition). `definition_id` is stored so a reader can re-validate / render with
the right question set.

## 2. RLS model

**RLS ENABLED, NO permissive policies (deny-by-default), `REVOKE … FROM anon,
authenticated`.** All access is via SECURITY DEFINER RPCs — identical posture to
`task_submissions`. This is the safest pattern and matches the live precedent.

Authorization enforced **inside the RPCs** (not via row policies):

- **Write (insert/update) — the report owner only.** The caller must hold the
  report task's `assigned_role` in that org (resolved via the existing
  `auth_user_roles_for_org(org)` helper). Optionally president/pro_consul for
  admin correction (mirrors proof's writer rule). No one else can write.
- **Read — the responsibility set:** the **submitter** (assignee role), the
  **annotator** (Secretary, compiles the agenda), **president**, **pro_consul**.
  This is intentionally **broader than proof** (which excludes the annotator) —
  the precise reason reports get their own table + read RPC.
- **Advisors: excluded** from reading reports for now (advisors are view-only
  calendar/RSVP; no role maps to the advisor level yet anyway).
- **Org isolation:** every RPC resolves the task's `org_id` from `tasks` and
  checks the caller's roles **for that org** via `auth_user_roles_for_org(org)`.
  A user with no active role in the task's org gets denied / empty. The token's
  org is irrelevant (same cross-org-safe approach as the push fix).

## 3. RPC model

**RPCs required** (not direct table access) — the table is locked
(`REVOKE … FROM authenticated`), so clients reach it only through definer RPCs.
Two, mirroring proof:

- **`upsert_task_report_submission(p_task_id text, p_definition_id text, p_answers jsonb) returns uuid`**
  - SECURITY DEFINER, pinned `search_path`.
  - Resolve task's `org_id` + `assigned_role`; require caller holds that role
    (or president/pro_consul). Validate `jsonb_typeof(answers)='object'`.
  - Upsert on `task_id`; stamp `submitted_by`/`submitted_role`/`updated_at`.
  - **Does NOT touch `tasks.state`** — the app flips state via the existing
    `updateTaskState`/`saveTaskState` path, exactly like proof.
- **`get_task_report_submission(p_task_id text) returns table(...)`**
  - SECURITY DEFINER. Reader = submitter / annotator / president / pro_consul,
    else empty (no row leak). Returns `definition_id`, `answers`, `submitted_role`,
    `submitted_at`, `updated_at`.

**Helper:** reuse the existing `auth_user_roles_for_org(uuid)` (already live from
proof v1a). No new helper needed. **`auth_user_orgs()` is untouched.**

## 4. Client integration plan (later; not in this lane)

- **Detection:** Task Detail already renders by task; a report task carries
  `reportDefinitionId` (the optional `MockTask` field shipped in the foundation).
  When present, Task Detail renders the **structured-response form** for that
  definition instead of the proof/complete UI.
- **Load:** on open (flag-on + configured), call `get_task_report_submission` →
  hydrate the form with saved answers (fallback empty). A thin
  `reportSubmissionService` adapter mirrors `taskService.getTaskSubmission`.
- **Save:** on submit, `validateAnswers` client-side → if complete, call
  `upsert_task_report_submission(task_id, definition_id, answers)`; on success,
  `setTaskState('submitted')` via the existing path (the RPC does NOT set state).
- **Completion → task state:** submitting flips the report task to `submitted`
  (then a reviewer, if any, could approve — but reports are not review-gated in
  v1, so `submitted` is effectively "done for the cycle"). No new state machine.
- **Avoids fake UI:** the form is backed by a real RPC + real table; nothing
  renders unless `reportDefinitionId` is set and storage is configured. Flag-off /
  unconfigured → no-op (the adapter returns null), no mock form.

## 5. Risk / decision list

**Decisions to approve before applying SQL:**
1. **Writer scope:** owner-only, or owner + president/pro_consul admin
   correction? (Recommend: match proof = owner + leadership.)
2. **Reader set:** confirm submitter + annotator + president + pro_consul; confirm
   advisors excluded for now.
3. **One-per-task** (`UNIQUE(task_id)`): confirm a single editable submission per
   report task (recommended — report tasks are already per-role-per-cycle).
4. **No review gate** on reports in v1 (submitting = done). Confirm.
5. **Definition validation stays client-side** (DB only checks "is JSON object").
   Confirm we don't want server-side per-question validation yet.

**Schema risks:** low — additive, leaf table, FK only INTO `tasks` (one-way,
`ON DELETE CASCADE`). Does not alter `task_submissions`, `tasks`, `events`,
`rsvps`, identity tables, or any existing RLS/RPC.

**RLS risks:** the read set is broader than proof (adds annotator) — verify the
read RPC's role check matches exactly the four reader roles and leaks nothing
otherwise. Deny-by-default + definer RPCs keep direct access impossible.

**Rollback plan:** leaf objects, fully reversible —
`drop function get_task_report_submission(text); drop function
upsert_task_report_submission(text,text,jsonb); drop table
task_report_submissions;`. **Do NOT** drop `auth_user_roles_for_org` (shared with
proof). Dropping the report table does not affect tasks/proof/rsvps.

## 6. Draft artifact

`supabase/reports_v1_task_report_submissions.sql` — committed as a **DRAFT, NOT
APPLIED**, with the same `⚠️ DO NOT RUN YET` header style as
`proof_v1a_task_submissions.sql`, plus verification + rollback blocks. Applying it
is a separate, explicitly-approved step.

---

## Implementation order (when greenlit)

1. **Apply the draft SQL** on alpha (table + 2 RPCs), verify with the included
   checks. ← Supabase step, separately approved.
2. **Client adapter** `lib/reportSubmissionService.ts` (upsert/get; fallback-safe).
3. **Task Detail report form** keyed off `reportDefinitionId` + `validateAnswers`
   + submit→state. Pure-test the payload builder.
4. **Report-task generation** wiring (deterministic generator already exists) —
   when/where report tasks get created per cycle (no scheduler yet; manual or
   on-demand).
5. New EAS build for on-device testing.

*Planning/record only. No schema, RLS, RPC, Supabase, app, or EAS change is
applied by this plan.*
