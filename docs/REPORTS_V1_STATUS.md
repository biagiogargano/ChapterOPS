# Reports V1 — Current Status (Build 17 dev)

Snapshot of what the Reports V1 chain does today and what is intentionally not
built. Record/doc only — no behavior, schema, or EAS change implied.

---

## The full chain (all shipped to `phase-2`, not yet in a build)

1. **Generic primitive** — `lib/structuredResponses.ts`: question/answer types,
   validation, ordering, completeness, "No update", answer-edit helpers. Tested.
2. **Report content** — `lib/reportDefinitions.ts`: the v1 `weekly_officer_report`
   definition (accomplishments + goals required; blockers + announcements optional
   with No-update). Tested.
3. **Report task builder** — `lib/reportTasks.ts`: pure `buildReportTask(...)`,
   deterministic id `report_<role>_<cycle>`, carries `reportDefinitionId`,
   structured / no-proof / no-review. Tested.
4. **Storage** — `task_report_submissions` table + `upsert/get` RPCs, applied +
   verified on alpha (see `docs/REPORTS_V1_PERSISTENCE_PLAN.md`).
5. **Client adapter** — `lib/reportSubmissionService.ts`: fallback-safe
   `upsert/getTaskReportSubmission`. Tested.
6. **Task Detail form** — `app/task/[id].tsx`: a task with `reportDefinitionId`
   renders the structured-response form (assignee) or a read-only view (allowed
   readers); submit → upsert + mark task complete. No proof/review UI.
7. **Controlled generation** — `lib/reportGeneration.ts`:
   `generateReportTasks(...)` / `generateWeeklyOfficerReports(orgId, cycle,
   dueDate)`. Manual, deterministic, idempotent (same role+cycle never
   duplicates). Tested.

## What is usable now

- In **code**, calling `generateWeeklyOfficerReports(orgId, cycle, dueDate)`
  creates one report task per officer role; opening that task in Task Detail
  shows the real, validated, persistent report form; submitting saves answers to
  `task_report_submissions` and marks the task complete; the assignee / annotator
  / president / pro_consul can read the submission via the live RPCs.
- Report tasks render cleanly in Tasks / Today / Event lists with **no
  proof/review language** — verified: the task card's "Reviewed by" label is gated
  on `requiresApproval` and the proof icon on `requiresProof`, both false for
  reports, so only the generic status badge (To do / Done / etc.) shows.

## Generation UI placement — DECISION (deferred, documented)

There is **no safe existing admin surface** for "generate this org's reports for
a cycle." The Me screen is per-user settings, not org-admin actions; wiring a
button there that mutates shared task state (and needs a cycle/date picker) would
be scope creep without a real admin design. **Decision (per Reports V1 defaults):**
generation stays **service/helper-only for now** (`lib/reportGeneration.ts`); no
UI added this lane. When an org-admin surface exists (a deliberate future lane), a
minimal "Generate weekly reports" action wires to `generateWeeklyOfficerReports`.

## What remains gated (not built, by design)

- **No scheduler / recurring background generation** — generation is manual; the
  caller supplies the cycle + due date.
- **No reminders / push** for reports.
- **No Reports tab** — completion is via Task Detail; report tasks live in the
  normal Tasks lists.
- **No non-text question types** (select/scale/time reserved in the union only).
- **A new EAS build** is required to exercise the form + RPC round-trip on device.

## Tests
All pure-tested: `structuredResponses` (37), `reportDefinitions` (16),
`reportTasks` (21), `reportSubmissionService` (6), `reportGeneration` (17).

---

*Doc only. No schema/RLS/RPC/EAS/auth/push change implied. Generation is manual
and service-only; the form + storage are live in code pending a build.*
