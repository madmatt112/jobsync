# Codebase context — mcp-write-tools

## MCP route and auth
- src/app/api/mcp/route.ts:52-67 — per-request handler; resolves the token, builds one McpServer
- src/app/api/mcp/route.ts:189-210 — `update_job` registration; `jobs:write` gate, Zod parse, `handleUpdateJob`
- src/app/api/mcp/route.ts:240-266 — `save_match_result` registration; `jobs:write` gate
- src/app/api/mcp/route.ts:291-312 — `save_match_results_batch` registration; `jobs:write` gate
- src/app/api/mcp/route.ts:314-344 — `review_resume` / `save_resume_review`; no scope gate, by design
- src/lib/mcp/auth.ts:7-42 — `resolveMcpToken`; returns userId, scopes, tokenName
- src/lib/mcp/auth.ts:48-50 — `hasJobReadScope`; `jobs:read` or `jobs:write`
- src/actions/mcpToken.actions.ts:46 — scopes issued on new tokens
- src/lib/mcp/rate-limit.ts:12-17 — `configuredMax`; `MCP_RATE_LIMIT_MAX` env override
- src/lib/mcp/rate-limit.ts:23-48 — `checkMcpRateLimit`; shared per-user bucket
- src/lib/mcp/toolDescriptions.ts:5-30 — `MCP_TOOL_DESCRIPTIONS`; agent-facing tool text
- evals/mcp-tools/generate-tools.ts:1-9 — regenerates tools.json from route.ts on every eval run

## update_job and the createdVia gate
- src/lib/mcp/tools/updateJob.ts:7-43 — `handleUpdateJob`; rate limit, `updateJobFromNames`, match offer on description change
- src/lib/jobs/updateJobFromNames.ts:55-57 — `NOT_FOUND_MESSAGE`; names the MCP-only rule
- src/lib/jobs/updateJobFromNames.ts:67-70 — pre-check `findFirst` with `createdVia: { not: null }`
- src/lib/jobs/updateJobFromNames.ts:183-207 — transaction; `update` where with `createdVia: { not: null }`; P2025 maps to not-found
- src/lib/mcp/tools/addJob.ts:27-30 — `add_job` upsert routes a duplicate into `upsertExisting`
- src/lib/mcp/tools/addJob.ts:57-78 — `upsertExisting`; calls `updateJobFromNames`, never rewrites createdVia
- src/lib/mcp/tools/findJob.ts:46 — `updatable` derived from `createdVia != null`
- src/lib/mcp/tools/findJob.ts:58-63 — hint text "cannot be updated via MCP" for app-created jobs
- src/models/mcp.schema.ts:245-286 — `McpUpdateJobInputShape`; jobId describe says MCP-created only
- src/models/mcp.schema.ts:288-294 — `McpUpdateJobSchema` with date transforms

## save_match_result
- src/lib/mcp/tools/saveMatchResult.ts:10-24 — handler entry; rate limit
- src/lib/mcp/tools/saveMatchResult.ts:67-70 — completeness read with `createdVia: { not: null }`
- src/lib/mcp/tools/saveMatchResult.ts:86-108 — `update` with `createdVia: { not: null }`; P2025 message names MCP eligibility
- src/lib/mcp/tools/saveMatchResultsBatch.ts:5-38 — batch loop over `handleSaveMatchResult`; stops on rate limit
- src/models/mcp.schema.ts:101-116 — `McpSaveMatchResultInputShape` / schema

## Cover letters
- prisma/schema.prisma:96-105 — `CoverLetter` model; profileId, title, content, timestamps
- prisma/schema.prisma:71-77 — `Profile` model; owns coverLetters
- prisma/schema.prisma:457-458 — `Job.CoverLetter` relation and `coverLetterId`
- src/actions/coverLetter.actions.ts:62-111 — `createCoverLetter`; creates a Profile when none exists
- src/actions/coverLetter.actions.ts:150-212 — `generateCoverLetterForJob`; min length, title, markdown render, new row plus job repoint in one transaction
- src/actions/coverLetter.actions.ts:11 — markdown-it with `html: false`
- src/lib/coverLetterTitle.ts:7-20 — `buildCoverLetterTitle`; "title - company" plus uniquifier
- src/lib/resumeCopyTitle.ts:29-42 — `ensureUniqueTitle`; " (2)", " (3)" suffixes, case-insensitive
- src/lib/constants.ts:98 — `MIN_COVER_LETTER_CHARS: 10`
- src/lib/agent/tools/generateCoverLetter.ts:143-169 — in-app agent tool saves via `generateCoverLetterForJob`
- src/components/myjobs/job-details/CoverLetterTab.tsx:16-60 — job page tab; renders `letter.content` and Regenerate
- src/components/myjobs/JobDetails.tsx:306-315 — tab wired to `job.CoverLetter`
- src/actions/job/queries.ts:59 — `JOB_DETAILS_INCLUDE` includes CoverLetter
- src/components/profile/ProfileContainer.tsx:80 — Profile page lists cover letters via `getCoverLetterList`
- src/lib/mcp/tools/getJob.ts:19 — `get_job` selects cover letter id and title
- src/lib/mcp/tools/getJob.ts:89 — `get_job` prints "Cover letter: title (id: …)"

## list_jobs / search_jobs rows
- src/lib/mcp/jobQuery.ts:218-232 — `ROW_SELECT`; already selects createdAt
- src/lib/mcp/jobQuery.ts:309 — `day` helper; ISO date or "-"
- src/lib/mcp/jobQuery.ts:311-324 — `formatJobRow`; pipe-delimited row, no created date
- src/lib/mcp/jobQuery.ts:326-337 — `renderJobPage`; header plus rows plus cursor line
- src/lib/mcp/tools/listJobs.ts:5-30 — `handleListJobs`
- src/lib/mcp/tools/getJob.ts:78 — `get_job` prints "Created" from createdAt
- src/lib/jobs/createJobRecord.ts:58-73 — createdAt set to now at insert

## Tests and docs that assert the current behaviour
- __tests__/updateJobFromNames.spec.ts:78 — asserts pre-check where includes createdVia gate
- __tests__/updateJobFromNames.spec.ts:87 — asserts update where includes createdVia gate
- __tests__/saveMatchResult.spec.ts:47 — asserts update where includes createdVia gate
- __tests__/saveMatchResult.spec.ts:94 — asserts "not eligible for a match via MCP" text
- __tests__/saveMatchResult.spec.ts:244 — asserts where includes createdVia gate
- __tests__/mcpFindJob.spec.ts:104-121 — asserts "cannot be updated via MCP" hint
- __tests__/mcpListJobs.spec.ts:100 — exact row string
- __tests__/mcpGetJob.spec.ts:179 — asserts cover letter reference line
- wiki/mcp.md:74 — tool count "Twelve"
- wiki/mcp.md:82 — update_job described as MCP-added jobs only
- wiki/mcp.md:85 — save_match_result described as after adding a job
- wiki/mcp.md:101 — list row field list
- wiki/mcp.md:121 — states MCP writes are scoped to MCP-created jobs

## Match directive (design phase)
- src/lib/mcp/tools/matchDirective.ts:6-52 — `buildMatchDirective`; own resume block, instructions, four sections
- src/lib/mcp/tools/matchDirective.ts:18-26 — completeness-gated PARTIAL DESCRIPTION WARNING
- src/lib/mcp/tools/matchDirective.ts:29-30 — opening line "against the user's default resume"
- src/lib/mcp/tools/matchDirective.ts:49-50 — closing `save_match_result` call with jobId and resumeId
- src/lib/mcp/tools/matchDirective.ts:57-100 — `buildMatchOffer`; title-only note, default resume, preprocess, directive
- src/lib/mcp/tools/matchDirective.ts:74-88 — no-default-resume and unusable-resume notes
- src/lib/mcp/tools/matchDirective.ts:103-110 — `composeOfferMessage`; blank line before directive, space before note
- src/lib/mcp/tools/addJobsBatch.ts:15-39 — per-item label `[i/n] `, items joined by blank lines
- src/lib/agent/tools/matchJob.ts:48-94 — in-app match: job lookup, resume lookup, preprocess both, system and user prompt
- src/lib/agent/jobLookup.ts:12-27 — `resolveJobForAgent`; userId-scoped job read with JobTitle, Company, Location
- src/lib/agent/resumeLookup.ts:44-90 — `resolveResumeForAgent`; named, page, default, only, else needs_selection
- src/lib/jobs/getDefaultResumeForUser.ts:8-28 — default-resume loader the directive uses today
- src/lib/ai/tools/preprocessing-job.ts:42-66 — `convertJobToText`; title, company, location, workplace, description
- src/lib/ai/tools/preprocessing-job.ts:104-163 — `preprocessJob`; 200-char minimum, normalization
- src/lib/ai/tools/preprocessing.ts:305-310 — `preprocessResume`
- src/lib/ai/prompts/job-match/system.ts:6-55 — `JOB_MATCH_SYSTEM_PROMPT`; Deal Breakers at 49-50
- src/lib/ai/prompts/job-match/user.ts:11-26 — `buildJobMatchPrompt`; date note, RESUME, JOB DESCRIPTION
- src/lib/ai/prompts/dateNote.ts:9-14 — `buildDateNote`
- src/actions/automation/analyze.ts:101 — automation on-demand analysis also uses `JOB_MATCH_SYSTEM_PROMPT` (and :114)
- src/lib/jobs/descriptionCompleteness.ts:12-19 — `classifyDescriptionCompleteness`; raw-text word count
- prisma/schema.prisma:474-476 — `descriptionCompleteness`; null for UI and pre-existing jobs

## get_job and find_job (design phase)
- src/lib/mcp/tools/getJob.ts:156-184 — `handleGetJob`; rate limit, userId-scoped read, "No job with that id."
- src/models/mcp.schema.ts:160-169 — `McpGetJobInputShape` / schema; jobId only
- src/lib/mcp/tools/findJob.ts:30-40 — detail select including createdVia
- src/lib/mcp/tools/findJob.ts:54-63 — reply text; update_job offer or web-app refusal
- src/lib/mcp/toolDescriptions.ts:10-21 — get_job, list_jobs, update_job, save_match_result descriptions
- src/models/mcp.schema.ts:101-113 — `McpSaveMatchResultInputShape`; jobId describe names add_job

## Cover letter writes (design phase)
- src/actions/coverLetter.actions.ts:164-167 — job read by id and userId with JobTitle and Company
- src/actions/coverLetter.actions.ts:181-190 — caller's letter titles read and `buildCoverLetterTitle` call
- src/actions/coverLetter.actions.ts:194-205 — create letter then repoint job, one transaction
- src/lib/jobs/updateJobFromNames.ts:23 — markdown-it `{ html: false, linkify: false, breaks: true }`, same as the cover-letter action

## Evals and e2e
- evals/mcp-tools/tools.ts:21-34 — `SHAPES`; tools.json is built from this map, not from route.ts
- e2e/mcp-add-job.spec.ts:9-71 — real MCP client over HTTP with a UI-issued token
- e2e/fixtures.ts:70-136 — `createNewJob`; adds a job through the app form, returns its id
- e2e/fixtures.ts:140-158 — `CleanupRegistry`; no cover-letter entry
- src/app/api/test/cleanup/route.ts:21-68 — test cleanup body fields and job deletion

## Tests touched by design
- __tests__/mcpAddJob.spec.ts:16-18 — mocks `getDefaultResumeForUser`
- __tests__/mcpAddJob.spec.ts:79-82 — asserts the four MCP section headings
- __tests__/mcpAddJob.spec.ts:130 — asserts default-resume loader not called (also :170)
- __tests__/mcpAddJob.spec.ts:256-274 — upsert onto a web-app job, mocked "not eligible" text
- __tests__/mcpUpdateJob.spec.ts:47 — asserts `buildMatchOffer` args including "update"
- __tests__/agentMatchJobTool.spec.ts:145 — asserts system prompt is `JOB_MATCH_SYSTEM_PROMPT`
- __tests__/mcpListJobs.spec.ts:192 — substring "| match - | automation"

## Tasks phase — test mocks and anchors
- __tests__/updateJobFromNames.spec.ts:17-25 — Prisma mock with an interactive `$transaction` that calls back with the client
- __tests__/mcpUpdateJob.spec.ts:6-8 — full mock of the update helper module (no constant export)
- __tests__/mcpUpdateJob.spec.ts:10-13 — partial mock of matchDirective via importOriginal
- __tests__/mcpUpdateJob.spec.ts:76 — mocked not-found message text
- __tests__/mcpAddJob.spec.ts:12-14 — full mock of the update helper module
- __tests__/mcpAddJob.spec.ts:20-22 — mock of `preprocessResume`
- __tests__/mcpAddJob.spec.ts:244 — asserts upsert passes no createdVia
- __tests__/mcpAddJob.spec.ts:264 — mocked "not eligible" message (asserted at :273)
- __tests__/saveMatchResult.spec.ts:84-96 — P2025 case, exact reply text at :94
- __tests__/mcpFindJob.spec.ts:8-11 — Prisma mock, `job.findFirst` only
- __tests__/mcpListJobs.spec.ts:22-40 — `row()` fixture; createdAt 2026-09-01 UTC
- __tests__/mcpListJobs.spec.ts:99-101 — exact nine-field row
- __tests__/mcpSearchJobs.spec.ts:103-104 — row prefix substrings only
- __tests__/mcpGetJob.spec.ts:7-14 — Prisma and rate-limit mocks
- __tests__/agentMatchJobTool.spec.ts:145 — system prompt compared by reference

## Tasks phase — source anchors
- src/lib/jobs/updateJobFromNames.ts:65-66 — comment naming the eligibility gate
- src/lib/jobs/updateJobFromNames.ts:78 — first `NOT_FOUND_MESSAGE` use (second at :203)
- src/lib/mcp/tools/saveMatchResult.ts:105-107 — generic error branch
- src/lib/mcp/tools/addJob.ts:38-43 — add-path `buildMatchOffer` call
- src/lib/mcp/tools/updateJob.ts:29-34 — update-path `buildMatchOffer` call
- src/lib/ai/prompts/job-match/system.ts:24-32 — output format and section instruction
- src/lib/ai/prompts/job-match/user.ts:11-26 — `buildJobMatchPrompt`
- src/lib/ai/prompts/job-match/index.ts:5-6 — barrel exports
- src/lib/resumeCopyTitle.ts:29-42 — `ensureUniqueTitle`; " (2)" on first collision
- src/lib/ai/tools/preprocessing.ts:45 — `MIN_CHAR_COUNT = 200`
- src/lib/constants.ts:157-158 — description word thresholds 40 and 150

## Tasks phase — docs, evals, e2e
- wiki/mcp.md:18 — overview says agents edit only MCP-created jobs
- wiki/mcp.md:89-93 — match how-to; default resume wording
- evals/package.json:11 — `eval:mcp-tools` runs generate-tools before promptfoo
- evals/mcp-tools/tools.json — committed generated file; carries the old update_job text
- e2e/fixtures.ts:172-229 — cleanup fixture; posts the body at :207-224
- e2e/automations.spec.ts:9-59 — `createResumeForMatching`; Summary plus Certification
- e2e/interviews.spec.ts:11 — job page URL with `?tab=` query
- src/components/myjobs/JobDetails.tsx:253 — "Cover Letter" tab trigger, value "letter"
- src/components/profile/ResumeTable.tsx:242-250 — "Set as default" menu item
- src/app/api/test/cleanup/route.ts:66-68 — job deletion loop
- package.json:18 — `test:e2e` script
- src/components/myjobs/JobDetails.tsx:51-58 — `JOB_DETAIL_TABS`; "letter" is a valid `?tab=` value
