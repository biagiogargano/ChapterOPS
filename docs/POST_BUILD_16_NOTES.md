# Post-Build-16 Development Notes (unbuilt)

Changes on `phase-2` since Build 16 (`8fe71fc`). **Not yet in any TestFlight
build** — Build 16 is the latest cut/submitted. These bundle into the next build
whenever one is cut. No EAS build is implied by this doc.

All changes here are clarity polish, pure helpers/tests, and docs — **no schema,
RLS, RPC, auth, flags, push-scope, or new systems.**

---

## User-visible changes

### Today tab
- **Overdue vs due-today is now distinguished.** TODAY'S TASKS lists overdue
  items first, then due-today, and shows a summary subtitle like
  "2 overdue · 1 due today · 3 to review". The header turns red only when there
  is actually overdue work.
- **Honest all-clear copy.** When today is clear but there's upcoming work, the
  message reads "Nothing urgent today — see Coming up below" instead of implying
  there is nothing to do.
- **COMING UP now shows a count.**

### Create Task
- Removed a **dead reviewer empty-state** with stale copy ("No reviewer
  available — leadership roles are all assignees here…"). After the Build-15
  reviewer fix, `reviewerOptions` is always the full leadership set, so that
  branch could never render; its message was misleading. Reviewer picker behavior
  is unchanged.

### Event Detail
- (Build 16 already hid the empty About section.) No further changes — the screen
  was already clean.

## Foundation / tests (inert, no behavior change)

- **Event template registry invariants** (`lib/eventTemplates.test.ts`, 39 → 150
  cases): every current/future template is now guarded for unique keys, known
  roles, no self-review, text/link-only proof, integer offsets, unique ids.
- **Typed kind-default accessors** (`lib/eventTemplates.ts`):
  `getDefaultTemplateIdForKind`, `kindHasDefaultTemplate`,
  `defaultTemplateCoverage` — make adding a future kind-default a one-line tested
  change. Create screen uses the accessor (behavior-identical).
- **Today feed helper** (`lib/todayFeed.ts` + tests): `bucketUrgencies`,
  `todaysTaskCount`, `todayIsUrgent`, `todaySummaryText` — moves Today's display
  logic into a tested pure module.

## Docs added
- `docs/EVENT_TEMPLATES_FOUNDATION.md` — template system architecture, idempotency,
  invariants, extension path, and the settled alpha decisions (no new
  auto-defaults; custom templates stay local; Formal = manual Social subtype, not
  a new event kind).

## Tests
- `npx tsc --noEmit` → clean.
- `npm run test:pure` → 19 suites pass (added `todayFeed`; `eventTemplates`
  expanded to 150).

## Commit range
`8fe71fc..2a508fe` (8 commits): template invariants/accessors/docs (×4), Today
clarity (×3), create-task dead-code cleanup (×1).

## Build status
Development-only. The next TestFlight build is **not** justified by these changes
alone under the scarce-build policy (no live-alpha blocker, no native/dependency
change) — they ride along whenever the next build is cut for another reason or on
explicit request.
