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

## Secrets (NEVER committed)

Set as Edge Function environment variables at deploy time — **never in the repo**:

- `SUPABASE_URL` — project URL (provided to Edge Functions by default)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only; bypasses RLS)

There are no secrets in this directory. Do not add any.

## Request shape (draft)

```jsonc
POST /functions/v1/send_push
Authorization: Bearer <user JWT>        // caller auth (the actor)
{
  "org_id":        "uuid",
  "entity_type":   "task" | "event",
  "entity_id":     "string",
  "audience_roles":["social_chair", "president"],
  "title":         "New task assigned",
  "body":          "Draft budget report — due Fri",
  "actor_role":    "annotator"          // excluded from recipients
}
```

## Deploy (WHEN greenlit — do not run now)

```
# 1. apply the table/RPC first:  supabase/push_tokens_schema.sql
# 2. set secrets:
#    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...    (server-only)
# 3. deploy:
#    supabase functions deploy send_push
```

## Status

Draft scaffold only. Not deployed. Not wired into the app. No APNs key required
to merge this file (APNs is needed only at actual send time, configured in EAS).
