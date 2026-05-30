# Org Levels / Assignment Permissions — Plan & Status

Status of the Build 16 assignment-permission foundation. Planning/record only —
no code, schema, RLS, or EAS changes are implied by this document.

See `lib/orgLevels.ts` (the pure model) and `docs/PRODUCT_BUILDING_PRINCIPLES.md`
(role→level mapping is pack data, not hardcoded core logic).

---

## 1. Model (generic)

Five ordered levels, highest authority first:

```
owner > executives > officers > members > advisors
```

Default assignment rule (pure, in `canAssign`):
- A higher level may assign **strictly downward** (to any lower level).
- **Same-level assignment is denied by default.**
- Lower → higher is denied.
- Unknown / unmapped roles fail safe (cannot assign, cannot be assigned).
- **Self-assignment is always allowed** (enforced by `getAssignableRoles`, which
  always includes the assigner's own role).

Exceptions (`canAssignWithExceptions` / `SIGMA_CHI_ASSIGNMENT_EXCEPTIONS`) only
ever **GRANT** a specific assigner→target pair; they never revoke. Future:
owner-configurable; today a small hardcoded alpha list.

## 2. Current Sigma Chi alpha mapping (`ROLE_LEVEL`)

| Role | Level |
| ---- | ----- |
| `president` (Consul) | **owner** |
| `pro_consul` | **executives** |
| `annotator` + all chairs/officers | **officers** |
| `brother` | **members** |
| *(none yet)* | **advisors** (reserved, unmapped) |

## 3. Default alpha exceptions (`SIGMA_CHI_ASSIGNMENT_EXCEPTIONS`)

Two upward grants to the President (which the downward rule denies):
- `pro_consul → president` — the second may delegate up to the Consul.
- `annotator → president` — the Secretary coordinates Consul follow-ups.

NOT exceptions:
- `president → pro_consul` — normal owner→executives downward assign.
- `annotator → peer officers` — same-level, stays denied (no peer grant).

## 4. Resulting assignee picker (wired in `app/task/create.tsx`, commit `5737992`)

| Acting role | Can assign to |
| ----------- | ------------- |
| President | self, Pro Consul, all officers/chairs, Brother |
| Pro Consul | self, President (exception), officers/chairs, Brother |
| Annotator | self, President (exception), Brother |
| Other officer/chair | self, Brother |
| Brother | self only |

Edit mode additionally keeps the task's CURRENT assignee selectable even if it
now falls outside the editor's downward set (prevents silently dropping a
pre-existing assignee on save).

## 5. What is NOT wired (intentional)

- **Advisors** — level exists, no role maps to it; no view-only restriction
  logic yet (advisors should mostly view calendar/RSVP, not private proof/reports
  — a separate future slice, and a data-visibility decision).
- **Reviewer picker** — unchanged (full leadership set; self-review handled
  per-clone). Org levels do not yet gate reviewers.
- **No exception-config UI**, no visual org tree, no permissions grid.
- **No Supabase persistence** of levels/exceptions — all pack data in code.

## 6. Remaining Build 16 candidate slices (low-risk first)

- **(done) Pure helpers + tests** — `lib/orgLevels.ts` + `lib/orgLevels.test.ts`.
- **(done) Assignee picker wiring** — `app/task/create.tsx`.
- **(done) Edit-mode current-assignee safety** — keep stored assignee selectable.
- **Next inert:** extract the "candidate roles" list (`[...OFFICER_ROLES,
  FLOOR_ROLE]`) into a single named constant if it spreads further (currently
  fine inline).
- **Future visible (needs decisions):**
  - Advisor view-only restrictions (data-visibility decision).
  - Whether reviewer eligibility should consider levels.
  - Annotator peer-officer assignment (currently denied — confirm if that should
    change for real users).

## 7. Build 16 cut criteria

Bundle into one Build 16 (not a build per change). Cut only when the visible
assignment behavior is stable and self-verified, and any advisor/reviewer
decisions for this release are settled. Until then, Build 15 stays live.

---

*Record/planning only. No app behavior, schema, RLS, RPC, flag, notification,
or EAS change is implied by this document.*
