# Goals-First System Plan

**Product pivot (captured for planning — DO NOT BUILD YET).** Reports / weekly
officer updates are useful, but the bigger product is a **Goals / Progress
Tracking** system. This doc reframes the existing structured-response/questionnaire
work as the *update layer* of a goals system, and plans the goals layer on top.

Supersedes the framing of `docs/GOALS_PROGRESS_LAYER_PLAN.md` (which stays as the
narrower persistence sketch); this is the first-class product plan. Governed by
`PRODUCT_ARCHITECTURE_AND_SCALE_DOCTRINE.md`.

> Scope guard: no Goals tab, no schema, no scheduler, no notifications, no AI, no
> build. Planning + optional type-only sketches only.

---

## 0. The three layers

```
Goal (persistent object)  →  Goal update window (recurring)  →  Update task (reminder/action)
   lives over time             "submit this period's update"      opens the update form, completes on submit
```

- **Goal** = a target tracked over time (current vs target, cadence, owner). Never
  "done" in the task sense — it progresses.
- **Goal update** = a recurring structured response capturing this period's value +
  notes (the questionnaire we already have, repurposed).
- **Update task** = the existing task that surfaces "submit your update" and
  completes on submission.

The current questionnaire work is layer 2–3, not the whole product.

## 1. What we already built that TRANSFERS (directly reusable)

| Asset | Where | Role in goals system |
|---|---|---|
| Structured-response primitive | `lib/structuredResponses.ts` | The **goal-update form** model (questions/answers/validation/No-update) — unchanged |
| Questionnaire definitions | `lib/reportDefinitions.ts`, `lib/questionnaireTemplates.ts` | Become **goal-update templates** (Weekly Officer Report = one check-in template) |
| `task_report_submissions` table + RPCs | applied on alpha | Stores **goal-update submissions** (a submission already keys by task + answers) |
| Submission adapter | `lib/reportSubmissionService.ts` | Reads/writes goal-update answers — unchanged |
| Task Detail form | `app/task/[id].tsx` `ReportFormSection` | Renders the **goal-update form** — unchanged |
| Questionnaire generation | `lib/reportGeneration.ts`, `lib/questionnaireGenerationPlan.ts`, `lib/questionnaireCycle.ts` | Generates the **recurring update tasks** from a goal's cadence |
| Agenda contribution helper | `lib/agendaContributions.ts` | Rolls **help-needed / announcements** from updates into agendas — unchanged |
| Starter packs | `lib/starterPacks.ts`, `lib/rolePack.ts` | Packs ship **default goal types** per org type later |

**Net: ~all of the structured-response/questionnaire stack is the goal-update
layer.** The pivot adds the *goal object* above it; it does not throw anything away.

## 2. What changes CONCEPTUALLY

- "**Weekly Officer Report**" → one **goal-update / check-in template** (an officer
  goal's weekly update), not a standalone report system.
- **Goals become persistent objects** with their own lifecycle (active / completed
  / archived) and current-vs-target value.
- **Update tasks are generated FROM goals** (cadence-driven), not authored ad hoc.
- **Leadership review** is about **progress over time** (a goal's trend), not just
  reading one week's report.
- A "report" is reframed as "a goal update with mostly-text answers."

## 3. Proposed v1 Goals tab (NOT built yet)

A simple list + detail, no dashboard:
- **List active goals**: title, owner (role/person), current/target, cadence, last
  update (date), and a needs-help/blocked flag if the latest update set one.
- **Create goal** (see §4).
- **Goal detail**: target/current, cadence + next update window, owner, update
  history (value + date + who), edit / mark complete / archive.
- No charts in v1 — a value + "3 of 5 updates submitted this term" is enough.

## 4. Goal creation model

- **One goal** manually, or **multiple at once** via newline/`;`-separated titles
  (mirrors a quick-add list; each line becomes a goal with shared cadence/owner
  defaults the creator can adjust).
- Fields: prompt/title, target value, current value (default 0), cadence
  (daily/weekly/monthly/custom), owner role or person, reviewer/visibility.
- Pure helper later: parse the multi-line input → `Goal[]` (deterministic,
  testable — like `reportTasks`/`questionnaireCycle`).

## 5. Weekly/monthly update model

- A goal's **cadence** + **update window** (open for a day / weekend / week) define
  when an update is expected.
- The system **generates an update task** per window (reusing
  `generateQuestionnaireTasks` + a cycle id from the goal + period).
- The update form asks: current value, what changed, need help?, announcement?,
  **no update this period**, **request completion / mark goal done**.
- Submitting completes the task and appends a **goal update** (value + answers +
  timestamp). Leadership reads the trend; "request completion" flags the goal for
  review, it doesn't self-complete.

## 6. Generic org applicability (pack content, not core)

| Org type | Example goal | Cadence |
|---|---|---|
| Fraternity | Officer term goal; recruitment class size | weekly / term |
| Club | Membership drive; event attendance | weekly |
| Sports team | Practice attendance; fitness target | weekly |
| Business team | KPI (signups, revenue) | weekly / monthly |
| Class / project | Milestone completion | per milestone |
| Nonprofit | Fundraising total; volunteer hours | monthly |
| Personal (later) | Self-management goals | daily / weekly |

The goal *model* is generic; the example goals are pack/default content.

## 7. What current report/questionnaire code BECOMES

| Code | Disposition |
|---|---|
| `structuredResponses`, `reportSubmissionService`, Task Detail form, `agendaContributions`, generation helpers | **Reuse directly** as the update layer. No change. |
| `reportDefinitions` / `questionnaireTemplates` | Reuse as **update templates**; a later rename toward "goal update template" is cosmetic — defer (churn). |
| `reportDefinitionId` field, `report_*` ids, `lib/report*.ts` names | **Keep — do NOT rename now.** Touches ~10 files + the live `task_report_submissions` table/RPC names = migration. Deprecated *conceptually* (they're "goal updates"), renamed only in an approved later pass. |
| `task_report_submissions` table + RPCs | **Reuse for goal-update storage** if the shape fits (it stores task_id + answers). A rename to `goal_update_submissions` is a **Supabase migration** — gated, later, maybe never if reuse is clean. |
| "Weekly Officer Report" as a product concept | **Conceptually deprecated** as a standalone feature — it's one goal-update template. UI copy already generic ("Submit Response"). |

Nothing gets deleted; the report layer is *subsumed*, not replaced.

## 8. Future Supabase needs (gated — do NOT touch)

- **`goals` table**: org-scoped, owner role/person, title, target/current value,
  cadence, status, visibility/reviewer, optional links. RLS + SECURITY DEFINER RPCs.
- **`goal_updates`**: either a new table (goal_id, period, value, answers jsonb,
  submitted_by, ts) **or reuse `task_report_submissions`** by linking the update
  task to a goal (cheaper; preferred if the access rules line up).
- **Generated-task linkage**: an update task references its goal + period.
- **Reviewer/leadership access**: mirror the submissions read model
  (submitter + leadership), extended to "read a goal's update history."
- All of this is a **schema/RLS/RPC lane** — planned like
  `REPORTS_V1_PERSISTENCE_PLAN.md`, applied only after explicit approval.

## 9. What NOT to build yet

- ❌ No Goals tab / UI. ❌ No schema. ❌ No `feedsGoalId`/goal tags on questions.
- ❌ No scheduler / recurring background generation. ❌ No notifications/reminders.
- ❌ No AI. ❌ No build. ❌ Do not rename report code or the live table/RPCs.
- ❌ Do not bolt "progress" onto `MockTask` / the task state machine.

## 10. Recommended implementation sequence

1. **This planning doc.** ✅
2. **Pure goal types + helpers** (inert): `Goal` / `GoalUpdate` interfaces ✅
   (`lib/goals.ts`); pure helpers ✅ (`lib/goalHelpers.ts`) — `parseGoalPrompts`
   (bulk newline/`;` quick-add), `goalProgress` (safe current/target math),
   `goalPeriodKey` + `isGoalUpdateDue` (cadence bucketing, NOT a scheduler), and
   status helpers. No app imports, no runtime wiring.
3. **Pure tests** ✅ (`lib/goalHelpers.test.ts`, 36 cases).
4. **Draft Supabase plan** (`goals` / `goal_updates` or reuse) — doc only. ✅
   `docs/GOALS_PERSISTENCE_PLAN.md` + `supabase/goals_v1_draft.sql` (DRAFT, NOT
   applied): a `goals` table + v1 RPCs in the reports pattern; goal **updates reuse
   `task_report_submissions`** for v1 (no new table); open product decisions listed.
5. **Apply Supabase** — only after explicit approval (own lane).
6. **Goals tab** (list + create + detail). *MVP BUILT* (`app/(tabs)/goals.tsx`):
   list active goals, create / edit / complete / archive via `lib/goalService` (the
   live RPCs). Real + persisted; needs device testing in the next build. Goal-update
   task generation NOT wired (step 7 stays future).
   **Permissions v1 (client wired; SQL patch APPLIED + verified on alpha):** any **officer** can
   create goals for their own role (owner defaults to their role); leadership create
   for any role via the role switcher; **Brother/non-officer** get no create form.
   Leadership/annotator (President / Pro Consul / Annotator) manage ALL org goals +
   can filter the list by owner role; an officer manages only goals they **personally
   created** (`createdBy`), so a goal leadership assigned to their role is
   **read-only** to them.
   Client uses `canManageGoal` (mirrors the RPC auth) to show/hide actions; the real
   gate is the RPCs — `supabase/goals_v1_permissions_patch_draft.sql` rewrote
   update/complete/archive auth and is **APPLIED + verified on alpha**, so the server
   now enforces creator-or-leadership management (client and server agree).
7. **Generated update tasks** from goals — **BUILT (manual, per-ROLE)**. The product
   chose ONE weekly update task per officer role (covering all that role's active goals
   + a check-in), not one per goal. Live modules: `lib/goalUpdateGeneration.ts` (pure
   builder + deterministic ids + render-time reconstruction) and `lib/goalUpdateRun.ts`
   (manual run: fetch goals → build → insert), surfaced via the Me-tab leadership card.
   *(An earlier per-GOAL builder `lib/goalUpdateTasks.ts` was removed once the per-role
   decision was made.)* Ownership gap unchanged: only goals owned by a runtime-supported
   `Role` produce a task (custom/person owners skipped until the Role union opens).
8. **Agenda integration** from goal updates (reuses `agendaContributions`).
9. **Notifications / AI** — last, gated.

Gate before each of 5–9: device-verify the questionnaire round-trip first
(`NEXT_BUILDABLE_WORK.md` #1) — the update layer must work on device before goals
ride on it.

---

*Planning/record only. No app behavior, schema, RLS, RPC, flag, push, or EAS change
is implied. Type-only goal sketches (if added) are inert — nothing imports them.*
