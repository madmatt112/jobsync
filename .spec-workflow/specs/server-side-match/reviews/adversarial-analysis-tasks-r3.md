# Adversarial Analysis — server-side-match/tasks (v1, round 3)

Round 3. Document still v1 (rounds 1 and 2 were each followed only by a lint pass, not a reviser pass). Primary surface: atomicity, ordering, coverage. Fresh lens this round: none assigned — so I added my own: **cross-task line-number drift** (line citations in a later task against a file an earlier task already edited on the same branch). Prior rounds found only R1-1/R2-1 (MINOR, Req 5.7 traceability).

## Deltas attacked first (the `## Changes since eec89f6` lint pass)

The diff is the v1 lint commit — the same lint pass round 2 already attacked. Nine hunks: cosmetic backtick-wrapping of code fragments in prompts, plus the five citation/wording edits round 2 re-verified. I re-grounded the load-bearing ones against code (a misstated artifact is an automatic MUST_FIX):

- **Task 6** condition edit ("the visible score is null"): `getJob.ts:95-99` computes `const visible = hideUnanalyzedScore(job); if (visible.matchScore == null) lines.push("Not scored.")`. "Visible score is null" is exactly that branch and equals design C9's "the score is hidden." Accurate. `GET_JOB_INCLUDE` is `satisfies Prisma.JobInclude` with `JobDetail = Prisma.JobGetPayload<{ include: typeof GET_JOB_INCLUDE }>` (`getJob.ts:43-45`) — `include`, so the two new scalars load with no edit (design C9 / task-6 restriction). Confirmed.
- **Task 8** `configuredMax`→`mcpRateLimitMax`: `rate-limit.ts:13-17` `configuredMax()` reads `process.env.MCP_RATE_LIMIT_MAX` on each call; `const MAX = configuredMax()` at `:19` caches once. The budget calling `mcpRateLimitMax()` "at check time" is what makes the env-override test (100 takes, Req 6.3) assertable. Confirmed.
- **Task 7** status.ts anchor: `saveJobMatchResult` spans `status.ts:52-70`; the inline update at `:60-63` is `prisma.job.update({ where: { id: jobId, userId: user.id }, data: { matchScore, matchData } })`. Task 7's `writeJobMatch` where/data and the `writeJobMatch(user.id, jobId, …)` replacement match byte-for-byte. Confirmed.
- **Task 3** (`userSettings.actions.ts:114-118`), **Task 13** (`toolDescriptions.ts:6-7/16-17/22-23`): unchanged since round 2's verification; re-confirmed consistent with the context map.
- **Task 2/9/11** wording glosses ("the DeepSeek-enum change owns it", etc.): round 2 ruled these keep the ownership fact; closed, not re-opened.

All delta citations accurate. No delta regressed an earlier-agreed item, so no fix-induced re-check applies.

## What I checked and how

- **Success-clause coverage (retro P7) on all 14 tasks**, not just the heavy ones: for each task, every test named in the `_Prompt` `Task:` body also appears in that task's `Success:` clause. Clean — no silently-dropped success clause anywhere (tasks 1-14).
- **`Test:` line gate on all 14**: each `Test:` call resolves — existing symbols (`buildMatchJobTool…execute`, `matchJobToResume`/`analyzeDiscoveredJob`, `getDefaultModelForProvider`, `handleGetJob`, `handleAddJob`, `MCP_TOOL_DESCRIPTIONS`) or symbols a this-task prompt creates (`updateServerSideMatch`, `ServerMatchSettings`, `writeJobMatch`, `takeServerMatchBudget`, `runServerMatch`, `enqueueServerMatch`, `resolveMatchReply`). Task 11's `resolveMatchReply(jobId, userId, completeness, context, skipMatch)` matches design C4's signature exactly. Success criteria are assertable with requirement values (e.g. task 9 `runServerMatch(task,5)`→"Timed out after 0.005 s.", N=timeoutMs/1000).
- **Cross-task line-number drift (my fresh lens)**: mapped every file touched by more than one task. Each file is edited by a single task (constants.ts→T8, mcp.schema.ts→T12, matchDirective.ts→T11, userSettings.actions.ts→T4, addJob.ts→T12, getJob.ts→T6, nestedGeneration.ts→T1); all cross-task references are by **symbol name / import**, never by a line number into a file an earlier task already shifted. No stale line citation. (This is why the "every task leaves the tree green" claim survives the one-branch, in-order constraint.)
- **Gate B / Gate C**: no task adds a new external dependency — `p-limit` (task 10) is already installed (7.3.0) and already used at `aiSettings.ts:18-24`. No task does more than the approved requirements ask; the wiki paragraph + regenerated tool list (task 13) serve Req 4.12/8.1 and are declared in Scope notes. Neither gate fires.
- **Decomposition scope**: the three decomposition bullets (match settings, server-side match for MCP adds, skip flag) map onto tasks 1-3, 4-12, 12 respectively; the out-of-scope list matches the tasks' Scope notes. The decomposition's "save with `saveJobMatchResult`" vs the tasks' `writeJobMatch` extraction is reconciled by requirements Scope note + design C7 (closed).

## Findings

**R3-1 — MINOR (Recurring; = R1-1/R2-1, not escalated).** Req 5.7 (the "Provisional score" badge on `"partial"` completeness) is still absent from every task's `_Requirements` line and from the Scope-notes coverage line. Only lint passes have touched the document since round 1, so the nit persists. Not escalated: Req 5.7 is an explicit "verified, not red-first" invariant with zero implementation — task 9 sets `descriptionCompleteness` (Req 5.6) and the unchanged `MatchDetails.tsx:42-50` renders the badge — so it causes no rework. Optional fix: add `5.7` to task 9's `_Requirements` or one scope-note line.

**R3-2 — MINOR (Novel).** The dependency-order paragraph (line 5) says "Tasks 1-3 (thinking option, DeepSeek model) stand alone." Task 2 is not standalone: it imports `MATCH_PROVIDER_OPTIONS`, "the constant task 1 exports" (task-2 summary line 27 and prompt). The group 1-3 depends on nothing outside itself, but within it 2→1 is a hard edge. The ordering is still correct (task 1 < task 2) and the task-2 detail line and prompt both state the dependency, so no implementation can go wrong. Purely an intro-prose imprecision. Optional fix: reword to "Tasks 1-3 are the match-settings prelude, independent of the queue/setting work (task 2 uses task 1's constant)."

## Requirement → task matrix (abridged, re-verified)
1.1→T1 · 1.2/1.3→T2 · 1.4→T9 · 1.5→T1,T2 · 1.6/1.7→T1 · 2.1/2.2→T3 · 2.3→T2,T3 · 2.4→T2 · 3.1→T4,T5,T11 · 3.2→T4,T5,T14 · 3.3→T4 · 3.4→T11 · 3.5→T6,T11,T12 · 4.1–4.9→T11/T12 · 4.10→T10 · 4.11→T10,T12 · 4.12→T13 · 5.1–5.6→T9 · 5.5→T7,T9 · 5.7→invariant (R3-1) · 5.8→T6 · 6.1→T10 · 6.2/6.5→T8,T10 · 6.3→T8 · 6.4→T10 · 7.1→T9/T12 · 7.2/7.3/7.6→T9 · 7.4/7.5→T6 · 8.1→T12,T13 · 8.2–8.5→T11/T12. NFRs (perf/security/reliability/testing) land on T9/T10/T12. Only Req 5.7 is traceability-only (invariant-covered).

## Top risks/gaps
1. None material. Req 5.7 (R3-1) is invariant-covered; the "stand alone" wording (R3-2) does not affect ordering or implementation.

## Top conclusions to challenge
1. "Every task leaves the tree compiling / lint / test green" — challenged this round via cross-task line-number drift (new angle): no later task cites a shifted line; all cross-task use is by symbol. Holds.
2. "No task uses an artefact a later task creates" — re-walked the queue↔run (order + run-not-importing-queue) and offer↔matchDirective (`import type`) cycles; holds.
3. "Tasks 1-3 stand alone" — reversed for task 2 (R3-2), but the ordering it implies is still satisfied.

## What's missing before acting
- Nothing blocking. Optionally thread Req 5.7 into task 9's `_Requirements` and reword line 5's "stand alone" — both cosmetic.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
