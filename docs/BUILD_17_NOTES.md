# Build 17 — Change Notes (bundled, not yet cut)

Build 17 is a bundled release in development on `phase-2`. **Build 16 remains the
latest cut/submitted TestFlight build.** This doc summarizes everything on
`phase-2` since Build 16 so it can be manually tested before a build is cut. **No
EAS build has been made.** Cut only on explicit "cut the build" or a live-alpha
blocker.

Base: Build 16 = commit `8fe71fc`. Range: `8fe71fc..HEAD` (28 commits).

This consolidates `docs/POST_BUILD_16_NOTES.md` (clarity polish + helper
extractions) and adds the **Reports V1** chain and the **agenda contribution
foundation** built afterward.

---

## Theme

Two threads: (1) **clarity polish + pure-helper extraction** across Today, Tasks,
Create Task, and the event-template registry (no behavior change beyond copy);
(2) the **Reports V1 vertical slice** — a generic structured-response system
(officer weekly reports) built end to end from primitive → storage → form →
generation, plus the pure seam for feeding report answers into meeting agendas.

One Supabase change was applied this cycle (the reports submission table + RPCs);
everything else is client/docs/tests. No auth, RLS-policy-on-existing-tables, or
push-scope change.

## What changed (user-visible)

### Today tab (clarity)
- Overdue vs due-today distinguished; TODAY'S TASKS lists overdue first with a
  summary subtitle ("2 overdue · 1 due today · 3 to review"); header turns red
  only when there is actually overdue work.
- Honest all-clear copy when today is clear but upcoming work exists.
- COMING UP shows a count.

### Tasks tab (clarity)
- Context-aware empty state: search-miss shows the query, Done shows "Nothing
  completed yet.", To Do shows "Nothing to do right now."

### Create Task (cleanup)
- Removed a dead reviewer empty-state with stale, unreachable copy.

### Reports V1 (NEW system — present in code, see "Gated / not user-reachable")
- A task carrying a `reportDefinitionId` renders a **structured report form** in
  Task Detail: ordered prompts, required/optional, per-question "No update",
  validation-gated Submit. Submitting saves answers and marks the task complete
  (no proof, no review gate). Allowed readers (assignee, annotator, president,
  pro consul) see a read-only view; before submission it reads "Not submitted
  yet." Report task cards in lists show no proof/review language.

## Foundation / tests (inert or gated — no live user surface)

- **Structured-response primitive** (`lib/structuredResponses.ts`): generic
  definition/answer model, validation, ordering, completeness, answer-edit
  helpers, and a generic `agendaSection` question tag. Text-only v1;
  select/scale/time reserved fail-safe.
- **Weekly officer report** (`lib/reportDefinitions.ts`): the alpha default
  definition (accomplishments + goals required; blockers + announcements optional
  with No-update; the latter two tagged to feed agenda sections).
- **Report-as-task builder + generation** (`lib/reportTasks.ts`,
  `lib/reportGeneration.ts`): deterministic `report_<role>_<cycle>` ids;
  idempotent manual generation (`generateWeeklyOfficerReports`); no scheduler.
- **Submission adapter** (`lib/reportSubmissionService.ts`): fallback-safe
  upsert/get over the report RPCs; never throws.
- **Agenda contribution extraction** (`lib/agendaContributions.ts`): pure
  pull of tagged, text-answered report answers into agenda
  announcement/help-needed sections, mergeable across officers. Not wired into
  the agenda screen.
- **Event-template registry** invariants/accessors and **Today/Tasks** display
  helpers (from post-Build-16): all pure + unit-tested.

## Supabase change applied this cycle

- `task_report_submissions` table + `upsert_task_report_submission` /
  `get_task_report_submission` SECURITY DEFINER RPCs. **RLS enabled, no table
  policies, REVOKE from anon/authenticated** — all access via the RPCs (writer =
  assignee-role or president/pro_consul; reader = submitter/annotator/leadership).
  Applied and verified on alpha 2026-05-30 (`docs/REPORTS_V1_PERSISTENCE_PLAN.md`,
  `supabase/reports_v1_task_report_submissions.sql`). No change to existing
  tables, existing RLS, auth, or org-scoping.

## What did NOT change

- Push notification scope/audiences (still the 4 task-responsibility pushes).
- Auth/session, org-scoping logic, existing-table RLS, flags.
- Task state machine, proof/review mechanics, reviewer picker.
- No Reports tab, no scheduler, no reminders, no new event systems, no template
  builder UI, no AI.

## Gated / not user-reachable yet (by design)

- **No trigger for report generation.** `generateWeeklyOfficerReports` has no UI
  caller, so no report tasks exist for a user to open. Documented placement: a
  future leadership-gated row on the Me screen Leadership card, wired only after
  device verification (`docs/REPORTS_V1_STATUS.md`).
- **Report form + RPC round-trip never run on device** — only against the
  fallback-safe path in tests. First on-device use needs a build.
- **No live report→agenda wiring** — the pure extraction exists; the agenda
  screen does not yet fetch submissions.

## Tests

- `npx tsc --noEmit` → clean.
- `npm run test:pure` → **26 suites pass**, including the Reports V1 +
  agenda-contribution suites: `structuredResponses` (37), `reportDefinitions`
  (16), `reportTasks` (21), `reportSubmissionService` (6), `reportGeneration`
  (17), `agendaContributions` (14), plus `todayFeed`, `taskListView`,
  `eventTemplates` (155), `orgLevels`, `taskAssignment`, and the rest.

## Smallest manual test list (once a build is cut)

Reports V1 cannot be exercised until a generation trigger exists or report tasks
are seeded. The non-report clarity changes are testable now in the sandbox:
1. **Today** with mixed due dates → overdue listed first, accurate summary line,
   red header only when overdue exists.
2. **Tasks tab** → empty states read correctly for search-miss / Done / To Do.
3. **Create Task** → reviewer picker behaves; no stale empty-state copy.

Reports V1 on-device checklist (deferred until generation + build exist):
seed/generate a weekly report task → open as assignee → fill required prompts,
toggle "No update" on an optional one → Submit → task shows Done → reopen as a
leadership reader → read-only answers shown; as a non-reader → no data.

## Known risks / notes

- Reports V1 is **code-complete but device-unverified**; treat the first on-device
  report round-trip as the real test of the RPC + deny-by-default table.
- The reports RPCs are auto-granted EXECUTE to `anon` by Supabase default — safe:
  the RPCs reject unauthenticated callers and the table has no anon grant.

## Status

Bundled, checks green (tsc clean, 26 pure suites), **not cut**. The clarity
changes ride along; Reports V1 needs a generation trigger and a build before it is
user-usable. Cut only on explicit "cut the build" or a live-alpha blocker.
