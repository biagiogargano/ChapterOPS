# Weekly Officer Report v1 — Smallest Schema/Workflow Plan

**Planning only. No code, no schema changes, no merge.** Target: the first
real slice after alpha stabilization. Questionnaire = a **structured task
response type**; Weekly Officer Report is its first use case. v1 is intentionally
smaller than the prototype.

## Tightened direction (locked)
1. Questionnaire = structured task response type.
2. Weekly Officer Report = first use case.
3. v1 < full prototype.
4. "Something must change" = **warning/confirm, not a hard block**.
5. **No agenda integration** in v1.
6. **No generic surveys/polls/quizzes** in v1.
7. **No complex per-committee templates** in v1.
8. **No AI** in v1.

v1 question types (max 5): **short text · long text · number/current value ·
current-vs-target · no update**.
v1 also: recurring weekly report task · editable draft · final submit · reviewer/
leadership view · basic submitted/missing status.

## Org-agnostic principle (must hold from v1)
ChapterOPS should eventually serve **any** organization (clubs, student orgs,
teams, classes, committees) — fraternities/Sigma Chi are the **first strong
default**, not a hardcoded assumption.
- The core tables here (questionnaire, questions, responses, answers) carry **no
  fraternity-specific terms**. Titles/labels are plain text/data.
- Who must report is targeted by **generic position/role rows**, not literals like
  "Consul." Sigma Chi labels (Consul, Pro Consul, Annotator, chapter meeting…)
  come from an **org template / default config**, seeded by `organizations.template`
  (the column already exists).
- Long-term: **org type determines** default roles, labels, templates, reports,
  workflows. The Weekly Officer Report is just the *fraternity template's* default
  report; another org type ships a different default report — same engine.
- Core primitive stays: **orgs use events, tasks, structured responses, and
  automation to stay organized.**

---

## 1. Proposed minimal data model
New, generic, org-scoped (all carry `org_id`):

- **`questionnaires`** — a report *definition*.
  `id, org_id, key (text, e.g. 'weekly_officer_report'), title, created_at`.
  (Title is plain text; `key` is generic. The fraternity template seeds one row.)
- **`questionnaire_questions`** — ordered prompts for a definition.
  `id, questionnaire_id, position (int), type (enum: short_text|long_text|number|
  target_value), prompt (text), config (jsonb: { unit?, target? }), allow_no_update
  (bool), required (bool)`.
  (`no update` is an attribute of a question, not a separate type → keeps the type
  list to 4 real input types.)
- **`report_answers`** — one row per (task, question).
  `id, org_id, task_id (fk tasks), question_id (fk questionnaire_questions),
  no_update (bool), text (text null), number (numeric null), updated_at`.
  (Typed nullable columns avoid jsonb parsing; `number` serves number + current
  value; `target` lives on the question config, current value in `number`.)

Reused: **`tasks`** (existing) is the recurring report instance — see §2.

Why this is minimal: **2 definition tables + 1 answers table**, plus one column on
tasks. No snapshot table, no separate response-status table (status derived — §3).

## 2. Extend tasks, or separate tables?
**Hybrid — extend tasks lightly; keep answers separate.**
- The *report instance* (appears on Today/Tasks, has a due date, assigned to a
  person/role, recurs weekly) **reuses `tasks`** so it inherits assignment,
  recurrence, due dates, and Today/Tasks surfacing. Add **one column**:
  `tasks.questionnaire_id (uuid null, fk questionnaires)`. The existing task
  `type='structured'` already exists in the app model; reuse it.
- The *answers* go in **separate tables** (`report_answers`) because today's tasks
  store only proof text/state — structured answers are a different shape and would
  bloat the task row.
- **Status reuses the task state machine** (no new states in v1): `assigned` =
  draft (editable), `submitted` = final. No `approved` step (no approval gate).

Net: minimal new surface, fits the existing engine, no parallel task system.

## 3. Draft vs submitted workflow (v1)
```
weekly recurrence generates a report task per responder  → state 'assigned' (DRAFT)
  edit freely: upsert report_answers while state = assigned
  final submit:
    - client "something must change" CONFIRM (warn, not block) if no substantive answer
    - set task state → 'submitted', stamp submitted_at (tasks.updated_at or a column)
    - LOCK answers (no edits after submit in v1)
missing = task still 'assigned' after its due/window
```
- **v1 simplification:** submit **locks** (no edit-after-submit, no rolling-to-next-
  week snapshot — that's deferred). This drops a whole class of complexity.
- **No approval gate.** Submission is self-serve.
- **"Something must change":** evaluated client-side as a confirm dialog; server
  does not reject (keeps it a warning, per direction #4).

## 4. Role / permission assumptions
Stated generically (org-agnostic), defaulted by template:
- **Responder:** the member the report task is assigned to — can read/write **their
  own** answers while draft; read their own after submit.
- **Reviewer/leadership:** a configurable set of roles can **read all** responses in
  their org for a cycle. Default (fraternity template): leadership positions
  (president/pro_consul/annotator). Stored as config, not hardcoded.
- **Authoring the questionnaire:** owner/admin (or seeded by template) — v1 needs
  no in-app editor; the definition is seeded.
- All checks key off existing **membership + positions** (already in schema).

## 5. Schema / RLS needed
- **DDL:** create `questionnaires`, `questionnaire_questions`, `report_answers`;
  add `tasks.questionnaire_id` (+ optional `tasks.submitted_at` if not derivable).
- **RLS (all org-scoped, key off membership/positions):**
  - `questionnaires` / `questionnaire_questions`: SELECT for any org member; INSERT/
    UPDATE restricted to owner/admin (or seeded server-side).
  - `report_answers`: a member may SELECT/INSERT/UPDATE rows for a **task assigned to
    them** while that task is draft; UPDATE blocked once task = submitted; leadership
    roles may SELECT all rows in their org.
  - `tasks`: already RLS-scoped; ensure the new column doesn't widen access.
- **Seeding:** a function/seed that, per org (by `template`), creates the default
  Weekly Officer Report `questionnaire` + its Tier-1 questions, and the weekly
  recurring tasks per officer.
- This is the **first place real schema/RLS is introduced** for this feature → its
  own approved migration, verified against the alpha isolation rules.

## 6. Smallest implementation sequence
1. **Migration:** 3 tables + 1 column + RLS policies (above).
2. **Template seed:** fraternity template seeds one Weekly Officer Report definition
   + Tier-1 questions; (org-agnostic: other templates can seed their own later).
3. **Recurrence generation:** weekly report task per officer (reuse the existing
   recurrence/generation engine; new `type='structured'` + `questionnaire_id`).
4. **Fill UI:** render questions by type; upsert answers as draft (autosave); a
   submit button with the warn-not-block confirm.
5. **Reviewer view:** list this cycle's responses → submitted vs missing per officer
   (read-only).
6. **Status surfacing:** the report task shows on the officer's Today/Tasks via the
   existing surfacing; submitted/missing reflected by task state.

Stop there for v1. Each step is small; 1–2 are the schema phase, 3–6 are UI/logic.

## 7. Risks & what to defer
**Risks (mitigate):**
- *Scope creep in question types* → cap at the 5; defer select/percentage/scheduler.
- *State-machine drift* → reuse assigned/submitted; do **not** invent new states in v1.
- *Hardcoding Sigma Chi* → keep tables generic; roles/labels/definition via template.
- *RLS gaps* → answers must be self-write/leadership-read only; test isolation.
**Defer to later versions:**
- Edit-after-submit + rolling-to-next-week snapshot (v1 locks on submit).
- Per-committee / multiple report definitions (v1 = one default).
- Agenda integration (announcements/help-needed) — explicitly out.
- Notifications on submit (nice-to-have; can add a simple notice later).
- In-app questionnaire authoring/editing UI (v1 seeds the definition).
- Generic surveys/polls/quizzes, AI drafting — out.

## Roadmap note (org-agnostic going forward)
Every future core area (events, tasks, reports, roles, templates, attendance,
agendas, permissions) should follow the same rule: **generic core table + org
template provides defaults/labels**. Fraternity is template #1; clubs/teams/classes
are future templates that reuse the same primitives. This keeps ChapterOPS broadly
applicable while still feeling tailor-made via smart defaults.
