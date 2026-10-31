# Adversarial Review — server-side-match/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/design.md

## Execution context
- Workspace: /home/mcf/repo/jobsync
- Workflow root: /home/mcf/repo/jobsync

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

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
Write your analysis to: /home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): server-side-match design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `server-side-match` in `/home/mcf/repo/jobsync/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/jobsync` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/jobsync`; the spec store under `/home/mcf/repo/jobsync/.spec-workflow`. Use absolute paths.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 3058b20

````diff
diff --git a/.spec-workflow/specs/server-side-match/design.md b/.spec-workflow/specs/server-side-match/design.md
index 5523a0f..40e367b 100644
--- a/.spec-workflow/specs/server-side-match/design.md
+++ b/.spec-workflow/specs/server-side-match/design.md
@@ -13,7 +13,7 @@ The steering files tech.md and structure.md do not exist; the design follows the
 New server-match files go in `src/lib/mcp/serverMatch/` because only MCP handlers enqueue; the shared match write goes in `src/lib/jobs/` beside `createJobFromNames`, which is the non-action home for job writes that take a user id.
 
 ### Design System (design-system.md) — if applicable
-N/A — the project has no design-system.md. The one new control reuses `Switch` (`src/components/ui/switch.tsx:8-29`) and `Label`, as `AiSettings.tsx` uses `Label` and `Select`.
+N/A — the project has no design-system.md. The one new control reuses `Switch` (`src/components/ui/switch.tsx:8-29`) and `Label`, as `AiSettings.tsx` uses `Label` and `Select` (`src/components/settings/AiSettings.tsx:16-23`).
 
 ## Architecture
 
@@ -43,17 +43,17 @@ graph TD
   - `src/lib/scraper/automation-run/match.ts:78-84` and `src/actions/automation/analyze.ts:112-117`: each `generateText` call adds `providerOptions: MATCH_PROVIDER_OPTIONS` (Req 1.2, 1.3).
   - C6 passes it (Req 1.4).
   - `src/app/api/ai/chat/route.ts` is not edited (Req 1.6, invariant).
-- **Reuses:** probe of the installed `@ai-sdk/deepseek` 2.0.4: the option schema (`node_modules/@ai-sdk/deepseek/dist/index.js:300-307`), the `deepseek` options key (`node_modules/@ai-sdk/deepseek/dist/index.js:418-420`, `node_modules/@ai-sdk/deepseek/dist/index.js:805`), the copy into the body (`node_modules/@ai-sdk/deepseek/dist/index.js:473`). `generateText` takes `providerOptions` in the installed `ai` 6.0.256 (`node_modules/ai/dist/index.d.ts:1390`).
+- **Reuses:** probe of the installed `@ai-sdk/deepseek` 2.0.4: the option schema (`node_modules/@ai-sdk/deepseek/dist/index.js:300-307`), the `deepseek` options key (`node_modules/@ai-sdk/deepseek/dist/index.js:418-420`, `node_modules/@ai-sdk/deepseek/dist/index.js:805`), the copy into the body (`node_modules/@ai-sdk/deepseek/dist/index.js:473`). `generateText` takes `providerOptions` in the installed `ai` 6.0.256 (`node_modules/ai/dist/index.d.ts:1361-1390`).
 
 ### C2 — DeepSeek model enum and default
 - **Purpose:** Name `deepseek-flash` as the default and the only fallback (Req 2.1, 2.2).
-- **Interfaces:** `DeepseekModel` (`src/models/ai.model.ts:37-40`) becomes one member, `DEEPSEEK_FLASH = "deepseek-flash"`; `DEEPSEEK_CHAT` and `DEEPSEEK_REASONER` are removed. `getDefaultModelForProvider` (`src/lib/scraper/automation-run/aiSettings.ts:32-33`) returns `DeepseekModel.DEEPSEEK_FLASH`.
-- **Post-conditions:** `getFallbackModels` (`src/components/settings/AiSettings.tsx:76-87`) needs no edit; `Object.values(DeepseekModel)` yields `["deepseek-flash"]`. No code reads or rewrites a stored model name, so a stored retired alias is sent unchanged (Req 2.3, invariant). A repo-wide search finds no other reference to the two removed members.
+- **Interfaces:** `DeepseekModel` (`src/models/ai.model.ts:37-40`) becomes one member, `DEEPSEEK_FLASH = "deepseek-flash"`; `DEEPSEEK_CHAT` and `DEEPSEEK_REASONER` are removed. `getDefaultModelForProvider` (`src/lib/scraper/automation-run/aiSettings.ts:26-39`) returns `DeepseekModel.DEEPSEEK_FLASH`.
+- **Post-conditions:** `getFallbackModels` (`src/components/settings/AiSettings.tsx:76-87`) needs no edit; `Object.values(DeepseekModel)` yields `["deepseek-flash"]`. No code reads or rewrites a stored model name, so a stored retired alias is sent unchanged (Req 2.3, invariant).
 
 ### C3 — Server-side match setting
 - **Purpose:** The opt-in flag, read without a session (Req 3).
 - **Interfaces:**
-  - `AiSettings` (`src/models/userSettings.model.ts:3-6`) gains `serverSideMatch?: boolean`. Absent reads as off (Req 3.1). `defaultUserSettings` is not changed.
+  - `AiSettings` (`src/models/userSettings.model.ts:3-6`) gains `serverSideMatch?: boolean`. Absent reads as off (Req 3.1). `defaultUserSettings` (`src/models/userSettings.model.ts:22-30`) is not changed.
   - `updateUserSettings` (`src/actions/userSettings.actions.ts:48-112`) changes its parameter type from `Partial<UserSettingsData>` to `{ ai?: Partial<AiSettings>; display?: Partial<DisplaySettings> }`. The merge body is unchanged; it already spreads `currentSettings.ai` under `settings.ai` (lines 68-72).
   - New server action `updateServerSideMatch(enabled: boolean)` in the same file calls `updateUserSettings({ ai: { serverSideMatch: enabled } })`. The merge keeps the stored provider and model (Req 3.2).
   - `updateAiSettings` is unchanged; its `{ provider, model }` patch merges over the stored `ai`, so a stored `serverSideMatch` survives a model save (Req 3.3).
@@ -83,9 +83,9 @@ graph TD
 - **Purpose:** Route the three write paths and the skip flag through C4 (Req 4, Req 8).
 - **Changes:**
   - `McpAddJobInputShape` (`src/models/mcp.schema.ts:29-73`) gains `skipMatch: z.boolean().optional().describe("Set true to ask JobSync not to score this job: no match directive, no server-side match.")`. `McpAddJobSchema` and the batch item (`src/models/mcp.schema.ts:325-336`) inherit it (Req 8.1).
-  - `handleAddJob` (`src/lib/mcp/tools/addJob.ts:38-46`) calls `resolveMatchReply(result.jobId, userId, result.descriptionCompleteness ?? "title-only", "add", input.skipMatch)` in place of `buildMatchOffer`. `createJobFromNames` destructures its input (`src/lib/jobs/createJobFromNames.ts:58-75`), so the extra field is ignored there.
+  - `handleAddJob` (`src/lib/mcp/tools/addJob.ts:8-46`) calls `resolveMatchReply(result.jobId, userId, result.descriptionCompleteness ?? "title-only", "add", input.skipMatch)` in place of `buildMatchOffer`. `createJobFromNames` destructures its input (`src/lib/jobs/createJobFromNames.ts:54-75`), so the extra field is ignored there.
   - `upsertExisting` (`src/lib/mcp/tools/addJob.ts:57-78`) strips `skipMatch` with `upsert` and `allowDuplicate` at line 62. On a changed description it calls `resolveMatchReply(..., "update", input.skipMatch)` (Req 4.3, 8.5).
-  - `handleUpdateJob` (`src/lib/mcp/tools/updateJob.ts:29-37`) calls `resolveMatchReply(..., "update")` with no skip flag; `update_job` gets no `skipMatch` (requirements D4).
+  - `handleUpdateJob` (`src/lib/mcp/tools/updateJob.ts:7-37`) calls `resolveMatchReply(..., "update")` with no skip flag; `update_job` gets no `skipMatch` (requirements D4).
   - These replies stay as at base: the duplicate path (`src/lib/mcp/tools/addJob.ts:27-36`), the not-updated and description-unchanged paths, the rate-limit replies, and `handleGetJob` with `matchDirective` (Req 4.8, 4.9, invariants). `handleAddJobsBatch` needs no edit; each item goes through `handleAddJob` and its labelled line carries that item's reply (Req 4.4).
   - `MCP_TOOL_DESCRIPTIONS` (`src/lib/mcp/toolDescriptions.ts:5-32`): `add_job` and `add_jobs_batch` each append "The reply carries a match directive, or states that the match is queued when server-side matching is on. Pass skipMatch: true to skip scoring a job." `update_job` changes "requests a fresh match analysis" to "requests a fresh match analysis: the reply carries a match directive, or states that the match is queued when server-side matching is on" (Req 4.12).
 
@@ -94,7 +94,7 @@ graph TD
 - **Interfaces:** new file `src/lib/mcp/serverMatch/run.ts`: `runServerMatch(task: ServerMatchTask, timeoutMs?: number): Promise<"saved" | "failed" | "dropped">`, where `ServerMatchTask = { jobId: string; userId: string; provider: AiProvider; model: string }`. `timeoutMs` defaults to `APP_CONSTANTS.AI_JOB_MATCH_TIMEOUT_MS`.
 - **Steps (post-conditions):**
   1. `resolveJobForAgent(userId, jobId)` (`src/lib/agent/jobLookup.ts:12-27`); `no_job` → `"dropped"` with no write (Req 7.6). The description is read here, at run time (Req 5.2).
-  2. `resolveResumeForAgent(userId, { pageResumeId: job.resumeId ?? undefined })`, as `src/lib/mcp/tools/matchDirective.ts:95-97`; `no_resumes` or `needs_selection` → fail.
+  2. `resolveResumeForAgent(userId, { pageResumeId: job.resumeId ?? undefined })`, as `src/lib/mcp/tools/matchDirective.ts:95-100`; `no_resumes` or `needs_selection` → fail.
   3. `Promise.all([preprocessResume(resume), preprocessJob(job)])`; job failure first, then resume failure → fail (Req 5.1, 7.2).
   4. `getModel(provider, model, userId)` (`src/lib/ai/providers.ts:7-23`); a throw → fail.
   5. Inside `withSpan("mcp.server_match", …)` with `genAiRequestAttrs` (surface `SURFACES.JOB_MATCH`), call `generateText`. It gets `system: JOB_MATCH_SYSTEM_PROMPT`, `prompt: buildJobMatchPrompt(resumeNormalized, jobNormalized)`, `temperature: TEMPERATURES.FEEDBACK`, `abortSignal: AbortSignal.timeout(timeoutMs)`, and `providerOptions: { ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } }, ...MATCH_PROVIDER_OPTIONS }` (Req 5.3, 1.4). A throw → fail; `finishReason !== "stop"` → fail (Req 7.2).
@@ -102,7 +102,7 @@ graph TD
   7. Build `matchData` (Data Models) and call `writeJobMatch(userId, jobId, scores.matchScore, JSON.stringify(matchData))` (C7) → `"saved"` (Req 5.5, 5.6). A Prisma `P2025` from the write means the job is gone → `"dropped"` (Req 7.6).
 - **Fail:** call `recordServerMatchFailure(userId, jobId, reason)`. It runs `prisma.job.updateMany({ where: { id: jobId, userId }, data: { serverMatchError: reason, serverMatchFailedAt: new Date() } })`. A count of 0 → `"dropped"`, with no record and no error line. Otherwise it logs one `log.error("[server-match] match failed", { jobId, userId, provider, model, reason })` → `"failed"` (Req 7.3). The fail path never writes `matchScore` or `matchData`, so an existing match stays (Req 7.2, requirements D10).
 - **Reasons (exact, closed set):** "No resume could be resolved — set a default resume in Profile → Resumes." · "The job description could not be prepared for matching." · "The resume could not be prepared for matching." · "Provider error: " plus the error message cut to 200 characters · "Timed out after N s." (N = `timeoutMs / 1000`, used when the timeout signal aborted) · "The generation stopped early (finish reason: X)." · "The reply had no SCORES line."
-- **Telemetry:** reuse `SURFACES.JOB_MATCH` (`src/lib/telemetry/genai.ts:7-14`), which the on-demand analysis already uses for the shared prompt (`src/actions/automation/analyze.ts:100`). The span adds `jobsync.user_id` and `jobsync.job_id`.
+- **Telemetry:** reuse `SURFACES.JOB_MATCH` (`src/lib/telemetry/genai.ts:7-14`), which the on-demand analysis already uses for the shared prompt (`src/actions/automation/analyze.ts:100-109`). The span adds `jobsync.user_id` and `jobsync.job_id`.
 
 ### C7 — Shared match write (`writeJobMatch`)
 - **Purpose:** One user-id-scoped write for `saveJobMatchResult` and the server match (Req 5.5).
@@ -135,7 +135,7 @@ graph TD
 
 ### C9 — get_job failure line
 - **Purpose:** Show a server-match failure that no later match superseded (Req 7.4, 7.5, 5.8).
-- **Change:** `renderDetail` (`src/lib/mcp/tools/getJob.ts:95-111`) appends one line after the score block ("Not scored." or the score with body). The line is `Server-side match failed YYYY-MM-DD: <reason>`, using the existing `day()` helper. It appears when `job.serverMatchFailedAt` is set AND one of these is true: the score is hidden, `matchedAt` is missing, or `matchedAt` is earlier than `serverMatchFailedAt`.
+- **Change:** `renderDetail` (`src/lib/mcp/tools/getJob.ts:50-111`) appends one line after the score block ("Not scored." or the score with body). The line is `Server-side match failed YYYY-MM-DD: <reason>`, using the existing `day()` helper. It appears when `job.serverMatchFailedAt` is set AND one of these is true: the score is hidden, `matchedAt` is missing, or `matchedAt` is earlier than `serverMatchFailedAt`.
 - **Post-conditions:** any later saved match, on any surface, sets a later `matchedAt` and hides the line (Req 7.5). Rows with null failure columns render as at base (Req 3.5). A saved server match renders through the existing score line as `via deepseek/deepseek-flash` (Req 5.8, invariant). `GET_JOB_INCLUDE` uses `include`, so the new scalars load with no edit.
 
 ## Data Models
@@ -232,7 +232,7 @@ No test calls a real provider. Each generation test stubs `getModel` (`vi.mock("
   - It turns the switch on in Settings → AI Provider and checks that it stays on after a reload (Req 3.2).
   - Over MCP, `add_job` with `skipMatch: true` and the `FULL_POSTING` fixture (`e2e/mcp-write-tools.spec.ts:15-32`) replies with the skipped text and no `SYSTEM PROMPT:` (Req 8.3).
   - A title-only `add_job` replies with the thin-description note (Req 4.6).
-  - The queued path is not run end to end: the API-key resolver falls back to environment keys (`src/lib/api-key-resolver.ts:34`), so a queued run could reach a real provider (D10).
+  - The queued path is not run end to end (D10); integration tests cover it.
 
 ## Decisions taken in this document
 
@@ -268,3 +268,4 @@ No test calls a real provider. Each generation test stubs `getModel` (`vi.mock("
 ## Revision History
 
 - **v1** (2026-10-30) — Initial draft.
+  - **Lint pass.** 13 fixed. Rejected: L-3,5,6,7,8,38,39 @-scoped node_modules paths resolve on the real tree (linter artifact); L-10,13,15,18,21,31,34,36 new identifiers this design adds; L-12,14,20,22,23,24,25,30,32,33,37,40 builtins or symbols cited elsewhere.

````
