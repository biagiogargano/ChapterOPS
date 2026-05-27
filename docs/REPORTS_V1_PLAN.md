# Reports v1 — Plan (structured-response tasks)

Corrected architecture for officer reports, to be implemented **after Proof v1A
phone QA passes**. Planning only — no code/SQL/Supabase changes are implied by
this document.

See also: `docs/PRODUCT_BUILDING_PRINCIPLES.md` (reports must reduce to generic
primitives, not become a standalone system) and
`supabase/proof_v1a_task_submissions.sql` (the proof submission primitive this
builds alongside).

---

## 1. Core decision
**Reports v1 is built as recurring structured-response *tasks*, not a standalone
reports system.** A report is a normal `structured` task that, instead of free
text/link proof, collects a small fixed set of answers. It rides the existing
primitives: tasks (accountability), submissions (storage), notices
(notification), and — later — the agenda. There is **no** separate reports
entity, tab, or inbox.

## 2. Storage decision
**Use a separate `task_report_submissions` table (added later). Do NOT extend
`task_submissions` with `answers jsonb`.**

Reasons:
- `task_submissions` has a `task_submissions_has_proof` CHECK
  (`proof_text <> '' OR proof_link <> ''`) — a report (answers only, no proof)
  would be rejected, forcing the constraint to be weakened.
- **Proof and reports have different visibility rules.** Proof = assignee /
  reviewer / leadership. Reports additionally need the **annotator** (who
  compiles the agenda).
- **Proof privacy must not be widened** to satisfy reports. A shared table +
  shared read RPC would either over-share proof or require fragile row-type
  branching in the read path.
- A separate table keeps the just-shipped **Proof v1A stable** (no ALTER to a
  live, in-QA table/constraint/RPC).
- **Precedent:** a task's structured answer already lives in its own table today
  — `rsvps` stores RSVP / date-name completion separately from `tasks`. A
  separate report-answers table is the same pattern, so this is consistent with
  the codebase and does NOT make reports a standalone system.

## 3. Report model
- **One report task per officer role per cycle** (e.g. weekly).
- **Deterministic id** like `report_<role>_<cycle>` (e.g.
  `report_social_chair_2026-W23`) — idempotent + dedupe, exactly like
  template-generated task ids.
- **Assigned to the officer role** (role-keyed, like every task). Brothers/
  members do not submit officer reports.
- **Submitted through a structured-response form** (the fixed field set below);
  the answers persist in `task_report_submissions`.
- **`tasks.state` still controls status** — submitting flips the report task to
  `submitted` via the existing `updateTaskState`/`saveTaskState` path (the report
  RPC does NOT touch `tasks.state`).
- **Missing reports = overdue report tasks** (the normal Tasks buckets /
  overdue). No bespoke "who's missing" inbox.
- **On submit, emit a notice** (existing `updateNoticeStore`) to the recipients
  (see Visibility).

## 4. Sigma Chi alpha weekly report fields (v1)
Keep it to ~4 short prompts; each supports a per-field **"No update"** toggle so
quiet weeks aren't friction. **Text only in v1** — no numbers, selects, or
ratings.
1. **This week's focus / goal** (long text)
2. **What did you get done?** (long text)
3. **Anything you need help with?** (short text)
4. **Announcements for the chapter** (long text)

## 5. Visibility (who can read a report submission)
- the **submitter** (the assigned officer role)
- the **annotator** (Secretary — compiles the agenda)
- **president**
- **pro_consul**

This read set is intentionally **broader than proof** (which excludes the
annotator) — another reason reports get their own table + read RPC rather than
sharing proof's.

## 6. Future agenda integration (NOT in the first slice)
`buildAgenda` already reserves `announcements` and `helpNeeded` sections
(currently omitted, "depend on reports"). Once reports exist:
- the **Announcements** field of the current cycle's submitted reports feeds the
  agenda **Announcements** section
- the **Need help?** field feeds the agenda **Help needed** section

**Do not add these agenda sections until reports actually exist.** Event/task
derivation in the agenda is unchanged.

## 7. What NOT to build
- **No standalone Reports tab for v1** — reports appear as report **tasks** in
  the existing Tasks tab (officer's My Tasks + a notice nudge; leadership/
  annotator see them in normal lists). A tab would re-create the parallel-system
  anti-pattern.
- **No fake inbox** — use overdue report tasks + notices.
- **No generic survey/form/quiz builder** — a fixed prompt set only.
- **No charts / leaderboards / scorecards** off any field.
- **No AI summaries.**
- **No file uploads / attachments.**

## 8. Future SQL outline (draft later; gated, after Proof v1A QA)
Additive only; **`task_submissions` untouched.**
- **`public.task_report_submissions`** — `id uuid pk`,
  `task_id text → tasks(id) ON DELETE CASCADE`, `org_id uuid`, `submitted_by uuid`,
  `submitted_role text`, `answers jsonb NOT NULL`, `submitted_at`, `updated_at`,
  `UNIQUE(task_id)`, CHECK `jsonb_typeof(answers) = 'object'`; one `org_id` index.
- **RLS enabled, NO permissive policies** (deny-by-default) + `REVOKE … FROM
  anon, authenticated` — access only via RPCs.
- **`upsert_report_submission(p_task_id text, p_answers jsonb)`** — SECURITY
  DEFINER; writer = assignee-role holder or president/pro_consul; **does NOT
  touch `tasks.state`**.
- **`get_report_submission(p_task_id)`** — SECURITY DEFINER; reader = submitter /
  annotator / president / pro_consul, else empty.
- Reuses the existing `auth_user_roles_for_org(uuid)` helper. **Separate
  read/write rules from proof submissions** (proof access never widens).

## 9. Implementation order
1. **Finish Proof v1A phone QA first** (build 9) — confirm the proof submission
   primitive works end-to-end (submit/read/auth/persist/fallback).
2. **Add the report migration DRAFT** (`task_report_submissions` + the two RPCs),
   committed but not run — mirroring how Proof v1A was staged.
3. **Apply + verify the SQL** on alpha (a deliberate, separately-approved
   Supabase step).
4. **Wire the fixed weekly report**: a deterministic report-task generator
   (`report_<role>_<cycle>`) + the structured-response form, using
   `upsert_report_submission` / `get_report_submission`; submit sets state via the
   existing path and emits the recipient notice. Flag-on/flag-off gating like
   proof. Pure tests for the spec + generator.
5. **Later: connect report answers to the agenda** (Announcements / Help needed
   sections).

---

*Documentation only. No app code, SQL, Supabase, or EAS changes are part of this
plan. The corrected storage decision (separate table) supersedes the earlier
draft note about extending `task_submissions` with `answers jsonb`.*
