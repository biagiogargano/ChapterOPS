# Reports V1 — Persistence Implementation Plan

Plan for the `task_report_submissions` storage boundary. The migration has now
been **applied to alpha** (see §6). Builds on:
- `docs/REPORTS_V1_PLAN.md` (architecture: separate table, not extending
  `task_submissions`).
- `docs/STRUCTURED_RESPONSES_FOUNDATION.md` + `lib/structuredResponses.ts`,
  `lib/reportDefinitions.ts`, `lib/reportTasks.ts` (pure foundation, shipped).
- The live precedent `supabase/proof_v1a_task_submissions.sql`.

Migration file: `supabase/reports_v1_task_report_submissions.sql` (applied).

---

## 1. Table — `public.task_report_submissions`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `task_id` | `text NOT NULL` → `tasks(id) ON DELETE CASCADE` | the report TASK (`report_<role>_<cycle>`) |
| `org_id` | `uuid NOT NULL` | org scoping = `tasks.chapter_id` |
| `definition_id` | `text NOT NULL` | which `StructuredResponseDefinition` |
| `answers` | `jsonb NOT NULL` | serialized `StructuredAnswerMap` |
| `submitted_by` | `uuid` | `members.id` (audit) |
| `submitted_role` | `text` | role at submit time (audit) |
| `submitted_at` / `updated_at` | `timestamptz` | |

Constraints: `UNIQUE(task_id)` (one submission per report task), CHECK
`jsonb_typeof(answers)='object'`, CHECK `definition_id <> ''`, org index.
No status column — `tasks.state` stays the source of truth.

### 1a. `answers` JSON shape
The serialized `StructuredAnswerMap` from `lib/structuredResponses.ts` (per-key
`{ key, value? , noUpdate? }`). The client validates with `validateAnswers`
before the RPC; the DB only enforces "is a JSON object".

## 2. RLS model

RLS ENABLED, NO permissive policies (deny-by-default), table revoked from
anon/authenticated. Authorization inside the SECURITY DEFINER RPCs:
- **Write:** report task's `assigned_role` holder OR president/pro_consul.
- **Read:** submitter (assignee), annotator, president, pro_consul.
- **Advisors excluded.**
- Org isolation via `auth_user_roles_for_org(org)` against the task's `org_id`.

## 3. RPCs
- `upsert_task_report_submission(p_task_id text, p_definition_id text, p_answers jsonb) returns uuid`
  — SECURITY DEFINER; writer rule above; upsert on `task_id`; does NOT touch
  `tasks.state`.
- `get_task_report_submission(p_task_id text) returns table(...)` — SECURITY
  DEFINER; reader rule above; empty otherwise.
- Reuses existing `auth_user_roles_for_org(uuid)`; `auth_user_orgs()` untouched.

## 4. Client integration plan (later; not yet built)
- **Detection:** a report task carries `reportDefinitionId` (optional `MockTask`
  field, shipped). Task Detail renders the structured-response form when present.
- **Load:** `get_task_report_submission` → hydrate form (fallback empty).
- **Save:** `validateAnswers` client-side → `upsert_task_report_submission` → on
  success `setTaskState('submitted')` via the existing path (RPC does not set
  state).
- **Avoids fake UI:** form is backed by the real RPC/table; no-op when
  unconfigured.

## 5. Approved decisions (all reflected in the applied SQL)
1. Writer = assignee-role holder OR president/pro_consul.
2. Reader = submitter, annotator, president, pro_consul.
3. Advisors excluded for now.
4. One submission per report task (`UNIQUE(task_id)`).
5. No review gate in v1; submission marks the report task complete in client
   logic later.
6. Validation client-side; DB only checks answers is a JSON object.

## 6. Migration artifact — APPLIED

`supabase/reports_v1_task_report_submissions.sql` — **applied to alpha
(2026-05-30)** via the Dashboard SQL Editor and verified:
- table exists, RLS enabled, **0 policies** (deny-by-default);
- both RPCs exist and are SECURITY DEFINER;
- the **table** has no `anon`/`authenticated` grants (direct access denied);
- 5 constraints present (pk, unique `task_id`, FK, answers-object, definition);
- empty read returns 0 rows, no error.

**Note:** Supabase auto-granted `EXECUTE` on both RPCs to `anon` (platform
default for new public functions). Safe — each RPC rejects unauthenticated
callers (`auth.uid()` null → 'unauthenticated') and the table has no anon grant;
matches the live proof v1A posture. Optional later tightening:
`revoke execute … from anon`.

## 7. Rollback plan
Leaf objects, fully reversible:
`drop function get_task_report_submission(text); drop function
upsert_task_report_submission(text,text,jsonb); drop table
task_report_submissions;`. **Do NOT** drop `auth_user_roles_for_org` (shared with
proof). Dropping this table does not affect tasks / task_submissions / rsvps.

## 8. Implementation order (next steps)
1. ✅ Apply the migration (table + 2 RPCs) — done + verified.
2. Client adapter `lib/reportSubmissionService.ts` (upsert/get; fallback-safe) —
   mirrors `taskService` proof adapters.
3. Task Detail report form keyed off `reportDefinitionId` + `validateAnswers` +
   submit→state; pure-test the payload builder.
4. Report-task generation wiring (generator exists; no scheduler yet).
5. New EAS build for on-device testing.

---

*Storage applied. No app UI, EAS, auth/flag, or notification change yet.*
