# Adversarial Analysis — mcp-write-tools/requirements (v3)

Round 3. Primary surface: completeness, ambiguity, scope. Fresh lens:
internal consistency across R4 (save), R5 (versioning) and R6
(scope/rate-limit/ownership) — contradictions, double-counting, gaps.
No v2 checkpoint commit exists (prompt `## Changes` section), so the deltas are
reconstructed from the v3 Revision History: the R2-1, R2-2, R2-3 responses.

## Deltas attacked first (v3 fixes)

The v3 delta touched three clauses. I re-verified each against source, both
ends of every cited range:

- **R2-1 fix (R5 AC3)** — the new Profile-list citations are accurate.
  `ProfileContainer.tsx:79-90` is `getCoverLetterList(1, 100)` with
  `setCoverLetters(data)` replacing (not appending); `:275` gates "Load More" on
  `resumes.length < totalResumes`. `getCoverLetterList` (coverLetter.actions.ts:13-55)
  orders `createdAt: "desc"` take 100, so "newest 100" is correct. The
  pagination falsehood R2-1 flagged is gone. **But the replacement sentence
  introduced a new false claim — see R3-1.**
- **R2-2 fix (R4 AC5)** — accurate. The no-profile sequence now reads
  create-empty-profile → create-letter → repoint, in one transaction, following
  `generateCoverLetterForJob`'s transaction (`coverLetter.actions.ts:194-205`:
  `tx.coverLetter.create` then `tx.job.update … coverLetterId: letter.id`,
  returns the letter). It correctly rejects `createCoverLetter`'s bundled nested
  write (`:97-104` returns the profile `res`, hides the letter id) and its
  title throw (`:79-81`). The id-in-hand defect R2-2 raised is resolved.
- **R2-3 fix (R4 AC4)** — accurate. AC4 now says its validation-error string is
  "pinned in design, as the not-found string of criterion 8 is," and the
  handler trim-then-compare after the rate-limit unit matches
  `saveMatchResult.ts:18` (rate limit) → `:26-38` (SCORES check). Assertable.

Two of three deltas are clean. The R5 AC3 delta fixed one falsehood and wrote
another.

## What else I checked and how

- Read `codebase-context.md`, the v2 memory file, the v2 analysis.
- Title path: `buildCoverLetterTitle` (coverLetterTitle.ts:7-20) **calls**
  `ensureUniqueTitle` (resumeCopyTitle.ts:19,29-42) internally, so R4 AC3 and R5
  AC2 describe one operation, not two conflicting ones — no contradiction (see
  R3-2, a minor double-spec note).
- get_job / Cover Letter tab surfaces: `getJob.ts:12-19,89` selects and prints
  the single `job.CoverLetter`; `JobDetails.tsx:310` passes `job.CoverLetter`;
  `CoverLetterTab.tsx:16-60` renders the one `letter`. All three show only the
  letter `job.coverLetterId` points at — the newest after a redraft.
- Validation split (R4 AC4 / R4 AC9 / D10) and rate-limit order (R4 AC4 / R6
  AC2): the Zod non-empty check at the router rejects `""` without a rate-limit
  unit; the handler min-length check consumes a unit first, like
  `save_match_result`. Intentional, documented in D10, consistent. Not a finding.

## Findings

### R3-1 — R5 AC3 falsely claims old versions are reachable through the Cover Letter tab and get_job; contradicts R4 AC7 — MUST_FIX (Compounds R2-1; fix-induced; Compounding)

The v3 fix for R2-1 rewrote R5 AC3 to end:

> "… so a version past the newest 100 stays in the database and is reachable
> through the job's Cover Letter tab and `get_job` but not through this Profile
> list."

The "reachable through the job's Cover Letter tab and `get_job`" clause is a
false claim about codebase behaviour, and it contradicts R4 AC7.

Both surfaces show only the single letter `job.coverLetterId` points to:
- `get_job` includes `CoverLetter: { select: { id, title } }` (getJob.ts:19) and
  prints one line, `job.CoverLetter` (getJob.ts:89).
- The Cover Letter tab is wired to `job.CoverLetter` (JobDetails.tsx:310) and
  `CoverLetterTab` renders the one `letter` (CoverLetterTab.tsx:16-60,57).

Each `save_cover_letter` redraft creates a new row and repoints the job to it
(R5 AC1), so after a redraft `job.coverLetterId` points at the **newest**
version. A superseded version is referenced by no job (`_count.Job` = 0 in the
Profile list select, coverLetter.actions.ts:37-41). Therefore a superseded
version is shown by **neither** the tab **nor** `get_job` — those only ever show
the current/newest letter. If it is also past the newest-100 window, it is
reachable through **no** UI surface the spec names.

This directly contradicts R4 AC7, which the same document states:

> "WHEN `get_job` is called on that job after the save THEN it SHALL show the
> **new** letter's title and id."

R4 AC7 pins get_job to the newest letter; R5 AC3 claims get_job also surfaces
old versions. Both cannot hold.

Failure scenario — the exact case R5 exists to protect: a user hand-edits a
letter they like, then an agent redrafts the job 100+ times (R5 AC4: every save
is a new version, no dedup). The liked version is superseded (job points
elsewhere) and past the newest-100 Profile window. R5's user story promises the
rewrite "never destroys a letter I liked or edited" — the row survives (R5 AC1,
true), but the spec tells the reader it is recoverable via the Cover Letter tab
and get_job, which is false. It is recoverable only from the DB/export, not any
surface R5 names.

Per the standing directive a wrong-behaviour claim about a cited artifact is an
automatic MUST_FIX; this one also fails the fresh lens (R4↔R5 contradiction).
Fix: drop the tab/get_job reachability clause. State the truth — a superseded
version past the newest 100 is retained in the DB (R5 AC1) but is not surfaced
by the Profile list (100-cap), the Cover Letter tab or get_job, which show only
the job's current letter; recovery of such a version is out of scope, as D1
leaves erasure/recovery to the existing in-app model.

### R3-2 — R5 AC2 restates title uniqueness already guaranteed by R4 AC3 — MINOR (Novel; fresh-lens double-count)

R4 AC3 requires the title built by `buildCoverLetterTitle` from the job title,
company and "the caller's existing letter titles." `buildCoverLetterTitle`
(coverLetterTitle.ts:19) already applies `ensureUniqueTitle`, the `" (2)"/" (3)"`
suffix rule. R5 AC2 then separately requires the redraft title "SHALL be unique
… using the `" (2)"`, `" (3)"` suffix rule of `ensureUniqueTitle`." The two
criteria mandate the same single operation; R5 AC2 adds no behaviour over R4
AC3. Not a contradiction (both point at the same mechanism), but the
double-specification invites an implementer to read it as a second, separate
uniquify step. Fold R5 AC2 into a cross-reference to R4 AC3 or state plainly
that AC3's title is already unique. Does not keep the loop alive.

### R3-3 — R6 AC3 ownership enumeration is narrower than the handler's real queries — MINOR (Novel; fresh-lens gap)

R6 AC3 scopes ownership to "any query … [that] reads or writes **a job or
profile**." But the handler also **reads** CoverLetter rows for the title-
uniqueness window (R4 AC3; Performance NFR "one read of the caller's letter
titles") and **writes** a CoverLetter row (R4 AC1). Neither is literally "a job
or profile." In practice the title read is scoped `where: { profile: { userId } }`
and the write is created inside the owned profile, and the Security NFR
("Ownership is enforced in every Prisma `where`") covers them — so this is
wording, not a hole. Tighten R6 AC3 to name the CoverLetter read/write (or say
"every query the handler runs") so the enumeration matches the handler.

## Top risks

1. R3-1 — the one MUST_FIX: R5 AC3 misstates get_job / Cover Letter tab
   behaviour and contradicts R4 AC7, promising recoverability of the protected
   redraft history through surfaces that only show the current letter. Highest
   correctness risk; squarely the fresh-lens R4↔R5 contradiction.
2. R3-2 — title uniqueness specified twice (R4 AC3 and R5 AC2); redundant, risks
   a double-uniquify reading. Minor.
3. R3-3 — ownership NFR enumerates "job or profile" but the handler also
   reads/writes CoverLetter rows; covered by the Security NFR, wording only.

## Top conclusions to challenge

1. "reachable through the job's Cover Letter tab and `get_job`" (R5 AC3) —
   reverse it: both surfaces show only the job's current letter
   (`job.coverLetterId`); a superseded redraft is reachable through neither, and
   through nothing at all once it is past the newest-100 Profile window. R4 AC7
   already fixes get_job to the newest letter.
2. R5 AC2's independent uniqueness SHALL — it is already delivered by R4 AC3's
   `buildCoverLetterTitle`; the two should be one statement.
3. R5 AC2 title uniqueness remains best-effort (carried from v1/v2): no DB
   unique on `CoverLetter.title`, the titles read sits outside the write
   transaction (Performance NFR). Unchanged, still unqualified. Re-raise only as
   carried, not re-argued.

## What's missing before acting

- A truthful R5 AC3: superseded versions past the newest-100 window are retained
  (R5 AC1) but not surfaced by the Profile list, the Cover Letter tab or
  get_job; whether that is acceptable for redraft history, consistent with D1.
- Resolution of the R4 AC7 ↔ R5 AC3 contradiction over what get_job shows.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
