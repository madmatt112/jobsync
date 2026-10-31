# Adversarial Analysis — mcp-write-tools/design (v1)

Round 1 (first review). Primary surface: feasibility, consistency, edge cases.
Fresh lens: interface-contract fidelity. No v1 checkpoint commit exists, so the
whole document was reviewed fresh rather than as a delta.

## What I checked and how

Read `codebase-context.md`, then both ends of every cited range the design
leans on, and cross-checked the governing requirements (v6) and the
decomposition entry.

- **Match seam (C5, C6, C7).** `matchDirective.ts` (current `buildMatchDirective`
  / `buildMatchOffer` signatures and the resume/instruction/four-section block
  at :28-51), `jobLookup.ts:12-27` (`resolveJobForAgent(userId, pageJobId?)`),
  `resumeLookup.ts:44-90` (`resolveResumeForAgent(userId, opts)`),
  `matchJob.ts:48-94` (the in-app order the design mirrors), `preprocessing-job.ts`
  (`preprocessJob(job)`, 200-char floor), `preprocessing.ts:305-310`
  (`preprocessResume`), `job-match/system.ts` (Deal Breakers at :49-50, OUTPUT
  FORMAT at :24-32), `user.ts` (`buildJobMatchPrompt`), `index.ts:5-6` (barrel),
  `analyze.ts:101`/`:114` (automation on-demand reuse), `automation-match/system.ts`
  (the lean prompt the design leaves alone). Verified `buildMatchOffer` keeps its
  four-arg external signature, so the add/update callers (addJob.ts:38,:69,
  updateJob.ts:29 — the only callers) and `mcpUpdateJob.spec.ts:47`'s
  `toHaveBeenCalledWith("job-1","user-1","full","update")` stay valid.
- **Ownership seam (C1, C2).** `updateJobFromNames.ts` (NOT_FOUND_MESSAGE :55-57,
  pre-check :67-70, transaction update :190-193, P2025 :195-207),
  `saveMatchResult.ts` (completeness read :67-70, update :86-93, P2025 :95-104),
  `addJob.ts:57-78` (upsert inherits), `findJob.ts:36,:46,:58-63`,
  `mcp.schema.ts:245-251` (jobId describe), `toolDescriptions.ts` (all 12 keys),
  `tools.ts:21-34` (SHAPES map).
- **Cover-letter seam (C3).** `coverLetter.actions.ts:11,:150-212` (renderer
  settings, create-then-repoint transaction order), `coverLetterTitle.ts:7-20`,
  `constants.ts:98` (MIN_COVER_LETTER_CHARS=10), `schema.prisma:71-77,96-105,457-458`
  (Profile has no unique userId, CoverLetter shape, Job.coverLetterId),
  `package.json:74` (markdown-it ^14.3.0 runtime; :103 is @types).
- **Rows (C4).** `jobQuery.ts:309` (`day`), `:311-324` (`formatJobRow`, nine
  fields, field 8 = match, field 9 = origin), `getJob.ts:45-46,:78,:89`.
- **Docs/tests/e2e (C8, Testing).** `wiki/mcp.md:74,82,85,89-93,101,121`;
  `mcpAddJob.spec.ts` (:16-18,:50,:79-82,:130,:135,:141,:147,:170,:256-274);
  `mcpUpdateJob.spec.ts:47,:76`; `e2e/fixtures.ts:70-136,140-158`;
  `cleanup/route.ts:21-68`; `e2e/mcp-add-job.spec.ts`.

Every path, range, signature and string the design cites is accurate. No
misstated artifact. The interface-contract lens found no signature the design
assumes that the code does not expose: `resolveJobForAgent`/`resolveResumeForAgent`
arg order, the `{kind,text}` offer type, `preprocessJob`/`preprocessResume`
`.data.normalizedText`, `buildJobMatchPrompt(resume, job)`, and the markdown-it
`{html,linkify,breaks}`+`.render()` capability (already exercised at
coverLetter.actions.ts:11) all hold.

## Re-decided requirement literals (ruled on my authority)

All five are **refinement (closed)**; none widens a requirement:

1. R6 AC3 / Security — two creates own through create data, not a `where` (D13).
   R6 AC3's intent is in-query ownership, never post-filter; a Prisma `create`
   has no `where`, and the requirement's own carried-R4-1 note already reads
   "where, or create data from a user-scoped read in the same tx." Within intent.
2. R8 AC1 — opening line names the resolved resumeId and in-app choice order,
   drops "default resume" (D6). R8 AC1 pins what is kept (jobId, resumeId,
   call-back) and replaced (resume block, instructions, four sections); the
   wording is an explicitly-deferred narrow-check item. Within intent.
3. R8 AC4 mechanism — `get_job matchDirective` flag (D1). R8 AC4 says "design
   decides the mechanism." Delegated choice.
4. Shared JOB_NOT_FOUND_MESSAGE string (D2). R1 AC3 / R2 AC4 / R4 AC8 pin the
   exact string "in design." Delegated choice.
5. e2e coverLetterIds on the cleanup route (D15). Test infrastructure, in scope.

## Findings

### R1-1 — SHOULD_FIX (Novel) — the e2e sketch cannot produce the directive it asserts

Testing Strategy / C8 prescribe `e2e/mcp-write-tools.spec.ts`: add a job through
`createNewJob` (so `createdVia` is null), then over MCP call `update_job`,
`list_jobs`, `save_cover_letter`, and `get_job` with `matchDirective: true`
— asserting the reply "carries the `save_match_result` call-back."

For `buildMatchOffer(..., "rescore")` to return a **directive** (the branch that
carries the `save_match_result` call-back) rather than a **note**, two
preconditions must both hold, and the sketch states neither:

- **Scoreable description.** `createNewJob` fills the description "test
  description" (`e2e/fixtures.ts:119`), and a UI-entered job has
  `descriptionCompleteness = null` (`schema.prisma:474-476`, context line 99).
  Null skips the title-only short-circuit, so the flow reaches `preprocessJob`,
  whose 200-char floor (`preprocessing-job.ts:112`) rejects that short body and
  returns the note "The job description couldn't be used for matching…". Unless
  the `update_job` step sends a full (≥200-char) posting, `get_job` rescore
  yields a note, not a directive.
- **A usable resume.** The sketch never creates a resume for the token's user.
  The base fixture seeds none (resume creation is explicit elsewhere, e.g.
  `automations.spec.ts:9` `createResumeForMatching`). With zero resumes
  `resolveResumeForAgent` returns `no_resumes`, so `buildMatchOffer` returns the
  "No default resume set…" note — again no call-back.

As written the only end-to-end check of the flagship R8 AC4 capability
("re-score without editing") asserts output the steps cannot produce. Fix: have
`update_job` send a substantive posting and seed a default resume for the token
user before the `get_job matchDirective: true` assertion.

### R1-2 — MINOR (Novel) — title-only note is add-centric on the rescore path

C6 post-condition 1 returns the note of `matchDirective.ts:63-72` "unchanged"
when `completeness === "title-only"`. That note reads "…the job was saved, but
no fit analysis was requested" — add-context phrasing. Reached via `get_job
matchDirective: true` on an MCP job already stored as title-only, the "was saved"
clause is wrong for a re-score, though the actionable guidance (fetch the full
posting, call `update_job`) still holds. Safe to reword in tasks.

### R1-3 — MINOR (Novel) — read-only token is handed an unfulfillable directive

C7 keeps the `jobs:read` gate on `get_job`, so a read-only token calling
`matchDirective: true` receives a directive instructing it to call
`save_match_result`, which then fails the `jobs:write` scope check. The design
states this consequence and it writes nothing (no security hole), but it is a
dead-end instruction for a read-only agent. Acceptable as a stated trade-off;
noting for awareness.

## Top risks / gaps

1. **R1-1** — the R8 AC4 end-to-end verification is non-executable as sketched.
2. Changing `JOB_MATCH_SYSTEM_PROMPT` moves **in-app Match and automation
   on-demand analysis** too (`analyze.ts:101,:114`), not only MCP — correctly
   scoped by C5/carried-R5-5 and intended by the decomposition, but a live
   behavioral change whose eval re-baselining is deferred. Fine, flagged for
   awareness.
3. The three shared-prompt additions (C5) are "illustrative, to be verified
   against eval fixtures"; final wording is deferred. The R9 AC5 invariant
   (no forbidden phrase, no batch-prefix line) is test-enforced, so this is safe.
4. `save_cover_letter` step 3a's "not-found marker with no write" inside a
   `$transaction` is an under-described control-flow (throw-sentinel vs.
   return-and-branch); intent is clear, resolvable in tasks. MINOR.
5. For `add`/`update`, the rewritten `buildMatchOffer` adds a job read
   (`resolveJobForAgent`) + `preprocessJob` that the old path skipped. Inherent
   to R8 (embed normalized job text server-side) and bounded; no NFR breach.

## Top 3 conclusions to challenge

1. **"the add and update callers are unchanged" (C6).** True only because
   `buildMatchOffer` keeps its four positional args; the widened `completeness`
   type and new `"rescore"` context do not touch the call sites. Verified at
   addJob.ts:38/:69, updateJob.ts:29 and the mcpUpdateJob.spec.ts:47 assertion.
   Holds.
2. **"get_job rescore carries a save_match_result call-back" (C7/e2e).** Only
   when the job is scoreable and a resume resolves — see R1-1. The unit test
   (`mcpMatchDirective.spec.ts`) mocks these, so it holds there; the e2e does not.
3. **"no gate for null-completeness jobs" (D10).** Correct — `preprocessJob`'s
   200-char floor is the real gate, and null skips the title-only branch. This
   is exactly why the e2e's thin UI job produces a note (R1-1), so D10 and R1-1
   are two faces of the same behavior.

## What's missing before acting

- Pin the two e2e preconditions (substantive `update_job` body + seeded resume)
  so the R8 AC4 path actually emits a directive (R1-1).
- Decide the title-only note wording for the rescore context, or state it is
  deliberately reused verbatim (R1-2).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
