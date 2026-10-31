# Tasks Document

Dependency order: tasks 1-6 are PR 1 (`feat/mcp-jobs-read-scope-get-job`, branched from `dev`) and run in sequence. Tasks 7-13 are PR 2 (`feat/mcp-list-jobs`, also from `dev`) and depend on nothing in PR 1 except the scope helper task 4 exports, which PR 2 branch carries by rebasing onto PR 1 until PR 1 merges. Tasks 14-17 are PR 3 (`feat/mcp-search-jobs`), stacked on PR 2's branch because it reuses PR 2's query module. Tasks 18-22 are fork-only: the rate-limit override branches from `dev` on its own; the integration branch merges all four; verification, the connection note and the push follow in that order. Every task leaves the tree compiling with `npm run lint` and `npm run test` green.

- [x] 1. PR1 — issue new tokens with `jobs:read`
  - File: src/actions/mcpToken.actions.ts
  - Add `jobs:read` to the hardcoded scope array in `createMcpToken`
  - Purpose: Requirement 6 criterion 1 — new tokens carry the read scope explicitly
  - `__tests__/mcpAuth.spec.ts` builds its own token fixture and never calls `createMcpToken`, so no exact-value assertion changes
  - _Leverage: src/actions/mcpToken.actions.ts:46_
  - _Requirements: 6.1_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add "jobs:read" to the scopes array at src/actions/mcpToken.actions.ts:46, keeping the existing three entries and their order | Restrictions: No migration, no backfill of existing token rows (design D5 makes the write scope an alias); touch nothing else | Success: A newly created token's scopes contain all four values; lint and the full test suite pass; mark the task in progress in tasks.md before starting, log with log-implementation after, then mark complete_

- [x] 2. PR1 — `get_job` input shape and description
  - File: src/models/mcp.schema.ts, src/lib/mcp/toolDescriptions.ts
  - Add `McpGetJobInputShape` (`jobId: string, min 1`) and `McpGetJobSchema`; add the `get_job` description
  - Purpose: The shape the SDK advertises and the prompt text that routes an agent to a detail read
  - _Leverage: src/models/mcp.schema.ts:100-105 (find_job shape as the model), src/lib/mcp/toolDescriptions.ts_
  - _Requirements: 4.1, 5.1_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add the get_job Zod shape and schema to src/models/mcp.schema.ts beside the find_job pair, and a get_job entry to MCP_TOOL_DESCRIPTIONS that says it reads one saved job in full by id and points agents to list_jobs or find_job when they have no id | Restrictions: Follow the existing InputShape/Schema naming pair; the description is routing prose, not documentation; do not edit other entries | Success: Both exports compile and the description is under 300 characters; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 3. PR1 — `get_job` handler
  - File: src/lib/mcp/tools/getJob.ts
  - Rate-limit check, `findFirst` scoped by `userId` with the detail include graph plus notes, sectioned text render per design D10, D14, D15
  - Purpose: Requirement 4 — one job in full, unowned id indistinguishable from missing
  - _Leverage: src/actions/job/queries.ts:45-77 (JOB_DETAILS_INCLUDE), src/actions/jobStage/shared.ts:9-32 (STAGE_DETAIL_INCLUDE), src/actions/job/shared.ts:9-17 (hideUnanalyzedScore), src/lib/mcp/tools/findJob.ts (contract and error shape)_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 7.1, 7.2, 8.1, 8.2_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write handleGetJob(input, userId) per design components and D10, D14, D15 — call checkMcpRateLimit first, query with where { id, userId }, render labelled sections (job, company incl. careers URL and industry, location, source, dates, tags, description, notes, stage timeline with interviewers and a prep-question count, contacts with role, resume and cover-letter references, match score/recommendation/date/provider/body), omit null fields and empty relations, return "No job with that id." for null, and hide an unanalyzed score | Restrictions: Return errors as text, never throw; no raw SQL; do not quote prep-question text; do not import from PR 2 files | Success: Handler compiles and renders every field the requirement lists; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 4. PR1 — read-scope helper and `get_job` registration
  - File: src/lib/mcp/auth.ts, src/app/api/mcp/route.ts
  - Export a helper that returns true when scopes include `jobs:read` or `jobs:write`; register `get_job` with an inline gate that uses it and returns the existing refusal text shape
  - Purpose: Requirement 6 criteria 2 and 3 — refusal for tokens with neither scope, legacy write tokens keep working
  - _Leverage: src/app/api/mcp/route.ts:92-99 (gate shape), src/app/api/mcp/route.ts:236-240 (precedent comment)_
  - _Requirements: 6.2, 6.3, 5.1_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add an exported scope helper to src/lib/mcp/auth.ts and a server.tool("get_job", …) block in route.ts mirroring the find_job block, gating on the helper with the text "Insufficient scope. Required: jobs:read", validating with the schema task 2 exports, and delegating to the handler task 3 exports | Restrictions: Do not touch existing tool blocks; keep the gate inline like its neighbours; add a comment beside the helper naming design D5 and the resume:write precedent | Success: get_job appears in tools/list, refuses a questions:write-only token, and serves a jobs:write-only token; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 5. PR1 — `get_job` unit spec and scope-refusal cases
  - File: __tests__/mcpGetJob.spec.ts, __tests__/mcpAuth.spec.ts
  - New spec mirroring `mcpFindJob.spec.ts`; new cases in `mcpAuth.spec.ts` for the helper task 4 exports (read-only, write-only, neither)
  - Purpose: Requirement 4 and 6 behaviour pinned before the route is exercised live
  - `__tests__/mcpAuth.spec.ts` gains cases only; no existing assertion value changes
  - _Leverage: __tests__/mcpFindJob.spec.ts (mock layout), __tests__/mcpAuth.spec.ts_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.2, 6.3, 7.2_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write __tests__/mcpGetJob.spec.ts with the Prisma and rate-limit mocks of mcpFindJob.spec.ts, asserting the where clause carries userId, the null result text, every rendered section on a full fixture, omission of null fields, hidden unanalyzed score, and the rate-limit short-circuit; add three scope cases to mcpAuth.spec.ts | Restrictions: Mock Prisma the way the sibling specs do; no database; do not alter existing cases | Success: New cases pass, existing suites unchanged, lint clean; mark in progress, log-implementation, mark complete_

- [x] 6. PR1 — wiki: `get_job` section and scopes sentence
  - File: wiki/mcp.md
  - Add `get_job` to the tool list, change the count and "all of them writes" wording, rewrite the scopes sentence to name `jobs:read` and say write-scoped tokens issued earlier keep read access
  - Purpose: Requirement 6 criterion 4, in the wiki's existing voice
  - _Leverage: wiki/mcp.md:70-84_
  - _Requirements: 6.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: edit wiki/mcp.md so the tool list includes get_job with a one-line description in the same style, the count reads ten, the "all of them writes" claim is corrected, and the scopes paragraph explains jobs:read and legacy-token behaviour per design D5 | Restrictions: Match the existing question-heading voice; no new headings beyond what the list needs; keep the frontmatter tags accurate | Success: The page reads as one author wrote it and the scopes paragraph answers "will my old token work"; mark in progress, log-implementation, mark complete_

- [x] 7. PR2 — `jobQuery.ts`: filter set to Prisma `where`
  - File: src/lib/mcp/jobQuery.ts
  - Export the filter type and the where-builder per design: every filter ANDed, `contains` for company/location/tag/createdVia, the `origin` enum mapping of D8, the dismissed default and `discoveryStatus` override of D13, the score-range guard of D12, all OR blocks nested under `AND`
  - Purpose: Requirements 1 and 2 filtering, with no hidden-score leak
  - _Leverage: src/actions/job/queries.ts:89-174, src/lib/constants.ts (JOB_STATUS_VALUES, AGENT_CHAT_CREATED_VIA), src/lib/scraper/automation-run/persist.ts:51_
  - _Requirements: 1.6, 2.1, 2.2, 8.1, 8.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: create src/lib/mcp/jobQuery.ts with the filter type and buildJobWhere(userId, filters) per design "Filter set", D8, D12 and D13 — userId always in the where, every OR-bearing block pushed into one AND array | Restrictions: No raw SQL; no `mode: "insensitive"`; do not implement cursor or rendering here (tasks 8 and 9) | Success: Module compiles, exports the builder, and a scratch call with each filter yields the clause shape the design specifies; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 8. PR2 — `jobQuery.ts`: cursor, fingerprint, keyset predicates, query runner
  - File: src/lib/mcp/jobQuery.ts
  - Add encode/decode of the cursor payload, the fingerprint over the design's field list, the four keyset predicates, the two-field `orderBy`, and a runner that issues `findMany` plus `count` and returns rows, total and next cursor
  - Purpose: Requirement 1 criteria 3 and 4 — stable paging that never skips the null run
  - _Leverage: src/lib/mcp/tokens.ts:1 (crypto import), src/actions/job/queries.ts:201-215 (findMany + count pair), design "Keyset predicates" and "Fingerprint"_
  - _Requirements: 1.1, 1.3, 1.4, 2.4, 2.5, 2.6_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: extend jobQuery.ts with cursor encode/decode, fingerprint, the four keyset predicates exactly as written in the design, orderBy [field, id] in the same direction, and a runner that takes limit+1 rows to detect a next page, applies hideUnanalyzedScore, and returns { rows, total, nextCursor } | Restrictions: A cursor whose s, o or f disagrees with the call is an error, never a silent reset; keyset predicate goes into the AND array task 7 built | Success: Paging a scratch fixture with null sort values returns each row once; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 9. PR2 — `jobQuery.ts`: row renderer and page text
  - File: src/lib/mcp/jobQuery.ts
  - Add the one-line row renderer with the sanitizer (whitespace collapse, `|` to `/`, 80-char truncation), the origin label, and a page renderer producing the header line, rows, and a next-cursor footer or a no-match line
  - Purpose: Requirement 5 — one line per job, bounded size, predictable layout
  - _Leverage: design "List row (one line)", src/lib/mcp/tools/findJob.ts:48-63 (text style)_
  - _Requirements: 1.2, 1.5, 1.7, 5.2, 5.5_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add formatJobRow and a page renderer to jobQuery.ts per the design's row template, with a header stating "N matched now, showing rows a-b, sorted by FIELD DIRECTION" and a footer telling the agent to pass the next cursor | Restrictions: Dates as YYYY-MM-DD; "-" for absent values; never emit a raw newline inside a row | Success: A title containing a newline and a pipe renders as one clean line; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 10. PR2 — `list_jobs` shape, description and handler
  - File: src/models/mcp.schema.ts, src/lib/mcp/toolDescriptions.ts, src/lib/mcp/tools/listJobs.ts
  - Add `McpListJobsInputShape` with described fields (status enum with lowercase preprocess, `origin` and `discoveryStatus` enums, ISO datetimes, limit 1-100 default 25) and its schema; add the `list_jobs` description; write the handler over the runner task 8 exports
  - Purpose: Requirement 1 and 2 as a registered tool surface
  - _Leverage: src/models/mcp.schema.ts:38-49 (status preprocess), src/lib/mcp/tools/findJob.ts:5-15 (handler opening)_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 2.6, 5.1, 5.4, 7.1, 7.2_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add the list_jobs input shape and schema with .describe() text on every field (the sortBy description states the null placement of design D4; the origin description names its four values), a description that says list_jobs answers "what do I have" with filters and paging and is not for URL lookups, and handleListJobs that rate-limits then delegates to the runner and page renderer | Restrictions: Handler returns errors as text; schema descriptions are prompt surface, keep them short; no changes to other schemas | Success: tools/list shows every filter with its description; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 11. PR2 — register `list_jobs`
  - File: src/app/api/mcp/route.ts
  - Add the `server.tool("list_jobs", …)` block with the read-scope gate task 4 exports, validation and delegation
  - Purpose: Requirement 6 gate applied to the list tool
  - _Leverage: the get_job block task 4 added_
  - _Requirements: 6.2, 6.3_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: register list_jobs in route.ts exactly as get_job is registered, gate first, then safeParse with the schema task 10 exports, then the handler | Restrictions: Do not touch other blocks | Success: list_jobs is served to a jobs:write-only token and refused to a questions:write-only token; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 12. PR2 — `list_jobs` unit spec and enum cases
  - File: __tests__/mcpListJobs.spec.ts, __tests__/mcpSchemaEnums.spec.ts
  - New spec asserting each filter's where shape, the dismissed default and override, the score guard, all four keyset predicates via the where passed to the mocked `findMany`, cursor round-trip and fingerprint rejection, row sanitization, hidden score, no-match line, rate-limit short-circuit; enum cases for `sortBy`, `sortOrder`, `origin`, `discoveryStatus`
  - Purpose: Pins requirements 1, 2, 5, 8 before live use
  - `__tests__/mcpSchemaEnums.spec.ts` gains a new describe block; existing assertions unchanged
  - _Leverage: __tests__/mcpFindJob.spec.ts, __tests__/mcpSchemaEnums.spec.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.2, 8.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write __tests__/mcpListJobs.spec.ts with mocked prisma.job.findMany and count, covering every behaviour listed in this task including a two-page walk whose second call's where contains the null branch of the descending predicate, and a test pinning the "analyzed":false marker string; extend mcpSchemaEnums.spec.ts for the four new enums | Restrictions: No database; do not weaken any existing case | Success: All new cases pass and the suite stays green; lint clean; mark in progress, log-implementation, mark complete_

- [x] 13. PR2 — wiki section and eval routing case for `list_jobs`
  - File: wiki/mcp.md, evals/mcp-tools/tools.ts, evals/mcp-tools/promptfooconfig.yaml, evals/mcp-tools/assertions.ts
  - Wiki: add the tool bullet and a short "How do I ask my agent what I have?" section. Evals: add `list_jobs` to the shape registry, an assertion that a single `list_jobs` call was made, and a test row for "what's open?"
  - Purpose: Outline docs and eval constraints for PR 2
  - _Leverage: wiki/mcp.md tool list, evals/mcp-tools/tools.ts SHAPES map, evals/mcp-tools/assertions.ts expectSingle_
  - _Requirements: 1.1, 3.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add list_jobs to the eval SHAPES map, an assertRoutesToListJobs helper built on expectSingle, and a promptfoo row whose user message asks what is open and asserts list_jobs was chosen and find_job was not; add the wiki bullet and section in the existing voice | Restrictions: Do not run the eval suite (no API spend this session); tools.json is generated, never edited | Success: generate-tools.ts runs and emits the new tool; wiki reads cleanly; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 14. PR3 — search block, `search_jobs` shape and handler
  - File: src/lib/mcp/jobQuery.ts, src/models/mcp.schema.ts, src/lib/mcp/tools/searchJobs.ts
  - Extend the where-builder with the `query` OR block over title, company, description and notes, nested in the AND array; add `McpSearchJobsInputShape` (list shape plus required `query`) and schema; write the handler
  - Purpose: Requirement 3 — find by words, same filters and paging
  - _Leverage: src/actions/job/queries.ts:153-170 (search idiom), the list handler task 10 wrote_
  - _Requirements: 3.1, 3.2, 3.3, 5.1, 7.1_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add the query OR block to the builder (JobTitle.label, Company.label, description, Notes.some.content with contains), the search_jobs shape spreading the list shape with a required described query, and handleSearchJobs delegating to the same runner with the query included in the fingerprint | Restrictions: No new filter semantics beyond the query; query must be part of the fingerprint; no changes to list_jobs behaviour | Success: A search for a title word returns the matching job regardless of URL; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 15. PR3 — descriptions and registration for `search_jobs`
  - File: src/lib/mcp/toolDescriptions.ts, src/app/api/mcp/route.ts
  - Add the `search_jobs` description and rewrite `find_job`'s to contrast "exact URL saved?" with "anything like this saved?"; register `search_jobs` with the read-scope gate
  - Purpose: Requirement 3 criterion 4 — agents route between the two without trying both
  - _Leverage: src/lib/mcp/toolDescriptions.ts:6-9 (find_job entry), the list_jobs block task 11 added_
  - _Requirements: 3.4, 6.2, 6.3_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write the search_jobs description (words in title, company, description or notes; same filters as list_jobs; the tool for reposts under a new URL) and edit find_job's to say it is for an exact URL only and to name search_jobs for everything else; add the route block | Restrictions: This is the only PR that edits find_job's description; keep both under 300 characters; no other tool blocks change | Success: Both descriptions read as a routing pair; search_jobs is gated like its siblings; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 16. PR3 — `search_jobs` unit spec
  - File: __tests__/mcpSearchJobs.spec.ts
  - Assert the query OR block over the four fields, AND-nesting with a status filter and the dismissed default, cursor fingerprint differing between two queries, the repost case (same title and company, different URL), and the rate-limit short-circuit
  - Purpose: Requirement 3 pinned
  - _Leverage: the list spec task 12 wrote_
  - _Requirements: 3.1, 3.2, 3.3, 7.2_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write __tests__/mcpSearchJobs.spec.ts with the same mock layout as the list spec, covering every behaviour this task lists | Restrictions: No database; do not duplicate list-only cases | Success: New cases pass, suite green, lint clean; mark in progress, log-implementation, mark complete_

- [x] 17. PR3 — wiki section and eval routing cases for `search_jobs`
  - File: wiki/mcp.md, evals/mcp-tools/tools.ts, evals/mcp-tools/promptfooconfig.yaml, evals/mcp-tools/assertions.ts
  - Wiki bullet and a short paragraph on find_job versus search_jobs; eval registry entry; two rows — a repost described by title and company routes to `search_jobs`, an exact-URL dedupe still routes to `find_job`
  - Purpose: Outline docs and eval constraints for PR 3
  - _Leverage: the eval helper task 13 added, evals/mcp-tools/promptfooconfig.yaml:80 (the existing dedupe row)_
  - _Requirements: 3.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: add search_jobs to the eval SHAPES map, an assertRoutesToSearchJobs helper, the two promptfoo rows, and the wiki text | Restrictions: Do not run the eval suite; do not alter the existing dedupe row's assertion | Success: generate-tools.ts emits twelve tools; wiki reads cleanly; lint and tests pass; mark in progress, log-implementation, mark complete_

- [x] 18. Fork — `MCP_RATE_LIMIT_MAX` environment override
  - File: src/lib/mcp/rate-limit.ts, .env.example
  - Read `process.env.MCP_RATE_LIMIT_MAX` once at module load; use it when it parses as a positive integer, else the constant; document the variable in `.env.example`
  - Purpose: Requirement 9, on its own branch `fork/mcp-rate-limit-env` from `dev`
  - `__tests__/mcpRateLimit.spec.ts` asserts against the constant and runs with the variable unset, so no assertion changes
  - _Leverage: src/lib/mcp/rate-limit.ts:10, .env.example:42_
  - _Requirements: 9.1, 9.2, 9.3_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: on branch fork/mcp-rate-limit-env, replace the MAX constant read in rate-limit.ts with a parsed env override that falls back to APP_CONSTANTS.MCP_RATE_LIMIT_MAX, and add a commented line to .env.example | Restrictions: One commit, conventional message with mcp scope; no other files | Success: With the variable unset behaviour is identical and the rate-limit spec passes; with it set to 5 a scratch check denies the sixth call; mark in progress, log-implementation, mark complete_

- [x] 19. Fork — integration branch and image rebuild
  - File: ~/jobsync-deploy/docker-compose.yml (unchanged), git branches
  - Create `fork/integration` from `dev`, merge the three PR branches and the rate-limit branch, run lint and tests, then `docker compose up -d --build` in `~/jobsync-deploy` with the checkout on that branch; add `MCP_RATE_LIMIT_MAX` to the compose environment list
  - Purpose: Requirement 10 criteria 1 and 2
  - _Leverage: ~/jobsync-deploy/RUNBOOK.md section 1_
  - _Requirements: 10.1, 10.2_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: build fork/integration by merging the four branches, resolve any conflicts in route.ts and toolDescriptions.ts in branch order, verify lint and tests, add the rate-limit variable to the compose file's environment block with a default, and rebuild the container until its healthcheck passes | Restrictions: Do not commit deploy files into the repo; do not rebase the PR branches | Success: The container is healthy and tools/list over /api/mcp with a valid token returns twelve tools; mark in progress, log-implementation, mark complete_

- [x] 20. Fork — end-to-end verification against the running container
  - File: .spec-workflow/specs/mcp-read-tools/Implementation Logs (results), a scratch seed script outside the repo
  - Seed a throwaway user with fixture jobs (null and shared dates, a dismissed discovery, an unanalyzed score, a repost under two URLs, a job with a newline in its title) and insert a token row for it; drive all three tools over HTTP through every acceptance criterion in requirements 1-8
  - Purpose: Requirement 10 criterion 4 — the gate the outline demands
  - _Leverage: src/lib/mcp/tokens.ts (hashToken), ~/jobsync-deploy/jobsyncdb/data/dev.db, src/actions/auth.actions.ts:55-61 (status seeding)_
  - _Requirements: 10.4, 1.1, 1.3, 1.4, 1.6, 1.7, 2.1, 2.4, 2.5, 3.1, 3.3, 4.1, 4.3, 5.2, 6.2, 6.3, 7.1, 8.4_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: seed the throwaway user, jobs and token directly in the container database with a script kept in the scratchpad, then call list_jobs, search_jobs and get_job over /api/mcp for each criterion, recording request, response excerpt and verdict in the implementation log | Restrictions: Never touch any other user's rows; reads only after seeding; the seed script never enters the repo | Success: Every criterion has a recorded pass, or a recorded failure with the fix task it spawned; mark in progress, log-implementation, mark complete_

- [x] 21. Fork — connection note
  - File: ~/jobsync-deploy/CONNECTING.md
  - One page: endpoint URL, token generation steps, the Claude Desktop `mcp-remote` config (with the `--allow-http` note for non-localhost addresses), the `claude mcp add` command for Claude Code, and the rate-limit variable
  - Purpose: Requirement 10 criterion 3
  - _Leverage: ~/jobsync-deploy/RUNBOOK.md section 3, ~/jobsync-deploy/claude_desktop_mcp_snippet.json, wiki/mcp.md connector sections_
  - _Requirements: 10.3_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: write ~/jobsync-deploy/CONNECTING.md in Simplified Technical English, one page, with the four items this task lists and a three-line example conversation showing list_jobs then get_job | Restrictions: No secrets in the file; placeholders for the token; keep it outside the repo | Success: A reader can connect either client from the note alone; mark in progress, log-implementation, mark complete_

- [x] 22. Fork — push branches
  - File: git remotes
  - Push `dev`, the three `feat/mcp-*` branches, `fork/mcp-rate-limit-env` and `fork/integration` to `origin` (madmatt112/jobsync); open no pull requests
  - Purpose: The branches reach the fork; upstream PRs wait for #114 or 2026-10-05
  - _Leverage: git remote origin_
  - _Requirements: 10.1_
  - _Prompt: Task: Implement the task for spec mcp-read-tools, first run spec-workflow-guide to get the workflow guide then implement the task: push every branch this task names to origin with upstream tracking set | Restrictions: No pull requests; nothing pushed to the upstream remote; no force pushes | Success: `git ls-remote --heads origin` lists all six branches at their local SHAs; mark in progress, log-implementation, mark complete_
