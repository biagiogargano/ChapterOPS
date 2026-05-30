# Build 17 — Change Notes (bundled, not yet cut)

Build 17 is a bundled release in development on `phase-2`. **Build 16 remains the
latest cut/submitted TestFlight build.** This doc summarizes everything on
`phase-2` since Build 16 so it can be manually tested before a build is cut. **No
EAS build has been made.** Cut only on explicit "cut the build" or a live-alpha
blocker.

Base: Build 16 = commit `8fe71fc`. Range: `8fe71fc..HEAD` (34 commits).

This consolidates `docs/POST_BUILD_16_NOTES.md` (clarity polish + helper
extractions), the **Reports V1** chain, the **agenda contribution foundation**, and
the **product-doctrine re-anchor + generic questionnaire** work built afterward.

---

## Theme

Three threads: (1) **clarity polish + pure-helper extraction** across Today, Tasks,
Create Task, and the event-template registry (no behavior change beyond copy);
(2) the **structured-response / questionnaire vertical slice** — a generic system
built end to end from primitive → storage → form → generation, with the Weekly
Officer Report as the Sigma Chi alpha template, plus the pure seam for feeding
answers into meeting agendas; (3) a **product re-anchor**: ChapterOPS is
organization-operations software, Sigma Chi is the alpha pack — the questionnaire
feature was generalized accordingly (generic templates + generic generation).

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

## Product re-anchor + generic questionnaire work (docs + pure foundation)

The structured-response feature was generalized so it is not a fraternity
officer-reports system. No live-user behavior change; no Supabase.

- **Product doctrine** (`docs/PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md`):
  ChapterOPS is organization-operations software; Sigma Chi is the alpha pack. The
  generic-primitives table, defaults-vs-core rule, build decision filter, and
  stop-doing list are now the standing contract.
- **Generic questionnaire templates** (`lib/questionnaireTemplates.ts`): three
  org-neutral definitions — Event Recap, Weekly Team Check-In, Availability/Status
  Check — registered through the same registry as the Weekly Officer Report (the
  alpha template). Proves the primitive is cross-org. 31 tests.
- **Generic vocabulary** (`lib/structuredResponses.ts`,
  `lib/reportDefinitions.ts`): `Questionnaire*` type aliases,
  `QUESTIONNAIRE_DEFINITIONS` / `getQuestionnaireDefinition` over the same lookup.
- **Generic generation** (`lib/reportGeneration.ts`): `generateQuestionnaireTasks`
  is now a real generic entry point (explicit definition + roles, no forced
  fraternity defaults, fail-safe, idempotent). `generateWeeklyOfficerReports`
  stays the Sigma Chi preset.
- **Plans (docs only):** `docs/QUESTIONNAIRE_GENERATION_UI_PLAN.md` (the eventual
  "Create questionnaire tasks" trigger — generic copy, Me/Leadership card, not a
  Reports tab) and `docs/GOALS_PROGRESS_LAYER_PLAN.md` (future goals layer, kept
  separate from tasks, gated on its own Supabase lane). Roadmap in
  `docs/STRUCTURED_RESPONSE_ROADMAP.md`.

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
- **No questionnaire generation UI** — `generateQuestionnaireTasks` is generic and
  tested but has no caller; the trigger is designed
  (`docs/QUESTIONNAIRE_GENERATION_UI_PLAN.md`) but not wired (real-user impact +
  device-unverified RPC).
- **No goals/progress layer** — planned only (`docs/GOALS_PROGRESS_LAYER_PLAN.md`);
  needs its own future Supabase lane.

## Tests

- `npx tsc --noEmit` → clean.
- `npm run test:pure` → **27 suites pass**, including the questionnaire +
  agenda-contribution suites: `structuredResponses` (37), `reportDefinitions`
  (16), `questionnaireTemplates` (31), `reportTasks` (21),
  `reportSubmissionService` (6), `reportGeneration` (26), `agendaContributions`
  (14), plus `todayFeed`, `taskListView`, `eventTemplates` (155), `orgLevels`,
  `taskAssignment`, and the rest.

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

Bundled, checks green (tsc clean, 27 pure suites), **not cut**. The clarity
changes ride along; the questionnaire feature needs a generation trigger and a
build before it is user-usable. **No build recommended** by these changes alone —
no native/dependency change, no live-alpha blocker. Cut only on explicit "cut the
build" or a live-alpha blocker.
