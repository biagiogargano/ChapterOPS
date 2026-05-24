# Product Spec — Required RSVP for Optional Events

**PLANNING ONLY.** No schema/RLS/RPC/auth/flags/data-model/state-machine changes
in this checkpoint. Design for a later, separately-approved build. Lives on
`feature/questionnaire-reports-planning`; does **not** touch `phase-2`. Expands
`PRODUCT_BACKLOG.md` §7.

---

## 1. Problem
Today, two concepts are conflated into one `audience` value:
- **Is attendance required?** (mandatory vs optional)
- **Is an RSVP / head count required?**

Current behavior (from `eventStore.maybeGenerateRsvpTask`): an event with
`audience === 'optional'` generates **no** RSVP task at all. So there's no way to
say "you don't *have* to come, but we need a head count." Socials, philanthropy
sign-ups, and optional mixers all need exactly that.

## 2. Goal
**Decouple "attendance required" from "RSVP required."** An *optional* event can
still **require an RSVP** (yes/no head count) without making attendance mandatory.

## 3. Proposed model
Introduce a second, independent flag on an event:

| Concept | Field (proposed) | Meaning |
|---|---|---|
| Attendance required | existing `audience` (`all` = mandatory, `optional`, `officers`) | Whether showing up is required |
| RSVP required | **new** `rsvpRequired: boolean` | Whether a yes/no response is required, regardless of attendance |

Resulting combinations:
- mandatory + rsvp → today's mandatory behavior (RSVP task, attendance expected).
- **optional + rsvp required → NEW:** head-count RSVP task generated, attendance
  not mandatory. The RSVP card asks "Are you coming?" but "No" is a fine answer.
- optional + no rsvp → today's optional behavior (no task).
- officers + rsvp → officer head count (already supported via `audience`).

## 4. Where it touches (future build — not now)
- **Event data model:** a second boolean (`rsvp_required`) on the events
  table/shape. *(Schema change — deferred.)*
- **Event create/edit UI:** a toggle "Require RSVP" shown independently of the
  mandatory/optional choice (so an optional event can still flip it on).
- **RSVP-task generation rule** (`maybeGenerateRsvpTask`): currently keyed off
  `audience`. New rule: generate an RSVP task when `rsvpRequired` is true **OR**
  `audience === 'all' | 'officers'` (preserving today's behavior). For an
  optional+rsvp event, the task is **not** flagged `linkedEventMandatory` — it's a
  head count, not an attendance obligation.
- **Reminders / urgency:** an optional+rsvp RSVP should nudge ("RSVP needed") but
  never escalate as "overdue mandatory."

## 5. UX details
- Create-event: two distinct controls — the audience/mandatory picker, and a
  separate **"Require RSVP"** switch. Make copy explicit: "Optional event —
  attendance not required, but members must RSVP for a head count."
- RSVP card wording for optional+rsvp: neutral ("Will you attend?") with Yes/No
  equally weighted (no "you must attend" framing).
- Officer RSVP roster: show the head count the same way as mandatory events.

## 6. Backwards compatibility
- Existing events have no `rsvp_required` → treat as `false`; behavior unchanged.
- Mandatory/officer events keep generating RSVP tasks via the existing audience
  branch even if `rsvp_required` is absent — the new flag only *adds* the
  optional+rsvp case.

## 7. Scope / size
**Small, self-contained.** A single boolean + one generation-rule tweak + one UI
toggle. Independent of the questionnaire system (#6) and the agenda system (#8) —
can slot in whenever convenient once schema changes are on the table.

## 8. Explicitly NOT now
- No schema migration, no RLS/RPC change, no flag change in this planning step.
- No change to the existing task state machine (RSVP tasks reuse the current
  lightweight-rsvp kind; only the *trigger* and the mandatory flag differ).

## 9. Open questions
1. Should optional+rsvp RSVPs have a **deadline/urgency**, or stay a soft nudge
   until the event passes?
2. For an optional event, does a **"No"** RSVP still appear in the officer roster
   count (likely yes — that's the point of a head count)?
3. Any role restriction on who can flip "Require RSVP," or any officer creating an
   event can set it?
