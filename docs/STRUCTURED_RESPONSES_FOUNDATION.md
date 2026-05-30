# Structured-Response Foundation

The generic primitive behind officer reports, questionnaires, structured
check-ins, status updates, and (later) polls/scales/time inputs.

Foundation only — see `lib/structuredResponses.ts`. Pure types + validation; no
React, stores, Supabase, or I/O. Nothing imports it yet. This complements
`docs/REPORTS_V1_PLAN.md`, which covers the report-specific storage/visibility
decisions; this doc covers the generic helper layer.

---

## 1. The idea

A **structured-response task** is a normal task whose completion is a set of
**answers** to a fixed **question definition** — instead of free-text/link proof.
Officer reports are the first use case; the primitive is deliberately generic so
any org (club, class, team, committee) supplies its own question set.

```
StructuredResponseDefinition  =  ordered StructuredQuestion[]
StructuredAnswer / StructuredAnswerMap  =  the responder's answers
```

## 2. What exists now (pure, tested)

In `lib/structuredResponses.ts` (31 tests in `structuredResponses.test.ts`):

- **Types:** `StructuredQuestionType`, `StructuredQuestion`,
  `StructuredResponseDefinition`, `StructuredAnswer`, `StructuredAnswerMap`.
- **`orderedQuestions`** — deterministic display order (by `order`, then original
  index, then key).
- **`validateDefinition`** — shape checks: id/label present, ≥1 question, unique
  non-empty keys, prompts present, supported types, valid maxLength.
- **`validateAnswers`** — required answered, No-update only when allowed, value
  vs No-update mutual exclusion, maxLength, unknown-key reporting.
- **`isAnswered`**, **`responseProgress`** — per-question answered check and the
  completeness gate (complete = all *required* answered).
- **`SUPPORTED_QUESTION_TYPES` / `isSupportedQuestionType`** — v1 text-only; the
  type union reserves `select` / `multi_select` / `scale` / `time` for later.
  Unsupported types **fail safe** (reported by validation, never thrown).

## 3. "No update" support

Each question may set `allowNoUpdate`. A responder can then explicitly mark "No
update" for that question, which satisfies `required` without free text — generic
and low-friction (e.g. a quiet week on a weekly report). A No-update answer is
invalid if the question doesn't allow it, and can't coexist with a value.

## 4. Feasibility: what's safe WITHOUT Supabase

- ✅ The **definition + answer types + all validation/ordering/completeness** —
  pure data and functions. Done.
- ✅ A v1 report **definition** (e.g. the weekly-officer-report fields) can be
  expressed as plain data over this primitive at any time.
- ✅ Wiring a **read-only or in-session** structured form is possible with no
  schema (answers held in component state), but that would not persist.

## 5. What REQUIRES Supabase / a product step later

- **Persisting real answers.** Per `docs/REPORTS_V1_PLAN.md`, report answers must
  live in a **separate `task_report_submissions` table** (NOT in
  `task_submissions` — its has-proof CHECK and proof-only visibility don't fit;
  reports also need annotator read access). That table + its `upsert/get` RPCs +
  RLS is a deliberate, separately-approved Supabase step. **Not done here.**
- **A real user-facing reports flow** (assign report tasks per cycle, submit the
  form, read submissions) depends on that storage.
- The task **state machine is unchanged**: submitting a report flips the report
  *task* to `submitted` via the existing `updateTaskState` path; the report RPC
  would not touch `tasks.state`.

## 6. Why it stays generic

Nothing in `structuredResponses.ts` is fraternity-specific — it's question
definitions and answers. Sigma Chi's weekly-report fields are just one
`StructuredResponseDefinition`. A class, club, sports team, or business supplies
its own definition over the identical primitive. This matches
`docs/PRODUCT_BUILDING_PRINCIPLES.md` (generic primitives; org-flavored defaults
on top).

## 7. Intentionally NOT built yet

- No report builder UI, no reports tab, no mock-backed reports.
- No Supabase table/columns/RLS/RPC.
- No recurrence scheduling, no reminders/notifications.
- No non-text question types implemented (reserved in the union only).
- No AI generation.

## 8. Recommended next steps (each gated)

1. **Define the v1 report definition** as data (weekly officer report) over this
   primitive — pure, no schema. Safe to do next.
2. **Report-task generator** (deterministic `report_<role>_<cycle>` ids, like
   template tasks) — pure, no schema.
3. **Storage** (`task_report_submissions` + RPCs + RLS) — **Supabase step; stop
   and get approval** before applying.
4. **Submit/read UI** — only after storage exists.

---

*Foundation/record only. No app behavior, schema, RLS, RPC, flag, notification,
or EAS change is implied. Real persistence requires the deferred Supabase step in
§5.*
