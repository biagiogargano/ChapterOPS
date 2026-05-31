# Next Buildable Work — ordered index

> **Governed by `docs/MASTER_ROADMAP.md`** (the canonical development + business
> roadmap). This index is the near-term task tracker under it. If the two disagree
> on direction, the master roadmap wins.

The single "what's next" list, so sessions stop re-doing finished work. Each item
says: what it is, its gate, and the doc that already plans it. **If something below
is marked done, do not rebuild it — only fix a specific bug or stale doc.**

Keep this doc current: when a lane finishes, move it to "Done" with its commit.

---

## Phase A — pre-build stabilization blocker list (current)

**Must-fix before the next (final) iOS build — DONE:**
- Questionnaire persistence: `taskService` maps `reportDefinitionId ↔ report_definition_id`; broken questionnaire → honest "unavailable" state; column applied on alpha. *(Needs the new build to verify on device — Build 17 predates the client mapping.)*
- Goals create UX: bulk create (newline/`;`), leadership owner-role selector, officers locked to own role.
- Goals cadence wording: "UPDATE CHECK-IN" → Weekly / Monthly / One-time (Daily hidden), helper "…does not create reminders yet."
- Goals permissions: client `canManageGoal` (creator-or-leadership) ↔ server patch applied.
- Notifications: 4 task pushes mirror to in-app notices; dismiss works.

**Okay to test privately in the next build (not blockers):** all of the above on device + the device checklist.

**Should WAIT until after the private build:** device-surfaced issues, then Goals v1 depth.

**Foundation built this sprint (client-safe; UI/wiring gated on DRAFT SQL apply):**
- **Goals numeric|text values** — types + `goalDisplay`/`goalValueKind` + service mapping + card render done (`lib/goals.ts`, `goalHelpers`, `goalService`, Goals card). Text INPUT gated on `supabase/goals_v2_value_kind_patch_draft.sql` (DRAFT, not applied).
- **Goal-linked weekly-update form** — pure builder `lib/goalUpdateDefinition.ts` (per-goal questions + officer check-in, reuses the structured-response form). Generation/insertion gated on a product decision + the value/window model.
- **Update windows** — pure `lib/taskWindow.ts` (open / not-yet-open / overdue). Locked UI gated on `supabase/task_available_at_patch_draft.sql` (DRAFT, not applied).
- **Goal-assigned in-app notice** — pure `buildGoalAssignedNotice`. Emit gated on `supabase/update_notices_goal_entity_patch_draft.sql` (widen entity_type CHECK to 'goal'; DRAFT, not applied).

**SQL patches — ✅ ALL THREE APPLIED + verified on alpha:**
1. `goals_v2_value_kind_patch_draft.sql` — value_kind/target_text/current_text +
   text-param create_goal/update_goal (exactly one overload each). → text/status goals.
2. `task_available_at_patch_draft.sql` — tasks.available_at. → update windows.
3. `update_notices_goal_entity_patch_draft.sql` — entity_type allows 'goal'. → goal notices.

**Client sprint WIRED (storage live):**
- ✅ Goals create/edit **text/status values** — GOAL TYPE toggle (Measurable number /
  Status outcome); card renders both via `goalDisplay`. (`app/(tabs)/goals.tsx`)
- ✅ **Goal-assigned in-app notice** — `emitGoalAssignedNotice` at the leadership
  goal-create site (no push; no-ops for self/own-role/all); Notifications opens the
  Goals tab on tap. (`goals.tsx`, `notifications.tsx`, `updateNoticeStore`)
- ✅ **available_at mapping** — `tasks.available_at ↔ MockTask.availableAt` (taskService).

**Weekly goal-update GENERATION — ✅ BUILT (manual, alpha; product decision made):**
Decision: MANUAL weekly generation, no scheduler/push/AI/background job. End-to-end,
**no new SQL** (reuses the applied `available_at` + `report_definition_id` columns):
- **Pure generation** (`lib/goalUpdateGeneration.ts`, 43 tests): one task per officer
  ROLE with active goals; deterministic ids (`goalupdrole_<role>__<period>` task,
  `goalupddef_<role>__<period>` def); idempotent; sets availableAt + dueAt.
- **Run service** (`lib/goalUpdateRun.ts`, 19 tests): fetches active goals → derives
  ISO period + window (availableAt = now+4d opens near end of week, dueAt = now+7d) →
  builds per-role tasks → persists new ones via addGeneratedTask + insertTask. Async,
  idempotent, fail-safe.
- **Leadership UI** (`app/(tabs)/me.tsx` — GoalUpdateGeneratorCard): President / Pro
  Consul / Annotator only; Alert confirm; created / skipped / "no active goals" line.
- **Dynamic-definition reload gate CLEARED via render-time reconstruction** (NOT new
  storage): a goal-update def is not in the static registry, so `app/task/[id].tsx`
  RECONSTRUCTS it from the role's CURRENT active goals (`reconstructGoalUpdateDefinition`)
  — questions re-derived from persisted goals; answers persist via the existing
  `task_report_submissions` RPC keyed by stable goal field keys. Survives reload.
- **Available-window UI**: `taskWindowView` gates the form — before availableAt the
  assignee sees "NOT OPEN YET" and the form is read-only (no submit before open).

  **Known alpha limitations (documented, not bugs):** (1) window is *now-relative* on
  first run, not calendar-anchored — re-runs the same ISO week are idempotent so timing
  is fixed by the first run; (2) the reconstructed form reflects *current* goals, not a
  snapshot at generation time — if a goal is archived after submission its answer
  persists but isn't shown. A historical snapshot / update-history view is **Phase D**
  (see below). **Needs device verification** of the generate → submit → reload →
  leadership-read round-trip (a build), like the questionnaire round-trip.

**Goals → updates → history → review → agenda — MOSTLY WIRED (see detailed status below).**
- **Update history / snapshot** — ✅ WIRED (SQL applied; submit persists a snapshot, read
  prefers it). See the WIRED section below.
- **Editable agenda + update-derived sections + Officer Priorities + agenda-finalized in-app
  notice** — ✅ WIRED. See the WIRED section below.
- **Leadership/Annotator review** — the one **NOT wired** piece. `lib/goalUpdateReview.ts`
  (22 tests) + the read-only "submitted/awaiting review" copy are ready, but turning on a real
  review GATE flips goal-update submit from auto-complete (→approved) to review-gated
  (→submitted, reviewer approves). That is a **PRODUCT DECISION** (does a weekly update need
  leadership sign-off to count as done?) + behavior change to an unverified flow — held. When
  decided: generation sets `reviewerRole`='annotator' + `requiresApproval`; the form's
  onSubmitted sets `submitted` (not `approved`, no push); Task Detail shows the reviewer
  approve/reject affordance for goal-update tasks (drop the `!isReportTask` gate). No SQL,
  no permission change, no push needed.

**SQL — ✅ BOTH APPLIED + verified on alpha (2026-05-30):**
1. `task_report_submission_snapshot_patch_draft.sql` — `definition_snapshot` column +
   4-arg upsert / snapshot-returning get. Backward-compatible; inert until the client
   snapshot write/read is wired. → goal-update history.
2. `agenda_documents_patch_draft.sql` — `agenda_documents` table + 3 definer RPCs (RLS on,
   0 policies, no client grant). Inert until the agenda editor/read path is wired. →
   editable meeting agenda.

**✅ WIRED (real persistence; needs device round-trip verification on the next build):**
- **Goal-update snapshot write/read** — on submit, Task Detail builds
  `buildGoalUpdateSnapshot(...)` and persists it via the 4-arg upsert; on read it prefers the
  stored snapshot (`definitionFromSnapshot` / `pickGoalUpdateDefinition`) over live
  reconstruction, with a "from the saved snapshot for that week" read note. Ordinary
  questionnaires unchanged. (`reportSubmissionService.ts`, `goalUpdateGeneration.ts`,
  `app/task/[id].tsx`.)
- **Editable agenda document** — `lib/agendaDocumentService.ts` (get/upsert/finalize, 11
  tests) + `app/agenda/[eventId].tsx`: leadership generate/regenerate/**finalize** a durable
  agenda; any member views the saved doc; live preview when none saved; honest
  loading/error/empty. **Goals-needing-attention** is folded in at generate (leadership reads
  goals; members see it via the saved doc).

**✅ Agenda inline editing — WIRED.** Leadership/Annotator edit a saved, unfinalized doc
(section titles + item text, add manual item, remove line), persisted via
`upsertAgendaDocument`; regenerate confirms before overwriting edits; members + finalized
docs read-only. Pure immutable helpers in `lib/agendaDocument.ts` (set/add/remove/prune, 36
tests). (`app/agenda/[eventId].tsx`.)

**✅ Agenda Help-Needed / Announcements — WIRED (read path applied + consumed).**
`list_submissions_for_org_cycle` is live; agenda generate/regenerate folds this cycle's
weekly-update submissions into the saved doc: `listSubmissionsForOrgCycle(org,
weeklyGoalUpdatePeriodKey(now))` → `agendaContributionsFromSubmissions` →
`assembleAgendaDocument`. Sections appear with role attribution when data exists; empty/
failed read omits them honestly (never blocks save). (`app/agenda/[eventId].tsx`.) Known: uses
the current weekly period (not meeting-anchored); only snapshot-backed submissions contribute.

**✅ Officer Priorities section + agenda-finalized in-app notice — WIRED.** Generate also
folds each officer's "priorities for next period" into an Officer Priorities section
(`officerPriorityItems`). Finalizing emits an in-app, officer-bounded, **no-push**
"Meeting agenda finalized" notice (`emitAgendaFinalizedNotice`, entityType 'event';
store excludes the actor). (`app/agenda/[eventId].tsx`, `lib/updateNoticeStore.ts`.)

**Still gated / next:**
- **Leadership/Annotator review wiring** — held; it's a **product decision** (does a weekly
  update need leadership sign-off to count as done?) + a behavior change to an unverified
  flow. Model + read-copy are ready (`lib/goalUpdateReview.ts`); see the detailed gate above.
- **Agenda announcements/help-needed from Weekly Officer Reports** (not just goal updates) —
  the list RPC matches only `goalupdrole_*`; widening it is a separate SQL lane.
- **Meeting-anchored agenda cycle** (vs current weekly) — a later product decision.

---

## Do NOT revisit (done — bug/stale-doc only)

- Product doctrine + scale principles — `PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md`, `PRODUCT_BUILDING_PRINCIPLES.md`
- Questionnaire/report foundation (primitive, definitions, storage, adapter, Task Detail form, generation trigger + confirm) — `STRUCTURED_RESPONSE_ROADMAP.md`, `REPORTS_V1_STATUS.md`
- Generic questionnaire templates + generic generation — `lib/questionnaireTemplates.ts`, `lib/reportGeneration.ts`
- Agenda contribution foundation (pure) — `lib/agendaContributions.ts`
- Event-template engine + generic unsurfaced examples — `EVENT_TEMPLATES_FOUNDATION.md`, `lib/genericEventTemplates.ts`
- Org-levels / assignment permissions — `ORG_LEVELS_PLAN.md`, `lib/orgLevels.ts`
- Role-pack + setup-pack plan + inert types — `ROLE_PACKS_AND_GENERIC_PERMISSIONS_PLAN.md`, `ORG_ONBOARDING_AND_SETUP_PLAN.md`, `lib/rolePack.ts`
- Packaging / GTM plan — `PACKAGING_AND_GTM_PLAN.md`
- Event Detail / Today / Tasks / Create Event polish — audited clean
- Build 17 notes + device-test checklist — `BUILD_17_NOTES.md`, `BUILD_17_DEVICE_TEST_CHECKLIST.md`

---

## Next, in order

### 1. Build 17 device test (when a build is cut) — GATED: EAS build
Verify the questionnaire **submission round-trip** on device (the one thing pure
tests can't cover): submit → persist via `task_report_submissions` RPC → read-only
leadership view → non-reader denial. Follow `BUILD_17_DEVICE_TEST_CHECKLIST.md`.
**Needs an explicit "cut the build"** (2 iOS builds left). Everything else here is
no-build.

### 2. Fix any device/RPC issues found — depends on #1
Triage what the device test surfaces (most likely the RPC round-trip / read
permissions). Scope unknown until #1 runs.

### 3. Questionnaire generation UX polish — only AFTER #1 is stable
Small, real improvements once the round-trip works: e.g. surface the cycle/week the
tasks are for, a role multi-select (deferred in `QUESTIONNAIRE_GENERATION_UI_PLAN.md`),
or a "view this cycle's questionnaire tasks" shortcut. No new system. Not before the
flow is device-verified (don't polish an unverified path).

### 4. Starter-pack / org-setup FOUNDATION (no UI) — registry+loader DONE; wiring next
**Registry + pure loader built** (`lib/starterPacks.ts`, 28 tests): `STARTER_PACKS`,
`getStarterPack`, `getStarterPackForOrgTemplate`, `activeStarterPack(template)` (safe
fallback to `sigma_chi`), `isKnownStarterPackId`. The `sigma_chi` pack is *derived
from* the live constants (roles/levels/exceptions/template+questionnaire ids/agenda
sections), so it describes current behavior without changing it. **Not wired** —
nothing imports it yet.
**Sub-step (a) STARTED — first read site wired:** the Me-tab questionnaire card now
reads `{ definitionId, roles }` from the active pack via
`lib/questionnaireGenerationPlan.planQuestionnaireGeneration(org.template)` instead
of hardcoding `WEEKLY_OFFICER_REPORT_ID` + `OFFICER_ROLES`. Behavior-identical for
alpha (sigma_chi + fallback); 15 tests lock that in.
**Still direct (intentional):** assignment/reviewer picker (`task/create.tsx` —
permission risk, Category C), event-audience composition + template picker
(`event/*`, `templates/edit.tsx` — Category B, low-level pack data, no behavior win
yet). **Sub-step (b) DONE:** a second pack `club` exists as pure data
(`CLUB_STARTER_PACK`) with real custom role keys, proving genericity — not default,
not surfaced, not active in alpha. Confirmed the closed-`Role`-union gate: custom
keys are data-expressible but not yet functional through the runtime engines.
**Also done:** the pack→runtime boundary is explicit (`lib/rolePackRuntime.ts`), and
packs are integrity-checked (`lib/starterPackValidation.ts`, test-enforced). The
create-org screen reads its template label/value from the registry
(`DEFAULT_STARTER_PACK_ID`), and the **Event Create template picker** and the **Templates screen BUILT-IN list**
(`templates/index.tsx`, display-only) now read built-in templates from the active
pack via `lib/templatePackView.ts` — behavior-identical for alpha (the sigma_chi
pack lists exactly `EVENT_TEMPLATES`); custom templates still merge/list after.
**Still direct (intentional):** Event Detail's apply-template picker
(`event/[id].tsx`), template EDIT/CREATE (`templates/edit.tsx`, plus the custom
list + edit/duplicate/delete actions — Category B mutation), and template
RESOLUTION (`getTemplateById`/`buildTasksForTemplateId` must resolve any id so no
existing task breaks).
**Read-side wiring is now COMPLETE for safe sites** — see
`docs/STARTER_PACK_MIGRATION_MAP.md`. No behavior-identical Category-A site remains;
every remaining direct site is B (mutation / low-level) or C (Role-union / permission
/ product-gated). **Stop wiring** until Build 17 device testing (#1) verifies the
already-wired reads render identically.
**Next:** (c) org-type selection UI — now meaningfully possible since a second pack
exists, but still gated on the Role-union opening + a real product decision; (d)
opening the `Role` union for custom keys is **Supabase-gated**. Plan:
`ORG_ONBOARDING_AND_SETUP_PLAN.md` §6 steps 2–4.

### 5. Agenda integration from questionnaire answers — partly Supabase-gated
Wire the pure `agendaContributions.ts` into the agenda screen: fetch a cycle's
submissions and render the announcement / help-needed sections. The **read path
needs fetching submissions** (uses the existing RPC — verify on device first, #1).
No new schema for the read path.

### 6. Goals / progress layer — FOUNDATION DONE, **PARKED** (gated)
Goals are now a first-class direction with a deep pure foundation (all behavior-free,
nothing wired/applied):
- Plan + pivot: `GOALS_FIRST_SYSTEM_PLAN.md`, `GOALS_PERSISTENCE_PLAN.md`.
- Types: `lib/goals.ts`. Helpers: `lib/goalHelpers.ts`. Weekly update generation:
  `lib/goalUpdateGeneration.ts` (per-ROLE) + `lib/goalUpdateRun.ts`. *(The earlier
  per-GOAL `lib/goalUpdateTasks.ts` was removed once the product chose one task per role.)*
- Draft (UNAPPLIED) SQL: `supabase/goals_v1_draft.sql`.

**Storage gate CLEARED** — `supabase/goals_v1_draft.sql` is **applied + verified on
alpha** (RLS on, 0 policies, 6 SECURITY DEFINER RPCs, table locked to definer RPCs).
**Client service DONE** — `lib/goalService.ts` (fallback-safe wrappers over all 6
RPCs; never throws; maps rows → `Goal`; 15 tests).
**Goals tab MVP BUILT** — `app/(tabs)/goals.tsx` (registered in the tab bar): lists
active goals (leadership/annotator → `listGoalsForOrg`; others → `listMyGoals`),
create / edit (title/current/target/cadence) / complete / archive, with
loading/error/empty states. Real + persisted (writes through `goalService`; a
failed/unconfigured RPC shows an error, never a fake success). **Needs device
testing** (the goal CRUD RPC round-trip) in the next build before it's
user-trustworthy. Goal-update task generation remains FUTURE (not wired).

Still gated for the tab to be USER-usable: device verification (a build) of the
goal CRUD + the questionnaire/update round-trip. Build/EAS still requires an explicit
"cut the build".

### 7. AI-assisted setup — LAST, gated on #4 working
Suggest a starter pack / templates from a description. Only after deterministic
setup (the pack loader) works. No AI promises before then.

---

## Gating legend
- **no-build**: doable now in dev (pure libs/tests/docs).
- **EAS build**: needs a TestFlight build — explicit "cut the build" only.
- **Supabase**: needs an approved schema/RLS/RPC lane — do not touch Supabase otherwise.

*Index/record only. No code, schema, RLS, RPC, flag, push, or EAS change implied.*
