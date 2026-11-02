# Adversarial Review — server-side-match/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/tasks.md

## Execution context
- Workspace: /home/mcf/repo/jobsync
- Workflow root: /home/mcf/repo/jobsync

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-memory-tasks.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-analysis-tasks.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-memory-tasks.md using this format:

```markdown
# Adversarial Review Memory — tasks
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-analysis-tasks-r2.md

## This round

- Read `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): server-side-match tasks v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `server-side-match` in `/home/mcf/repo/jobsync/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human's gate B; it never reads the body.
- For every `Test:` line: the call exists in the design's interfaces, an earlier task's prompt or this task's prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.
- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task's `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-memory-tasks.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/jobsync`; the spec store under `/home/mcf/repo/jobsync/.spec-workflow`. Use absolute paths.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since eec89f6

````diff
diff --git a/.spec-workflow/specs/server-side-match/tasks.md b/.spec-workflow/specs/server-side-match/tasks.md
index 1781515..8fc985c 100644
--- a/.spec-workflow/specs/server-side-match/tasks.md
+++ b/.spec-workflow/specs/server-side-match/tasks.md
@@ -17,7 +17,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - Regression guards: the call without the new arg sends exactly the base object (Req 1.7); `src/app/api/ai/chat/route.ts` is not edited (Req 1.6)
   - _Leverage: src/lib/agent/nestedGeneration.ts:25-42 (args type), src/lib/agent/nestedGeneration.ts:98-107 (the call), src/lib/agent/tools/matchJob.ts:88-109_
   - _Requirements: 1.1, 1.5, 1.6, 1.7_
-  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C1, create src/lib/ai/matchProviderOptions.ts exporting MATCH_PROVIDER_OPTIONS = { deepseek: { thinking: { type: "disabled" } } } (no "server-only", so every match surface can import it); add the optional trailing field extraProviderOptions to NestedGenerationArgs (:25-42), typed as the providerOptions type streamText accepts, and make the call at :98-107 pass `{ ollama: { options: { num_ctx: numCtx } }, ...extraProviderOptions }`; in src/lib/agent/tools/matchJob.ts pass extraProviderOptions: MATCH_PROVIDER_OPTIONS in the runNestedGeneration call (:88-109). Tests: in __tests__/agentMatchJobTool.spec.ts assert streamText's providerOptions.deepseek.thinking.type is "disabled" and its keys are exactly ollama and deepseek (Req 1.1, 1.5); in __tests__/agentNestedGeneration.spec.ts add a case that extraProviderOptions { deepseek: … } is merged beside ollama, and a regression-guard case (green at base, Req 1.7 invariant) that a call without it sends providerOptions deep-equal to { ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } } } | Restrictions: Do not edit src/app/api/ai/chat/route.ts or the review_resume and generate_cover_letter tools; keep the comment at :104-105 true; do not add think to the ollama key | Success: match_job's streamText call carries deepseek.thinking.type "disabled" beside the unchanged ollama key and no other key; a nested generation given extraProviderOptions merges it beside the ollama key; a nested generation without extraProviderOptions sends exactly the ollama object; git diff shows no change to the chat route; lint and the full suite pass; mark in progress, log-implementation, mark complete_
+  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C1, create src/lib/ai/matchProviderOptions.ts exporting MATCH_PROVIDER_OPTIONS = { deepseek: { thinking: { type: "disabled" } } } (no "server-only", so every match surface can import it); add the optional trailing field extraProviderOptions to NestedGenerationArgs (:25-42), typed as the providerOptions type streamText accepts, and make the call at :98-107 pass `{ ollama: { options: { num_ctx: numCtx } }, ...extraProviderOptions }`; in src/lib/agent/tools/matchJob.ts pass extraProviderOptions: MATCH_PROVIDER_OPTIONS in the runNestedGeneration call (:88-109). Tests: in __tests__/agentMatchJobTool.spec.ts assert streamText's providerOptions.deepseek.thinking.type is "disabled" and its keys are exactly ollama and deepseek (Req 1.1, 1.5); in __tests__/agentNestedGeneration.spec.ts add a case that extraProviderOptions `{ deepseek: … }` is merged beside ollama, and a regression-guard case (green at base, Req 1.7 invariant) that a call without it sends providerOptions deep-equal to `{ ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } } }` | Restrictions: Do not edit src/app/api/ai/chat/route.ts or the review_resume and generate_cover_letter tools; keep the comment at :104-105 true; do not add think to the ollama key | Success: match_job's streamText call carries deepseek.thinking.type "disabled" beside the unchanged ollama key and no other key; a nested generation given extraProviderOptions merges it beside the ollama key; a nested generation without extraProviderOptions sends exactly the ollama object; git diff shows no change to the chat route; lint and the full suite pass; mark in progress, log-implementation, mark complete_
 
 - [ ] 2. Match provider options on the automation match and on-demand analysis
   - File: src/lib/scraper/automation-run/match.ts
@@ -30,7 +30,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - Regression guard: a stored `deepseek-reasoner` reaches `getModel` unchanged (Req 2.3 invariant, green at base)
   - _Leverage: src/lib/scraper/automation-run/match.ts:78-84, src/actions/automation/analyze.ts:112-117, __tests__/agentNestedGeneration.spec.ts:4-8 (partial "ai" mock)_
   - _Requirements: 1.2, 1.3, 1.5, 2.3, 2.4_
-  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C1, add providerOptions: MATCH_PROVIDER_OPTIONS (import the constant task 1 exports) to the generateText call in src/lib/scraper/automation-run/match.ts (:78-84) and in src/actions/automation/analyze.ts (:112-117). Tests: create __tests__/matchProviderOptions.spec.ts; mock generateText with a partial "ai" mock as __tests__/agentNestedGeneration.spec.ts:4-8 does, returning text with a SCORES line, finishReason "stop" and totalUsage; mock getModel through a partial mock of "@/lib/ai" (both files import it from that barrel), and mock the other inputs each function reads (match.ts: ./resumeText; analyze.ts: @/lib/db, ../shared requireUser, @/actions/profile.actions, @/actions/job.actions, @/lib/automation-logger, and preprocessing through "@/lib/ai"). Assert for each function: generateText's providerOptions.deepseek.thinking.type is "disabled" and providerOptions has no key other than deepseek (Req 1.2, 1.3, 1.5). For matchJobToResume with aiSettings { provider: "deepseek", model: "deepseek-reasoner" } assert getModel received "deepseek-reasoner" (regression guard, Req 2.3) and the call still carries thinking disabled (Req 2.4) | Restrictions: Do not change AUTOMATION_JOB_MATCH_SYSTEM_PROMPT, temperatures, the abort signal or the span attributes; do not touch src/lib/scraper/automation-run/aiSettings.ts (task 3 owns it) | Success: both generateText calls send deepseek.thinking.type "disabled" with no other provider key; a stored deepseek-reasoner is sent unchanged with thinking disabled; lint and the full suite pass; mark in progress, log-implementation, mark complete_
+  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C1, add providerOptions: MATCH_PROVIDER_OPTIONS (import the constant task 1 exports) to the generateText call in src/lib/scraper/automation-run/match.ts (:78-84) and in src/actions/automation/analyze.ts (:112-117). Tests: create __tests__/matchProviderOptions.spec.ts; mock generateText with a partial "ai" mock as __tests__/agentNestedGeneration.spec.ts:4-8 does, returning text with a SCORES line, finishReason "stop" and totalUsage; mock getModel through a partial mock of "@/lib/ai" (both files import it from that barrel), and mock the other inputs each function reads (match.ts: ./resumeText; analyze.ts: @/lib/db, ../shared requireUser, @/actions/profile.actions, @/actions/job.actions, @/lib/automation-logger, and preprocessing through "@/lib/ai"). Assert for each function: generateText's providerOptions.deepseek.thinking.type is "disabled" and providerOptions has no key other than deepseek (Req 1.2, 1.3, 1.5). For matchJobToResume with aiSettings { provider: "deepseek", model: "deepseek-reasoner" } assert getModel received "deepseek-reasoner" (regression guard, Req 2.3) and the call still carries thinking disabled (Req 2.4) | Restrictions: Do not change AUTOMATION_JOB_MATCH_SYSTEM_PROMPT, temperatures, the abort signal or the span attributes; do not touch src/lib/scraper/automation-run/aiSettings.ts (the DeepSeek-enum change owns it) | Success: both generateText calls send deepseek.thinking.type "disabled" with no other provider key; a stored deepseek-reasoner is sent unchanged with thinking disabled; lint and the full suite pass; mark in progress, log-implementation, mark complete_
 
 - [ ] 3. DeepSeek model enum and default
   - File: src/models/ai.model.ts
@@ -54,7 +54,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - `AiSettings` gains `serverSideMatch?: boolean`; `updateUserSettings` takes per-key partials; new action `updateServerSideMatch` (design C3)
   - Purpose: the flag persists without touching the stored provider or model (Req 3.2, 3.3)
   - Exact values: new suite only; `defaultUserSettings` (:22-30) is unchanged, so no existing assertion changes
-  - Regression guard: `updateAiSettings` keeps a stored flag — the merge at `src/actions/userSettings.actions.ts:68-72` already spreads stored `ai` under the patch (Req 3.3, green at base)
+  - Regression guard: `updateAiSettings` (`src/actions/userSettings.actions.ts:114-118`) keeps a stored flag — the merge at `src/actions/userSettings.actions.ts:68-72` already spreads stored `ai` under the patch (Req 3.3, green at base)
   - _Leverage: src/actions/userSettings.actions.ts:48-112, src/actions/userSettings.actions.ts:114-118, src/models/userSettings.model.ts:3-6_
   - _Requirements: 3.1, 3.2, 3.3_
   - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C3, add serverSideMatch?: boolean to AiSettings (src/models/userSettings.model.ts:3-6); change the updateUserSettings parameter (src/actions/userSettings.actions.ts:48-50) from Partial of UserSettingsData to an object with optional ai: Partial of AiSettings and optional display: Partial of DisplaySettings, leaving the merge body unchanged; add the async server action updateServerSideMatch(enabled: boolean) that returns updateUserSettings({ ai: { serverSideMatch: enabled } }). Tests: create __tests__/userSettingsServerMatch.spec.ts mocking prisma (userSettings.findUnique and upsert) and requireUser; assert that with stored ai { provider: "deepseek", model: "deepseek-flash" }, updateServerSideMatch(true) writes settings whose ai is { provider: "deepseek", model: "deepseek-flash", serverSideMatch: true } (Req 3.2); assert with no stored row the written ai carries the default provider, no model and serverSideMatch true; regression guard (green at base): with stored ai carrying serverSideMatch true, updateAiSettings({ provider: "openai", model: "gpt-4o" }) writes ai with serverSideMatch still true (Req 3.3) | Restrictions: Do not change defaultUserSettings (an absent flag reads as off, Req 3.1); do not change updateAiSettings or updateDisplaySettings bodies; the file stays "use server" and exports only async functions | Success: updateServerSideMatch persists the flag and keeps provider and model; with no stored row it writes the default provider, no model and the flag; updateAiSettings keeps a stored flag; npx tsc --noEmit passes with the new parameter type; lint and the full suite pass; mark in progress, log-implementation, mark complete_
@@ -77,7 +77,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - File: src/lib/mcp/tools/getJob.ts
   - File: __tests__/mcpGetJob.spec.ts
   - Test: __tests__/mcpGetJob.spec.ts — handleGetJob(input, userId)
-  - Job gains `serverMatchError` and `serverMatchFailedAt` after `descriptionCompleteness` (`prisma/schema.prisma:476`); `renderDetail` appends the failure line (design C9, Data Models)
+  - Job gains `serverMatchError` and `serverMatchFailedAt` after `descriptionCompleteness`; `renderDetail` appends the failure line (design C9, Data Models)
   - Purpose: `get_job` shows a server-match failure no later match superseded (Req 7.4, 7.5)
   - Exact values: fixtures without the columns render as today; `__tests__/mcpGetJob.spec.ts:210-240` assertions stay
   - Regression guards: a row with null columns renders byte-identically (Req 3.5); a saved server match renders `via deepseek/deepseek-flash` (Req 5.8); `__tests__/backup*.spec.ts` stay green unchanged
@@ -103,7 +103,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - File: src/lib/mcp/serverMatch/budget.ts
   - File: __tests__/serverMatchBudget.spec.ts
   - Test: __tests__/serverMatchBudget.spec.ts — takeServerMatchBudget(userId)
-  - Add `SERVER_MATCH_SURFACE: "server"` (beside `src/lib/constants.ts:169`) and `SERVER_MATCH_CONCURRENCY: 3` (beside :109); export `configuredMax` (`src/lib/mcp/rate-limit.ts:13-17`) as `mcpRateLimitMax`; new per-user budget (design C8)
+  - Add `SERVER_MATCH_SURFACE: "server"` (beside `src/lib/constants.ts:169`) and `SERVER_MATCH_CONCURRENCY: 3` (beside `src/lib/constants.ts:109`); export the MCP limiter's `configuredMax` (`src/lib/mcp/rate-limit.ts:13-17`) under a new name; new per-user budget (design C8)
   - Purpose: server matches have their own budget, at least the MCP hourly budget (Req 6.2, 6.3)
   - Exact values: `__tests__/mcpRateLimit.spec.ts` keeps its values; `MAX` (:19) is unchanged
   - _Leverage: src/lib/mcp/rate-limit.ts:23-49, src/lib/ai/rate-limiter.ts:33-78 (checkRateLimit, not called)_
@@ -119,7 +119,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - Exact values: new suite only
   - _Leverage: src/lib/agent/tools/matchJob.ts:48-70 (lookups, preprocess), src/actions/automation/analyze.ts:92-127 (withSpan, generateText), src/lib/ai/jobMatch/parse.ts:24-45, src/lib/ai/providers.ts:7-23_
   - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.6_
-  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C6 and the matchData shape in design Data Models, create src/lib/mcp/serverMatch/run.ts exporting the ServerMatchTask type and runServerMatch(task, timeoutMs = APP_CONSTANTS.AI_JOB_MATCH_TIMEOUT_MS) returning "saved", "failed" or "dropped", following design C6 steps 1-7, the Fail paragraph and the closed reason set exactly. Import getModel from "@/lib/ai/providers" (not the barrel) and the preprocessors from the paths matchJob.ts uses. Tests: create __tests__/serverMatchRun.spec.ts; vi.mock "@/lib/ai/providers" so getModel returns a MockLanguageModelV3 from "ai/test"; mock the lookups and preprocessors as __tests__/mcpAddJob.spec.ts:10-32 does, writeJobMatch's module, and @prisma/client for job.updateMany. Assert: system, prompt, temperature and doGenerateCalls[0].providerOptions (ollama num_ctx plus deepseek thinking "disabled") (Req 5.3, 1.4); resolveJobForAgent is called with the task's userId and jobId at run time (Req 5.2, NFR security); the saved matchData fields and surface "server" (Req 5.6); each reason writes serverMatchError and serverMatchFailedAt through updateMany scoped { id, userId }, logs one error line, and never calls writeJobMatch (Req 7.2, 7.3); no_job, a P2025 from writeJobMatch, and updateMany count 0 return "dropped" with no record (Req 7.6); runServerMatch(task, 5) with a never-resolving model returns "failed" with the reason "Timed out after 0.005 s." | Restrictions: Never read userId from the job row; no real provider call; do not import from src/lib/mcp/serverMatch/queue.ts (task 10 creates it) | Success: a scored reply saves matchData with every design field through writeJobMatch; every failure reason records the columns and one log line without touching the match; deleted jobs drop silently; the request carries the shared prompt, FEEDBACK temperature and both provider options; the job lookup uses the task's userId and jobId at run time; a 5 ms timeout returns "failed" with the timeout reason; lint and the full suite pass; mark in progress, log-implementation, mark complete_
+  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C6 and the matchData shape in design Data Models, create src/lib/mcp/serverMatch/run.ts exporting the ServerMatchTask type and runServerMatch(task, timeoutMs = APP_CONSTANTS.AI_JOB_MATCH_TIMEOUT_MS) returning "saved", "failed" or "dropped", following design C6 steps 1-7, the Fail paragraph and the closed reason set exactly. Import getModel from "@/lib/ai/providers" (not the barrel) and the preprocessors from the paths matchJob.ts uses. Tests: create __tests__/serverMatchRun.spec.ts; vi.mock "@/lib/ai/providers" so getModel returns a MockLanguageModelV3 from "ai/test"; mock the lookups and preprocessors as __tests__/mcpAddJob.spec.ts:10-32 does, writeJobMatch's module, and @prisma/client for job.updateMany. Assert: system, prompt, temperature and doGenerateCalls[0].providerOptions (ollama num_ctx plus deepseek thinking "disabled") (Req 5.3, 1.4); resolveJobForAgent is called with the task's userId and jobId at run time (Req 5.2, NFR security); the saved matchData fields and surface "server" (Req 5.6); each reason writes serverMatchError and serverMatchFailedAt through updateMany scoped { id, userId }, logs one error line, and never calls writeJobMatch (Req 7.2, 7.3); no_job, a P2025 from writeJobMatch, and updateMany count 0 return "dropped" with no record (Req 7.6); runServerMatch(task, 5) with a never-resolving model returns "failed" with the reason "Timed out after 0.005 s." | Restrictions: Never read userId from the job row; no real provider call; do not import from src/lib/mcp/serverMatch/queue.ts (the queue module is created afterwards and imports this run, not the reverse) | Success: a scored reply saves matchData with every design field through writeJobMatch; every failure reason records the columns and one log line without touching the match; deleted jobs drop silently; the request carries the shared prompt, FEEDBACK temperature and both provider options; the job lookup uses the task's userId and jobId at run time; a 5 ms timeout returns "failed" with the timeout reason; lint and the full suite pass; mark in progress, log-implementation, mark complete_
 
 - [ ] 10. Server match queue and limiter
   - File: src/lib/mcp/serverMatch/queue.ts
@@ -143,7 +143,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - Regression guard: off returns the `buildMatchOffer` result by deep equality (Req 3.5 invariant)
   - _Leverage: src/lib/mcp/tools/matchDirective.ts:65-141, src/lib/scraper/automation-run/aiSettings.ts:41-55_
   - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.5, 4.6, 4.7, 8.2, 8.3, 8.4_
-  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C4 (Interfaces, Order steps 1-5, Texts exact), create src/lib/mcp/serverMatch/offer.ts; readServerMatchSettings reads through getUserAiSettings(userId) and reads a throw or a non-true flag as off; enqueue through the function task 10 exports. In src/lib/mcp/tools/matchDirective.ts widen composeOfferMessage's offer parameter to MatchReply with an `import type` (offer.ts imports from this file). Tests: create __tests__/serverMatchOffer.spec.ts with partial mocks of @/lib/scraper/automation-run/aiSettings (getUserAiSettings), @/lib/mcp/tools/matchDirective (buildMatchOffer) and a full mock of the queue module. Assert: skipMatch true returns kind "skipped" with SKIPPED_TEXT and reads no settings and builds no offer (Req 8.2, 8.3); skipMatch false or absent behaves as without it (Req 8.4); a stored ai without the flag, a throwing read and the flag off each return buildMatchOffer's result by deep equality and never enqueue (Req 3.1, 3.5); getUserAiSettings is called with the given userId (Req 3.4); a note offer passes through (Req 4.6); a directive with no model returns NO_MODEL_TEXT as a note (Req 4.7); a directive with a model enqueues once with { jobId, userId, provider, model } and returns QUEUED_TEXT (Req 4.1); none of the three texts contains "SYSTEM PROMPT:" or "save_match_result" (Req 4.5) | Restrictions: Do not change buildMatchOffer or composeOfferMessage's body; do not edit the MCP handlers (task 12 owns them) | Success: each branch returns the design kind and exact text; skip reads no settings and builds no offer; an absent flag, a throwing read and the flag off each equal buildMatchOffer's output; settings are read by the given userId; enqueue happens once, only on the queued branch, with the task fields; no text contains "SYSTEM PROMPT:" or "save_match_result"; lint and the full suite pass; mark in progress, log-implementation, mark complete_
+  - _Prompt: Task: Implement the task for spec server-side-match, first run spec-workflow-guide to get the workflow guide then implement the task: per design C4 (Interfaces, Order steps 1-5, Texts exact), create src/lib/mcp/serverMatch/offer.ts; readServerMatchSettings reads through getUserAiSettings(userId) and reads a throw or a non-true flag as off; enqueue through the function task 10 exports. In src/lib/mcp/tools/matchDirective.ts widen composeOfferMessage's offer parameter to MatchReply with an `import type` (offer.ts imports from this file). Tests: create __tests__/serverMatchOffer.spec.ts with partial mocks of @/lib/scraper/automation-run/aiSettings (getUserAiSettings), @/lib/mcp/tools/matchDirective (buildMatchOffer) and a full mock of the queue module. Assert: skipMatch true returns kind "skipped" with SKIPPED_TEXT and reads no settings and builds no offer (Req 8.2, 8.3); skipMatch false or absent behaves as without it (Req 8.4); a stored ai without the flag, a throwing read and the flag off each return buildMatchOffer's result by deep equality and never enqueue (Req 3.1, 3.5); getUserAiSettings is called with the given userId (Req 3.4); a note offer passes through (Req 4.6); a directive with no model returns NO_MODEL_TEXT as a note (Req 4.7); a directive with a model enqueues once with { jobId, userId, provider, model } and returns QUEUED_TEXT (Req 4.1); none of the three texts contains "SYSTEM PROMPT:" or "save_match_result" (Req 4.5) | Restrictions: Do not change buildMatchOffer or composeOfferMessage's body; do not edit the MCP handlers (the handler-wiring change owns them) | Success: each branch returns the design kind and exact text; skip reads no settings and builds no offer; an absent flag, a throwing read and the flag off each equal buildMatchOffer's output; settings are read by the given userId; enqueue happens once, only on the queued branch, with the task fields; no text contains "SYSTEM PROMPT:" or "save_match_result"; lint and the full suite pass; mark in progress, log-implementation, mark complete_
 
 - [ ] 12. MCP handlers and the skip flag
   - File: src/models/mcp.schema.ts
@@ -168,7 +168,7 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
   - File: wiki/mcp.md
   - File: evals/mcp-tools/tools.json
   - Test: __tests__/mcpToolDescriptions.spec.ts — MCP_TOOL_DESCRIPTIONS
-  - Rewrite the `add_job` (:7), `update_job` (:17) and `add_jobs_batch` (:23) descriptions per design C5; document the setting and `skipMatch` in `wiki/mcp.md:76-98`; regenerate `evals/mcp-tools/tools.json`
+  - Rewrite the `add_job` (`src/lib/mcp/toolDescriptions.ts:6-7`), `update_job` (`src/lib/mcp/toolDescriptions.ts:16-17`) and `add_jobs_batch` (`src/lib/mcp/toolDescriptions.ts:22-23`) descriptions per design C5; document the setting and the skip flag in `wiki/mcp.md:76-98`; regenerate `evals/mcp-tools/tools.json`
   - Purpose: the agent learns the reply can say the match is queued (Req 4.12)
   - Exact values: no suite asserts these strings today; `evals/mcp-tools/tools.json` is generated, never hand-edited
   - _Leverage: evals/mcp-tools/generate-tools.ts, evals/mcp-tools/tools.ts_
@@ -208,3 +208,4 @@ Dependency order: tasks run in number order on one branch from `main`. Tasks 1-3
 ## Revision History
 
 - **v1** (2026-10-31) — Initial draft.
+  - **Lint pass.** 10 fixed; rejected: none.

````
