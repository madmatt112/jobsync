# Adversarial Analysis — server-side-match/tasks (v1, round 2)

Round 2. Document still v1 (round 1 was followed only by a lint pass, not a reviser pass). Primary surface: atomicity, ordering, coverage. Fresh lens: none specified. Prior round found only R1-1 (MINOR, Req 5.7 traceability).

## Deltas attacked first (the `## Changes since eec89f6` lint pass)

The diff is the v1 lint commit. Nine hunks; most are cosmetic (backtick-wrapping code in prompts, replacing "task N owns it" with a prose gloss of the owning change). Five touch citations — each re-verified against code (a misstated artifact would be an automatic MUST_FIX):

- Task 3 regression-guard add: `updateAiSettings` at `src/actions/userSettings.actions.ts:114-118` — confirmed (`export const updateAiSettings` spans 114-118); the ai-merge at `:68-72` — confirmed (the `ai: { ...default, ...current, ...settings.ai }` block).
- Task 6 bullet: dropped the `prisma/schema.prisma:476` gloss from the summary line; the prompt body still pins `prisma/schema.prisma:476` for `descriptionCompleteness`. Line 88 of `getJob.ts` reads `job.descriptionCompleteness`; schema line 476 is the column. Accurate.
- Task 8: `SERVER_MATCH_CONCURRENCY: 3` beside `src/lib/constants.ts:109` (`AUTOMATION_MATCH_CONCURRENCY: 3`) — confirmed; `SERVER_MATCH_SURFACE: "server"` beside `:169` (`AGENT_CHAT_MATCH_SURFACE: "chat"`) — confirmed; `configuredMax` at `src/lib/mcp/rate-limit.ts:13-17` and `MAX` at `:19` — confirmed verbatim.
- Task 13: `add_job` `toolDescriptions.ts:6-7`, `update_job` `:16-17`, `add_jobs_batch` `:22-23` — confirmed (each is the key line plus its string); `update_job`'s string at `:17` contains "requests a fresh match analysis".
- Task 2/9/11 wording changes ("the DeepSeek-enum change owns it", "the queue module is created afterwards…", "the handler-wiring change owns them") drop the task-number cross-reference but keep the ownership fact; no citation drift.

All delta citations accurate. No delta regressed an earlier-agreed item (no fix-induced re-check applies).

## What I checked and how

- Re-ran the task-3 count grep across the whole tree (excluding node_modules): only `src/lib/scraper/automation-run/aiSettings.ts:33` uses a removed enum member in `src`; the `__tests__/AiSettings.spec.tsx` hits (67, 72-73, 95) are `"deepseek-chat"` string literals in a live-list mock, and `evals/resume-review/assertions.ts:121` is a comment — none references `DeepseekModel.DEEPSEEK_CHAT/REASONER` as an enum member, so narrowing the enum keeps the tree compiling and the suite green (header claim holds at task 3).
- Verified the task-2 seams the regression guard rides on: `src/lib/scraper/automation-run/match.ts:78-84` and `src/actions/automation/analyze.ts:112-117` each pass `generateText` with no `providerOptions` today (so adding `MATCH_PROVIDER_OPTIONS` cannot collide, Req 1.5); `matchJobToResume(job, resume, sourceBoard, aiSettings, userId, signal?)` resolves `modelName = aiSettings.model || getDefaultModelForProvider(provider)` and calls `getModel(provider, modelName, userId)` (match.ts:52-54), so "getModel received `deepseek-reasoner`" (Req 2.3/2.4) is assertable; both import `getModel` from the `@/lib/ai` barrel, matching the task's mock target.
- Confirmed the `renderDetail` seam (`getJob.ts:50-111`): `GET_JOB_INCLUDE` uses `include`, so the two new scalars load with no edit (design C9); the "## Match" block at 96-111 is where task 6 appends the failure line; `day()` at :47-48 returns a string when `serverMatchFailedAt` is non-null.
- Re-walked the dependency graph for forward references and the two module cycles (queue↔run resolved by order + run-not-importing-queue; offer↔matchDirective resolved by `import type`). No forward edge; every `File:` entry is a literal path; no prose gloss.
- Re-mapped every acceptance criterion to a task (table below) and checked success-clause coverage (retro P7) on the two heaviest tasks (9 and 12): every test the `_Prompt` `Task:` body names reappears in that task's `Success:` clause.

## Topics attacked

### 1. Header claim "every task leaves the tree compiling / lint / test green" (dependency paragraph)
- Challenge the claim that task 3 narrowing `DeepseekModel` to one member breaks nothing: verified by whole-tree grep — only `aiSettings.ts:33` is a source enum use, fixed in the same task; no test references the removed members as enum values. Holds.
- Stress-test task 9 compiling before task 10 exists: run.ts exports `ServerMatchTask` and must not import queue.ts (restriction present); queue.ts (task 10) imports run.ts, not the reverse. Order 9→10 is sound.
- Stress-test task 9 type-checking against the new Prisma columns: `recordServerMatchFailure` writes `serverMatchError`/`serverMatchFailedAt`, which exist in the generated client only after task 6's `prisma generate`; task 6 < task 9. Holds.

### 2. Coverage: requirements → tasks
- Challenge whether any criterion is orphaned: all of Req 1–8 map (see matrix). The only unlisted criterion is **Req 5.7** (provisional badge on `"partial"`), the known R1-1. It is an explicit invariant satisfied by task 9's Req 5.6 field write plus unchanged `MatchDetails.tsx:42-50`; no implementation is missing.
- Challenge Req 7.1 being listed on task 9: task 9's isolated `runServerMatch` test can assert "the job stays saved / no `matchScore` write on failure" but not "the MCP reply already returned" — that half is asserted by task 12's flow test (Req 4.11). The split is honest, not a gap.
- Challenge Req 4.9 (get_job + matchDirective unchanged): task 12 lists it as an invariant with `getJob.ts` not edited; consistent with design C5.

### 3. Atomicity of the large tasks (9 and 12)
- Stress-test whether task 12 (7 files, handlers + schema + skip flag + flow test) should split: the three write paths all need `resolveMatchReply` and the `skipMatch` schema field together; splitting would create a forward reference or a red intermediate state. Cohesive; correctly whole.
- Stress-test task 9 (run + failure record) as one unit: run and `recordServerMatchFailure` share the closed reason set and the "never write matchData on failure" invariant; splitting would duplicate the reason set. Correctly whole.

### 4. Test seams and the success-clause gate (retro P7)
- Verified each `Test:` call is defined and assertable with requirement values (task 2 getModel-via-barrel, task 9 `runServerMatch(task,5)` → "Timed out after 0.005 s." with N = timeoutMs/1000, task 12 handler flow).
- Walked task 9 and task 12 `Task:`-body tests against their `Success:` clauses: no dropped success clause.

## Findings

**R2-1 — MINOR (Recurring; = R1-1, not escalated).** Req 5.7 (the "Provisional score" badge on `"partial"` completeness) is still absent from any task's `_Requirements` and from the Scope-notes coverage line. The document was only lint-passed since round 1, so the nit persists. I am deliberately **not** escalating severity: Req 5.7 is an explicit "verified, not red-first" invariant with zero implementation — task 9 sets `descriptionCompleteness` (Req 5.6) and the existing `MatchDetails.tsx:42-50` renders the badge — so it causes no rework and no wrong implementation. Escalating an invariant-covered traceability pointer to a loop-keeping severity would be padding. Optional fix: add `5.7` to task 9's `_Requirements` or one scope-note line.

## Requirement → task matrix (abridged)
1.1→T1 · 1.2/1.3→T2 · 1.4→T9 · 1.5→T1,T2 · 1.6/1.7→T1 · 2.1/2.2→T3 · 2.3→T2,T3 · 2.4→T2 · 3.1→T4,T5,T11 · 3.2→T4,T5,T14 · 3.3→T4 · 3.4→T11 · 3.5→T6,T11,T12 · 4.1–4.9→T11/T12 · 4.10→T10 · 4.11→T10,T12 · 4.12→T13 · 5.1–5.6→T9 · 5.5→T7,T9 · 5.7→invariant (R2-1) · 5.8→T6 · 6.1→T10 · 6.2/6.5→T8,T10 · 6.3→T8 · 6.4→T10 · 7.1→T9/T12 · 7.2/7.3/7.6→T9 · 7.4/7.5→T6 · 8.1→T12,T13 · 8.2–8.5→T11/T12.

## Top risks/gaps
1. None material. The single coverage observation (Req 5.7 / R2-1) is an invariant already satisfied by task 9's field write.

## Top conclusions to challenge
1. "Every task leaves the tree compiling, lint and test green" — challenged via the enum narrowing (whole-tree grep), the queue↔run order, and the Prisma-column dependency; all hold.
2. "No task uses an artefact a later task creates" — challenged across all 14 tasks; holds (cycles are `import type` or correctly ordered).
3. The lint pass changed no artifact — challenged all five citation edits against code; all accurate.

## What's missing before acting
- Nothing blocking. Optionally thread Req 5.7 into task 9's `_Requirements` for a complete matrix.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
