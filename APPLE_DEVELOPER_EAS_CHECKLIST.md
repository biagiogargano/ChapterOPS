# Apple Developer → EAS / TestFlight Setup Checklist

**PLANNING ONLY.** No EAS scaffolding, no `eas.json`, no app-code/distribution
changes in this checkpoint. This documents what to buy, gather, and do so that
when you're ready we can produce a real iPhone alpha build with **one** short,
well-scoped change. Lives on `feature/questionnaire-reports-planning`; does **not**
touch `phase-2`.

Context: Expo Go + tunnel proved unreliable for a remote VP (offline-endpoint /
"could not connect to development server" errors). A standalone build via EAS +
TestFlight removes the dependency on your laptop/tunnel entirely.

---

## 1. What to buy / enroll in
- **Apple Developer Program — $99/year.** Required for *any* iOS build that runs
  on a physical iPhone (both internal ad-hoc distribution and TestFlight). This is
  the hard gate; nothing iOS proceeds without it.
  - Enroll at <https://developer.apple.com/programs/enroll/>.
  - **Individual** enrollment is fine for now (fast). An **Organization** account
    needs a D-U-N-S number and takes longer — only needed if you want the chapter/
    company as the legal publisher. Recommend **Individual** to start.
  - Activation can take anywhere from minutes to ~24–48h (identity verification).
- **Expo account — free.** Used by EAS to run cloud builds. (No paid EAS plan
  needed for low build volume; the free tier covers an alpha. Builds may queue.)
- Optional later: nothing else required for an internal/TestFlight alpha.

## 2. Account info to have ready
- **Apple ID** used for the Developer Program (email + password + 2FA device).
- Confirmation the membership shows **Active** at
  <https://developer.apple.com/account>.
- **App Store Connect** access (auto-included with the Developer Program) at
  <https://appstoreconnect.apple.com>.
- **Expo account** login (email/password or GitHub).
- The **alpha Supabase project** values (already used for the tunnel flag-on
  profile): `EXPO_PUBLIC_SUPABASE_URL` (bare, no `/rest/v1/`),
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`. (Anon key is the publishable client key — safe
  to embed in a client build.)
- A **bundle identifier** decision, e.g. `com.biagiogargano.chapterops` (must be
  unique on the App Store; lowercase reverse-domain).
- For **internal distribution only** (not TestFlight): the VP's device **UDID**
  (EAS can capture it via a registration link — no manual lookup needed).

## 3. What Claude should do after enrollment is Active
Each of these is a small, reviewable step — I will pause for your go-ahead before
the first commit, and report `phase-2` status after each:
1. **Scaffold `eas.json`** on `phase-2` with a `preview` profile (internal
   distribution) and a `production`/TestFlight profile — flag-on env baked into the
   profile only (see §5). Additive build config; no runtime app behavior change.
2. **Set the iOS `bundleIdentifier`** in `app.json` / `app.config` (one field).
3. Walk you through the **interactive** parts I cannot do for you:
   `eas login`, `eas build:configure`, `eas credentials` (Apple sign-in / cert +
   provisioning profile generation — EAS automates most of this), and
   `eas device:create` (for internal) **or** App Store Connect app creation (for
   TestFlight).
4. Trigger/observe the build command with you: `eas build -p ios --profile preview`.
5. Help **verify the flag-on build** on-device: login required, real identity, no
   "DEV MODE" badge, no mock data (per `ALPHA_ROLLOUT.md` §9).
6. Document the repeatable build/distribute steps in `ALPHA_ROLLOUT.md` §9.

I will **not** run `eas login`, enter Apple credentials, register devices, or
submit to TestFlight — those need your accounts + 2FA and must be done by you.

## 4. App config / build files that will likely change
- **`eas.json`** — **new** file. Build profiles + per-profile `env`. The main
  addition.
- **`app.json` / `app.config.(js|ts)`** — add iOS `bundleIdentifier`, confirm
  `name`, `slug`, `version`, `ios.buildNumber`. Possibly an `extra.eas.projectId`
  (EAS writes this on `build:configure`).
- **`package.json`** — `eas-cli` is global; no dependency change expected. (If we
  add `expo-updates` later for OTA, that's a separate, explicit decision — not now.)
- **NOT changed:** `lib/flags.ts` (stays committed-`false`), any
  schema/RLS/RPC/policy, the task state machine, or feature code. Distribution is
  config-only.

## 5. Keeping committed flags FALSE while shipping a flag-on alpha
The rule stays intact — the build does **not** flip committed defaults:
- `lib/flags.ts` keeps reading `process.env.EXPO_PUBLIC_*` and stays committed
  `false` by default. **No edit to that file.**
- The **flag-on values live only in the `eas.json` build profile's `env` block**
  (or EAS dashboard env vars / secrets), e.g.:
  ```jsonc
  "preview": {
    "distribution": "internal",
    "env": {
      "EXPO_PUBLIC_AUTH_ENABLED": "true",
      "EXPO_PUBLIC_ORG_SCOPED_DATA": "true",
      "EXPO_PUBLIC_SUPABASE_URL": "https://<alpha>.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<anon key>"
    }
  }
  ```
- `EXPO_PUBLIC_*` vars are **inlined at build time**, so the alpha build is flag-on
  while a normal `expo start` / a profile without those vars remains the flag-off
  sandbox. Same model as the gitignored `.env*.local`, just baked into a profile.
- **Rollback is still code-free:** stop sharing / don't promote the flag-on build,
  or ship a build from a profile without the env. No `lib/flags.ts` revert ever.
- Decision to make: keep the anon key in committed `eas.json` (simplest; the key
  is publishable) **or** store it as an **EAS secret / dashboard env var** and keep
  `eas.json` value-free. Either respects "committed flags false." Recommend EAS
  dashboard env vars for cleanliness; decide at scaffold time.

## 6. How testers install via TestFlight
- **Internal testers (up to 100, no Apple review, instant):** add the VP's Apple ID
  email as an **Internal Tester** in App Store Connect → TestFlight. After
  `eas submit` pushes the build, he gets an email + installs the **TestFlight** app,
  then taps "Install." Best fit for a small trusted alpha.
- **External testers (up to 10k, light Apple review of the first build):** invite by
  email or a public link; needed only if you outgrow 100 internal testers.
- **Alternative — Internal Distribution (no TestFlight):** EAS gives an install
  link after registering each device's UDID (`eas device:create`). Fastest for
  1–2 devices, but you must register each device. **TestFlight is the better path
  for a growing alpha** since it needs no UDID wrangling.
- Recommendation: **TestFlight Internal Testers** for the VP and future officers.

## 7. Risks / what NOT to do yet
- **Don't pay/scaffold until you've decided** Individual vs Organization (Individual
  recommended) — Organization needs a D-U-N-S number and stalls things.
- **Don't commit secrets carelessly.** Anon key is publishable, but never commit
  service-role keys or any `.env*.local`. Prefer EAS env vars for the key.
- **Don't build the alpha off this feature branch** — the iOS build must come from
  **`phase-2`** (stable). This branch has the unfinished questionnaire prototype.
- **Don't change `lib/flags.ts`, schema/RLS/RPC, or the task state machine** for
  distribution — none of that is required.
- **Don't add `expo-updates`/OTA yet** — separate decision; not needed for a first
  TestFlight build.
- **Don't bump `version`/`buildNumber` carelessly** once submitting — each
  TestFlight upload needs a unique `buildNumber`.
- **Build provenance:** ensure the build commit is clean, `tsc` + pure tests green,
  committed flags still `false`, and `.env*.local` untracked (mirrors
  `ALPHA_ROLLOUT.md` §11 go/no-go) before any submit.

---

## TL;DR sequence (once you say go, after enrollment is Active)
1. You: enroll (Individual, $99/yr) → wait for **Active** → create Expo account.
2. Me (on `phase-2`, with your approval per step): scaffold `eas.json` + set
   `bundleIdentifier`; commit; report `phase-2` impact.
3. You + me: `eas login` → `eas build:configure` → `eas build -p ios --profile
   preview` (EAS handles iOS credentials interactively).
4. You: create the app in App Store Connect, add the VP as an Internal Tester,
   `eas submit`.
5. VP: installs via TestFlight, logs in with his Org-S email — no tunnel, no
   laptop, distance irrelevant.
