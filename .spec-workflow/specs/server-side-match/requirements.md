# Requirements Document — server-side-match

## Introduction

JobSync scores jobs that arrive over MCP itself, with the user's configured AI provider and model, so a job that jobscout pushes gets a match without a Claude session that follows the match directive. The feature is for the operator who runs jobscout against JobSync and wants consistent matches at a lower cost than Claude. It adds an opt-in user setting, a background match queue for MCP adds and description updates, a per-job skip flag, and thinking-disabled DeepSeek calls on every match surface.

## Alignment with Product Vision

The steering file product.md does not exist in this repository, so this section aligns with the decomposition entry instead. The entry states the aim: consistent matching at a lower cost than Claude, based on the bake-off in which DeepSeek with thinking off agreed with the operator's tier more often than Claude's stored matches did. The feature keeps one match method (the prompt, preprocessing and parser that the mcp-write-tools spec made common to every surface) and changes only who runs it.

## Requirements

### Requirement 1 — Thinking disabled on every match call

**User Story:** As the operator, I want every match call to DeepSeek to run with thinking disabled, so that matches are as accurate and stable as the bake-off measured.

Probe: the installed `@ai-sdk/deepseek` 2.0.4 accepts `providerOptions.deepseek.thinking.type` with the values `"enabled"` and `"disabled"` and copies it into the request body (`node_modules/@ai-sdk/deepseek/dist/index.d.ts:5-13`, `node_modules/@ai-sdk/deepseek/dist/index.js:473`). The options key is `deepseek` (`node_modules/@ai-sdk/deepseek/dist/index.js:418-420`, `node_modules/@ai-sdk/deepseek/dist/index.js:805`). The library comment says thinking defaults to enabled when unset (`node_modules/@ai-sdk/deepseek/dist/index.js:300-307`).

#### Acceptance Criteria

1. WHEN the in-app Match (the agent `match_job` tool, `src/lib/agent/tools/matchJob.ts:88-109`) generates a match THEN the generation request SHALL carry the DeepSeek provider option thinking type `"disabled"`.
2. WHEN the automation runner match (`src/lib/scraper/automation-run/match.ts:78-84`) generates a match THEN the request SHALL carry the same option.
3. WHEN the on-demand analysis of a discovered job (`src/actions/automation/analyze.ts:112-117`) generates a match THEN the request SHALL carry the same option.
4. WHEN the server-side match (Requirement 5) generates a match THEN the request SHALL carry the same option.
5. WHEN a match call uses a provider other than DeepSeek THEN the call SHALL pass the thinking option only under the `deepseek` provider-options key, so the other provider's options are unchanged.
6. WHEN the agent chat turn calls the model (`src/app/api/ai/chat/route.ts`) THEN its provider options SHALL be unchanged by this spec. (Invariant — verified, not red-first.)
7. WHEN the `review_resume` or `generate_cover_letter` nested generation runs (both through `src/lib/agent/nestedGeneration.ts:50-150`) THEN its provider options SHALL be unchanged by this spec. (Invariant — verified, not red-first.)

### Requirement 2 — DeepSeek default model and model list

**User Story:** As a user who picks DeepSeek, I want the default and the fallback list to name the current model, so that a new setup does not pick a retired alias.

#### Acceptance Criteria

1. WHEN `getDefaultModelForProvider` is called with the DeepSeek provider (`src/lib/scraper/automation-run/aiSettings.ts:26-39`) THEN it SHALL return `"deepseek-flash"`.
2. WHEN the AI settings page builds the fallback model list for DeepSeek (`src/components/settings/AiSettings.tsx:76-87`) THEN the list SHALL be `["deepseek-flash"]` and SHALL not contain `"deepseek-chat"` or `"deepseek-reasoner"`.
3. IF a user's stored AI setting names `"deepseek-chat"` or `"deepseek-reasoner"` THEN every match call SHALL send that stored model name unchanged, and the stored setting SHALL not be rewritten. (Invariant — verified, not red-first: no code rewrites the stored model today.)
4. WHEN a match call sends either retired alias THEN the call SHALL carry thinking type `"disabled"` as in Requirement 1, so a stored `"deepseek-reasoner"` also runs with thinking off.

### Requirement 3 — Server-side match setting

**User Story:** As the operator, I want one setting that turns server-side matching on, so that I choose when JobSync spends my provider budget on MCP jobs.

#### Acceptance Criteria

1. WHEN a user has no stored value for the setting THEN the setting SHALL read as off.
2. WHEN the user turns the setting on or off in the AI section of Settings and saves THEN the value SHALL persist in the user's settings record and SHALL not change the stored provider or model.
3. WHEN the user saves a provider and model in the AI settings page THEN the stored setting value SHALL be unchanged.
4. WHEN an MCP handler reads the setting THEN it SHALL read it by the token's user id, without a session.
5. IF the setting is off AND an MCP call carries no skip flag THEN the `add_job`, `add_jobs_batch`, `update_job` and `get_job` replies SHALL be byte-identical to the replies at base for the same input and data. (Invariant — verified, not red-first.)

### Requirement 4 — Queue a match from MCP adds and description updates

**User Story:** As jobscout, I want JobSync to queue a match when I add or update a job, so that I do not need a Claude session to score it.

The "offer" below is the directive-or-note decision `buildMatchOffer` makes today (`src/lib/mcp/tools/matchDirective.ts:65-141`).

#### Acceptance Criteria

1. IF the setting is on AND `add_job` creates a job AND the offer for that job would be a directive THEN JobSync SHALL queue one server-side match for the job, and the reply SHALL state that the match is queued.
2. IF the setting is on AND `update_job` changes the job's description AND the offer would be a directive THEN JobSync SHALL queue one server-side match, and the reply SHALL state that the match is queued.
3. IF the setting is on AND `add_job` with `upsert: true` updates an existing job's description AND the offer would be a directive THEN JobSync SHALL queue one server-side match, as in criterion 2.
4. WHEN `add_jobs_batch` runs with the setting on THEN each item SHALL follow criteria 1 and 3, and each item's labelled line SHALL carry that item's own reply.
5. WHEN a reply states that a match is queued THEN the reply SHALL contain neither the text `SYSTEM PROMPT:` nor the text `save_match_result`.
6. IF the setting is on AND the offer would be a note (title-only description, job not loadable, no resolvable resume, unreadable job, unreadable resume) THEN JobSync SHALL not queue a match, and the reply SHALL carry that same note.
7. IF the setting is on AND the user's AI settings have no model THEN JobSync SHALL not queue a match, and the reply SHALL carry a note that says no AI model is configured and points to Settings.
8. IF `update_job` does not change the description, OR `add_job` reports a duplicate without `upsert` THEN JobSync SHALL not queue a match, and the reply SHALL be unchanged from base. (Invariant — verified, not red-first.)
9. WHEN `get_job` is called with `matchDirective: true` and the setting is on THEN the reply SHALL still carry the match directive, as at base, and SHALL not queue a match. (Invariant — verified, not red-first.)
10. WHEN a match for a job is queued and has not started AND another call would queue a match for the same job THEN JobSync SHALL keep one queued match for that job, not two.
11. WHEN JobSync queues a match THEN the MCP reply SHALL return without waiting for the match generation to start or finish.
12. WHEN the tool descriptions for `add_job`, `add_jobs_batch` and `update_job` are registered (`src/lib/mcp/toolDescriptions.ts:5-32`) THEN each SHALL say that the reply carries a match directive, or states that the match is queued when server-side matching is on.

### Requirement 5 — Run the match with the in-app method and save it

**User Story:** As the operator, I want a server-side match to be the same analysis the in-app Match produces, so that scores from both paths compare directly.

#### Acceptance Criteria

1. WHEN a queued match runs THEN it SHALL load the job by id scoped to the token's user id, resolve the resume as the in-app Match does (the job's linked resume, else the default resume, else the only resume), and preprocess both with `preprocessResume` and `preprocessJob` (`src/lib/mcp/tools/matchDirective.ts:93-113`).
2. WHEN a queued match runs THEN it SHALL read the job's description at run time, not the text present when the match was queued.
3. WHEN a queued match runs THEN it SHALL call the user's configured provider and model with `JOB_MATCH_SYSTEM_PROMPT`, `buildJobMatchPrompt` over the normalized texts, temperature `TEMPERATURES.FEEDBACK` and timeout `AI_JOB_MATCH_TIMEOUT_MS`, the same inputs as `src/lib/agent/tools/matchJob.ts:88-109`.
4. WHEN the generation returns THEN it SHALL be parsed with `parseJobMatch` (`src/lib/ai/jobMatch/parse.ts:24-45`).
5. WHEN the parsed result has scores THEN JobSync SHALL write `matchScore` and `matchData` on that job, scoped by the token's user id, through the same write `saveJobMatchResult` performs (`src/actions/job/status.ts:52-70`).
6. WHEN the match is saved THEN its `matchData` SHALL carry the scores, body, resume id and title, `matchedAt`, `provider` set to the configured provider id, `model` set to the model name sent, `analyzed: true`, the job's `descriptionCompleteness`, and a `surface` value that names the server-side match path and differs from `"chat"` and from the `"mcp"` marker.
7. WHEN a saved server-side match has a `descriptionCompleteness` of `"partial"` THEN the app SHALL show the existing "Provisional score" badge (`src/components/automations/MatchDetails.tsx:42-50`). (Invariant — verified, not red-first, once criterion 6 sets the field.)
8. WHEN `get_job` reads a job with a saved server-side match THEN its Match section SHALL show the score, recommendation, date and provider/model as it does for other matches (`src/lib/mcp/tools/getJob.ts:95-111`).

### Requirement 6 — Background limits

**User Story:** As the operator, I want server-side matches to run in the background under their own limits, so that a large import neither slows MCP replies nor uses up my interactive AI budget.

#### Acceptance Criteria

1. WHILE server-side matches run THEN the number of generations in flight across the process SHALL not exceed a concurrency constant, and SHALL be 1 when the provider is Ollama, as `getAutomationMatchLimit` does (`src/lib/scraper/automation-run/aiSettings.ts:18-24`).
2. WHEN a server-side match starts THEN it SHALL count against a per-user match budget of its own, and SHALL not count against the `"default"` or `"chat"` buckets of `checkRateLimit` (`src/lib/ai/rate-limiter.ts:17-78`).
3. WHEN the match budget is configured THEN it SHALL be at least `MCP_RATE_LIMIT_MAX` per `MCP_RATE_LIMIT_WINDOW_MS` (`src/lib/constants.ts:150-151`), so 50 jobs added through five 10-item `add_jobs_batch` calls within one hour all get matched within that hour, subject to provider speed.
4. IF a user's match budget is spent THEN later queued matches for that user SHALL wait and run after the window resets; they SHALL not fail for that reason.
5. WHEN 50 server-side matches run for a user THEN an interactive `checkRateLimit(userId)` call made afterwards SHALL report the same `remaining` as it would without those matches.

### Requirement 7 — Failures

**User Story:** As the operator, I want a failed match to leave the job saved and tell me why, so that I can retry or score it another way.

#### Acceptance Criteria

1. WHEN a queued match fails for any reason THEN the job SHALL stay saved, and the MCP reply that queued it SHALL already have been returned unchanged.
2. WHEN the generation throws, times out, finishes without the `"stop"` finish reason, or returns text with no scores line, OR the resume or job no longer preprocesses THEN JobSync SHALL not write `matchScore` or `matchData`, and an existing match on the job SHALL stay as it was.
3. WHEN a queued match fails THEN JobSync SHALL record on the job the failure reason and time, and SHALL log one error line with the job id, user id, provider, model and reason.
4. WHEN `get_job` reads a job whose latest server-side match failed after its last saved match THEN the Match section SHALL state that the server-side match failed and give the recorded reason.
5. WHEN a later server-side match for that job succeeds THEN `get_job` SHALL no longer show the failure.
6. IF the job is deleted before its queued match runs THEN the match SHALL be dropped without a write and without a failure record.

### Requirement 8 — Skip a match on request

**User Story:** As jobscout, I want to tell JobSync not to score a job, so that jobs I already graded stretch or possible do not cost a match.

#### Acceptance Criteria

1. WHEN `add_job` and each item of `add_jobs_batch` are registered THEN their input SHALL accept an optional boolean `skipMatch`, with a description that says it asks JobSync not to score this job.
2. IF `skipMatch` is true THEN JobSync SHALL not queue a server-side match for that job, whatever the setting.
3. IF `skipMatch` is true THEN the reply SHALL carry no match directive and no note, and SHALL state that the match was skipped on request, whatever the setting.
4. IF `skipMatch` is absent or false THEN the behaviour SHALL be as if the flag did not exist.
5. WHEN `add_job` with `upsert: true` and `skipMatch: true` updates an existing job's description THEN JobSync SHALL not queue a match and the reply SHALL state that the match was skipped on request.

## Non-Functional Requirements

### Performance
- An MCP reply that queues a match SHALL take no longer than the same call with the setting off, plus the setting read and the queue insert; it SHALL not include any provider call.

### Security
- A queued match SHALL carry the token's user id from the MCP request and SHALL read and write only rows scoped to that user id; it SHALL never take a user id from the job row or from tool input.
- Provider credentials SHALL be resolved per user through `getModel` (`src/lib/ai/providers.ts:7-23`), as every other match surface does.

### Reliability
- The queue SHALL live in the server process. A restart SHALL drop queued and running matches without a failure record; those jobs stay unscored and can be re-scored through `get_job` with `matchDirective: true` or the in-app Match.
- A failure in one queued match SHALL not stop or fail other queued matches.

### Testing
- Tests SHALL drive the server-side match with a stubbed language model; no test SHALL call a real provider.

## Decisions taken in this document

- D1 — Money, personal data and legal posture: options were opt-in with the user's own provider key and no new data surface, on by default for MCP users, a separate JobSync-billed match service; chosen because JobSync has no billing, so there are no refunds, credits or forfeiture, spend is the user's own provider cost bounded by the match budget, the resume and posting go to the same provider the user already chose for in-app Match, and the match lives on the job row and is erased with it, so no new retention or erasure rule is needed.
- D2 — Where the queue lives: options were an in-process queue that a restart drops, a database-backed queue that survives restarts, a job on the existing cron scheduler; chosen because the app runs as one standalone Node process with an in-process scheduler already, and a lost match is cheap to redo.
- D3 — How a failure is recorded: options were a reason and time on the job shown by get_job plus a log line, a log line only, a failure body written into the match data; chosen because jobscout reads jobs over MCP and needs to see why a job has no score, and writing into the match data would destroy an existing good match.
- D4 — Skip flag scope: options were honour the flag whatever the setting, honour it only when the setting is on, ignore it and leave skipping to jobscout; chosen because "do not score this job" saves cost on both paths, and replies without the flag stay unchanged when the setting is off.
- D5 — When the reply says queued: options were check the existing note conditions and a configured model before queuing, queue always and record a failure later, queue always and say nothing; chosen because the reply then tells jobscout the truth at once, and the note texts already exist.
- D6 — Missing model: options were refuse with a note as the chat route does, fall back to the provider default as the automation runner does; chosen because the in-app Match refuses, and a model the user never chose is a hidden cost.
- D7 — get_job with the directive flag stays a directive when the setting is on: options were keep the directive, queue a server match instead; chosen because the decomposition lists only adds and description updates, and an explicit directive request is the agent's own re-score path.
- D8 — Thinking-disabled scope: options were every match call including the automation runner and on-demand analysis, only the in-app and server-side match, every nested generation; chosen because the decomposition names every match surface and keeps the chat out, and resume review and cover letters are not match calls.
- D9 — Retired DeepSeek aliases: options were send the stored name unchanged, map it to the new model at call time, migrate stored settings; chosen because the bake-off notes record that DeepSeek serves both aliases with the new model, so nothing breaks and no data changes.
- D10 — Existing match on a description update: options were keep it until the new match saves, clear it when the match is queued; chosen because a failed re-score must not leave the job with nothing, and the match date shows its age.
- D11 — Over-budget matches wait: options were wait for the window, fail with a recorded reason; chosen because the budget protects provider spend rate, not the job, and waiting needs no retry from the caller.
- D12 — Budget size floor: options were at least the MCP hourly budget, a smaller fixed number; chosen because each MCP add already costs one MCP unit, so the MCP budget stays the binding limit and every added job can be matched in the same hour.
- D13 — Skip flag name is skipMatch: options were skipMatch, noMatch, match set to false; chosen because it reads as a request and matches the camel-case style of upsert and allowDuplicate.
- D14 — Duplicate queued matches collapse: options were one queued match per job, one per call; chosen because the match reads the description at run time, so a second queued match would score the same text twice.

## Scope notes

- Carried items from the decomposition: none.
- The decomposition says to save with `saveJobMatchResult`. That action resolves the user from the session through `requireUser` (`src/actions/job/status.ts:52-70`, `src/actions/shared.ts:6-12`), and a background match has no session. Requirement 5 criterion 5 keeps the same write and leaves to the design how a user-id-scoped path shares it.
- The decomposition's "50-job batch" is five calls: `add_jobs_batch` takes at most `MCP_BATCH_MAX_ITEMS` (10) items (`src/models/mcp.schema.ts:334-336`, `src/lib/constants.ts:163`). Requirement 6 states the scenario that way.
- The "5-per-minute interactive budget" is the `"default"` bucket of `checkRateLimit`; the in-app Match runs inside the chat turn, which uses the `"chat"` bucket. Requirement 6 keeps server matches out of both.
- Deferred to design: the setting's storage key and label, the queued, skipped and no-model reply texts, the surface value, the concurrency constant and budget values, and where the failure record is stored.
- Out of scope, as the decomposition states: a match provider or model separate from the chat setting; prompt changes; scoring jobs added in the app; the agent chat's thinking setting; the jobscout change that sets `skipMatch`.
- Out of scope: the automation runner's own prompt (`AUTOMATION_JOB_MATCH_SYSTEM_PROMPT`) stays as it is; only its thinking option changes.
- Not cut: nothing the decomposition entry lists is cut or deferred to a later spec.
- The bake-off evidence (`evals/job-match-bakeoff/`) is on the `feat/match-eval-posting-link` branch, not on `main`; this document cites only its README notes on the DeepSeek aliases.

## Revision History

- **v1** (2026-10-30) — Initial draft.
  - **Lint pass.** 2 fixed; rejected: L-1..L-5 (node_modules/@ai-sdk/deepseek paths exist in the tree, the linter does not resolve outside the code root; the probe legitimately cites the installed library), L-6/L-7 (`review_resume`/`generate_cover_letter` are nested-generation label names passed to the generic `runNestedGeneration`; the citation correctly names the shared path both run through, not a definition site), L-10/L-12/L-13 (`get_job`, `add_jobs_batch` are MCP wire tool names used as prose; the code symbols are `handleGetJob`/`McpAddJobsBatchSchema`, and the cited ranges and constants are correct).
