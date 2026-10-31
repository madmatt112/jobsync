# Adversarial Analysis — mcp-write-tools/requirements (v2)

Round 2. Primary surface: completeness, ambiguity, scope. Fresh lens:
testability and mechanical verifiability of each acceptance criterion.
Deltas attacked first (per the prompt there is no v1 checkpoint commit, so the
deltas are reconstructed from the v2 Revision History: R1-1..R1-5 responses).

## What I checked and how

- Read target v2, `codebase-context.md`, the v1 memory file and the v1
  analysis.
- Re-verified every citation the v2 lint pass touched, both ends of range:
  `saveMatchResult.ts:18,26-38,67-70,86-108` (rate-limit-then-SCORES order),
  `coverLetter.actions.ts:11,79-81,97-104,194-205`,
  `route.ts:84-93,189-210,194-200,240-266`,
  `updateJobFromNames.ts:55-57,67-70,129-152,183-194`,
  `addJob.ts:27-30,57-78`, `findJob.ts:46-63`,
  `mcp.schema.ts:245-286` (jobId describe at :250),
  `jobQuery.ts:218-232,309,311-324`, `getJob.ts:78,89`,
  `coverLetterTitle.ts:7-20` → `resumeCopyTitle.ts:29-42`,
  `prisma/schema.prisma:71-77,96-105`, `wiki/mcp.md:74,101,121`,
  and the whole of `ProfileContainer.tsx`.
- Confirmed the v2 fixes that landed cleanly:
  - R1-1: R4 AC9 + D10 pin the wire contract (required `jobId` string,
    required non-empty `text`; router Zod before handler per `route.ts:84-93`;
    trim-then-compare in the handler after the rate-limit unit, matching
    `saveMatchResult.ts:18,26-38`). Sound and consistent.
  - R1-2 (transaction / orphan Profile half): Reliability NFR now names the
    orphan `Profile` row and the missing `Profile.userId` unique constraint
    (`schema.prisma:71-77` confirms no `@unique`). Accurate.
  - R1-4: R7 AC2 / D6 correctly scope the no-break guarantee to front-indexed
    parsers; `formatJobRow` (`jobQuery.ts:311-324`) ends with the origin label
    at :322, so a from-end reader now reads `added`. Accurate.
  - Tool-count arithmetic (R3 AC4): `wiki/mcp.md:74` currently reads "Twelve.
    Nine … write … three read"; +`save_cover_letter` → thirteen / ten / three.
    Correct.
- Testability lens, criterion by criterion: the gate-removal ACs (R1 AC5, R2
  AC3) are mechanically testable against the existing `where`-clause assertions
  (`updateJobFromNames.spec.ts:78,87`, `saveMatchResult.spec.ts:47,244`); the
  row-format ACs (R7 AC1-3) are exact-string testable; R4 AC2 pins the renderer
  to `coverLetter.actions.ts:11` (`{html:false,linkify:false,breaks:true}`).
  Two criteria resist mechanical verification — see R2-1 and R2-3.

## Findings

### R2-1 — R5 AC3 claims a paginated Profile list that does not exist — MUST_FIX (Compounds R1-3; fix-induced)

The v2 fix for R1-3 reworded R5 AC3 to:

> "… SHALL appear in that list, which pages the caller's letters newest-first,
> so a version falls on a later page only once the earlier pages are full
> (`src/components/profile/ProfileContainer.tsx:80`)."

The cited behaviour is false. `ProfileContainer.tsx`:
- `loadCoverLetters` (lines 79-90) calls `getCoverLetterList(1, 100)` — a
  **hardcoded page 1, limit 100**. It takes no page argument.
- `loadDocuments(page)` (104-111) forwards `page` only to `loadResumes`;
  `loadCoverLetters()` is called with no argument every time.
- `setCoverLetters(data)` (line 85) **replaces** the array — it never appends.
- The "Load More" button renders only `if (resumes.length < totalResumes)`
  (line 275) — gated on **resumes**, not cover letters — and clicking it
  re-fetches the same page-1/limit-100 cover letters.

So the Profile cover-letter list shows at most the 100 newest cover letters,
with no mechanism to reach the rest. A version beyond the newest 100 does not
"fall on a later page"; it never appears in this list at all.

Failure scenario: an agent redrafts a letter 101 times (R5 AC4 stores every
save as a new version with no dedup). The oldest version — a letter the user
wrote and liked, the exact thing R5 exists to protect — drops off the only
Profile list that shows it. The user cannot see or select it there.

Per the standing directive, a misstated artifact (wrong cited behaviour) is an
automatic MUST_FIX, and the cited line `:80` refutes the claim rather than
supporting it. Restate AC3 to the truth: the Profile list shows the newest 100
versions (`getCoverLetterList(1,100)`, replace-not-append, Load More gated on
resumes); older versions remain in the DB and reachable through the job's Cover
Letter tab / `get_job`, but not through the Profile list. Decide whether the
100 cap is acceptable or needs a real pager before claiming pagination.

### R2-2 — R4 AC5's no-profile analog cannot surface the letter id the flow needs — SHOULD_FIX (Compounds R1-2; fix-induced)

The v2 fix for R1-2 reworded R4 AC5 to create the profile "by nested write
inside the transaction of criterion 1, the way `createCoverLetter`'s no-profile
branch creates it (`coverLetter.actions.ts:97-104`)." That branch is:

```
prisma.profile.create({ data: { userId, coverLetters: { create: [{ title, content }] } } })
```

Two problems the delta introduced:
1. That code creates the Profile **and** a nested CoverLetter in one write — it
   never creates an empty Profile. AC1 separately says "create a CoverLetter row
   in it." Followed literally on the no-profile path, the nested write plus
   AC1's create yields **two** letters, or forces an undocumented deviation from
   the cited analog.
2. `createCoverLetter` returns the Profile (`res`), not the letter — the nested
   letter's id is never exposed (no `include`). But AC1 must set
   `job.coverLetterId` to "the new row" and AC6 must report "the letter id."
   An implementer copying `:97-104` as instructed has no letter id to repoint
   with. The flow is unimplementable "the way `:97-104` does it."

`generateCoverLetterForJob`'s transaction (`:194-205`) creates the letter
first (so `letter.id` is in hand) then repoints — but it assumes a profile
already exists (`:177-179` throws otherwise). Neither cited analog composes
cleanly with the no-profile case. State the actual no-profile sequence: create
the Profile (empty or with `include`), obtain the new letter's id, repoint —
all in the one transaction — rather than deferring to `:97-104`, which cannot
yield the id.

### R2-3 — R4 AC4's min-length rejection has no testable error string — MINOR (Compounds R1-5; fresh lens)

R4 AC4 requires the handler to "return a validation error and write nothing"
when trimmed `text` is shorter than `MIN_COVER_LETTER_CHARS`
(`constants.ts:98` = 10). Under the testability lens this criterion is only
half-verifiable: "write nothing" is testable, but the error string is unpinned,
so a test cannot assert the message the agent sees. Every sibling rejection has
a fixed string — scope (R6 AC1), rate limit (R6 AC2), SCORES-parse
(`saveMatchResult.ts:28-37`) — and R4 AC8 at least says its not-found string is
"pinned in design." AC4 says nothing. Either pin the string or state it is
deferred to design, as AC8 does, so the three min-length clauses (AC4, the
router Zod non-empty check in AC9, the success line AC6) are mutually
determined and each is assertable.

## Top risks

1. R2-1 — the one MUST_FIX: a false claim about cited UI behaviour that also
   hides the exact content R5 is meant to protect. Highest correctness risk.
2. R2-2 — the no-profile path is specified by an analog that cannot return the
   letter id the transaction and reply both need; a literal implementer is
   blocked or writes two letters.
3. R2-3 — one acceptance criterion with no assertable outcome string (minor,
   folds into the AC8 design pin).

## Top conclusions to challenge

1. "which pages the caller's letters newest-first, so a version falls on a
   later page" (R5 AC3) — reverse it: the Profile list does not page cover
   letters; it loads one fixed window of 100 and replaces it. Say the cap.
2. "the way `createCoverLetter`'s no-profile branch creates it" (R4 AC5) — that
   branch returns the Profile, not the letter, and bundles a letter AC1 also
   asks for. Do not anchor the no-profile create to `:97-104`.
3. R5 AC2 "its title SHALL be unique among the caller's letters" — still a
   best-effort SHALL: `CoverLetter.title` has no DB unique constraint
   (`schema.prisma:96-105`) and the uniqueness read is outside the write
   transaction (Performance NFR). Carried from v1; concurrent saves can still
   collide. Qualify or accept.

## What's missing before acting

- A truthful statement of the Profile list's 100-version cap (R2-1) and a
  decision on whether that cap is acceptable for redraft history.
- The concrete no-profile sequence that yields the new letter's id for repoint
  and reply (R2-2).
- A pinned or explicitly-deferred min-length error string (R2-3).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
