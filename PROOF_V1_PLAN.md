# Proof / Attachment v1 — Planning

**Planning only. No code, no schema, no Supabase Storage/RLS changes yet.**
Feature-branch planning doc. Goal: design the smallest proof-attachment system that
makes task submissions actually useful (receipts, flyers, screenshots, attendance
sheets, meeting minutes, room-setup photos) without bloating the task state machine.

> **STATUS — direction APPROVED; build NOT started.** Proof v1 is a **high-priority
> post-TestFlight feature** (text/link-only proof is not enough for real officer
> tasks). Approved scope (locked): text/photo/file/link/any · **one attachment per
> submission** · private Supabase Storage bucket · reviewer view + approve/reject ·
> **no new task states** · no multiple attachments · no comments-with-attachments ·
> no folders/versioning/integrations. **Post-TestFlight priority: #2** (see
> `PRODUCT_BACKLOG.md` → "Post-TestFlight priority order"). This stays planning until
> the next **approved schema/storage/RLS checkpoint** — do not build yet.

---

## 1. Current proof/submission model (as built)
The pieces already exist in mock form:
- **Task definition fields** (`lib/mockTasks.ts`): `requiresProof: boolean`,
  `proofType?: ProofType` where `ProofType = 'text' | 'image' | 'screenshot' |
  'document' | 'link'`, plus `requiresApproval` + `reviewerRole`.
- **Interaction state** (`lib/devTaskStore.ts` `StoredTask`): `state`,
  `proofContent: string` (the typed text/link), `rejectionNote: string`.
- **State machine** (`TaskState`): `assigned → submitted → approved | rejected`
  (+ `overdue` / `escalated` urgency-driven). Reject sends it back to resubmit.
- **Persistence scaffolding** (`lib/taskService.ts`, **not wired to any screen**):
  a proposed `tasks` table with `requires_proof`, `proof_type`, `proof_content`,
  `rejection_note` columns; `updateTaskState()` writes state/proof/rejection.
- **UI** (`app/task/[id].tsx`):
  - `ProofSubmitSection` (assignee) — a `TextInput` for text/link; for binary
    types (`image`/`screenshot`/`document`) it shows a **dashed "Upload" button**.
  - `ProofReviewSection` (reviewer) — shows the text/link content; for binary it
    shows the literal placeholder **"Binary file attached"**.

## 2. What works today
- **Text and link proof** end-to-end (typed): assignee types → submits → state
  `submitted`; reviewer reads the content → approve/reject; reject stores a
  `rejectionNote` and the assignee can resubmit.
- The **state machine** (assigned/submitted/approved/rejected) is real, simple,
  and already drives Today/Tasks/review surfaces.
- The **definition fields** (requiresProof/proofType/reviewerRole) and the
  **persistence shape** (proof_content/rejection_note columns) already exist in the
  scaffolding, so wiring is mostly additive.

## 3. What is fake / mock / incomplete today
- **No real file or photo capture or upload.** The "Upload" button has **no
  `onPress`** — it does nothing. No image picker, no document picker.
- **Binary proof is a placeholder.** Nothing is stored or shown; the reviewer sees
  "Binary file attached" text, not an actual image/file.
- **`proofContent` is a single text string** — there is no attachment URL/path,
  filename, mime type, or size anywhere in the model.
- **No Supabase Storage** usage at all; `taskService.ts` is groundwork, **not
  called by any screen** — tasks still come from `mockTasks.ts` + `devTaskStore`.
- `proofType` values (`image`/`screenshot`/`document`) don't map cleanly to the
  requested v1 set (`photo`/`file`).

**Bottom line:** text/link works; photo/file is entirely cosmetic.

## 4. Recommended minimal data model (v1)
Keep it to **one attachment per submission**, reusing the existing interaction-state
row — **no new table** in v1.

**Normalize `ProofType`** to the requested set:
```
ProofType = 'text' | 'photo' | 'file' | 'link' | 'any'
```
(map legacy `image`/`screenshot` → `photo`, `document` → `file`; `any` lets the
assignee choose one of text/photo/file/link at submit time.)

**Add to the task interaction state** (StoredTask + the `tasks` table columns):
| Field | Type | Notes |
|-------|------|-------|
| `proofContent` | text | **existing** — used for text proof, link URL, or a caption |
| `proofAttachmentPath` | text \| null | Storage object path (NOT a public URL) |
| `proofAttachmentKind` | `'photo' \| 'file' \| 'link'` \| null | what was submitted |
| `proofAttachmentName` | text \| null | original filename (display) |
| `proofAttachmentMime` | text \| null | e.g. `image/jpeg`, `application/pdf` |
| `proofAttachmentSize` | int \| null | bytes (for limits/display) |

- A **link** stores its URL in `proofContent` (kind=`link`), no storage object.
- **One attachment max** — these are scalar columns, which structurally enforces the
  single-attachment rule and keeps v1 trivial.
- **State machine unchanged** — the attachment is just data on the submission; we add
  **no new states**. `assigned → submitted → approved | rejected` stays as-is.
- **Evolution path (deferred):** when multiple attachments / versioning land, move
  these columns into a `task_submissions` (or `task_attachments`) child table keyed
  by `task_id`. v1 columns map 1:1 to the first row of that table later.

## 5. Should Supabase Storage be used?
**Yes** — for photo/file. It's the right primitive and matches the existing
Supabase auth/RLS model.
- **One private bucket**, e.g. `task-proofs` (NOT public).
- **Object path embeds org + task** for isolation + policy checks:
  `task-proofs/{org_id}/{task_id}/{uuid}.{ext}`.
- Store the **path** in `proofAttachmentPath`; generate **short-lived signed URLs**
  on read (reviewer view). Never store a public URL.
- Client-side **compress/resize photos** before upload to control size/cost.
- Links use no storage; text uses no storage.

## 6. RLS / storage policy requirements (to design when approved — not now)
- **Bucket = private.** Access only via policies + signed URLs.
- **Upload (INSERT):** allow only an authenticated member of `org_id` (ideally the
  task's assignee) where the **first path segment = their org_id**
  (`storage.foldername(name)[1] = org_id`) and they belong to that org.
- **Read (SELECT / signed URL):** allow the **assignee + the reviewer role +
  officers of the same org**; enforce org isolation via the path's `org_id` segment
  and a membership check. No cross-org reads.
- **Replace/Delete:** v1 — allow the **assignee to overwrite their own attachment
  while the task is `assigned`/`rejected`** (i.e. before/after a rejection, to
  resubmit); deny once `approved`. Keep delete minimal.
- **`tasks` table RLS** (proposal) already row-scopes by org; the new proof columns
  inherit that. The proof-attachment columns need the **assignee** able to write
  them on submit and the **reviewer** able to read them — same shape as today's
  `proof_content`/`state` writes.
- All of this is an **approved schema/RLS/storage checkpoint later** — explicitly
  out of scope for this planning pass.

## 7. UI flow — assignee submission
1. Task detail shows **"Proof required: <type>"** (Photo / File / Link / Text / Any).
2. Input by type:
   - **Text** → multiline textarea (today's behavior).
   - **Link** → URL field (today's behavior).
   - **Photo** → "Take photo / Choose from library" (expo-image-picker).
   - **File** → "Choose file" (expo-document-picker; pdf/doc/image).
   - **Any** → a small chooser (Text / Photo / File / Link), then the matching input.
3. After picking a photo/file: show a **preview/thumbnail + filename + Remove**
   (one attachment max; picking again replaces it). Optional caption → `proofContent`.
4. **Submit** → upload the attachment (progress indicator) → on success set state
   `submitted` and store path + metadata. If upload fails, **stay `assigned`** and
   show an error (never mark submitted without the file).
5. Submitted state is read-only ("Pending review"). On **reject**, show the
   reviewer's note and allow **resubmit** (replace attachment → back to `submitted`).

## 8. UI flow — reviewer
1. Reviewer opens a `submitted` task → **Proof review** section renders by kind:
   - **Photo** → inline image (signed URL) + tap to enlarge.
   - **File** → filename + "Open / Download" (signed URL).
   - **Link** → tappable URL.
   - **Text** → inline text.
2. **Approve** → state `approved` (proof accepted).
3. **Reject** → enter a rejection note (recommended) → state `rejected`; assignee
   resubmits. (Reuses today's `rejectionNote`.)
4. No new reviewer surface — this is the existing `ProofReviewSection`, upgraded to
   render real attachments instead of the "Binary file attached" placeholder.

## 9. Smallest implementation sequence (when approved)
1. **(Schema/storage checkpoint — separate approval)** add the proof-attachment
   columns to the `tasks` proposal; create the private `task-proofs` bucket + the
   §6 policies.
2. **Normalize `ProofType`** to `text|photo|file|link|any` in `mockTasks.ts`; map
   legacy values; update `PROOF_LABEL`/`PROOF_ICON`.
3. Add **`expo-image-picker`** + **`expo-document-picker`** (UI-only deps; pickers
   work in the flag-off sandbox even before storage exists — can mock the upload).
4. Add a thin **`proofStorage` service** (upload → returns path; getSignedUrl) in
   the same never-throws/no-op-when-unconfigured pattern as `eventService`.
5. Wire **`ProofSubmitSection`**: real picker, single-attachment state, real submit
   (upload then state change). Behind the scenes still works mock in the sandbox.
6. Wire **`ProofReviewSection`**: render photo/file/link/text via signed URL.
7. Extend **`devTaskStore` / `taskService`** to carry the new attachment fields
   (mirror the existing `proofContent`/`rejectionNote` plumbing).
8. **Verify on alpha** after the schema/storage checkpoint is approved + applied.

## 10. Risks & what to defer
**Risks to manage:**
- **Storage cost/abuse** → enforce a **max file size** + allowed mime types; single
  attachment; compress photos client-side.
- **Failed/slow uploads** → never mark `submitted` until upload succeeds; show
  progress + retry; handle offline.
- **Signed-URL expiry** → generate on demand; don't cache long-lived URLs.
- **Privacy** → strip/avoid EXIF GPS on photos where feasible; private bucket only.
- **Org isolation** → path must embed `org_id`; policies validate it (a leak here is
  a hard blocker, mirroring the alpha rule).

**Explicitly deferred (NOT v1):**
- Multiple attachments per submission.
- Comments/clarification threads **with** attachments (ties to backlog #9
  action-linked communication).
- Versioning / submission history / audit of replaced files.
- Folders / a file library / browsing past proofs.
- Third-party integrations (Google Drive, Dropbox), video, virus scanning.
- Any new task states — the machine stays `assigned/submitted/approved/rejected`.

---

### Guardrails
Planning only. No code, no schema, no Supabase Storage/RLS, no EAS changes. The
storage + RLS + schema work is a **separate, explicitly-approved checkpoint**;
this document only specifies it.
