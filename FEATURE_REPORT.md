# ChapterOPS — Comprehensive Feature & Prototype Report

A full snapshot of everything designed and prototyped on the
`feature/questionnaire-reports-planning` branch, for review / second opinions
(e.g. pasting into ChatGPT to pressure-test the ideas). **All prototypes are
UI-only, mock-backed, and isolated from the live alpha** — the alpha branch
(`phase-2`) is untouched; nothing here changes schema, RLS, auth, flags, or the
task state machine. Persistence/enforcement is a later, approved phase.

---

## 1. Product vision (what we're going for)
- A **sophisticated** chapter-management app that is still **simple, intuitive,
  and easy** for a brand-new user.
- **All the power belongs to the user; the app teaches them how to use it.**
- **Everything customizable** so it "feels built for each org," with **smart
  defaults** so nobody starts from a blank page.
- Features should fit the **core primitives — events & tasks** — not be bolt-on
  modes. (e.g. attendance is a *task* tied to a meeting, not a separate screen.)

## 2. How to view the prototypes
Run the flag-off sandbox: `npx expo start -c` (the `-c` registers new routes).
Open from **Me → 🧪 Prototype features** (the `/prototypes` hub), or the new
**Pinned** and **Settings** tabs.

---

## 3. Onboarding & org setup
- **First-time experience** (`/first-run`): log into an *empty* chapter → guided →
  create your first event → **customize what it sets up** (auto-agenda + section
  template, attendance task, RSVP; app suggests defaults, you decide) → see what
  was created. Embodies "power + guidance."
- **Welcome walkthrough** (`/tutorial`): short skippable intro carousel.
- **Org setup wizard** (`/setup`): name → who's in charge (with **transfer
  ownership** if you're setting it up for someone else) → structure → invite → done.
- **Invite people** (`/setup/invite-people`): add people by **name / email /
  position** → they form your roster.
- **Invite link + join form** (`/setup/invite-link`): share **one link**; owner
  **toggles which questions to ask on join (incl. phone) and which are required**.
  Scales to big groups.
- **Join via link** (`/join`): the self-join form people fill; on submit they're
  added to the roster, ready to place in the tree.
- **Build the org tree** (`/setup/tree`): build the hierarchy by **answering
  "who reports to X?" and placing real people from your roster** (not a grid).
- **Invitation (invitee view)** (`/invite`): what someone sees when invited.
- **Org settings** (`/org-settings`): rename org, transfer ownership, customize.

## 4. People & structure
- **Leadership tree** (`/leadership`): reporting lines + who-can-delegate, your role
  highlighted. Pure model (`reportsTo`, `directReports`, `canDelegate`, …).
- **Delegate a task** (`/delegate`): reassign **only to roles below you** in the
  tree; receives the real task title when opened from a task.
- **My committee** (`/committee`): a group's home (members, events, tasks).
- **Members & positions** (`/roster`): real editor — assign/change a member's
  **position**, add/remove, search; shared store so it reflects app-wide.

## 5. Reports & meetings (the questionnaire system)
- **Weekly report** (`/report/weekly`): typed prompts — goal, current value,
  percentage, single/multi-select, text, plus a **"No update"** toggle. Workflow:
  always-editable within a window, **first submit snapshots the week** and
  **notifies Annotator + Pro Consul + Consul**, later edits roll to next week,
  **"something must change"** warning blocks an all-"No update" submit.
- **Reports review** (`/report/inbox`): Annotator view of who submitted / who's
  missing; tap your row to see the detail.
- **Report detail** (`/report/detail`): read-only submitted snapshot.
- **Meeting agenda** (`/agenda`): auto-drafted from this week's events + tasks
  (old/new business, brother-wide, unresolved) **plus officer announcements &
  help-needed pulled from submitted reports**.

## 6. Events & duties (everything is tasks/events)
- **Event automation defaults** (`/event-defaults`, in Settings): per **event
  type**, set what auto-generates (agenda + template sections, attendance, RSVP).
  The "decide the rules once" backbone.
- **Event → duties**: an event knows the role-owned tasks it generates (RSVP,
  attendance, minutes, safety checklist, headcount); shown on the **Event detail**
  ("This event generates…").
- **Attendance as tasks** (`/attendance`): chapter/eboard + mandatory events
  produce an **Annotator** attendance task that **opens at start, due ~1h after**;
  open ones launch check-in.
- **Attendance check-in** (`/checkin`): mark who's present + count.
- **RSVP settings** (`/rsvp-optional`): decouple "attendance required" from "RSVP
  required" so an optional event can still need a head count.
- **Availability picker** (`/availability`): generated time-slot grid (reusable
  scheduler).

## 7. Communication & engagement
- **Announcements** (`/announcements`): chapter notices feed + composer.
- **Quick poll** (`/poll`): lightweight vote with live tallies.
- **Points & leaderboard** (`/points`): participation points + rankings.

## 8. App shell / navigation
- **Settings tab**: org details/ownership, members & positions, leadership
  structure, report questions, **event automation**, notification toggles, profile,
  prototypes index.
- **Pinned tab**: customizable quick-access shortcuts (pin your weekly report,
  agenda, etc.); add/remove; conceptually **role-gated** (not everyone needs it).
- Dev-gated tie-ins on real **Task detail** ("Delegate this task") and **Event
  detail** ("This event generates…").

## 9. Specs (planning docs on the branch)
`QUESTIONNAIRE_REPORTS_PLAN`, `SPEC_ONBOARDING_ORG_SETUP`,
`SPEC_REQUIRED_RSVP_OPTIONAL_EVENTS`, `SPEC_MEETING_AGENDA_AUTOPOPULATION`,
`SPEC_FEATURE_INTEGRATION` (features = tasks/events), `SPEC_PERMISSIONS_CUSTOMIZATION`
(**deferred** — permissions kept implicit; favor a simple model later),
`APPLE_DEVELOPER_EAS_CHECKLIST` (path to a real iPhone alpha via TestFlight).

## 10. Key design decisions made
- Questionnaire workflow: rolling weekly snapshot, multi-role notify, "something
  must change" rule.
- Permissions: **deferred**; the grid felt too complex → keep implicit, simplify later.
- Onboarding: **roster before tree**; place real people, not typed roles.
- Invite link with **owner-configurable required questions** (incl. phone) for scale.
- Attendance (and other duties) modeled as **event-linked, role-owned tasks**.
- AI: **intentionally not built** (documented future direction only).

## 11. Open questions / things to pressure-test (please critique these)
- **Permissions model** (12 questions in `SPEC_PERMISSIONS_CUSTOMIZATION` §6a):
  owner identity, tiers vs toggles, granularity, defaults, who can edit, etc.
- **Onboarding friction**: is manual name/email entry ever needed, or should we
  *default to the invite link* and only manual-add as a fallback? (Self-flagged:
  making the owner type everyone is the "dumb" path — link-first is better.)
- **Attendance**: which events qualify (chapter/eboard only vs all mandatory)? Due
  offset fixed (1h) or configurable? Auto-close behavior?
- **Required RSVP**: deadline/urgency for optional+RSVP events?
- **Pinned/custom tabs**: who gets them, how many, per-role defaults?
- **"Something must change"**: hard block vs warn; does "No update" count?
- **Committee model**: everyone under an officer, or explicit named groups?

## 12. Guardrails honored throughout
≤ all changes on the feature branch; `phase-2` pinned at the alpha commit; every
commit passed `npx tsc --noEmit` + `npm run test:pure` (12 suites); no
schema/RLS/RPC/auth/flags/state-machine/AI; nothing merged.
