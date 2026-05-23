# ChapterOPS — Alpha Readiness Checklist

Manual smoke test before putting 1–2 officer alpha users on the build.
Run in the flag-off sandbox (committed `AUTH_ENABLED`/`ORG_SCOPED_DATA` = `false`)
unless explicitly testing a flag-on profile. Automated gate first:

```
npx tsc --noEmit && npm run test:pure
```

## Events
- [ ] Create a one-off event → lands on Event Detail.
- [ ] Create a recurring event → series created; edit "this event" vs "entire series" both work.
- [ ] Non-optional event auto-generates its RSVP-review task.
- [ ] Edit an event → returning to Event Detail shows the update (no duplicate detail screen).
- [ ] Delete an event → cascades/removes its generated RSVP-review task.

## RSVP / attendance
- [ ] RSVP Attending / Not Attending; excuse required for mandatory; covering required when configured.
- [ ] Date-name submission saves and shows in the roster (Risk Mgr / Social Chair / BROAD).
- [ ] RSVP responses roster shows for mandatory/officer events to the right roles.

## Tasks
- [ ] Create task from an event ("+ Add Task"): event link is locked; returns to that Event Detail.
- [ ] Create standalone task: event picker collapsed; filter + "None" work; advanced options collapsed.
- [ ] Lifecycle: assign → submit (with proof) → approve / reject → resubmit.
- [ ] Reviewer sees the proof-review section; approve/reject routes correctly.
- [ ] Status badges read consistently (To do / In review / Done / Overdue) on Today, Tasks, Event Detail.
- [ ] Task Detail keeps precise states (Rejected / Escalated) where the assignee acts.

## Navigation
- [ ] Today / Tasks / Calendar → Event or Task detail and back behave normally.
- [ ] Event ↔ Task cross-links do not pile up an endless back stack.

## Today / notifications
- [ ] Today shows today-relevant items per role; a single "Coming Up"; no mock excuses block.
- [ ] "All caught up" shows without a duplicate "No events scheduled today".
- [ ] Notification bell unread count is correct; tapping a notice acknowledges + navigates; empty state shows.
- [ ] Editing/deleting an entity emits a notice that updates the bell badge.

## Roles & org
- [ ] Switch dev roles → correct sections per role (brother / officer / annotator / leadership / president).
- [ ] (If exercised) multi-org switch scopes data to the active org and clears the prior org's data.

## Stability / housekeeping
- [ ] Reload persists task state + RSVPs where Supabase is configured; mock fallback degrades gracefully.
- [ ] Committed flags are `false`/`false`; `.env` is the intended profile.
- [ ] No red-screen errors on the main flows; back button never traps the user.
- [ ] `npx tsc --noEmit && npm run test:pure` is green on `phase-2`.
