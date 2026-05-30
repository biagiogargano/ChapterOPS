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
- **Generic event-template examples** (`lib/genericEventTemplates.ts`): three
  org-neutral example templates (Club Fundraiser, Team Practice, Business Meeting)
  on the same `EventTaskTemplate` shape, proving the template engine is generic.
  **Not registered, not surfaced** (kept out of `EVENT_TEMPLATES` — never in the
  picker/preview/defaults/cascade). 51 tests assert same-invariants + not-surfaced.
- **Role-pack planning** (`lib/rolePack.ts` inert type-only sketch +
  `docs/ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md`): the future role-pack shape
  for supporting many org types. Nothing imports the sketch — zero runtime code.
- **Plans (docs only):** `docs/QUESTIONNAIRE_GENERATION_UI_PLAN.md` (the
  "Create questionnaire tasks" trigger — now wired), `docs/GOALS_PROGRESS_LAYER_PLAN.md`
  (future goals layer, separate from tasks, Supabase-gated), and
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

### Questionnaire generation trigger (NEW — wired, sandbox-testable)

- A **"Create questionnaire tasks"** card on the **Me tab**, gated to **President /
  Pro Consul / Annotator**. Helper text: "Creates tasks from a questionnaire
  template. Safe to press again." Shows the selected template's label (Weekly
  Officer Report for alpha).
- Calls the generic `generateQuestionnaireTasks` (template + officer roles +
  ISO-week cycle id + due-in-7-days). **Idempotent** — re-press creates nothing
  new. Inline success (created/skipped counts) or inline error.
- **Confirmation step (`f8db5f0`):** the button opens a native confirm
  ("Create questionnaire tasks?" / body explaining it creates this cycle's tasks
  for officer roles and is safe to re-run / "Create tasks" · "Cancel"). Generation
  runs only after Confirm.
- This creates the report **tasks**; **submitting** a task still writes through the
  `task_report_submissions` RPC, which remains device-unverified (see gated list).

## Gated / not user-reachable yet (by design)

- **Submission round-trip never run on device.** The questionnaire form +
  `task_report_submissions` RPC have only run against the fallback-safe path in
  tests. Generation works in-app now, but persisting answers needs a build to
  verify on device.
- **No live answers→agenda wiring** — the pure extraction
  (`agendaContributions.ts`) exists; the agenda screen does not yet fetch
  submissions.
- **No goals/progress layer** — planned only (`docs/GOALS_PROGRESS_LAYER_PLAN.md`);
  needs its own future Supabase lane.
- **No scheduler / reminders / push / Reports tab** — generation is one manual tap.

## Tests

- `npx tsc --noEmit` → clean.
- `npm run test:pure` → **29 suites pass**, including the questionnaire +
  agenda-contribution suites: `structuredResponses` (37), `reportDefinitions`
  (16), `questionnaireTemplates` (31), `questionnaireCycle` (12), `reportTasks`
  (21), `reportSubmissionService` (6), `reportGeneration` (26),
  `agendaContributions` (14), `genericEventTemplates` (51), plus `todayFeed`,
  `taskListView`, `eventTemplates` (155), `orgLevels`, `taskAssignment`, and the rest.

## Manual test checklist

> For the **on-device** pass when Build 17 is cut, use the dedicated, ordered
> `docs/BUILD_17_DEVICE_TEST_CHECKLIST.md` (includes roll-out caution: test on your
> phone + one other account, don't announce broadly until the round-trip works).
> The lists below are the quick dev/sandbox view.

### Testable now (sandbox / in-app, no build needed)
1. **Today** with mixed due dates → overdue listed first, accurate summary line,
   red header only when overdue exists.
2. **Tasks tab** → empty states read correctly for search-miss / Done / To Do.
3. **Create Task** → reviewer picker behaves; no stale empty-state copy.
4. **Questionnaire generation** (as President / Pro Consul / Annotator):
   - Me tab shows the "Create questionnaire tasks" card; other roles do **not**
     see it.
   - Press it → **a confirm dialog appears**; tapping **Cancel** creates nothing.
   - Press it again → **Create tasks** → success line shows a created count; one
     questionnaire task per officer role appears in the Tasks list, titled
     "Weekly Officer Report — <role>".
   - **Confirm again → "No new tasks · N already existed"** (idempotent, no dupes).
   - Generated cards show **no proof icon and no "Reviewed by"** label (correct —
     questionnaires have neither).

### Requires the next build (on-device, exercises the RPC)
5. Open a generated questionnaire task as its **assignee** → fill required prompts,
   toggle "No update" on an optional one → **Submit Response** → task shows **Done**.
6. Reopen as a **leadership reader** (President / Pro Consul / Annotator) →
   read-only answers shown. As a **non-reader** role → no answer data.
7. Re-submit / edit path: reopen as assignee before submit → "Not submitted yet."

## Gated next steps (explicit)

**Requires EAS build + on-device testing:**
- Verify the questionnaire submission round-trip (steps 5–7) against the live
  `task_report_submissions` RPC + deny-by-default table — the first real use is the
  real test. **No build is cut without an explicit "cut the build."**

**Requires future Supabase work (separate approved lanes):**
- **Live answers→agenda wiring** — fetch per-cycle submissions and render the
  agenda sections from `agendaContributions.ts`.
- **Goals/progress layer** — a `goals` + `goal_progress_updates` schema/RLS/RPC
  set per `docs/GOALS_PROGRESS_LAYER_PLAN.md`. **Do not build goals yet.**
- Any rename of `task_report_submissions` / RPCs (a migration).

## Known risks / notes

- The questionnaire chain is **code-complete and generation is live in-app, but the
  submission round-trip is device-unverified**; treat the first on-device submit as
  the real test of the RPC + deny-by-default table.
- The submission RPCs are auto-granted EXECUTE to `anon` by Supabase default —
  safe: the RPCs reject unauthenticated callers and the table has no anon grant.

## Status

Bundled, checks green (tsc clean, 28 pure suites), **not cut**. Questionnaire
generation is now usable in-app; submission persistence needs a build to verify on
device. **No build recommended** by these changes alone — no native/dependency
change, no live-alpha blocker. Cut only on explicit "cut the build" or a live-alpha
blocker.
