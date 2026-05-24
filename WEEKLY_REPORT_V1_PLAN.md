# Structured Response Tasks v1 — Smallest Schema/Workflow Plan
### (first use case: Weekly Officer Report)

**Planning only. No code, no schema changes, no merge.** First real slice after
alpha stabilization. The system is **generic structured-response tasks**; the
**Weekly Officer Report is just the first default template**, seeded by the
fraternity org template — not a fraternity-only feature.

## Tightened direction (locked)
1. Underlying system is **generic structured-response tasks**, not fraternity-only reports.
2. Weekly Officer Report = the **first default template / use case**.
3. v1 < the prototype.
4. "Something must change" = **warning/confirm, not a hard block**.
5. **No agenda integration** in v1.
6. **No generic surveys/polls/quizzes** in v1.
7. **No complex per-committee templates** in v1.
8. **No AI** in v1.
9. **Schema org-agnostic** — Sigma Chi terms come from org templates/defaults, never
   from core table/column names.

v1 field types (max 5): **short text · long text · number/current value ·
current-vs-target · no update** (where "no update" is a per-field option, not a 5th
input type). v1 includes: one recurring structured-response task for officers ·
editable draft · final submit · reviewer/leadership view · submitted/missing status.

## Org-agnostic principle (must hold from v1)
ChapterOPS should serve **any** org (clubs, student orgs, teams, classes,
committees); fraternities/Sigma Chi are the **first strong default**, not a hardcoded
assumption.
- Core tables below use **generic names** (`response_forms`, `response_form_fields`,
  `task_field_responses`) — no "officer", "chapter", or "report" baked into the schema.
- Reporters are targeted by **generic position/role rows**, never literals like "Consul".
- The **Weekly Officer Report** is one `response_forms` row + its fields, **seeded by
  the fraternity template** (`organizations.template`, which already exists). Other
  org types seed different default forms — same engine.
- Long-term: **org type determines** default roles, labels, templates, forms,
  workflows. Core primitive stays: orgs use **events, tasks, structured responses,
  and automation** to stay organized.

---

## 1. Proposed minimal generic data model
Three new generic, org-scoped tables (all carry `org_id`) + one column:

- **`response_forms`** — a structured-response *definition*.
  `id, org_id, key (text), title (text), created_at`.
  (Generic. "Weekly Officer Report" is just a `title`; `key` e.g. `weekly_report`.)
- **`response_form_fields`** — ordered fields for a form.
  `id, form_id (fk), position (int), type (enum: short_text|long_text|number|
  target_value), prompt (text), config (jsonb: { unit?, target? }), allow_no_update
  (bool), required (bool)`.
- **`task_field_responses`** — one row per (task, field) = a responder's answer.
  `id, org_id, task_id (fk tasks), field_id (fk response_form_fields),
  no_update (bool), text (text null), number (numeric null), updated_at`.

Reused: **`tasks`** is the recurring structured-response instance (see §2), with one
added column **`tasks.response_form_id (uuid null, fk response_forms)`**.

Minimal: **2 definition tables + 1 answers table + 1 column**. No snapshot table, no
separate response-status table (status derived from task state — §3). Nothing in the
schema names a fraternity concept.

## 2. Extend tasks, or separate tables?
**Hybrid — extend `tasks` lightly; keep answers separate.**
- The *instance* (shows on Today/Tasks, has a due date, assigned to a person/role,
  recurs weekly) **reuses `tasks`** → inherits assignment, recurrence, due dates, and
  surfacing. Add one column `tasks.response_form_id`; reuse existing `type='structured'`.
- The *answers* go in **`task_field_responses`** (separate) — today's tasks store only
  proof text/state; structured answers are a different shape.
- **Status reuses the task state machine** (no new states in v1): `assigned` = draft,
  `submitted` = final. No `approved` step (no approval gate).

Fits the existing engine; no parallel task system; generic.

## 3. Draft vs submitted workflow (v1)
```
weekly recurrence generates a structured-response task per responder → 'assigned' (DRAFT)
  edit freely: upsert task_field_responses while state = assigned
  final submit:
    - client "something must change" CONFIRM (warn, not block) if no substantive answer
    - set task state → 'submitted', stamp submitted_at
    - LOCK answers (no edits after submit in v1)
missing = task still 'assigned' after its due/window
```
- **v1 simplification:** submit **locks** (defer edit-after-submit + rolling-to-next-
  cycle snapshot). Drops major complexity.
- **No approval gate.** Self-serve submit.
- **"Something must change":** client-side confirm dialog; the server does **not**
  reject (direction #4).

## 4. Role / permission assumptions (generic)
- **Responder:** the member the task is assigned to — read/write **their own** answers
  while draft; read-only after submit.
- **Reviewer/leadership:** a **configurable role set** can read **all** responses for a
  cycle in their org. Default comes from the org template (fraternity → leadership
  positions), not hardcoded.
- **Form authoring:** owner/admin or template seed; **no in-app editor in v1**.
- All checks key off existing **membership + positions**.

## 5. Schema / RLS needed
- **DDL:** create `response_forms`, `response_form_fields`, `task_field_responses`;
  add `tasks.response_form_id` (+ optional `tasks.submitted_at` if not derivable).
- **RLS (org-scoped, key off membership/positions):**
  - `response_forms` / `response_form_fields`: SELECT for org members; INSERT/UPDATE
    for owner/admin (or seeded server-side).
  - `task_field_responses`: a member may SELECT/INSERT/UPDATE rows for a task **assigned
    to them** while it's draft; UPDATE blocked once task = submitted; leadership roles
    may SELECT all in their org.
  - `tasks`: already RLS-scoped; ensure the new column doesn't widen access.
- **Seeding:** a template-driven seed creates, per org by `template`, the default form
  + fields (fraternity → Weekly Officer Report + Tier-1 fields) and the weekly recurring
  tasks per officer. Other templates seed their own.
- First real schema/RLS for this feature → its own approved migration, verified against
  alpha org-isolation rules.

## 6. Smallest implementation sequence
1. **Migration:** 3 generic tables + 1 column + RLS.
2. **Template seed:** fraternity template seeds one structured-response form (titled
   "Weekly Officer Report") + Tier-1 fields. (Generic seed path reusable per template.)
3. **Recurrence generation:** weekly structured-response task per officer (reuse the
   recurrence/generation engine; `type='structured'` + `response_form_id`).
4. **Fill UI:** render fields by type; upsert answers as draft (autosave); submit with
   the warn-not-block confirm.
5. **Reviewer view:** list a cycle's responses → submitted vs missing (read-only).
6. **Status surfacing:** the task shows on the responder's Today/Tasks via existing
   surfacing; submitted/missing reflected by task state.

Stop there. Steps 1–2 are the schema phase; 3–6 are UI/logic.

## 7. Risks & what to defer
**Risks (mitigate):**
- *Scope creep in field types* → cap at 5; defer select/percentage/scheduler.
- *State-machine drift* → reuse assigned/submitted; no new states in v1.
- *Hidden fraternity coupling* → keep table/column names generic; roles/labels/forms via
  template; review the migration specifically for any literal Sigma Chi terms.
- *RLS gaps* → answers self-write/leadership-read only; test isolation.
**Defer:**
- Edit-after-submit + rolling-to-next-cycle snapshot (v1 locks on submit).
- Multiple / per-committee forms (v1 = one default form).
- Agenda integration — explicitly out.
- Submit notifications (add a simple notice later).
- In-app form authoring/editing UI (v1 seeds the form).
- Surveys/polls/quizzes, AI drafting — out.

## Roadmap note (org-agnostic going forward)
Every future core area (events, tasks, structured responses, roles, templates,
attendance, agendas, permissions) follows the same rule: **generic core table + org
template provides defaults/labels**. Fraternity is template #1; clubs/teams/classes are
future templates reusing the same primitives. Broadly applicable, still tailor-made via
smart defaults.
