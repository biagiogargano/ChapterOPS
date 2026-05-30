# Event-Generated Tasks / Templates — Foundation

Status of the event → template → generated-task system. This is **already built
and working**; this doc records the architecture, invariants, and the safe
extension path so future template work stays generic and duplicate-free.

Planning/record only — no code/schema/Supabase changes implied.

---

## 1. The primitive (generic)

```
event kind  →  template (data)  →  generated tasks (concrete, tied to the event)
```

- A **template** is plain data: an id, a label, and a list of `EventTaskSpec`
  (title, description, assigned role, due offset, proof/approval/reviewer).
- **Generating** = mapping a template's specs to normal structured `MockTask`s
  for a concrete event. No engine per template — adding a workflow is a registry
  entry, not code.
- Sigma Chi templates (date_party, recruitment, formal, chapter_meeting,
  eboard_meeting) are **default content**, not hardcoded core — a future org
  template supplies its own registry over the same shape.

## 2. Key files

| File | Role |
| ---- | ---- |
| `lib/eventTemplates.ts` | Built-in template registry + pure builder (`buildTasksFromTemplate`, `templateTaskId`, `allTemplateTaskIdsForEvent`, `DEFAULT_TEMPLATE_BY_KIND`) |
| `lib/customTemplatesStore.ts` | User-built templates (local AsyncStorage v1); merges built-in + custom; `buildTasksForTemplateId` |
| `lib/generatedTasks.ts` | The auto RSVP-review task (`buildRsvpReviewTask`) |
| `app/event/create.tsx` | Applies the selected template + RSVP-review task on event create |
| `app/event/[id].tsx` | Shows generated/related tasks; cascade-deletes them on event delete |

## 3. Idempotency / duplicate prevention (already solid)

- **Deterministic ids**: `tmpl_<templateId>_<eventId>_<key>` and
  `task_rsvpreview_<eventId>`. The same event + template always yields the same
  ids, so re-applying or re-hydrating collapses to one task.
- **`addGeneratedTask`** returns `undefined` if the id already exists OR was
  tombstoned by an in-session delete — never resurrects a deleted task, never
  duplicates.
- **Cascade delete**: `allTemplateTaskIdsForEvent(eventId)` enumerates every
  possible template-task id; `deleteUserTask` is a harmless no-op for ids that
  never existed, so we don't need to store which template was applied.
- **Recurring events**: each occurrence gets its own event id → its own
  deterministic task ids → no cross-occurrence collisions.

## 4. Invariants (enforced by tests, `lib/eventTemplates.test.ts`)

Registry-wide, protecting every current and future template entry:
- spec keys unique within a template;
- every `assignedRole` is a known role;
- approval tasks have a reviewer that is a leadership approver and differs from
  the assignee (no self-review);
- proof tasks declare a text/link `proofType` (alpha has no file proof);
- `dueOffsetDays` is an integer; template ids globally unique; generated ids
  unique per event.

A new template that violates any of these fails CI.

## 5. Kind → default template (create-time pre-selection)

`DEFAULT_TEMPLATE_BY_KIND` pre-selects a sensible template when an officer
creates an event of that kind (they still preview and can switch to None):

| Event kind | Default template |
| ---------- | ---------------- |
| `social` | `date_party` |
| `recruitment` | `recruitment` |
| *(all other kinds)* | none (manual-apply) |

Meeting templates (`chapter_meeting`, `eboard_meeting`) are intentionally
**manual-apply only** — meetings recur, so auto-generating prep tasks every
occurrence would be noise.

## 6. Safe extension path (no schema, no engine change)

- **Add a new built-in workflow**: append an `EventTaskTemplate` to
  `EVENT_TEMPLATES`. Invariant tests cover it automatically.
- **Default a new kind**: add a `DEFAULT_TEMPLATE_BY_KIND[kind]` entry — but this
  changes create-time behavior for real users (**product decision**: which kinds
  should auto-suggest a template).
- **Share custom templates org-wide**: swap `customTemplatesStore`'s AsyncStorage
  for a Supabase table (**schema change** — separate, approved step). The builder
  UI and resolve API stay the same.

## 7. What is NOT built / out of scope now

- No full template-builder UI beyond the existing simple custom-template flow.
- No org-wide template sharing (custom templates are per-device today).
- No AI, no reports/questionnaires, no teams.
- No additional kind defaults without a product decision.
- No file/photo proof.

## 8. Settled decisions (alpha)

These were decided to unblock the lane; they constrain near-term work:

1. **No new auto-defaults yet.** Create-time auto-suggested templates stay
   limited to the current safe cases (`social → date_party`,
   `recruitment → recruitment`). Do NOT add automatic templates for
   philanthropy / academic / risk / etc. yet. Pure helpers
   (`getDefaultTemplateIdForKind`, `kindHasDefaultTemplate`,
   `defaultTemplateCoverage`) exist to make adding future defaults a one-line,
   tested change when a decision is made.
2. **Custom templates stay local/client-side.** No Supabase schema, no template
   tables, no RLS/RPC. Org-shared templates remain future-planning only.
3. **Formal is a manual template/subtype under Social — NOT its own event kind.**
   - Today: an officer creates a `social` event and manually applies the `formal`
     template. The `formal` template already exists in the registry and is
     reachable from the template picker.
   - Do NOT add a `formal` `EventKind`. Adding a kind ripples through audience
     rules, ROLE_ALLOWED_KINDS, KIND_LABELS/colors, and calendar dots — a much
     larger change for no current benefit.
   - **Future direction (when template packs exist):** "Formal" is the canonical
     example of an **event subtype** — a named template within a parent kind
     (Social). If/when we introduce subtypes or org template-packs, model Formal
     as a Social subtype, not a top-level kind. Until then it stays a manual
     template.

## 9. Remaining future decisions (not blocking)

- Which additional kinds eventually get auto-defaults (revisit per real usage).
- When/whether custom templates become org-shared (needs Supabase).
- Whether to introduce a formal "event subtype" concept (parent kind + named
  template) once more subtypes than just Formal appear.

---

*Record/planning only. The system described is already live in the app; this
doc adds no behavior. Extending kind-defaults or org-sharing requires the noted
product/Supabase decisions.*
