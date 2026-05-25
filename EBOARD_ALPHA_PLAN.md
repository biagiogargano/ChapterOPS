# ChapterOPS — eBoard TestFlight Alpha Plan (5–7 officers)

**Planning only. No code, no schema/RLS/RPC/auth/flag/task-state changes.**
Lives on `feature/questionnaire-reports-planning`; the actual build ships from
**`phase-2`** (stable). Builds on, does not replace:
- `APPLE_DEVELOPER_EAS_CHECKLIST.md` — Apple/EAS mechanics (what to buy, eas.json, credentials).
- `ALPHA_ROLLOUT.md` — flag-on env model, rollback, known limitations, go/no-go.
- `AUTH_SMOKE_TEST.md` — flag-on verification this depends on.

## Goal
Get the **current alpha** (`phase-2`, flag-on) into the hands of **5–7 real eBoard
members** via **TestFlight**, so they use ChapterOPS for **real officer tasks** —
no Expo tunnel, no laptop dependency. This is the first "real users" milestone.

## Scope guardrails (explicit)
- **Do NOT invite the full chapter** — eBoard only (≤7).
- **Do NOT merge feature-branch prototypes** into `phase-2`/alpha.
- **Do NOT start Weekly Reports or invite-link schema** — those stay deferred.
- **Single org** ("Sigma Chi test org" / Org S). This is *not* the cross-org
  isolation test (that's `ALPHA_ROLLOUT.md`); isolation is already validated.
- Data may be reset — it's a preview, not the system of record.

## Target testers (7)
| # | Person | Position (role key) |
|---|--------|---------------------|
| 1 | Biagio | Consul / President (`president`) — BROAD/owner |
| 2 | Pro Consul | `pro_consul` — reviewer/approver |
| 3 | Annotator | `annotator` (secretary) — attendance/minutes |
| 4 | Risk Manager | `risk_manager` |
| 5 | Social Chair | `social_chair` |
| 6 | Recruitment Chair | `recruitment_chair` |
| 7 | Treasurer **or** Magister | `treasurer` / `magister` (pick one to keep it 7) |

> Confirm each role key against `lib/roles.ts` / positions before creating rows;
> use the exact stored key. If a chair role doesn't exist as an officer key yet,
> assign the closest existing officer key (do NOT add new role keys for this alpha).

---

## 1. Apple Developer / EAS setup steps
Full mechanics in `APPLE_DEVELOPER_EAS_CHECKLIST.md`. Summary sequence:
1. **Enroll** in Apple Developer Program — **Individual**, $99/yr. Wait for
   membership = **Active** (minutes–48h).
2. **Expo account** (free tier is fine for alpha build volume).
3. Decide **bundle identifier** (e.g. `com.biagiogargano.chapterops`).
4. On **`phase-2`**, with your go-ahead per step: scaffold `eas.json` (preview +
   production profiles), set iOS `bundleIdentifier` + `buildNumber` in app config.
   Additive build config only — no runtime behavior change.
5. Interactive (you, with 2FA): `eas login` → `eas build:configure` →
   `eas build -p ios --profile preview` (EAS auto-generates iOS credentials).
6. Create the app in **App Store Connect**, `eas submit` the build to TestFlight.
- **Claude will NOT** run `eas login`, enter Apple credentials, register devices,
  or submit — those need your accounts + 2FA.

## 2. Alpha build profile / env setup
- Use the **TestFlight (internal) profile** in `eas.json` with the four
  `EXPO_PUBLIC_*` vars baked in (or as EAS dashboard env vars — recommended for the
  anon key):
  - `EXPO_PUBLIC_AUTH_ENABLED=true`
  - `EXPO_PUBLIC_ORG_SCOPED_DATA=true`
  - `EXPO_PUBLIC_SUPABASE_URL` = alpha project URL (bare, no `/rest/v1/`)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = alpha anon/publishable key
- Build from **`phase-2`** only. Confirm the build commit is `tsc`-clean +
  `test:pure` green, committed flags still `false`, `.env*.local` untracked.

## 3. Keep committed flags FALSE while building flag-on
Unchanged rule (see `APPLE_DEVELOPER_EAS_CHECKLIST.md` §5 / `ALPHA_ROLLOUT.md` §9):
- **No edit to `lib/flags.ts`** — it keeps reading env and stays committed `false`.
- Flag-on values live **only** in the EAS build profile `env` / EAS dashboard.
- `EXPO_PUBLIC_*` are inlined at build time → the TestFlight build is flag-on while
  a plain `expo start` (or a profile without those vars) stays the flag-off sandbox.
- Rollback is code-free (see §10).

## 4. Supabase member/position rows for the eBoard
All on the **alpha** project, **Org S only**. Confirm the project first with the
sanity query in `ENVIRONMENTS.md`.
- For each of the 7 testers, create a `members` row in Org S:
  - `email` = that person's **login email** (unique per person),
  - `authUserId` = **null** (the claim links it on first login),
  - `status` = `active`, `fullName` set.
- Create a matching `positions` row per member with the role key from the table above.
- **Email auth must be enabled**; RLS + claim RPCs are already live — just verify.
- No second org needed (this isn't the isolation test). No schema changes.
- Pre-create the rows **before** sending TestFlight invites so first login resolves
  cleanly into Org S with the right role.

## 5. Recommended role assignments
- **Biagio = President** (BROAD): full create/approve/template/officer powers — the
  owner driving the alpha.
- **Pro Consul = `pro_consul`**: the **reviewer/approver** path (approve/reject
  submissions, Officer Overview).
- **Annotator = `annotator`**: attendance/minutes-style tasks (event-linked
  attendance task owner).
- **Risk / Social / Recruitment chairs**: standard officer scope — create + manage
  their own events/tasks, RSVP, get assigned tasks.
- **Treasurer/Magister**: standard officer scope.
- Keep it to the **existing role keys**; do not invent roles or touch the permission
  model for this alpha (permissions stay implicit).

## 6. Initial events / tasks to seed (so they have real things to do)
Create these in Org S (as President) so testers land in a populated, realistic org:
- **1 recurring chapter meeting** (weekly) — exercises recurrence + prep tasks +
  attendance + RSVP review.
- **1 one-off social event** (Social Chair) with **RSVP required** — exercises
  RSVP yes/no + headcount, including the new `optional_rsvp` if you want an optional
  event that still needs an RSVP.
- **1 recruitment event** (Recruitment Chair) — second owner, second calendar item.
- **1 risk/safety task** assigned to Risk Manager (a to-do with submit→approve).
- **1 brother-wide task** (e.g. "confirm contact info") to test broad assignment.
- **1 task assigned to a specific officer** that routes to **Pro Consul for review**
  — exercises the submit → review → approve/reject loop end to end.
- Apply a **built-in template** to the chapter meeting so prep tasks auto-generate.
> Keep the seed small and real — enough that each officer has ≥1 thing to act on,
> not a fake data dump.

## 7. What each officer should test
- **Biagio (President):** create one-off + recurring events; apply a template;
  Add-vs-Replace + entire-series; approve/reject submissions (incl. proofless);
  RSVP; calendar month + day; notification bell; Officer Overview; **pull-to-refresh**.
- **Pro Consul:** act as **reviewer** — approve/reject others' submissions; view
  assigned tasks; submit one for review; Officer Overview counts; calendar.
- **Annotator:** the **attendance/RSVP-review** task flow on the chapter meeting;
  mark attendance; confirm the attendance task opens/closes around the event.
- **Risk / Social / Recruitment / Treasurer:** receive an assigned task →
  **submit for review**; create an event/task in their area; RSVP to the social;
  confirm they see chapter-wide items; pull-to-refresh to see others' changes.
- **Everyone:** log in with their org email (no DEV-MODE badge), RSVP yes→no→pull
  to refresh on another device, report anything stale/broken via the agreed channel.

## 8. Known limitations to tell them (field version)
Reuse `ALPHA_ROLLOUT.md` §8, minus the Expo-tunnel bullet (TestFlight removes it):
- **Not real-time** — pull to refresh on Today / Calendar / Event detail to see
  teammates' changes; don't report stale data before refreshing.
- **Custom templates are device-local** — a template you build shows only on your
  device (expected, not a leak).
- **Approvals are single-gate** — Pro Consul reviews; President is oversight, not a
  second required sign-off.
- **Recurring events:** prep tasks per occurrence; RSVP-review task on the first
  occurrence only.
- **Not built yet:** questionnaire/Weekly Reports, meeting-agenda auto-population,
  member-level assignment, the feature-branch Create-tab/agenda-checkbox prototypes
  (those are NOT in this build).
- **Early alpha** — data may be reset; preview, not system of record.
- TestFlight builds expire (~90 days); a new build will be pushed as needed.

## 9. Hard blockers (stop the alpha)
- **Crash / red screen** on a core flow (login, create event, submit→approve,
  calendar, RSVP, org load).
- **Login/claim failure** — a tester with a valid member row can't log in or gets
  "not in any org."
- **Wrong role/org resolution** — someone gets powers (or data) they shouldn't.
- **Write goes to the wrong place** or data loss on a normal action.
- **Flag-on not actually on** — DEV-MODE badge shows / mock data appears / login not
  required (means the wrong build/profile shipped).
- Not blockers: cosmetic issues, stale-until-refresh, single-gate approval,
  device-local custom templates.

## 10. Rollback plan
Flags are env/build-only and committed `false`, so rollback needs **no code/git change**:
- **Stop promoting / stop sharing** the flag-on TestFlight build; testers fall back
  to nothing (no dev server needed). Or ship a build from a profile without the env.
- **Data:** clear the alpha org's rows in Supabase if needed (no schema change).
- **No `lib/flags.ts` edit/revert ever.**
- If a bad build reaches TestFlight: push a fixed build with a higher `buildNumber`;
  expire/remove the bad build in App Store Connect.

## 11. Exact checklist before inviting them
- [ ] Apple Developer **Active**; Expo account ready; bundle id decided.
- [ ] `eas.json` TestFlight profile has the **four `EXPO_PUBLIC_*`** vars (flag-on);
      committed `lib/flags.ts` still `false`.
- [ ] Build is from **`phase-2`**, commit is clean, `tsc` + `test:pure` green,
      `.env*.local` untracked.
- [ ] Flag-on build **verified on-device**: login required, real identity, **no
      DEV-MODE badge**, no mock/demo data.
- [ ] **7 member rows + positions** created in Org S (per §4); each email unique;
      role keys match `lib/roles.ts`.
- [ ] **Email auth on**; **RLS + claim RPCs live** on the alpha project (verify).
- [ ] Seed **events/tasks** created (per §6) so each officer has ≥1 real action.
- [ ] Each tester added as a **TestFlight Internal Tester** by their Apple ID email.
- [ ] Limitations (§8) + point-of-contact + issue-reporting channel sent to testers.
- [ ] Rollback path confirmed (stop promoting build / clear org rows).
- [ ] Confirmed: **full chapter NOT invited**, **no prototype merge**, **no Weekly
      Report / invite-link schema started**.

---

## Suggested sequence
1. You: enroll Apple (Individual) → **Active**; create Expo account.
2. Me (on `phase-2`, your approval per step): scaffold `eas.json` + bundle id; commit; report phase-2 impact.
3. You + me: `eas login` → `build:configure` → `eas build -p ios --profile preview/testflight`.
4. You: create app in App Store Connect; `eas submit`; add 7 internal testers.
5. Me/you: create the 7 Supabase rows + seed events/tasks in Org S; verify flag-on on-device.
6. Send limitations + invites → eBoard installs via TestFlight → real officer use.
