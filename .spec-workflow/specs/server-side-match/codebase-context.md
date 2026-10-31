# Codebase context — server-side-match

## MCP job tools
- src/app/api/mcp/route.ts:72-98 — add_job registration: scope check, schema parse, call to handleAddJob with userId and tokenName.
- src/lib/mcp/tools/addJob.ts:8-52 — handleAddJob: MCP rate check, createJobFromNames, buildMatchOffer in the "add" context, composed reply.
- src/lib/mcp/tools/addJob.ts:57-78 — upsertExisting: duplicate with upsert routes to updateJobFromNames; offer only when the description changed.
- src/lib/mcp/tools/addJobsBatch.ts:7-40 — handleAddJobsBatch: sequential handleAddJob per item, "[n/m]" labels, stops at the rate limit.
- src/lib/mcp/tools/updateJob.ts:7-43 — handleUpdateJob: offer only when updated and descriptionChanged.
- src/lib/mcp/tools/getJob.ts:158-203 — handleGetJob: matchDirective flag appends an offer in the "rescore" context.
- src/lib/mcp/tools/getJob.ts:95-111 — "## Match" section of the detail: "Not scored." or score, recommendation, date, provider/model, body.
- src/lib/mcp/tools/matchDirective.ts:22-60 — buildMatchDirective: directive text with the shared system and user prompts.
- src/lib/mcp/tools/matchDirective.ts:65-141 — buildMatchOffer: title-only, no job, no resume, unreadable job, unreadable resume notes; else directive.
- src/lib/mcp/tools/matchDirective.ts:144-151 — composeOfferMessage: blank line before a directive, space before a note.
- src/lib/mcp/tools/saveMatchResult.ts:73-85 — matchData written by save_match_result: provider "mcp" marker, model is the token name, analyzed true, descriptionCompleteness.
- src/lib/mcp/toolDescriptions.ts:5-32 — MCP tool descriptions; add_job, update_job, add_jobs_batch mention the match directive.
- src/models/mcp.schema.ts:29-73 — McpAddJobInputShape: add_job wire fields, including allowDuplicate and upsert.
- src/models/mcp.schema.ts:76-80 — McpAddJobSchema: transforms for dates.
- src/models/mcp.schema.ts:187-192 — get_job matchDirective flag.
- src/models/mcp.schema.ts:334-336 — McpAddJobsBatchSchema: at most MCP_BATCH_MAX_ITEMS jobs.
- src/lib/mcp/rate-limit.ts:13-49 — checkMcpRateLimit: per-user hourly budget, MCP_RATE_LIMIT_MAX env override.

## Match pipeline (shared)
- src/lib/agent/tools/matchJob.ts:41-174 — in-app Match (agent match_job tool): resolve job and resume, preprocess, generate, parse, save.
- src/lib/agent/tools/matchJob.ts:88-109 — match_job generation call: shared prompts, TEMPERATURES.FEEDBACK, AI_JOB_MATCH_TIMEOUT_MS.
- src/lib/agent/tools/matchJob.ts:143-157 — match_job matchData shape and saveJobMatchResult call.
- src/lib/agent/nestedGeneration.ts:50-150 — runNestedGeneration: streamText for match_job, review_resume, generate_cover_letter.
- src/lib/agent/nestedGeneration.ts:98-107 — providerOptions passes only the Ollama num_ctx; no DeepSeek option.
- src/lib/agent/jobLookup.ts:12-27 — resolveJobForAgent: owned job by id with title, company, location.
- src/lib/agent/resumeLookup.ts:1-90 — resolveResumeForAgent: page resume, title, default, only resume, else needs_selection.
- src/lib/ai/jobMatch/parse.ts:24-45 — parseJobMatch: SCORES line to scores, rest to body.
- src/lib/ai/prompts/job-match/system.ts:1-58 — JOB_MATCH_SYSTEM_PROMPT.
- src/lib/ai/prompts/job-match/user.ts:1-26 — buildJobMatchPrompt.
- src/actions/job/status.ts:52-70 — saveJobMatchResult: resolves the user from the session with requireUser, writes matchScore and matchData.
- src/actions/shared.ts:6-12 — requireUser throws "Not authenticated" without a session.
- src/models/ai.schemas.ts:60-76 — JobMatchData: provider, model, surface, analyzed, descriptionCompleteness.
- src/actions/job/shared.ts:12-20 — hideUnanalyzedScore: hides the score when analyzed is false.
- src/components/automations/MatchDetails.tsx:42-50 — "Provisional score" badge when descriptionCompleteness is not "full".

## Automation match
- src/lib/scraper/automation-run/match.ts:32-131 — matchJobToResume: automation prompt, generateText, parse.
- src/lib/scraper/automation-run/match.ts:78-84 — automation generateText call; no providerOptions.
- src/actions/automation/analyze.ts:31-163 — analyzeDiscoveredJob: on-demand match of a discovered job with the shared prompt.
- src/actions/automation/analyze.ts:112-117 — analyze generateText call; no providerOptions.
- src/lib/scraper/automation-run/aiSettings.ts:18-24 — getAutomationMatchLimit: p-limit, Ollama 1, else AUTOMATION_MATCH_CONCURRENCY.
- src/lib/scraper/automation-run/aiSettings.ts:26-39 — getDefaultModelForProvider: DeepSeek returns DEEPSEEK_CHAT.
- src/lib/scraper/automation-run/aiSettings.ts:41-55 — getUserAiSettings: user ai settings merged over defaults, by userId.

## AI providers and models
- src/models/ai.model.ts:37-40 — DeepseekModel enum: deepseek-chat, deepseek-reasoner.
- src/lib/ai/providers.ts:7-23 — getModel: resolve credential by userId, build the provider model.
- src/lib/ai/provider-registry.server.ts:16 — DeepSeek factory: createDeepSeek with the API key.
- src/lib/ai/provider-registry.ts:64-80 — DeepSeek registry entry; live models endpoint.
- node_modules/@ai-sdk/deepseek/dist/index.d.ts:5-13 — installed 2.0.4: DeepSeekChatModelId and the thinking option, type "enabled" or "disabled".
- node_modules/@ai-sdk/deepseek/dist/index.js:300-307 — thinking option schema; comment says it defaults to enabled.
- node_modules/@ai-sdk/deepseek/dist/index.js:418-420 — providerOptionsName: first segment of the provider id.
- node_modules/@ai-sdk/deepseek/dist/index.js:437-440 — provider options parsed under the provider's options name.
- node_modules/@ai-sdk/deepseek/dist/index.js:805 — chat model provider id "deepseek.chat", so the options key is "deepseek".
- node_modules/@ai-sdk/deepseek/dist/index.js:473 — thinking type copied into the request body.
- package.json:31 — @ai-sdk/deepseek dependency.
- package.json:65 — ai dependency.

## Rate limits and constants
- src/lib/ai/rate-limiter.ts:17-25 — buckets "default" (5 per minute) and "chat" (30 per minute).
- src/lib/ai/rate-limiter.ts:33-78 — checkRateLimit: in-memory per-user window.
- src/lib/ai/config.ts:17-28 — RATE_LIMITS: WINDOW_MS, MAX_REQUESTS 5, CHAT_MAX_REQUESTS 30.
- src/lib/ai/config.ts:30-36 — TEMPERATURES: FEEDBACK 0.3.
- src/lib/constants.ts:90 — AI_JOB_MATCH_TIMEOUT_MS 180000.
- src/lib/constants.ts:109 — AUTOMATION_MATCH_CONCURRENCY 3.
- src/lib/constants.ts:150-151 — MCP_RATE_LIMIT_MAX 60 per MCP_RATE_LIMIT_WINDOW_MS (1 hour).
- src/lib/constants.ts:157-159 — description word floors and MCP_MATCH_PROVIDER_MARKER.
- src/lib/constants.ts:163 — MCP_BATCH_MAX_ITEMS 10.
- src/lib/constants.ts:169 — AGENT_CHAT_MATCH_SURFACE "chat".
- src/lib/telemetry/genai.ts:7-24 — SURFACES and SURFACE_BY_NESTED_LABEL.

## Agent chat
- src/app/api/ai/chat/route.ts:99-105 — chat rate check on the "chat" bucket.
- src/app/api/ai/chat/route.ts:120-141 — provider and model from user settings; no model substitution; 503 when no model.

## User settings
- src/models/userSettings.model.ts:3-6 — AiSettings: provider, model.
- src/models/userSettings.model.ts:22-30 — defaultUserSettings.
- src/actions/userSettings.actions.ts:48-112 — updateUserSettings: merges ai and display over stored and defaults.
- src/actions/userSettings.actions.ts:114-118 — updateAiSettings.
- src/components/settings/AiSettings.tsx:76-87 — fallback model lists; DeepSeek uses DeepseekModel values.
- src/components/settings/AiSettings.tsx:141-145 — clears a selected model not in the fetched list (local state only).
- src/components/settings/AiSettings.tsx:176-199 — saveModelSettings: saves provider and model.

## Process and data
- src/instrumentation.ts:1-6 — Node runtime start: syncSchedulerState.
- src/lib/scheduler/index.ts:1-8 — node-cron scheduler module, in-process.
- prisma/schema.prisma:432-483 — Job model.
- prisma/schema.prisma:467-468 — Job.matchScore and Job.matchData.

## Tests
- __tests__/mcpAddJob.spec.ts — add_job handler tests.
- __tests__/mcpBatch.spec.ts — add_jobs_batch handler tests.
- __tests__/mcpUpdateJob.spec.ts — update_job handler tests.
- __tests__/mcpGetJob.spec.ts — get_job handler tests.
- __tests__/mcpMatchDirective.spec.ts — directive and offer tests.
- __tests__/agentMatchJobTool.spec.ts — match_job tool tests.
- __tests__/agentNestedGeneration.spec.ts — runNestedGeneration tests.
- __tests__/AiSettings.spec.tsx — settings component tests.
- __tests__/rateLimitBuckets.spec.ts — rate limiter bucket tests.
- e2e/mcp-write-tools.spec.ts — MCP write tools end-to-end.

## Design phase — job writes and inputs
- src/lib/jobs/createJobFromNames.ts:26-43 — CreateJobFromNamesInput.
- src/lib/jobs/createJobFromNames.ts:58-75 — input destructured; unknown fields ignored.
- src/lib/jobs/updateJobFromNames.ts:25-53 — UpdateJobFromNamesInput and result with descriptionChanged.
- src/lib/mcp/tools/addJob.ts:62 — upsertExisting strips upsert and allowDuplicate.
- src/lib/mcp/tools/addJob.ts:27-36 — duplicate reply without upsert.
- src/models/mcp.schema.ts:325-336 — batch input: items use McpAddJobInputShape and McpAddJobSchema.
- src/lib/agent/resumeLookup.ts:6-9 — ResumeLookup statuses ok, needs_selection, no_resumes.
- src/lib/utils.ts:43-60 — handleError returns the error message.
- src/lib/db.ts:12-18 — Prisma client held on globalThis outside production.
- src/lib/mcp/rate-limit.ts:13-19 — configuredMax and MAX from MCP_RATE_LIMIT_MAX.
- src/lib/api-key-resolver.ts:34 — env-var fallback for provider keys.
- src/actions/automation/analyze.ts:100 — on-demand analysis uses SURFACES.JOB_MATCH.
- src/lib/telemetry/span.ts:101-104 — withSpan signature.

## Design phase — settings UI
- src/app/dashboard/settings/page.tsx:25 — "ai-provider" section renders AiSettings.
- src/components/ui/switch.tsx:8-29 — Switch component.
- src/actions/userSettings.actions.ts:12-46 — getUserSettings merges stored over defaults.
- src/actions/userSettings.actions.ts:68-72 — ai merge spreads stored ai under the patch.

## Design phase — backup
- src/lib/backup/schema.ts:191-216 — Job backup row schema.
- src/lib/backup/export.ts:109 — BackupDataSchema.parse strips unlisted columns.

## Design phase — library probes
- node_modules/ai/package.json:3 — ai 6.0.256.
- node_modules/ai/dist/index.d.ts:107 — FinishReason union.
- node_modules/ai/dist/index.d.ts:1361 — generateText signature (abortSignal, providerOptions).
- node_modules/ai/dist/index.d.ts:1390 — generateText providerOptions field.
- node_modules/ai/dist/test/index.d.ts:53-70 — MockLanguageModelV3 with doGenerateCalls.
- node_modules/@ai-sdk/provider/dist/index.d.ts:1467 — call options carry providerOptions.
- node_modules/p-limit/package.json:3 — p-limit 7.3.0.
- node_modules/p-limit/index.d.ts:89 — pLimit(concurrency).

## Design phase — tests and fixtures
- __tests__/agentNestedStreamSpike.spec.ts:2 — MockLanguageModelV3 imported from ai/test.
- __tests__/AiSettings.spec.tsx:6-9 — userSettings.actions mocked with two functions.
- __tests__/mcpAddJob.spec.ts:10-34 — module mocks; no settings mock.
- e2e/mcp-write-tools.spec.ts:15-32 — FULL_POSTING fixture.
