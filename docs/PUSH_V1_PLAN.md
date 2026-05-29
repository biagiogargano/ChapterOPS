# Push Notifications v1 — Plan

Planning document only. **No app code, SQL, Supabase, Edge Function, EAS, or
`app.json` changes are part of this document.** It captures the smallest safe
push-notification design for the TestFlight alpha so the backend pieces can be
greenlit separately before any implementation.

Decisions locked for this plan:
- **Backend posture:** plan doc only for now. The `push_tokens` table + RLS and
  the `send_push` Edge Function are described here but **not** written as files
  yet — they are a separate, explicitly-approved step (they are schema/RLS +
  server changes).
- **Recurring RSVP reminders:** **deferred to v1.1** (needs a scheduler). v1 is
  purely event-driven.
- **Permission prompt timing:** **on first meaningful action** (first time the
  user opens a task or RSVPs), not on cold launch and not immediately at login.

See also: `docs/PRODUCT_BUILDING_PRINCIPLES.md` (notifications must be
action-linked, not a feed) and `lib/updateNoticeStore.ts` (the existing in-app
notice system push rides alongside — push does NOT replace it).

---

## 1. Core rule

**Every push is action-linked.** A push always points at one task or one event
and deep-links there on tap. No chat, no general feed, no broadcast/marketing,
no "X posted" social spam. If a notification can't deep-link to a concrete
task/event the user can act on, it is not in v1.

Push is an *amplifier of the existing in-app notice system*, not a new system.
Where the app emits an `UpdateNotice` to an audience, v1 also sends a push to
that audience's devices. Same targeting, same audience exclusion (the actor
never gets pushed their own action).

> **⚠️ Correction (readiness audit, build 13).** An earlier draft of this plan
> assumed most v1 notifications "already emit" a notice and push just needs send
> wiring. **That is wrong.** Only **event changed** emits today. The task and
> RSVP-required notifications do **NOT** emit a notice yet, so **Push V1 must
> first ADD the missing notice-emit hooks** before push can amplify them. See the
> corrected table below and §2a.

## 2. v1 scope (the 5 notifications)

| # | Notification | Emits a notice today? | New work for push |
| - | ------------ | --------------------- | ----------------- |
| 1 | Task assigned to me | ❌ **No** | **add a new emit** at task create (incl. each multi-role clone) + send |
| 2 | Task submitted for my review | ❌ **No** (`handleProofSubmit` only sets state) | **add a new emit** on submit (reviewer audience) + send |
| 3 | Task approved / rejected | ❌ **No** (review handlers only set state) | **add a new emit** on approve/reject (assignee audience) + send |
| 4 | RSVP required | ❌ **No** (event *create* does not emit) | **add a new emit** on mandatory-event create + send |
| 5 | Event time/date changed | ✅ **Yes** (event *edit* emits) | send wiring only |

**Reality:** 4 of the 5 v1 notifications have **no existing emit hook**. Only
"event changed" (event edit) is wired. Task delete/cancel and event cancel also
emit today, but those are not in the v1 push set. The bulk of the app-side v1
work is therefore **adding emit hooks**, not just "wiring sends onto existing
emits."

## 2a. Missing emit hooks Push V1 must add (verified in code)

Confirmed by inspecting the actual flows (build 12 / HEAD):

- **Task assigned** — `app/task/create.tsx` `handleSubmit` builds + inserts each
  task (one per assigned role) but emits **no** notice. → add an "assigned" emit
  per created clone, audience = that clone's `assignedRole`.
- **Task submitted for review** — `app/task/[id].tsx` `handleProofSubmit` calls
  `setTaskState('submitted')` (and the proof RPC) but emits **no** notice. → add
  a "submitted" emit, audience = `reviewerRole` (fallback leadership).
- **Task approved / rejected** — `app/task/[id].tsx` review handlers call
  `setTaskState('approved' | 'rejected')` but emit **no** notice. → add an
  "approved"/"rejected" emit, audience = `assignedRole`.
- **RSVP required** — `app/event/create.tsx` create path emits **no** notice
  (only the *edit* path does). → add an "RSVP required" emit on creating a
  mandatory/attendance event, audience = the event's member audience.
- **Event changed** — `app/event/create.tsx` edit path **already emits**
  (`buildEventEditNotice` → `emitUpdateNotice`). Push only needs send wiring.

These emits are additive and gated like the rest of push; they do not change
task/event state machines and do not break build-12 users.

**Out of v1 (deferred to v1.1):** recurring/time-based RSVP *reminders* ("event
is tomorrow, RSVP"). These need a scheduled job (pg_cron or a scheduled Edge
Function) and a sent-ledger to avoid duplicates — a meaningfully bigger surface.
Documented as the first v1.1 item, intentionally not built in v1.

**Explicitly NOT in scope (any version of this plan):** chat, DMs, a
notification inbox/feed screen, social/posting notifications, marketing pushes,
per-message threads.

## 3. Current state (investigation summary)

- **No push code exists** anywhere in the repo today.
- **`expo-notifications` is NOT installed.** `expo-linking`/`expo-constants`/
  `expo-router` are present, so tap-to-deep-link routing is already feasible
  (the auth email-link work wired `chapterops://` handling we can reuse).
- **`app.json`** has `scheme: "chapterops"` but **no notifications plugin** and
  **no iOS push entitlement** yet.
- **The emit hooks mostly DO NOT exist yet (corrected):** `emitUpdateNotice` is
  called today only from **edit/delete/cancel** paths — task edit, task
  delete/cancel, event edit, event cancel. It is **NOT** called from task
  assignment, task submit-for-review, task approve/reject, or event create. So 4
  of the 5 v1 notifications need a **new** emit hook (see §2a); only "event
  changed" reuses an existing one.
- **Audience targeting is role-based** (`audienceRoles`), matching the existing
  notice model and the live RLS helpers (`auth_user_orgs()` etc.).
- **Task-centric first (Checkpoint A):** v1 lands the pipeline + the three task
  emits (assigned / submitted / approved-rejected) first — the highest-frequency
  "I need to act" moments. **RSVP-required (#4) and event-changed (#5) push are
  Checkpoint B**, reusing the same pipeline with additional emit sites.

## 4. Apple / APNs / EAS requirements

- An **APNs key** registered with EAS (`eas credentials` → push notifications
  key) under Apple Team `6NPWF9RRGX`. Expo's push service relays to APNs; the
  app never talks to APNs directly.
- iOS **physical device** required to receive push (no simulator).
- The TestFlight build must carry the `aps-environment` entitlement — added by
  the `expo-notifications` config plugin + EAS credentials, not hand-edited.
- **A fresh EAS build is mandatory** — `expo-notifications` is a native module
  and the entitlement is native; this cannot be shipped OTA.

## 5. Token storage — `push_tokens` (backend, needs separate approval)

A device's Expo push token is **per auth user + device**, so no existing table
fits. One new additive table, in the established pattern (`update_notices`,
`task_submissions`).

Proposed shape (draft — NOT to be created until separately greenlit):

```
public.push_tokens (
  id            uuid pk default gen_random_uuid(),
  org_id        uuid not null,
  member_id     uuid,                 -- members.id (audit / targeting)
  auth_user_id  uuid not null,        -- owner = auth.uid()
  expo_token    text not null unique, -- ExponentPushToken[...]
  platform      text,                 -- 'ios' | 'android'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
)
```

## 6. RLS / security model

- **RLS enabled.** A user may upsert/delete **only their own** token rows
  (`auth_user_id = auth.uid()`). Writes go through a SECURITY DEFINER RPC
  `upsert_push_token(expo_token, platform)` that stamps `auth.uid()` + the
  caller's active org/member (mirrors `upsert_task_submission`).
- **Clients can NEVER read other users' tokens.** No broad SELECT policy. The
  only reader is the Edge Function, which uses the **service-role key**
  (bypasses RLS) server-side. This keeps the fan-out (role → members → tokens)
  entirely off the client — the client doesn't know, and shouldn't know, anyone
  else's token.
- Token rows are disposable: on sign-out or permission revocation the client
  deletes its own row; Expo "DeviceNotRegistered" receipts prune dead tokens.

## 7. How sending works (server-side, NOT app code)

**A Supabase Edge Function `send_push` does the fan-out.** The client must not
contain push-send logic — it can't see other users' tokens (RLS), and putting
recipient resolution on the client would be both insecure and incorrect.

Flow:
1. An action happens (assign / submit / review / event change). The app emits its
   `UpdateNotice` — **adding the emit hook where one does not exist yet** (see
   §2a: task assign/submit/review and RSVP-required all need new emits).
2. Alongside that emit, the app invokes `send_push` with
   `{ org_id, entity_type, entity_id, audience_roles, title, body }`.
3. `send_push` (service-role): resolve `audience_roles → active members in org →
   their push_tokens`, **exclude the actor**, then POST batched messages to
   `https://exp.host/--/api/v2/push/send`. Each message carries
   `data: { entityType, entityId }` for deep-link routing.
4. Expo relays to APNs. Delivery receipts with `DeviceNotRegistered` prune dead
   tokens.

Rationale for Edge Function over (a) app-side send or (b) DB trigger:
- **App-side** is rejected: clients can't read others' tokens; would leak.
- **DB trigger calling http** is brittle and ties push to row writes; the notice
  emit is the cleaner seam and already exists.
- **Edge Function** keeps the service-role key server-only and the logic in one
  testable place.

## 8. Client pieces (when implementation is approved)

- `expo-notifications` dependency + `app.json` plugin/entitlement.
- `lib/pushTokens.ts` — thin adapter (`upsert_push_token` RPC call + local
  delete), fallback-safe + no-op when Supabase unconfigured (mirrors the other
  services).
- `lib/usePushRegistration.ts` — hook gated by `AUTH_ENABLED` + resolved
  identity. Requests permission **on first meaningful action** (first task open
  / first RSVP), gets the Expo token, upserts it. Never prompts on cold launch.
- Root-level notification-response listener → deep-link to `/task/[id]` or
  `/event/[id]` from the `data` payload (reuses the auth deep-link infra).
- **New notice-emit hooks (Checkpoint A):** `app/task/create.tsx` (assigned),
  `app/task/[id].tsx` (submitted, approved, rejected).
- **New notice-emit hooks (Checkpoint B):** `app/event/create.tsx`
  (RSVP-required on mandatory-event create); event-changed reuses the existing
  edit emit.
- The shared call site that fires `send_push` next to each `emitUpdateNotice`.

## 9. Files expected to change (future implementation — NOT now)

Client (phase-2):
- `package.json`, `app.json`
- `lib/pushTokens.ts` (new), `lib/usePushRegistration.ts` (new)
- `app/_layout.tsx` (mount hook + response listener)
- `app/task/create.tsx` (assigned emit — Checkpoint A)
- `app/task/[id].tsx` (submitted / approved / rejected emits — Checkpoint A)
- `app/event/create.tsx` (RSVP-required emit — Checkpoint B)
- one pure test for the role→audience push payload builder

Backend — **drafts now staged in-repo (committed but NOT applied/deployed):**
- `supabase/push_tokens_schema.sql` (table + RLS + `upsert_push_token` RPC)
- `supabase/functions/send_push/index.ts` (Edge Function scaffold)

## 10. New TestFlight build required?

**Yes — mandatory.** `expo-notifications` is a native module and the iOS push
entitlement is native. A fresh EAS alpha build (+ APNs key in EAS credentials)
is required; it cannot be delivered OTA.

## 11. Implementation order (when greenlit)

0. **Drafts staged (DONE, this commit):** `push_tokens_schema.sql` +
   `send_push/index.ts` committed as inert drafts — **not applied, not deployed.**
1. **Backend, as deliberate steps:** apply `push_tokens` + RLS +
   `upsert_push_token`; deploy `send_push`; register the APNs key in EAS. Verify
   with a manual Expo push to one seeded token.
2. **Client registration:** add `expo-notifications`, the hook, and token upsert.
   Confirm a token row appears for the signed-in user.
3. **Checkpoint A — task push:** add the three task emits (assigned / submitted /
   approved-rejected) and wire `send_push`. Confirm they deliver + deep-link.
4. **New EAS alpha build** for on-device testing (push needs a physical device).
5. **Checkpoint B — RSVP-required + event-changed push:** add the RSVP-required
   emit on mandatory-event create; wire send onto the existing event-edit emit.
6. **v1.1 later:** recurring RSVP reminders via a scheduled job + sent-ledger.

---

*Documentation only. No code/SQL/Supabase/Edge Function/EAS/app.json changes are
implied by this plan. The `push_tokens` table, its RLS, and the `send_push`
Edge Function are schema/RLS/server changes that must be approved and applied as
separate, deliberate steps.*
