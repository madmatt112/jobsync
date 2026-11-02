# Adversarial Analysis — server-side-match/tasks (v1)

Round 1 (first review). Primary surface: atomicity, ordering, coverage. Fresh lens: none specified.

## What I checked and how

- Re-verified the five citations the v1 lint commit changed (the `## Changes since` diff): task 3 `updateAiSettings` at `src/actions/userSettings.actions.ts:114-118` and the ai-merge at `:68-72`; task 6 drop of the `prisma/schema.prisma:476` gloss — `476` is `descriptionCompleteness String?` (confirmed); task 8 `configuredMax` at `src/lib/mcp/rate-limit.ts:13-17` and `MAX` at `:19`; task 13 `src/lib/mcp/toolDescriptions.ts:6-7/16-17/22-23`. All accurate.
- Verified every other cited seam against code: `nestedGeneration.ts:25-42/98-107` (args type, the streamText call, the `:104-105` comment), `matchJob.ts:88-109`, `match.ts:78-84`, `analyze.ts:112-117` + `analyzeDiscoveredJob(jobId)` signature, `ai.model.ts:37-40` enum, `aiSettings.ts:26-39/33/41-55`, `userSettings.model.ts:3-6/22-30`, `userSettings.actions.ts:48-50`, `getJob.ts:47-48/95-111`, `status.ts:52-70` (`:60-63` inline update), `matchDirective.ts:65-141/144-151` + `MatchContext = "add"|"update"|"rescore"`, `addJob.ts:27-36/38-43/62/69-74`, `updateJob.ts:29-34`, `mcp.schema.ts:29-73/67-72/325-336`, `ai.schemas.ts:60-76`, `constants.ts:75/90/109/150-151/157-159/163/169`, `page.tsx:25`.
- Ran the task-3 count grep (`DeepseekModel|DEEPSEEK_CHAT|DEEPSEEK_REASONER|deepseek-chat|deepseek-reasoner`): confirmed `aiSettings.ts:33` is the only source use of a removed member; `AiSettings.tsx:81` uses `Object.values(DeepseekModel)` (whole enum, safe) and the `AiSettings.spec.tsx` hits are live-list mock strings the task deliberately keeps.
- Confirmed `agentMatchJobTool.spec.ts` mocks `streamText` (lines 20-24) and reads `streamText.mock.calls[0][0].providerOptions` (144-158), so task 1's `deepseek` assertion and the "no `think` on ollama" guard (155-158) are reachable through the stated seam.
- Walked the dependency graph for forward references, every requirement criterion → task, every design component → task, every `File:` entry (all literal paths), every `Test:` line (callable, assertable), and success-clause coverage (every prompt-named test appears in the `Success:` clause). Gate B (new deps) and Gate C (scope creep): none.

## Topics attacked

### 1. Dependency order and the "every task compiles/lints/tests green" claim (header paragraph)
- Challenged the claim that no task consumes a later task's artefact: traced MATCH_PROVIDER_OPTIONS (1→2,9), writeJobMatch (7→9), columns (6→9), SERVER_MATCH_SURFACE/CONCURRENCY/budget (8→9,10), run/ServerMatchTask (9→10,11), queue (10→11,12), resolveMatchReply (11→12), skipMatch schema (12→13,14). No forward edge. Holds.
- Stress-tested the task-11 ↔ matchDirective circular import: `matchDirective.ts` imports `MatchReply` from `offer.ts` while `offer.ts` imports `buildMatchOffer` from `matchDirective.ts`. The prompt forces `import type`, which erases at compile time — no runtime cycle. Safe.
- Checked that task 11 widening `composeOfferMessage` to the `MatchReply` union does not break the base `buildMatchOffer` callers in `addJob.ts`/`updateJob.ts` still passing `{kind:"directive"|"note"}`; the narrower type is assignable to the wider param. Green.
- Checked that task 4's parameter retype (`Partial<UserSettingsData>` → `{ai?:Partial<AiSettings>;display?:Partial<DisplaySettings>}`) keeps `updateAiSettings`/`updateDisplaySettings` compiling (full `AiSettings`/`DisplaySettings` assignable to the partials); no other caller of `updateUserSettings` exists. Green.

### 2. Coverage: requirements → tasks
- Mapped all criteria. Every one maps except **Req 5.7** (the "Provisional score" badge on `"partial"` completeness). It is marked in the requirements as an invariant "verified, not red-first, once criterion 6 sets the field," and task 9 sets `descriptionCompleteness` (Req 5.6) while the existing `MatchDetails.tsx:42-50` renders the badge — so it is covered-by-invariant, but no task lists it and the Scope notes speak only of components. Minor (see R1-1).
- Confirmed no orphan tasks: every task's `_Requirements` names a real criterion.

### 3. Test seams and success-clause coverage (retro P7)
- Verified each `Test:` call is defined and its assertions are reachable with the stated mocks: `matchJobToResume`/`analyzeDiscoveredJob` (task 2, getModel + providerOptions via barrel mock), `getDefaultModelForProvider` (task 3), `takeServerMatchBudget` (task 8), `runServerMatch(task,timeoutMs)` (task 9, `vi.mock("@/lib/ai/providers")`), `enqueueServerMatch` (task 10, fake timers), `resolveMatchReply` (task 11, mocked `buildMatchOffer`/queue), `handleAddJob` (task 12).
- Checked every test the `_Prompt` `Task:` body names also appears in that task's `Success:` clause — tasks 1,2,3,4,5,6,7,8,9,10,12,13,14 all pass; task 11's "skipMatch false/absent behaves as without it" folds into "each branch returns the design kind and exact text." No dropped success clause.
- Probed the task-9 timeout assertion (`runServerMatch(task,5)` → "Timed out after 0.005 s."): N = timeoutMs/1000 matches design C6's closed reason set; distinguishing the timeout signal from a provider throw is implementable and asserted. Fine.

### 4. The setting-off invariant (Req 3.5) across the integration suites (task 12 / D3)
- Stress-tested the claim that existing exact-text cases stay byte-identical: task 12 adds a `getUserAiSettings` module mock (flag off) so `resolveMatchReply` step 2 returns `buildMatchOffer(...)` with the same args `handleAddJob` passes today (`result.descriptionCompleteness ?? "title-only"`). Reply is identical. Holds.
- Checked D3's deliberate divergence from the design (mock `getUserAiSettings`, not `readServerMatchSettings`): legitimate because `readServerMatchSettings` is called inside its own module, so only the module-boundary mock bites. Recorded with rationale; not a contradiction.

### 5. Budget / concurrency semantics (tasks 8, 10) vs Req 6
- Verified the budget is a separate `Map` (task 8 restriction "do not share the MCP store"), so 50 adds (MCP units) and 50 server-match takes (budget units) each stay ≤ 60 default — Req 6.3's five-batch scenario holds.
- Verified the coalescing math: initial run + one `rerun` with the latest task = "exactly two runs" while running; a second enqueue while `queued` just replaces the task = "one run" (Req 4.10 / D14).
- Verified the over-budget wait holds no limiter slot (D6) and never fails (Req 6.4), and that `checkRateLimit` is never touched (Req 6.2/6.5) in both the task-8 and task-10 seams.

## Findings

**R1-1 — MINOR.** Req 5.7 (provisional badge on `"partial"` completeness) is not listed in any task's `_Requirements` or the Scope notes' coverage line. It is covered-by-invariant: task 9 sets `descriptionCompleteness` (Req 5.6) and `MatchDetails.tsx:42-50` already renders the badge, so no implementation is missing. Optional: add 5.7 to task 9's `_Requirements` or a one-line scope note for traceability.

## Top risks/gaps
1. None material. The only coverage observation (Req 5.7, R1-1) is an invariant already satisfied by task 9.

## Top conclusions to challenge
1. "Every task leaves the tree compiling, lint and test green" — challenged via forward-reference, circular-import, and type-retype paths; all hold.
2. "With the setting off every existing exact-text assertion stays" (task 12) — challenged; holds because the flag-off mock routes through unchanged `buildMatchOffer` with identical args.
3. "No task uses an artefact a later task creates" — challenged across all 14 tasks; holds (queue↔run and offer↔matchDirective cycles are type-only or correctly ordered).

## What's missing before acting
- Nothing blocking. Optionally thread Req 5.7 into task 9's `_Requirements` for a clean requirement→task matrix.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
