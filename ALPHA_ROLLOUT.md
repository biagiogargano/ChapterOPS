# ChapterOPS — Trusted Alpha Rollout Plan

Documentation only. **No committed flag changes, no schema/RLS/RPC/policy changes.**
Flag-on is achieved purely via a **local/build-time env profile**; the committed
defaults stay `false`. See `AUTH_SMOKE_TEST.md` for the flag-on verification this
plan depends on.

## 1. Alpha purpose
Put the app in front of a few trusted officers, flag-on, against a real Supabase
project, to validate:
- real **auth → role → org-scoped data** end to end,
- core officer workflows (events, tasks, templates, approvals, calendar, notifications),
- **org isolation** (no chapter sees another chapter's data),
- **multi-org** switching for an account that belongs to two orgs.
It is a preview, not the system of record — data may be reset.

## 2. Three-tester structure
Two orgs exist: **Org S = "Sigma Chi test org"** (main) and **Org B = second test org**.

| Tester | Member of | Purpose |
|---|---|---|
| **Biagio** | **Both** Org S + Org B | Multi-org switching, president/officer workflows, templates, events, tasks, **and** cross-org isolation from one account |
| **Sigma Chi VP** | **Org S only** | Real officer workflows inside the main org (reviewer/approver path) |
| **Tester 3** | **Org B only** | Confirms isolation — Sigma Chi data must never appear |

## 3. Exact Supabase member/position rows needed
`authUserId` stays **null** until first login (the claim links it). Email auth must
be enabled; RLS + claim RPCs are already live — just verify on the alpha project.

**Biagio (multi-org):**
- `members` in **Org S**: `email` = Biagio's login email, `authUserId` = null, `status` = active, `fullName` set.
- `members` in **Org B**: **same** `email`, `authUserId` = null, `status` = active.
- `positions`: Org-S member → **president**; Org-B member → **brother** (or a low officer).
- ⚠️ Both member rows MUST use the **same email** — that's what resolves him as a
  **multi-org** member (one auth user → two memberships). Different emails = two
  separate single-org accounts.

**Sigma Chi VP (single-org, Org S):**
- `members` in **Org S**: `email` = VP's login email, `authUserId` = null, `status` = active, `fullName` set.
- `positions`: Org-S member → **pro_consul**.

**Tester 3 (single-org, Org B):**
- `members` in **Org B**: `email` = Tester 3's login email, `authUserId` = null, `status` = active, `fullName` set.
- `positions`: Org-B member → **president** (or an officer) of Org B.

General: each person's login email is unique to them (VP ≠ Tester 3 ≠ Biagio);
Biagio's email appears only on his two rows.

## 4. Recommended roles
- **Biagio:** **President** in Org S (BROAD — full approve/template/officer powers), **Brother** in Org B (role + data clearly differ across orgs; feels isolation as a non-officer).
- **VP:** **Pro Consul** in Org S (officer + reviewer — exercises approve/reject + Officer Overview).
- **Tester 3:** **President/officer** of Org B (gives Org B its own officer so isolation is tested against a populated second org).

## 5. What each tester should test
- **Biagio (Org S as President):** create events (one-off + recurring); apply templates (built-in + a custom one he builds); Add-vs-Replace and entire-series apply/replace; approve/reject tasks (incl. proofless approval); RSVP; calendar month view + day detail; notification bell; Officer Overview; search/filter. Then switch to Org B (see §6).
- **VP (Org S as Pro Consul):** view assigned tasks; **submit for review** (incl. proofless approval tasks); act as **reviewer** to approve/reject submissions; RSVP; Officer Overview counts; task search/filter; calendar.
- **Tester 3 (Org B):** confirm he sees **only Org B's** events/tasks/notices/RSVPs — never any Sigma Chi data — and runs basic flows (create event/task, RSVP) in Org B.

## 6. What Biagio should verify across both orgs
- **Org switching** (Me → Organizations) reloads to the correct org; **role changes** (President in S → Brother in B); officer-only surfaces (+ Create, Apply template, Officer Overview) appear in S but **not** in B.
- **Cross-org isolation from one account:** in Org B he sees **none** of Org S's data and vice versa; creating in one org never appears in the other.
- **Notices** scoped per org.
- **Custom templates** show on his device in **both** orgs — **expected local-only behavior, not a leak** (call it out).
- **Org-preference on re-login:** he's the only multi-org account, so capture where he lands after switching to Org S then logging out/in (restore-to-last vs alphabetical default). Not a blocker either way.

## 7. Hard blockers (stop the alpha)
- **Any cross-org data leak** — Tester 3 or Biagio-in-Org-B sees Sigma Chi events/tasks/notices/RSVPs.
- **Write to the wrong org** — creating in Org S shows up in Org B.
- **Login/claim failure** — a tester with a valid member row can't log in or gets "not in any org."
- **Wrong role/org resolution** granting management of data they shouldn't.
- **Crash / red screen** on a core flow (create event, submit→approve, calendar, org switch).

Not blockers: custom templates visible across Biagio's orgs (expected local), single-gate
approval, org-preference landing on default after re-login, cosmetic issues.

## 8. Known limitations to tell testers
- **Not real-time yet** — the app does **not** live-sync between devices. When
  another member creates/edits an event or changes an RSVP, you won't see it
  automatically. **Pull down to refresh** on Today, Calendar, and an Event's
  detail screen, or switch tabs / reopen the app, to pull the latest data.
  (Supabase Realtime is intentionally not built for this alpha.)
- **Refresh to see others' changes** — same point, restated for the field: if a
  number/list looks stale (a teammate's new event or RSVP isn't showing), pull
  to refresh first before reporting it as missing.
- **Custom templates are device-local** — a template you build is stored only on
  **your** device; it shows across *your* orgs but other testers won't see it.
  Expected, not a leak.
- **Approvals are single-gate:** Pro Consul reviews; "President"/Consul shows as
  oversight, not a second required sign-off.
- **Recurring events:** prep tasks generate per occurrence; "Entire Series"
  actions affect all occurrences; the RSVP-review task is generated for the first
  occurrence only.
- **Expo Go / tunnel build** — testers run through **Expo Go** over a dev-server
  **tunnel**. Expect rough edges: the app may fail to reopen if the dev server is
  stopped/asleep or the phone lost the tunnel (you'll see a "could not connect to
  development server" / red error screen — **not** an app crash). Fix by
  re-scanning the QR while the server is running. Backgrounding for a long time
  can drop the connection. A later EAS build removes this dependency.
- **Not built yet:** questionnaire/report tasks, meeting-agenda auto-population,
  member-level assignment, separate "required RSVP for optional events."
- **Early alpha:** data may be reset; it's a preview, not the system of record.

## 9. Env setup, build & run (recap)
- Gitignored profile (e.g. `.env.alpha.flagon.local`) with the **alpha** project's
  `EXPO_PUBLIC_SUPABASE_URL` (bare, no `/rest/v1/`), `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  and `EXPO_PUBLIC_AUTH_ENABLED=true`, `EXPO_PUBLIC_ORG_SCOPED_DATA=true`. Committed
  flags stay `false`; this file is never committed (`.env*.local` is gitignored).
- **Run (first tiny alpha):** copy that profile to `.env.local`, then `npx expo start -c --tunnel`; testers use **Expo Go** + the QR.
- **Durable (TestFlight) — `eas.json` is scaffolded (phase-2):**
  - Profiles: `development` (dev client), `preview` (internal/ad-hoc, flag-on),
    `alpha` (store → TestFlight, flag-on, `autoIncrement` buildNumber).
  - The two **flag vars are baked into the profile `env`** (`EXPO_PUBLIC_AUTH_ENABLED`
    / `EXPO_PUBLIC_ORG_SCOPED_DATA` = `"true"`). Committed `lib/flags.ts` stays `false`.
  - The **alpha Supabase `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
    are NOT committed** — set them as **EAS environment variables** for the build
    (`eas env:create` or the EAS dashboard) so no key lands in git.
  - `app.json` carries `ios.bundleIdentifier` = `com.biagiogargano.chapterops` +
    `ios.buildNumber`; `eas.json` `appVersionSource: "local"` so `autoIncrement` bumps it.
  - **Interactive steps (you, with Apple 2FA), not yet run:** `eas login` →
    `eas init` / `eas build:configure` (writes `extra.eas.projectId`) →
    `eas build -p ios --profile alpha` → create the App Store Connect app + add
    Internal Testers → `eas submit -p ios --profile alpha`. Do NOT run these until approved.
- Confirm the running build is flag-on: login required, real identity shows, **no "DEV MODE · auth bypassed"** badge, no mock/demo data.

## 10. Rollback plan
Flags are env/build-only and committed `false`, so rollback needs **no code/git change**:
- Dev-server: stop the server → testers can't connect; any normal build is the sandbox.
- EAS: don't promote / stop sharing the flag-on build, or ship a build without the flag env.
- Data: clear the alpha org's rows in Supabase if needed (no schema change) — app untouched.
- No `lib/flags.ts` edit/revert is ever required.

## 11. Go / no-go checklist before inviting testers
- [ ] Smoke test **D–J passed**, including **RLS isolation** (org A can't see org B).
- [ ] Two orgs created; member rows + positions per §3; Biagio's two rows share his email.
- [ ] **Email auth on**; **RLS + claim RPCs live** on the alpha project.
- [ ] Flag-on build verified: login required, real identity, **no auth-bypassed badge**, no mock/demo data.
- [ ] Committed flags still `false`; `git status` clean; `.env*.local` not tracked.
- [ ] **EAS:** `eas.json` `alpha` profile present (flag-on env); Supabase URL/key set
      as **EAS env vars** (not committed); `bundleIdentifier` set; `eas init` has
      written `extra.eas.projectId` before building.
- [ ] `npx tsc --noEmit && npm run test:pure` green on the build commit.
- [ ] Limitations (§8) sent to testers; point of contact + issue-reporting method agreed.
- [ ] Rollback path confirmed (stop server / don't promote build).
