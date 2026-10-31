# Adversarial Analysis — mcp-write-tools/requirements (v1)

Round 1. Primary surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, input/response shapes, client state).
First review — no deltas to attack; whole document in scope against
decomposition entry 2.

## What I checked and how

- Read the target, `codebase-context.md`, and decomposition entry 2.
- Read both ends of every cited range:
  `updateJobFromNames.ts` (55-57, 67-70, 129-152, 183-207),
  `addJob.ts` (27-30, 54-78), `saveMatchResult.ts` (67-108),
  `saveMatchResultsBatch.ts`, `findJob.ts` (46-63),
  `coverLetter.actions.ts` (11, 62-111, 150-212), `coverLetterTitle.ts`,
  `resumeCopyTitle.ts` (29-42), `constants.ts:98`, `getJob.ts` (78, 89),
  `jobQuery.ts` (200-337, incl. `ROW_SELECT`, `formatJobRow`),
  `toolDescriptions.ts`, `mcp.schema.ts:245-286`, `route.ts` (189-312),
  `createJobFromNames.ts` (incl. `detectDuplicate`),
  `CoverLetterTab.tsx:1-60`, `ProfileContainer.tsx:79-86`,
  `prisma/schema.prisma:71-105`.
- Re-verified the citation-identifier warnings L-1..L-16: every flagged token
  is a registered MCP tool name, a Prisma model (`Profile`), or an
  enclosing/analog function whose load-bearing body is the cited range. All
  benign, as the Revision History records. No citation is misstated; no
  auto-MUST_FIX from artifacts.
- Scope check vs decomposition: the three in-scope items (gate removal on
  `update_job`/`save_match_result`, `save_cover_letter` with versions, the
  date-added row field) are all present; `set_status` is correctly excluded.
  No scope creep.

## Findings

### R1-1 — save_cover_letter input wire contract and validation boundary are unspecified — SHOULD_FIX

Every other tool is wired as `server.tool(name, description, InputShape, …)`
with a Zod `safeParse` at the router that returns `"Validation error: …"`
*before* the handler runs (`route.ts:84-93, 201-208`). The document specifies
`save_cover_letter`'s success line (R4 AC6), scope-refusal text (R6 AC1) and
rate-limit text (R6 AC2), but never defines the input contract: the field
names/types (`jobId`, `text`), nor where the `MIN_COVER_LETTER_CHARS` check
lives. R4 AC4 says "IF `text` trimmed is shorter than
`APP_CONSTANTS.MIN_COVER_LETTER_CHARS` THEN return a validation error" — but a
Zod `.min()` does not trim and fires at the router (no handler reached), while
a trim-then-compare must live in the handler. That placement decision is
load-bearing: it fixes the error string an agent sees and whether a rejected
call consumes a rate-limit unit. The in-repo precedent is split —
`saveMatchResult` rejects a bad SCORES line inside the handler *after*
consuming the limit (`saveMatchResult.ts:18,26-38`), whereas Zod parse errors
bypass the limit. Decide and state the parse-vs-handler split so R4 AC4, AC6,
AC8 and R6 AC2 ("exactly one unit") are mutually determined.

### R1-2 — no-profile path versus the "one transaction" and reliability guarantees — SHOULD_FIX

R4 AC1 requires create-letter + repoint-job "in one transaction"; R4 AC5
requires create-profile-if-none "as `createCoverLetter` does." These lean on
two functions that each do only half, and they do not compose:

- `generateCoverLetterForJob` (`coverLetter.actions.ts:150-212`) does the
  create+repoint transaction (194-205) but **throws** when no profile exists
  (177-179) — it never creates one.
- `createCoverLetter` (62-111) creates the profile via nested write (97-104)
  but **does not repoint the job** and does not wrap a job update in a
  transaction.

So "find-or-create profile, create letter, repoint job, atomically" is a new
composition neither analog demonstrates. The document never says whether the
profile creation sits inside the atomic unit. The Reliability NFR guarantees
"no orphan `CoverLetter` row and no repointed job" on failure but is silent on
an orphan empty `Profile` row — and `Profile.userId` carries no DB unique
constraint (`schema.prisma:71-77`; both call sites use `findFirst`), so a
create-profile path that runs outside the transaction (or concurrently) can
leave a stray or duplicate `Profile`. Failure scenario: a save fails after the
profile is created but before the job repoint → an empty `Profile` persists,
outside the stated guarantee. Specify that profile creation is inside the
atomic unit and extend the reliability guarantee to the `Profile` row, or
state the orphan is accepted.

### R1-3 — "every version SHALL appear" overstates a paginated list — MINOR

R5 AC3 cites `ProfileContainer.tsx:80` for "every version SHALL appear there."
That call is `getCoverLetterList(1, 100)` — page 1, limit 100, `createdAt`
desc (`coverLetter.actions.ts:13-55`). With enough redrafts, versions past 100
fall off page 1. The claim is true only within the paginated window. Low real
risk, but the absolute "every version" wording does not match the cited code.

### R1-4 — D6 "appended last" protects only front-indexed parsers — MINOR

R7 AC2/D6 justify appending `added` as the last row field "so a parser that
reads existing fields by position does not break." `formatJobRow`
(`jobQuery.ts:311-324`) currently ends with the origin label; a consumer
reading the *last* field (negative index) now reads `added …` instead of
origin. The rationale holds for front-indexed parsers only. The consumer that
motivates R7 (jobscout `expire-stale`) must change regardless (Scope note,
line 130), so the practical exposure is small, but the unqualified claim is
wrong for from-end parsers.

### R1-5 — minor completeness gaps — MINOR

- R3 AC4 requires the correct tool count in `wiki/mcp.md` (currently
  "Twelve", line 74) but not the adjacent "Nine of them write … and three
  read it back" split, which must become ten/three once `save_cover_letter`
  lands. Name it so the doc is internally consistent.
- R4 AC8 requires "one not-found text for both" cases but never pins the
  string, unlike the gate-removal tools whose not-found strings are fixed
  verbatim (R1 AC3, R2 AC4). Fine to defer, but note it is undefined.
- R7 AC1/AC3: `added` and `get_job`'s "Created" both slice `toISOString()`
  (UTC) via the same `day` helper, so AC3 holds; but a created-date *filter*
  that uses local-day boundaries could disagree with the UTC `added` label by
  a day. Pre-existing and inherited; flagging for awareness only.

## Top risks

1. R1-2 — the no-profile + transaction interaction and the orphan-`Profile`
   reliability gap. Highest rework risk; the two cited analogs actively
   mislead a literal implementer.
2. R1-1 — undefined input/validation boundary for the one genuinely new tool,
   on the exact lens (wire contracts) this round applies.
3. R1-3/R1-4 — two overstated invariants (`every version`, `position does not
   break`) that read as guarantees but are conditional.

## Top conclusions to challenge

1. "as `createCoverLetter` does" (R4 AC5) — reverse the framing: the primary
   analog for the whole flow is `generateCoverLetterForJob`; `createCoverLetter`
   only contributes the profile-create idea and must NOT contribute its
   title-collision *throw* (62-81) or its non-transactional, non-repointing
   shape. State this explicitly.
2. Reliability NFR "A failed `save_cover_letter` leaves no orphan `CoverLetter`
   row and no repointed job" — incomplete; it omits the `Profile` row created
   on the no-profile path. Broaden or qualify.
3. R5 AC2 "its title SHALL be unique among the caller's letters" — this is
   best-effort, not enforced: `CoverLetter.title` has no DB unique constraint
   (`schema.prisma:96-105`) and the uniqueness read is outside the write
   transaction (Performance NFR), so concurrent saves can collide. Inherited
   from the app, but the hard "SHALL" overstates the guarantee.

## What's missing before acting

- A stated input schema contract for `save_cover_letter` (fields, types) and
  the parse-vs-handler location of the min-length check (R1-1).
- A decision on whether profile creation is inside the write transaction and a
  reliability guarantee that covers the `Profile` row (R1-2).
- Confirmation that `save_cover_letter` is registered in `route.ts` under the
  `jobs:write` gate with its own InputShape/Schema — implied by R3 AC5 and R6
  but never stated as a requirement.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
