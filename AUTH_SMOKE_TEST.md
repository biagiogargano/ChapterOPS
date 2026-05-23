# ChapterOPS — Auth / Org-Scoping Flag-On Smoke Test

Run this **before** turning auth on for an environment. It verifies the real
**signup → role → org-scoped data → Phase 3 features** path with the flags ON,
**without committing the flag change**.

## Enabling flag-on locally (do NOT commit)
1. Create a gitignored env profile (e.g. `.env.alpha.flagon.local`) with:
   - `EXPO_PUBLIC_AUTH_ENABLED=true`
   - `EXPO_PUBLIC_ORG_SCOPED_DATA=true`
   - the real `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
2. Start Metro against that profile; hard-reload the app.
3. **Revert to the flag-off profile before any commit.** Committed flags stay `false`.

Prereqs: Supabase reachable, RLS live, and at least one `members` row whose email
you can claim by logging in (and ideally a second org/account for isolation checks).

## A. Boot & routing
- [ ] With no session, the app lands on the **(auth)** flow (login/onboarding), not the tabs.
- [ ] Splash shows while identity is resolving (no flash of tabs).
- [ ] After login, it routes into the tabs.

## B. Login & identity resolution
- [ ] Log in with a claimable member email → `claim_membership_by_email` resolves a membership (no "not in any orgs" dead end).
- [ ] Identity phase reaches `resolved` (not stuck initializing/error).

## C. Identity binding (the fix just shipped)
- [ ] Today greeting shows the **real member name** (not "Biagio Gargano").
- [ ] Today chapter line shows the **real organization name** + role.
- [ ] Me tab user card shows real name, initials, and chapter.
- [ ] **No "DEV MODE · auth bypassed" badge** anywhere (Today or Me).

## D. Role resolution
- [ ] `actingRole` matches the member's real position (e.g. president vs brother).
- [ ] Today/Tasks render the correct role-specific sections for that role.
- [ ] Officer-only surfaces (Officer Overview, "+ Create", "Apply template", Manage templates) appear only for officer roles.
- [ ] (Dev build) the role switcher override behaves as expected / is irrelevant in production builds.

## E. Multi-org (if the test user has ≥2 memberships)
- [ ] A sensible default org is selected; the org switcher lists all memberships.
- [ ] Switching org **resets caches** and shows the new org's data (no carryover).
- [ ] Per-user preferred org persists across reload.

## F. Org-scoped data (no mock leak)
- [ ] Events, Tasks, and Notices show **only the active org's** data.
- [ ] An org with no data shows **empty states** (no MOCK_EVENTS/MOCK_TASKS seed leaking in).
- [ ] Creating an event/task writes to the active org and reappears after reload.

## G. Phase 3 features against real data
- [ ] Create event → lands on Event Detail; RSVP-review task generated.
- [ ] Apply a template (built-in **and** a custom one) → tasks generate, are org-scoped, and appear under Related Tasks.
- [ ] Event Detail prep progress + Related Tasks are chapter-wide for officers.
- [ ] Task lifecycle: assign → submit (+proof) → Pro Consul approve/reject; status badges update (To do/In review/Done/Overdue).
- [ ] Notification bell: editing/deleting an entity emits a notice to the right roles; tapping acknowledges + navigates.
- [ ] Officer Overview counts (overdue / awaiting review / events need prep) reflect real data.
- [ ] Tasks tab filters + sort work on real data.

## G2. Recurring-event templates (required)
- [ ] Create a **recurring** event **with a template** → each occurrence's Event Detail shows its **own** generated tasks.
- [ ] Each occurrence's task due dates are **relative to that occurrence's date** (they differ across occurrences).
- [ ] From an existing recurring occurrence, **Apply template → Entire Series** generates tasks across all occurrences ("across N events"); **This Event Only** scopes to one.
- [ ] Re-applying the same template (series) reports **"already on the series"** — no duplicates (idempotent).
- [ ] **Delete → Entire Series** removes generated/review tasks for **all** occurrences (no orphans); **This Event Only** removes just that occurrence's tasks.
- [ ] Non-recurring event + template still generates exactly one set (unchanged).

## H. Custom templates (local — expected for alpha)
- [ ] A template built in the app persists across reload (local/device).
- [ ] Understood limitation: custom templates are **not shared** across members/devices yet (server phase).

## I. RLS / isolation (if a second account/org is available)
- [ ] A user in org A cannot see org B's events/tasks/notices.
- [ ] Identity writes go only through the SECURITY DEFINER RPCs (no direct table writes).

## J. Flag-off regression (flip both flags back off)
- [ ] Sandbox returns to demo identity + dev role switcher, exactly as before.
- [ ] `npx tsc --noEmit && npm run test:pure` is green.

## Go / no-go
**GO** when A–G pass cleanly and J confirms no flag-off regression. H is informational
(local templates accepted for alpha). I is required if a real multi-account/RLS check is possible;
otherwise rely on the prior RLS rollout verification.

Record blockers here with the section letter + a one-line repro before deciding to enable per environment.
