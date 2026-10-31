# Adversarial Analysis — mcp-write-tools/design (v2)

Round 2. Primary surface: feasibility, consistency, edge cases.
Fresh lens: failure modes and concurrency (transaction atomicity, partial-write
rollback, races in the cover-letter and ownership paths).

## Deltas attacked first

v2 Revision History records two code-affecting changes: R1-1 accepted (e2e now
seeds a resume + enriches the job before the re-score read) and R1-2 accepted
(title-only note reworded for rescore). R1-3 rejected (closed). I attacked the
R1-1 fix diff against its requirement (R8 AC4 e2e must emit a directive) as a
fix-induced re-check, then applied the concurrency lens to C3/C1.

## What I checked and how

- **R1-1 fix (e2e), both legs.** `matchDirective.ts` (buildMatchOffer gate order:
  `title-only` short-circuit at :63-72 runs *before* `preprocessJob`),
  `descriptionCompleteness.ts:12-19` (word-count classifier),
  `constants.ts:157-158` (`DESCRIPTION_PARTIAL_MIN_WORDS=40`,
  `DESCRIPTION_FULL_MIN_WORDS=150`), `preprocessing-job.ts:37,112`
  (`MIN_CHAR_COUNT=200`), `preprocessing.ts:45,261-309` (resume floor 200,
  `preprocessText`→`preprocessResume`), `preprocessing.ts:97-256`
  (`convertResumeToText`), `e2e/automations.spec.ts:9-80`
  (`createResumeForMatching` content), `resumeUpload.ts:12-71` /
  `resume.ts:139-141` (`createResume` seeds no ContactInfo),
  `resumeLookup.ts:44-90` (resolve order), `e2e/fixtures.ts:70-136`
  (`createNewJob` fills "test description", no resumeId link).
- **R1-2 fix.** matchDirective.ts:63-72 note text — reworded clause verified; the
  R1-2 ruling is closed, not re-opened.
- **Concurrency lens.** `coverLetter.actions.ts:11,150-212` (template renders
  markdown *before* the transaction; `generateCoverLetterForJob` throws on no
  profile, never creates), `schema.prisma:71-77,96-105` (Profile.userId NOT
  unique; grep of all `@unique`/`@@unique` confirms none on Profile),
  `resumeUpload.ts:39-71` + `createCoverLetter:83-104` (pre-existing
  findFirst→create-profile race), `updateJobFromNames.ts:177-207` (documented
  SQLite write-lock norm + P2025 mapping), `getJob.ts:48-184`
  (`renderDetail` already reads `job.descriptionCompleteness`, so C7's
  `job.descriptionCompleteness` arg is grounded).
- **Data Models / Error-branch directives.** Offer type `{kind,text}` is fully
  enumerated, not union-arms-only — no MUST_FIX. MCP tool results are text
  content, not HTTP responses, so the "response status code" half of the
  error-branch directive does not map to this artifact; the P2025 race-loser
  pins its discriminant (P2025) and its text (JOB_NOT_FOUND_MESSAGE).

Every path, range and value the v2 delta cites is accurate; no misstated
artifact. The defect is behavioral, in the e2e preconditions.

## Findings

### R2-1 — MUST_FIX — Recurring (Compounds R1-1), fix-induced — the v2 e2e still cannot emit the directive it asserts

The R1-1 fix (design line 170) set out to make the `get_job matchDirective: true`
re-score return a directive. It still returns a **note** on two independent legs,
so the only end-to-end check of R8 AC4 asserts output the steps cannot produce —
the exact defect R1-1 raised.

- **Leg A — wrong job gate.** The fix pins "`update_job` with a posting over the
  `preprocessJob` char floor (`preprocessing-job.ts:112`) so the stored
  description scores." But `buildMatchOffer` step 1 short-circuits to the
  title-only note whenever `completeness === "title-only"`, and completeness is
  set by `classifyDescriptionCompleteness` — a **word count** with
  `DESCRIPTION_PARTIAL_MIN_WORDS = 40` (`constants.ts:157`) — which runs *before*
  `preprocessJob` is ever reached. The 200-char `MIN_CHAR_COUNT` floor is not the
  scoring gate. A posting of ~200-228 chars is ~30-35 words (< 40) → stored
  `title-only` → `get_job` rescore returns the note, not a directive. The pinned
  invariant ("over the char floor … so the stored description scores") is a false
  statement of the code's behavior.

- **Leg B — unmatchable seeded resume.** The fix seeds the resume with
  `createResumeForMatching` (`e2e/automations.spec.ts:9`). That helper fills only
  a one-sentence Summary ("Experienced full stack engineer.") and one
  Certification (title + organization); `createResume` seeds no ContactInfo
  (`resumeUpload.ts:12-71`). `convertResumeToText` therefore yields ~130 chars,
  under `preprocessResume`'s `MIN_CHAR_COUNT = 200` (`preprocessing.ts:45`). So
  `buildMatchOffer` step 4 `preprocessResume` returns TOO_SHORT → the
  "resume couldn't be used for matching" note, not a directive. The helper was
  built for the automation **selection dropdown** (its own comment: the 2-section
  rule is `MIN_RESUME_SECTIONS_FOR_SELECTION`), not to clear the matching floor;
  the design cites it as if its name guaranteed a matchable resume.

Either leg alone yields a note; both are present. R1-1 was SHOULD_FIX and is
Recurring unresolved → escalated to MUST_FIX, and it is fix-induced (the v2 delta
wrote both faulty preconditions).

Fix: the e2e must (A) send a description of ≥ 40 words (≥ 150 for a no-warning
"full" directive), not merely > 200 chars, and (B) seed a resume whose serialized
text clears 200 chars — add real sections/content, or assert against a fuller
resume fixture — before the `matchDirective: true` read.

### R2-2 — SHOULD_FIX — Novel (fresh lens: concurrency) — profile find-or-create race in the cover-letter transaction

C3 step 3b runs `tx.profile.findFirst({ where: { userId } })` then, when null,
`tx.profile.create({ data: { userId } })`. `Profile.userId` has **no** unique
constraint (`schema.prisma:71-77`; no `@unique`, no `@@unique` on Profile — grep
of the whole schema confirms). `checkMcpRateLimit` is a synchronous check-then-act
on a shared per-user bucket, so two concurrent `save_cover_letter` calls can both
pass, both read a null profile, and both create a Profile row — duplicate
profiles for one user. The transaction template the design cites,
`generateCoverLetterForJob`, deliberately does **not** create a profile (it
throws "No profile found", `coverLetter.actions.ts:173-179`); C3's find-or-create
is a new write path. Error Handling enumerates the P2025 race-loser but not this
one, and D12/D13 reason about atomicity and ownership while omitting it.

Mitigating context (so this need not be a code change): the same
findFirst→create-profile race pre-exists in `createResume` (`resumeUpload.ts:39-71`)
and `createCoverLetter` (`:83-104`), and `getCoverLetterList` filters through
`profile: { userId }`, so letters stay visible even if split across two profiles —
no data loss, a latent wrinkle. The gap is that the design claims to have reasoned
about the transaction's failure modes yet leaves this one unstated. Resolve by
stating the assumption (a profile is expected to exist / the race is tolerated as
elsewhere) or by a unique constraint — but note "No schema change and no
migration" forecloses the clean fix, so the honest move is to document it.

### R2-3 — MINOR — Novel (fresh lens) — markdown render inside the write-lock transaction

C3 step 3e evaluates `md.render(markdown)` as the `content` argument *inside* the
`prisma.$transaction`, holding SQLite's single-writer lock during CPU-bound
rendering. The cited template renders outside the transaction
(`coverLetter.actions.ts:192`, before the `$transaction` at `:194`), and
`updateJobFromNames.ts:177-178` states the explicit norm: do not run independent
work while the transaction holds SQLite's write lock. The render needs only
`input.text`, available before step 3. Move it ahead of the transaction. MINOR —
the render is fast and contention is small — but it contradicts a documented
codebase rule the design otherwise follows.

## Top risks / gaps

1. **R2-1** — the R8 AC4 end-to-end verification is still non-executable; the v2
   fix named the wrong job gate (char floor vs 40-word classifier) and seeded a
   ~130-char resume under the 200-char match floor. Both emit a note.
2. **R2-2** — an unconsidered concurrency race creates duplicate Profile rows;
   bounded harm, but absent from a design that otherwise enumerates its
   transaction failure modes.
3. **R2-3** — needless write-lock hold during markdown render, against the
   codebase's own documented rule.

## Top 3 conclusions to challenge or reverse

1. **"a posting over the `preprocessJob` char floor … so the stored description
   scores" (e2e).** Reverse: the scoring gate is the 40-word
   `DESCRIPTION_PARTIAL_MIN_WORDS` classifier that runs first, not the 200-char
   floor. 200 chars ≈ 30-35 words → title-only → note (R2-1 Leg A).
2. **"seed a resume … with `createResumeForMatching` … so `resolveResumeForAgent`
   resolves the only resume" (e2e).** Resolving is necessary but not sufficient:
   step 4 `preprocessResume` still runs and rejects the ~130-char resume, so the
   offer is a note regardless of resolution (R2-1 Leg B). The design verified the
   resolve path but not the preprocess floor.
3. **"the create-then-repoint transaction … rolls back cleanly" (D12).** True for
   job deletion (P2025), but the transaction's *own* profile create has no
   uniqueness guard and no rollback story for a concurrent duplicate — the
   atomicity argument does not cover the one new write the design adds (R2-2).

## What's missing before acting

- Make the e2e emit a real directive: pin a ≥ 40-word (ideally ≥ 150-word)
  `update_job` description and a resume that serializes to ≥ 200 chars (R2-1).
- One sentence on the profile-create race — tolerate-as-elsewhere or guard it
  (R2-2).
- Move `md.render` out of the transaction, matching the cited template (R2-3).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
