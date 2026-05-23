# Roster / Member Selector — Planning Spec (NOT IMPLEMENTED)

Direction only. **No data-model, member-keying, schema, or assignment-architecture
work is implied or approved here.** This documents the future UX so today's
search/picker components can grow into it without rework.

## Goal
As a chapter grows, officers need to pick people without scrolling forever:
- **Select all brothers** (e.g., for a chapter-wide event/task).
- **Select specific brothers** (multi-select).
- **Assign people to events/tasks** (people-keyed assignment — future).
- **Search brothers by name.**
- **Filter by role/position** (e.g., only officers, only a committee).

## Proposed UX (when built)
- A **`MemberSelector`** built on the existing `components/SearchablePicker`:
  - extend the picker to a **multi-select** mode (checkboxes + a running count),
  - a **"Select all / Clear"** affordance,
  - a **role/position filter** row (chips) above the search box,
  - search by name (the picker's existing filter).
- Single-select reuse: the same component can back single-person fields (e.g., a
  reviewer) by running in its current single-select mode.

## What this depends on (and must NOT be done prematurely)
- A real **member roster** source (currently the app is role-keyed, not
  member-keyed; identity exposes `member`/`memberships` but tasks/events are keyed
  by role). Member-level assignment needs:
  - a members list scoped to the active org (read),
  - a people-keyed assignment field on tasks/events (**data-model change — deferred**),
  - permissions for who can assign whom (**deferred**).
- Until that exists, keep assignment **role-based** as it is today.

## Incremental, safe path
1. **(Now / done)** reusable `SearchablePicker` with filter + clear selected state.
2. **(Next, UI-only)** add an optional **multi-select mode** to `SearchablePicker`
   (selected set + Select-all/Clear) — usable for any string-id list, no roster needed.
3. **(Later, needs roster read)** a `MemberSelector` that feeds the picker with
   org members + a role/position filter — **read-only**, still no assignment write.
4. **(Later, needs data model + permissions)** people-keyed assignment on
   tasks/events — separate, explicitly-approved architecture phase.

## Guardrails
- No schema/RLS/RPC/migrations.
- No member-keying of tasks/events.
- No permissions architecture.
- Reuse existing components; keep each step UI-only until the data layer is approved.
