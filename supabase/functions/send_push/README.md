# send_push — Edge Function (DRAFT, NOT DEPLOYED)

> ⚠️ **This is a committed DRAFT scaffold. It is NOT deployed and must NOT be
> deployed until separately greenlit.** It is part of Push v1 Checkpoint A
> staging (see `docs/PUSH_V1_PLAN.md`). Nothing in the app invokes it yet.

## What it does (when deployed)

Server-side fan-out of an **action-linked** push notification. The app calls this
function with an audience (role list) for a task/event; the function resolves
those roles → active members → their Expo push tokens (reading `push_tokens`
with the **service-role key**, which bypasses RLS), excludes the actor, and POSTs
batched messages to the Expo Push API (`https://exp.host/--/api/v2/push/send`).

This is the ONLY place that reads other users' tokens. Clients never can (RLS).

## Why an Edge Function (not app-side / not a DB trigger)

- **App-side is impossible/insecure:** clients can't read other users' tokens.
- **DB trigger calling http is brittle** and couples push to row writes.
- **Edge Function** keeps the service-role key server-only and the fan-out logic
  in one testable place.

## Secrets / environment

**For V1 you do NOT need to set any secrets.** The two variables this function
reads are **auto-injected by the Supabase Edge Function runtime** into every
deployed function:

- `SUPABASE_URL` — the project URL (runtime-provided).
- `SUPABASE_SERVICE_ROLE_KEY` — the service role key (runtime-provided;
  server-only; bypasses RLS so the function can read every member's token).

> ⚠️ Do **NOT** run `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=…`. Supabase
> manages the `SUPABASE_`-prefixed variables itself and **rejects** attempts to
> set secrets with that reserved prefix. There is no secrets command to run for
> V1.

There are no secrets committed in this directory. Do not add any.

**Deferred — `EXPO_ACCESS_TOKEN`:** only needed if Expo "enhanced push security"
is later enabled for the project (it is OFF by default), or if we start reading
delivery receipts under an authenticated Expo account. If/when that happens, that
is the ONE secret to add:

```
supabase secrets set EXPO_ACCESS_TOKEN=...   # only if enhanced security is enabled later
```

## Request shape (draft)

```jsonc
POST /functions/v1/send_push
Authorization: Bearer <user JWT>        // authenticated app user (the actor)
{
  "org_id":        "uuid",
  "entity_type":   "task" | "event",
  "entity_id":     "string",
  "audience_roles":["social_chair", "president"],
  "title":         "New task assigned",
  "body":          "Draft budget report — due Fri",
  "actor_role":    "annotator"          // excluded from recipients (role-level; see TODO)
}
```

## Authentication / JWT verification

- **Deploy with JWT verification ON (the default).** Do not pass `--no-verify-jwt`
  for normal use — that would let anyone who reaches the URL trigger sends.
- The app calls this function **as an authenticated user** (e.g.
  `supabase.functions.invoke('send_push', …)`, which attaches the user's JWT), so
  default verification is exactly what we want.
- `--no-verify-jwt` is acceptable **only** as a clearly-marked, throwaway local
  debug step (e.g. a one-off curl smoke test) and must never be the deployed
  configuration.

## Deploy (WHEN greenlit — do not run now)

```
# 1. apply the table/RPC first:  supabase/push_tokens_schema.sql   (already applied on alpha)
# 2. no secrets to set for V1 (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are runtime-provided)
# 3. deploy with JWT verification ON (default):
#    supabase functions deploy send_push --project-ref <alpha-project-ref>
```

## TODOs / known limitations (not deployment blockers)

- **Actor exclusion is ROLE-level, not person-level.** The function drops the
  actor's *role* from the audience. If the actor shares a role with real
  recipients (e.g. one of two co-Social-Chairs), legitimate recipients can be
  dropped; conversely the actor could still be notified under a *different* role
  they hold. **Future improvement:** exclude by `auth_user_id` / `member_id` once
  the client safely sends the actor's identity.
- **Expo enhanced push security / `EXPO_ACCESS_TOKEN` deferred.** V1 calls the
  Expo Push API unauthenticated, which is fine while enhanced security is off.
- **Delivery-receipt pruning deferred.** V1 does not yet read receipts to prune
  `DeviceNotRegistered` tokens (TODO in `index.ts`).

## Status

Draft scaffold only. Not deployed. Not wired into the app. No APNs key required
to merge this file (APNs is needed only at actual send time, configured in EAS).
