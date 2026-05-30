# Structured-Response / Questionnaire Roadmap

The forward plan for the structured-response feature. Read this before building
anything in the "reports" area — it exists to keep the core **generic** and stop
future sessions from hardcoding it as a fraternity officer-reports system or from
repeating completed work.

---

## The product model (READ FIRST)

The generic core primitive is a **questionnaire / structured-response task**: a
task whose completion is a set of answers to a fixed question definition. It is
**not** fraternity-specific.

```
Generic core ........ questionnaire / structured-response task
Alpha default ....... "Weekly Officer Report"  (ONE definition)
Future definitions .. class reflection, business weekly check-in, club officer
                      update, poll, survey, quiz, availability form, event recap
Future LAYER ........ goals / progress tracking (separate from tasks — see v3)
```

"Report" is a **use case / default template**, not the system. Do not flatten
everything into "questionnaire" either — long-term, report answers may feed a
separate goals/progress layer. Keep the core generic; keep "report" as one preset.

### Naming convention going forward
- **Generic vocabulary** for new code: questionnaire / structured-response /
  definition / answers / submission.
- The **definition label** (e.g. "Weekly Officer Report") is the alpha template
  name and may stay user-visible as the form's title.
- The **chrome** around the form (buttons, section labels, errors) should be
  generic ("Submit Response", "SUBMITTED RESPONSE"), not "report"-locked.

---

## What is already DONE (do not rebuild)

| Layer | Module | Notes |
|---|---|---|
| Generic primitive | `lib/structuredResponses.ts` | Definition/answer model, validation, ordering, completeness, answer-edit helpers, `agendaSection` tag. Generic aliases `QuestionnaireDefinition` / `QuestionnaireAnswer(Map)` / `QuestionnaireQuestion`. **This is the core — already generic.** |
| Alpha template | `lib/reportDefinitions.ts` | `WEEKLY_OFFICER_REPORT` — one definition over the primitive. |
| Task builder | `lib/reportTasks.ts` | Deterministic `report_<role>_<cycle>` ids; `buildReportTask`. Body is definition-agnostic. |
| Generation | `lib/reportGeneration.ts` | `generateReportTasks` (impl) + generic alias `generateQuestionnaireTasks`; `generateWeeklyOfficerReports` preset. Idempotent, fail-safe. |
| Storage | `task_report_submissions` table + `upsert/get` RPCs | Applied + verified on alpha. RLS-on, no policies, RPC-only access. |
| Client adapter | `lib/reportSubmissionService.ts` | Fallback-safe upsert/get over the RPCs. |
| Form UI | `app/task/[id].tsx` `ReportFormSection` | Renders any definition; assignee submits → task complete; readers get read-only view. Chrome copy now generic. |
| Agenda seam | `lib/agendaContributions.ts` | Pure extraction of tagged answers → agenda sections. Not wired. |

Tests: `structuredResponses` (37), `reportDefinitions` (16), `reportTasks` (21),
`reportSubmissionService` (6), `reportGeneration` (21), `agendaContributions` (14).

## Naming: kept report-named ON PURPOSE (temporary)

These keep the report-era spelling because renaming is churn-for-no-gain or would
require a DB migration. Documented here so it is a deliberate choice, not drift.

| Name | Why kept | Rename when |
|---|---|---|
| `task_report_submissions`, `upsert/get_task_report_submission` RPCs | **DB migration** — a hard stop gate. | A deliberate, approved Supabase migration lane. |
| `MockTask.reportDefinitionId` | ~8-file interface field; touches tests + UI. Already holds a generic definition id. | A future low-risk rename pass → `structuredResponseDefinitionId`. |
| `lib/report*.ts` module + fn names (`buildReportTask`, `generateReportTasks`, `getReportDefinition`, `reportSubmissionService`) | Working, tested; bodies are generic. Generic aliases added alongside. | If/when generic aliases fully supersede them and the report names read as legacy. |

Rule: **never rename the live table/RPCs outside an approved Supabase lane.**

---

## What is NOT done / gated

- **No generation trigger UI.** `generateQuestionnaireTasks` has no caller. The
  manual entry point is fully designed in
  `docs/QUESTIONNAIRE_GENERATION_UI_PLAN.md` (Me → Leadership card; copy "Create
  questionnaire tasks"; Weekly Officer Report as the default-selected template —
  **not** a one-off "Generate weekly officer reports" button). Gated: it creates
  tasks for real officers (product decision) and the RPC round-trip is
  device-unverified.
- **Form + RPC never run on device** — needs a build (gate).
- **No live report→agenda wiring** — pure extraction exists; agenda screen does
  not fetch submissions yet.
- **No new question types** — select/scale/time/multi_select reserved, fail-safe.
- **No scheduler, no reminders/push, no Reports tab.**

---

## Roadmap

### v1 — structured-response tasks (current)
A user fills a form attached to a task; the task completes. Weekly Officer Report
is the first template. **Status: code-complete, device-unverified, no trigger UI.**
Remaining: (a) generic manual generation entry point; (b) a build to verify
on device; (c) optionally more templates.

### v2 — answers feed the org
- Report/questionnaire answers feed **meeting agendas** (foundation built:
  `agendaContributions.ts`; needs async submission fetch + device-verified RPC).
- **Help-needed** answers can spawn follow-up **tasks**.
- **Announcements** answers can become agenda items / notices.
- **Blockers** become leadership follow-up items.
All of this reads from the existing submission storage — no new schema required
for the agenda read path beyond fetching submissions per cycle.

### v3 — goals / progress tracking (separate layer)
A distinct layer, **not** forced into the task model. Goals (recruitment,
philanthropy, committee, officer) persist over time; questionnaire answers can
**update** ongoing goals. Design this as its own data model when the time comes;
do not bolt it onto tasks. Not started — do not build yet.

### Future — AI-assisted creation
Only after deterministic flows work: AI suggests questionnaire definitions /
templates / generated tasks from events. Deterministic generation must be solid
first.

---

## Next safe lanes (no Supabase / EAS / auth / push / major product decision)

1. More questionnaire **definitions** as data (e.g. event recap, availability) —
   pure, tested, no UI required.
2. Generic generation **helpers/tests** around `generateQuestionnaireTasks`.
3. Continued **doc/comment/alias** alignment toward the generic vocabulary.
4. Agenda-contribution **shaping helpers** (still pure, pre-wiring).

Stop and ask before: any DB rename/migration, the generation trigger UI (real-user
impact), a build, or starting the goals layer.
