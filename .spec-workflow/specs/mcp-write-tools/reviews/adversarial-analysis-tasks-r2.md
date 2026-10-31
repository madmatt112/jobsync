# Adversarial Analysis — mcp-write-tools/tasks (v2), Round 2

Primary attack surface: atomicity, ordering, coverage. Fresh lens: task atomicity and
dependency ordering (does a task bundle separable units or depend on an un-cited earlier
task's export). No v1 checkpoint diff exists (prompt: "no checkpoint commit found for v1"),
so the deltas attacked are the v2 Revision-History fixes: R1-1 (task 1 + scope note),
R1-2 (task 4 grep), R1-3 (scope note).

## Delta re-checks (v2 fixes), scoped to the fix diff

- **R1-1 (task 1 reframe) — resolved.** Task 1 now reframes `__tests__/mcpAddJob.spec.ts:256-274`
  to mock `updateJobFromNames` returning `{ updated: true, descriptionChanged: false, …,
  message: "Job job-9 updated." }` and assert the reply reports the patch and omits "not eligible".
  Traced against `src/lib/mcp/tools/addJob.ts:57-78`: with `descriptionChanged:false`,
  `upsertExisting` short-circuits at `:65` and returns `result.message` ("Job job-9 updated.")
  without reaching `buildMatchOffer`, so the assertion is self-consistent and survives task 9's
  rebuild of `buildMatchOffer`. The scope note (line 147) now routes R1 AC2 as inherited through
  `addJob.ts:57-78` forwarding unchanged. Accurate. Closed.
- **R1-2 (task 4 grep) — resolved.** Verified the live files: the forbidden-phrase grep
  `"through MCP\|created with add_job\|add_job directive"` matches exactly four lines today —
  `toolDescriptions.ts:17` ("added through MCP"), `:21` ("created with add_job"),
  `mcp.schema.ts:108` ("add_job directive") and `:250` ("created through MCP") — and all four sit
  in lines task 4 edits. "returned by add_job" (`:102`, `:250`) is no longer in the pattern, so
  listing id sources ("as returned by add_job, find_job, …") and a clean grep no longer collide.
  No other occurrence of the forbidden phrases exists in the two scoped files. Accurate. Closed.
- **R1-3 (scope note) — resolved.** The invariant list routes R1 AC6 (discovery-status) as
  verified by the ownership `where` keying only on id/userId. Matches design C1. Closed.

## What I verified against source this round

- `src/lib/mcp/tools/addJob.ts:38-43` (add path) and `:69-74` (upsert "update" path) both call
  `buildMatchOffer`; task 9 keeps both callers unchanged (correct — the 4-arg signature is
  preserved).
- `src/lib/mcp/tools/matchDirective.ts`: current `buildMatchOffer(jobId,userId,completeness,context)`
  (4 args, unchanged by task 9) and `buildMatchDirective` (5 args → 6 args with `normalizedJobText`,
  internal only). The `save_match_result` call-back at `:49-50` carries `"resumeId": "${resumeId}"`,
  so task 9's claim that `mcpAddJob.spec.ts:83` (`"resumeId": "resume-1"`) holds is correct.
- `src/lib/agent/jobLookup.ts:12-27` returns the job with `JobTitle/Company/Location` and
  `job.resumeId`; `src/lib/agent/resumeLookup.ts:44-90` resolves page→default→only; `matchJob.ts:48-70`
  confirms the job check runs before the resume check and both preprocess together. Task 9's reuse
  claims are accurate.
- `src/lib/mcp/tools/getJob.ts:45-46` is `day = d ? new Date(d).toISOString().slice(0,10) : null`
  and `:78` prints `Created: day(createdAt)`; task 5 / design C4's R7 AC3 equality holds.
- `__tests__/mcpBatch.spec.ts` fully mocks `handleAddJob`/`handleSaveMatchResult` (`:6-9`), so it
  never reaches the real `buildMatchOffer` — task 9 correctly needs no batch-suite change.
- `__tests__/mcpUpdateJob.spec.ts` partial-mocks `matchDirective` ("DIRECTIVE calling save_match_result",
  `:25/:46`), so it does not reach the real builder; task 9's "passes unchanged" is correct.
- `__tests__/mcpReviewResume.spec.ts` mocks `getDefaultResumeForUser`, which task 9 leaves in place
  for `review_resume` — unaffected.

Coverage holds: every requirement criterion maps to a task (R1→1, R2→2, R3→3/4/7/11, R4→6/7,
R5→6, R6→6/7, R7→5, R8→8/9/10, R9→5/8/9/10/11); the `_Requirements` tags cover the set; invariants
routed as verified match the design. Success-clause coverage (P7): every test named in each
`Task:` body reappears in that task's `Success:` clause (checked tasks 5, 6, 8, 9, 10). No new
external dependency (no gate-b); nothing exceeds the approved requirements (no gate-c). Dependency
narrative (header line 5) is sound: 1→(2,6), 6→7, 9→10, 11 after 4/5/7/10, 12 last; task 8/9 carry
no logical dependency on 1-7.

## Findings

### R2-1 — SHOULD_FIX — Novel (carried; fresh-lens) — Task 9: the upsert happy-path test is missing from the mock/anchor rewrite and will go red
Task 9 rebuilds `buildMatchOffer` so it now loads the job via `resolveJobForAgent(userId, jobId)`
**before** the resume step (design C6 post-conditions 2→3). Task 9's exact-value enumeration
(tasks.md line 97) meticulously lists the first `describe` block ("handleAddJob match gating"):
mocks `:16-22/:50/:135/:147`, headings `:79-82`, call assertions `:130/:170`, and which assertions
hold (`:73/:74/:83/:141/:153`). It names no change in the second `describe` ("handleAddJob upsert
routing", `__tests__/mcpAddJob.spec.ts:183-275`).

But that block's happy-path test at `:196-222` ("updates the existing job … when upsert is true")
mocks `updateJobFromNames` with `descriptionChanged:true` (`:201`), so `upsertExisting`
(`addJob.ts:65`) does **not** short-circuit and reaches `buildMatchOffer(result.jobId, userId,
"full", "update")` at `:69-74` (a caller task 9 keeps unchanged). The test's only setup for the
offer is `mockUsableResume()` (`:206`), which sets the resume side only
(`getDefaultResumeForUser`+`preprocessResume`). After task 9, `getDefaultResumeForUser` is removed
from this path and `resolveJobForAgent` is unmocked for this test → it returns `no_job` → the offer
is the note "The job couldn't be loaded for matching." → `:220 expect(text).toContain("save_match_result")`
**fails**. This breaks task 9's own `Success` gate ("the full suite pass"). The design Testing
Strategy (design.md:160) shares the omission, so nothing catches it cross-artifact.

Why it is real, not noise: the task is precise enough to enumerate which assertions merely *hold*,
yet it skips a second-block test that provably flips red. The generic "widen to every assertion the
change touches" boilerplate (line 100) is the only cover, and the upsert `describe` has its own
`beforeEach` (`:191-194`) that sets only `checkMcpRateLimit`, so nothing supplies a default job
lookup. Fix: add `:196-222` to task 9's anchor list and give the upsert `describe` a job-side mock
(`resolveJobForAgent`→ok, `preprocessJob`→success), e.g. by widening `mockUsableResume` into a
shared "usable job + resume" helper or seeding the mocks in the second block's `beforeEach`. The
same job-first ordering silently applies to `:66/:100/:133/:145`, but task 9's "`:74/:83` hold" and
`:135/:147` claims already presuppose the job mock there, so only the upsert block is unguided.

## Top 3 conclusions to challenge
1. "task 9 … Exact-value changes in `mcpAddJob.spec.ts`: [first-describe anchors]" (line 97) — the
   enumeration is not exhaustive; the upsert happy-path test at `:196-222` reaches the rebuilt
   `buildMatchOffer` and is absent (R2-1).
2. "Every task leaves the tree … `npm run test` green" (header line 5) — true for every task except
   that task 9, implemented strictly to its listed anchors, lands with `:220` red (R2-1).
3. "task 8 … and task 9 … are independent of tasks 1-7" (line 5) — holds logically (verified: no
   export/behaviour dependency), but note task 9 and task 1 both edit `mcpAddJob.spec.ts`; the edits
   are disjoint (`:256-274` vs the match-gating block), so sequential order is safe — no defect, but
   the "independent" phrasing hides a shared file.

## What's missing before acting
- Task 9 anchors for the upsert happy-path test and a shared job-lookup mock, so task 9 ships green
  under its own `Success` gate.

## Notes (awareness, not counted)
- design.md:160 still says `mcpAddJob.spec.ts:264/:273` "use JOB_NOT_FOUND_MESSAGE" (the old
  not-found treatment), which the accepted R1-1 fix superseded by reframing `:256-274` to a patch
  case. The tasks doc (task 1) is correct per R1 AC2; the design line is stale. Cross-artifact, in
  the design (not the reviewed doc); R1-1 is a closed ruling.
- Tasks 4/6/10 all edit `src/models/mcp.schema.ts` by line number; earlier insertions (task 6's new
  shape) drift task 10's `:160-167` anchor, but task 10 edits `McpGetJobInputShape` by name, so no
  defect.
- Task 12's e2e asserts a `list_jobs` row ends with "added <today's UTC date>" computed test-side vs
  a server-set `createdAt`; a run straddling UTC midnight could mismatch. Same UTC-skew theme already
  ruled awareness-only; left as is.

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
