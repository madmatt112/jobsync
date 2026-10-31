# Adversarial Analysis — mcp-write-tools/requirements (v4)

Round 4. Primary surface: completeness, ambiguity, scope. Fresh lens: security
and abuse of `save_cover_letter` — multi-tenant ownership isolation, `jobs:write`
scope enforcement, rate-limit evasion, cross-user id confusion.

No v3 checkpoint commit exists (prompt `## Changes` section), so the v4 deltas
are reconstructed from the v4 Revision History: the R3-1, R3-2, R3-3 responses,
touching R5 AC3, R5 AC2 and R6 AC3.

## Deltas attacked first (v4 fixes), both ends of every range re-read

- **R3-1 fix (R5 AC3)** — accurate, falsehood resolved. The clause now reads a
  version past the newest 100 is retained (criterion 1) but "surfaced by no read
  surface": the Profile list caps at newest 100, and the Cover Letter tab and
  `get_job` show only `job.coverLetterId`. Verified: `ProfileContainer.tsx:79-90`
  is `getCoverLetterList(1, 100)` + `setCoverLetters(data)` (replace); `:275`
  gates Load More on `resumes.length < totalResumes` (resumes, not letters);
  `JobDetails.tsx:310` (within cited 306-315) passes `letter={job.CoverLetter}`;
  `getJob.ts:89` prints the single `job.CoverLetter`. "Consistent with R4
  criterion 7" now holds — both pin `get_job` to the newest letter. The R3-1
  contradiction is gone.
- **R3-2 fix (R5 AC2)** — accurate. AC2 now cross-references R4 AC3's
  `buildCoverLetterTitle` path and states no second uniquify step. Verified
  `coverLetterTitle.ts:19` returns `ensureUniqueTitle(base, takenTitles)` and
  `resumeCopyTitle.ts:29-42` is the `" (2)"/" (3)"` suffix loop. One operation,
  no double-spec.
- **R3-3 fix (R6 AC3)** — enumeration broadened to name the title-uniqueness read
  and the new-row write alongside job and profile. Substantively correct, but the
  broadening introduced an imprecision — see R4-1.

Two of three fixes are clean. The third is sound in intent but mis-frames the
new-row write (R4-1).

## Fresh lens: security / abuse — what I checked and how

All ownership scoping is grounded and correct; no hole found.

- **Scope gate.** `save_cover_letter` is specified behind `jobs:write` (R4 AC9, R6
  AC1) using the exact string `route.ts:194-200` returns. D3's claim "every token
  already carries `jobs:write`" is true: `mcpToken.actions.ts:46` issues
  `["jobs:write","jobs:read",...]`, and `auth.ts:44-47` confirms `jobs:write` is
  the oldest scope (pre-dates `jobs:read`), so no live token lacks it. A
  `jobs:read`-only token is correctly refused. Clean.
- **Rate limit / evasion.** `checkMcpRateLimit` (`rate-limit.ts:23-48`) is keyed
  by `userId`, so multiple tokens of one user share one bucket — minting tokens
  cannot evade it. R6 AC2 ("exactly one unit") matches the single entry call the
  other handlers make (`saveMatchResult.ts:18`, `getJob.ts:160`). No batch form
  of `save_cover_letter` exists (scope notes exclude it), so no batch
  amplification. Clean.
- **Cross-user id confusion / indistinguishability.** R4 AC8 returns the shared
  job-not-found phrasing for both a foreign id and a missing id and writes no
  row. The repoint is `job.update` scoped `{ id, userId }`; a foreign/missing id
  yields P2025 inside the one transaction, which both maps to the shared string
  (the established pattern — `updateJobFromNames.ts:67-70` up-front check +
  P2025 mapping) and rolls back the profile/letter creates. The Reliability NFR
  explicitly guarantees no orphan `Profile`, no orphan `CoverLetter`, no
  repointed job on failure. So a foreign id leaves no attacker-owned empty
  Profile. Clean.
- **Content safety.** R4 AC2 stores `md.render(text)` with `html:false`
  (`coverLetter.actions.ts:11`) — identical to the in-app generator, displayed in
  the same tab via `TipTapContentViewer`. The external agent's text goes through
  the same escaping as app-generated letters; the stored shape is unchanged, and
  content only ever displays to the same self-hosted user (D1). No new XSS
  surface. Clean.
- **Letter-id injection.** `save_cover_letter` takes only `jobId` and `text` (R4
  AC9) and always creates a fresh row; there is no caller-supplied `coverLetterId`
  to point a job at a foreign letter. Clean.

## Findings

### R4-1 — R6 AC3 (and the Security NFR) demand a `userId` `where` on the "new-row write," but that write is a `create`, which has no `where` — MINOR (Compounding R3-3; fix-induced)

The R3-3 fix added "the new-row write" to R6 AC3's list and kept the predicate
"its Prisma `where` SHALL include the caller's `userId`, directly or through the
profile relation." The new-row write is `coverLetter.create` (analog
`coverLetter.actions.ts:195-197`: `tx.coverLetter.create({ data: { profileId,
title, content } })`) — a `create` has no `where`; its ownership comes from
`data.profileId` referencing the caller's owned Profile. The no-profile case (R4
AC5) adds a second where-less write, `profile.create({ data: { userId } })`.
Applying a "Prisma `where` SHALL include `userId`" requirement to a `create` is
incoherent for the one operation the fix was added to cover. The Security NFR
("Ownership is enforced in every Prisma `where`") carries the same blind spot:
its universal `where` framing cannot describe the two creates.

Not a hole: R4 AC1/AC5 already mandate the correct behaviour ("find or create the
caller's Profile … create a CoverLetter row **in it**"), so the creates land in
the owned profile regardless. The defect is precision — a reviewer verifying
"userId in every `where`" would inspect the two reads and the repoint update and
sign off without ever checking that the create's `profileId` came from a
`userId`-scoped profile lookup, because there is no `where` to inspect. Fix:
state that the two `create` operations establish ownership through the owned
Profile / `userId` in `data`, while the scoped reads and the repoint carry
`userId` in `where`. Does not keep the loop alive.

## Top risks / gaps

1. R4-1 (MINOR) — the only finding. R6 AC3 and the Security NFR express ownership
   isolation as a `where`-clause invariant, which structurally cannot describe
   the two `create` writes the handler performs; redundant with R4 AC1/AC5, so no
   behavioural risk, only an imprecise/unverifiable security requirement.
2. Fresh security lens otherwise clean — scope gate, per-user one-unit rate
   limit, cross-user indistinguishability + transactional rollback, and reused
   content escaping are all grounded and correct.
3. Nothing else: the three v4 deltas are substantively accurate and every cited
   artifact in them was re-read at both ends.

## Top conclusions to challenge or reverse

1. R6 AC3's "its Prisma `where` SHALL include the caller's `userId` … [for] the
   new-row write" — reverse the framing for creates: the CoverLetter create and
   the no-profile Profile create own their rows through `data` (`profileId` /
   `userId`), not a `where`.
2. The R5 AC3 reachability rewrite is correct and R3-1 is fully resolved — do not
   re-open; the only remaining cover-letter-surface claim worth stating plainly
   is already stated ("surfaced by no read surface", consistent with R4 AC7).
3. Carried (v1/v2): R5 AC2 title uniqueness stays best-effort — no DB unique on
   `CoverLetter.title` (`schema.prisma:96-105`), titles read outside the write
   transaction (Performance NFR). Unchanged, no new evidence; raise only as
   carried.

## What's missing before acting

- A one-line precision edit to R6 AC3 / Security NFR so the ownership guarantee
  covers the two `create` writes by their `data` link, not only `where` clauses.
  Everything else needed for design is present; this is a wording tidy-up, not a
  blocker.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
