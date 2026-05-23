# ChapterOPS — Product Backlog

Planning/direction notes. Not a commitment of order or scope; each item becomes a
scoped checkpoint when picked up. Most template-application work below is
**UI-only / local** (template tasks are deterministic `tmpl_<templateId>_<eventId>_<key>`
MockTasks, so per-template targeting and replace are recoverable from the id with
no schema). Items explicitly marked **server** need schema/RLS/auth.

## 1. Template application choices
- Apply template to **this event only**.
- Apply template to the **entire series**.
- **Add on top** of existing tasks (default; non-destructive).
- **Replace** existing template-generated tasks (scoped to that template's tasks via id prefix).
- **Avoid duplicate / overlapping tasks**:
  - Exact (id-level): re-applying the same template is already idempotent — keep.
  - Semantic (heuristic): same `linkedEventId` + normalized title + assignee → **warn**, don't silently block.
  - Replace should preserve in-progress work — only remove not-yet-acted-on tasks (assigned/rejected), or warn before removing submitted/approved.

## 2. Series behavior choices
- **Replace a series only with explicit confirmation** (destructive; show count of affected occurrences).
- **Add to a series** without destructive replacement (non-destructive default).
- **This-event-only vs entire-series** behavior must stay clear and consistent with the edit/delete prompts.

## 3. Large-selection UX
- Move long button lists toward **searchable dropdown / filter** UI.
- Build one reusable searchable picker and reuse it.
- Priority order:
  1. **Template picker** (event create + Event Detail) — grows fastest with custom templates.
  2. **Event linker** (task create) — already collapsed/filtered; standardize onto the reusable picker.
  3. **Event type / kind** (event create) — small set; opportunistic.
  4. **Assignee / reviewer** (task create + template builder) — small fixed roles today; matters once member-level assignment exists.

## 4. Future AI direction
- Eventually users should describe what they want in **natural language**.
- AI should **draft** events / templates / tasks from that request.
- AI sits **on top of** the deterministic template/task system — it proposes; the existing engine generates. It does **not** replace the deterministic system yet.
- **No AI implementation now** — direction only.

## 5. Deferred server / shared work (needs schema/RLS/auth)
- Org-**shared** templates (persisted, visible chapter-wide).
- Template **permissions** (officers-only; creator restricted to their committee/self).
- **Audit / versioning** (who applied/replaced; which template version an event used).
- Real **role/member-based restrictions** backed by auth/identity.

## Recommended first safe checkpoint
**Apply mode: Add vs Replace (single event), UI-only** — when applying a template to an
event that already has template tasks, prompt **Add on top / Replace template tasks / Cancel**;
Replace removes only that event's not-yet-acted-on `tmpl_` tasks and warns on the rest.
Then extend Add/Replace to the **entire-series** path with an explicit-confirm gate.
