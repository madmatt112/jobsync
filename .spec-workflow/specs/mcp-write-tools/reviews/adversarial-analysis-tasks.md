# Adversarial Analysis — mcp-write-tools/tasks (v1), Round 1

Primary attack surface: atomicity, ordering, coverage. Fresh lens: test-seam adequacy.
No v1 checkpoint diff exists (prompt: "no checkpoint commit found for v1"), so this is a
first full pass, not a delta re-check.

## What I verified against source (all accurate)

I read both ends of every load-bearing citation. All of these are correct in the codebase:

- Task 1 — `updateJobFromNames.ts`: `NOT_FOUND_MESSAGE` :55-57, pre-check `where` :67-70 and
  update `where` :190-193 both carry `createdVia: { not: null }`, P2025 map :195-205, use sites
  :78/:203, "Job … updated." :230. Test anchors `updateJobFromNames.spec.ts:17-25/:78/:87` correct.
- Task 2 — `saveMatchResult.ts` :67-70, :86-93, :95-104, :105-107; test anchors :47/:94/:244 correct.
- Task 3 — `findJob.ts` select :36, `updatable` :46, update_job sentence :59-61, refusal :62-63;
  `mcpFindJob.spec.ts:8-11/:97-101/:104-121` correct.
- Task 4 — no suite imports `MCP_TOOL_DESCRIPTIONS` or asserts the describes (grep confirms);
  describe lines :17/:21 and schema :102/:108/:250 correct.
- Task 5 — `formatJobRow` :311-324 (9 fields, field 8 `match N%`), `day` :309, `ROW_SELECT.createdAt`
  :220; `mcpListJobs.spec.ts:22-40` fixture `createdAt = 2026-09-01 UTC`, exact row :99-101 is the only
  `.toBe()` full-row assertion (so "only :99-101 changes exactly" holds), :192 and `mcpSearchJobs:103-104`
  are `toContain` prefixes that survive the appended tenth field.
- Task 6/7 — `coverLetter.actions.ts:11/:186-190/:194-205`, `coverLetterTitle.ts:7-20`,
  `MIN_COVER_LETTER_CHARS:10` (constants :98), route gate/parse :189-210, `save_match_results_batch`
  block :291-312, `evals/mcp-tools/tools.ts` SHAPES :21-34. markdown-it is already a dependency
  (`updateJobFromNames.ts:1`, `coverLetter.actions.ts:2`) — no new external dependency, no gate-b.
- Task 8/9 — `system.ts` Deal Breakers :49-50 and seven section headings; `matchDirective.ts`
  :18-26/:29-30/:34-35/:49-50/:103-110; `matchJob.ts:57-86`, `jobLookup.ts:12-27` (uses `include`, so
  `job.resumeId`/`description`/`workplaceType` are present for `preprocessJob`), `resumeLookup.ts:44-90`,
  `addJobsBatch.ts:17/:39` (`[n/m] ` prefix, blank-line join), `index.ts:5-6`. `addJob.ts:57-78`
  (`upsertExisting`) forwards to `updateJobFromNames` and adds no `createdVia` gate — so dropping the
  helper gate is sufficient for R1 AC2.
- Task 10 — `getJob.ts` renderDetail/URL :74/Created :78/cover letter :89/handleGetJob :156-184,
  schema :160-167, route pass-through :120-141 (McpGetJobSchema is built from the shape, so the new
  optional `matchDirective` flows through without a route edit).
- Task 12 — `cleanup/route.ts` body :20-53 and job loop :66-68; `fixtures.ts` CleanupRegistry :140-158
  and posted body ~:207-224; delete-after-jobs ordering is correct (Job.coverLetterId FK).

Ordering is sound: 1→(2,6), 6→7, 9→10, and 11 after 4/5/7/10, 12 last. C1–C8 map to tasks 1–11 and the
e2e strategy to task 12; the decomposition's four bullets (gate removal, save_cover_letter, date-added
row, one match method + re-score) are all covered; `set_status` stays out. Nothing exceeds the approved
requirements — no gate-c. Success-clause coverage (P7) holds: every test named in a `Task:` body
reappears in that task's `Success:` clause (checked tasks 1, 6, 8, 9, 10, 12).

## Findings

### R1-1 — SHOULD_FIX — Novel — Task 1: R1 AC2 has no test seam and its only test now asserts the opposite behaviour
`__tests__/mcpAddJob.spec.ts:256-274` is titled *"explains when the duplicate is a web-app job that MCP
cannot update"* and asserts an upsert onto a `createdVia: null` duplicate returns the not-found reply.
After the gate is dropped, R1 AC2 says that exact upsert now **patches** the job. Task 1's prompt keeps
this test and only swaps its mocked message to the real `JOB_NOT_FOUND_MESSAGE` (`:264`, asserted `:273`);
it does not rename or reframe it — unlike Task 2, which explicitly renames its parallel stale titles at
`saveMatchResult.spec.ts:84/:236`. Because the test fully mocks `updateJobFromNames` (`:12-14`), it can
never exercise the real gate removal through the upsert path, and R1 AC2 is also absent from the line-147
"verified, not red-first" invariant list. Net: a named acceptance criterion with no automated check
anywhere (task 12 e2e calls `update_job`, not the `add_job` upsert path) plus a test whose name documents
the inverse contract — a regression that re-added a gate in `upsertExisting` would not be caught.
Fix: either list R1 AC2 in task 1's verified-invariant note (helper gate removal is proven by task 1's
new null-`createdVia` update case, and `addJob.ts:57-78` forwards unchanged), or add a real upsert-patch
case; and rename/reframe the `mcpAddJob.spec.ts:256` test so it no longer claims web-app jobs can't update.

### R1-2 — SHOULD_FIX — Novel — Task 4: the mandated grep contradicts the instruction to list `add_job` as an id source
Task 4's `Success` requires `grep -rn "through MCP\|created with add_job\|add_job directive\|returned by
add_job" …` to print nothing, while the same `Prompt` requires the `McpUpdateJobInputShape.jobId` describe
(`mcp.schema.ts:250`) to "list the id sources add_job, find_job, list_jobs, search_jobs, get_job". The
current :250 stem is "as returned by add_job or find_job", and the natural rewrite that lists all sources
("as returned by add_job, find_job, …") still matches the forbidden pattern `returned by add_job`. The
pattern is meant to catch MCP-restriction wording, but `returned by add_job` is also legitimate
source-naming wording, so the two completion criteria collide. An implementer either fails their own grep
gate or drops `add_job` from the source list. Fix: narrow the grep to the restriction phrases
(`through MCP`, `created with add_job`, `add_job directive`) and drop the over-broad `returned by add_job`,
or state explicitly that the source list must avoid the "returned by" stem.

### R1-3 — MINOR — Task 1: R1 AC6 (dismissed / discovery-status job) gets no test and no invariant note
Task 1 adds a null-`createdVia` update case and a not-found case, but nothing for a discovery-status
("dismissed") job, and R1 AC6 is not in the line-147 invariant list. Design C1 closes it ("no
discovery-status gate exists; the `where` keys only on id, userId, createdVia"), so it holds by
construction, but the tasks doc neither tests nor routes it as a verified invariant.

### R1-4 — MINOR — Task 7: save_cover_letter's scope/validation branches have no automated assertion
R6 AC1 (jobs:write refusal) and R4 AC9 (router `Validation error:` before the handler) for
`save_cover_letter` are covered by no unit test; task 12's e2e exercises only the happy path and is
outside `npm run test`. The router block is a verbatim copy of `route.ts:189-210` and no tool has a
route-level unit suite (design D6), so this is consistent with the existing pattern — awareness-only.

## Top 3 conclusions to challenge
1. "every design component C1-C8 maps to tasks 1-11" (scope note) — true for components, but R1 AC2's
   *inheritance* through the upsert path is asserted nowhere (R1-1).
2. Task 4's "the grep prints nothing" as a completion gate — self-contradictory with listing add_job as a
   source (R1-2).
3. "Every task leaves the tree … `npm run test` green" — true, but for task 7 that greenness proves
   nothing about the new tool's registration/gate; only out-of-suite e2e does (R1-4).

## What's missing before acting
- A test (or an explicit invariant declaration) for the add_job upsert patching a hand-entered job.
- A de-conflicted Task 4 guard so "list add_job as a source" and "grep clean" can both hold.

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
