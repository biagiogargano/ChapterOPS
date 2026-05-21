# Environments — Supabase project switching

The app talks to **whichever Supabase project** these two env vars point at
(read in `lib/supabase.ts`):

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

There is **no code change** involved in switching projects — only the env values.

## Layout

| File                  | Tracked? | Purpose                                  |
|-----------------------|----------|------------------------------------------|
| `.env.example`        | ✅ yes   | Template (no real keys).                 |
| `.env`                | ❌ no    | The values the app actually uses now.    |
| `.env.alpha.local`    | ❌ no    | Live / alpha project URL + anon key.     |
| `.env.staging.local`  | ❌ no    | Staging project URL + anon key.          |

All `.env` variants are gitignored except `.env.example`.

## Switching projects

```bash
# Work against staging:
cp .env.staging.local .env && npx expo start -c

# Back to alpha/live:
cp .env.alpha.local .env && npx expo start -c
```

`-c` clears the Metro cache so the new values take effect.

## Safety habits

- **Never commit real keys.** Only `.env.example` (placeholders) is tracked.
- **Never commit the `service_role` key** anywhere.
- **Before running any SQL** in the Supabase SQL editor, confirm which project
  you're in with a sanity query, e.g.:
  ```sql
  select current_database(),
         (select count(*) from public.organizations) as orgs,
         (select count(*) from public.members)       as members;
  ```
  Staging shows tiny/synthetic counts; alpha shows real counts. If the numbers
  surprise you, stop.
- **Staging is for rehearsal only** — do not point a real-user build at it.

> Note: the `.env.*.local` files do not exist yet. Create them only when you set
> up the staging project, and keep them local.
