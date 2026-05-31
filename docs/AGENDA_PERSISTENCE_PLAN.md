# Agenda Persistence Plan (editable meeting agenda)

Status: **SQL APPLIED + WIRED (generate / view / inline edit / finalize).**
Update-derived sections (announcements/help-needed) drafted but unapplied. Governed by
`docs/MASTER_ROADMAP.md` (Phase E).

**Implemented:**
- `lib/agendaDocumentService.ts` — fallback-safe get/upsert/finalize wrappers (11 tests).
- `app/agenda/[eventId].tsx` — load saved doc; leadership generate / regenerate (with confirm)
  / **inline edit** / finalize; members view; live preview when none saved; honest
  loading/error/empty; tap-through.
- **Inline editing** — pure immutable helpers in `lib/agendaDocument.ts` (setSectionTitle,
  setItemText, addManualItem, removeItem, withAllCanonicalSections, pruneEmptySections; 36
  tests). Edit mode persists via upsert; finalized/members read-only.
- Goals-needing-attention folded in at generate time (leadership reads goals; members see it
  via the saved doc).

**Deferred (read path DRAFTED, unapplied):**
- **Announcements / help-needed sections** — DRAFT
  `supabase/list_submissions_for_org_cycle_patch_draft.sql` (definer LIST reader for an org +
  cycle; leadership/annotator read-set). Client wrapper
  `reportSubmissionService.listSubmissionsForOrgCycle` is ready (returns [] until applied).
  On apply, wire at generate: list → `pickGoalUpdateDefinition` per submission →
  `extractAgendaContributions` → `groupAgendaContributions` → `assembleAgendaDocument`.
- **Minutes / versioning** — still out of scope; `finalized_at` is the baseline hook.

## Problem
The meeting agenda is read-only and derived live (`lib/buildAgenda` from events+tasks;
`lib/agendaGoals` + `lib/agendaContributions` are pure and unwired). There is no way to
**edit** it (add manual notes, reorder, finalize for the meeting) and persist that.
We do **not** want a fake local-only editor — an editable agenda needs real storage.

## What can be done WITHOUT new schema (already built, pure)
- `buildAgenda(events, tasks, …)` → old/new business, open tasks, chapter-wide tasks.
- `agendaGoals.goalsNeedingAttention(goals)` → goals that need a decision/nudge.
- `agendaContributions.extract/group(...)` → announcements + help-needed from update answers.
- `agendaDocument.assembleAgendaDocument({ agenda, goalsNeedingAttention, contributions })`
  → composes those slices into one ordered, serializable `AgendaDocument`.

A **read-only generated** agenda (no editing) can be rendered from those today, once the
agenda screen fetches goals + submissions (an existing leadership/member-readable RPC —
**device-verify first**). No new schema is required for the read-only view.

## What REQUIRES persistence (the editable document)
Editing (manual notes, reordering, retitling, marking finalized) and having it survive
reload / be shared across officers needs durable storage. That is the DRAFT
`supabase/agenda_documents_patch_draft.sql`.

## Model (decided for v1)
Stored as `agenda_documents` (one row per meeting event):

| concern | decision |
| --- | --- |
| One agenda per meeting event? | **Yes.** `event_id` set + UNIQUE (partial index). Nullable to allow a future standalone agenda; v1 always ties to a meeting event. |
| Generated vs manual | **Both.** `sections jsonb` = the editable document (`lib/agendaDocument.AgendaDocument`: ordered sections of items). `generated_from jsonb` = provenance snapshot of what was auto-derived, so edits don't lose the source and a re-generate can diff. |
| Who can edit? | **President / Pro Consul / Annotator** (agenda compiler + broad leadership). |
| Who can view? | **Any active member** of the org (it's the meeting document). |
| Versioned? | **No full versioning in v1.** `created_by/updated_by/at` audit + a `finalized_at` lock. Editing a finalized agenda is refused (`agenda_finalized`). |
| Minutes later? | Attach as a future `minutes jsonb` column or `agenda_minutes` table keyed by `event_id`; `finalized_at` is the baseline hook. Out of scope here. |

Security posture mirrors `goals_v1` / `reports_v1`: **RLS on, zero policies
(deny-by-default), access only via SECURITY DEFINER RPCs**, org isolation via
`auth_user_roles_for_org`. RPCs: `get_agenda_for_event` (member view),
`upsert_agenda_document` (leadership edit, blocked after finalize),
`finalize_agenda_document` (leadership lock).

## The `sections jsonb` shape
Exactly `lib/agendaDocument.AgendaDocument` (versioned): `{ v, sections: [{ key, title,
items: [{ id, text, meta?, kind, refId? }] }] }`. Canonical section keys/order in
`AGENDA_SECTION_DEFS`. The pure assembler produces the initial draft; edits mutate the
same shape. Item `kind` + `refId` drive tap-through (event/task/goal) and distinguish
manual `note` lines.

## Apply-time caveats (do at apply, not now)
- Confirm the live **events** table name + org column (`events.chapter_id`) and adjust the
  FK/lookup if the live schema differs (events predate these drafts).
- This is a **gate**: applying needs explicit approval + Dashboard SQL Editor (no CLI).

## Not doing (yet)
- No editor UI until the table is applied + the read path is device-verified.
- No minutes, no versioning, no AI agenda summarization (Phase E/AI, later).
