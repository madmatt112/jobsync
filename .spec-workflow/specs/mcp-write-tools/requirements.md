# Requirements Document

Document version: v6

## Introduction

This spec gives an MCP agent write access to every job its token's user owns: `update_job` and `save_match_result` lose the `createdVia` gate, a new `save_cover_letter` tool stores a letter against a job, and `list_jobs` and `search_jobs` rows carry the date the job was added. It is for the fork's operator, whose agents (jobscout among them) track app-entered and automation-found jobs as well as MCP-added ones. It lifts the write boundary the read-tools spec kept: a hand-entered job is now within an agent's reach. It also unifies scoring: the MCP match directive hands the agent the in-app Match prompt and resume choice, so an MCP re-score agrees with the app.

## Alignment with Product Vision

The steering directory is empty; the reference is decomposition entry 2 in `.spec-workflow/spec-decomposition/decomposition.md`, which fixes this document's scope. That entry implements items 3 and 4 of Gsync/jobsync#114 plus one read-row field and the unified match method of the entry's fourth bullet, and excludes item 5 (`set_status`). The fork is a hard fork at 1.1.21, so upstream PR size and the upstream decision to decline items 3 and 4 no longer constrain it.

## Requirements

### Requirement 1 — Update any owned job

**User Story:** As a JobSync user with an agent connected over MCP, I want the agent to correct or enrich any of my jobs, so that a job I entered in the app or that an automation found can be kept current the same way as one the agent added.

#### Acceptance Criteria

1. WHEN `update_job` is called with the id of a job the caller owns whose `createdVia` is null THEN the server SHALL apply the supplied fields exactly as it does today for a job with a non-null `createdVia`, including the status, stage and applied-date side effects in `src/lib/jobs/updateJobFromNames.ts:129-152` and `:183-194`.
2. WHEN `add_job` is called with `upsert: true` and the duplicate it finds has a null `createdVia` THEN the server SHALL patch that job through the same path (`src/lib/mcp/tools/addJob.ts:57-78`) instead of returning a not-found message.
3. WHEN `update_job` is called with the id of a job owned by another user, or an id that does not exist THEN the server SHALL return the same not-found text for both, and that text SHALL no longer mention that only MCP-created jobs are eligible. (The equality of the two cases is an invariant — verified, not red-first.)
4. WHEN `update_job` or the `add_job` upsert path patches a job THEN the server SHALL NOT write the job's `createdVia`, so the job's recorded origin never changes. (Invariant — verified, not red-first; `src/lib/mcp/tools/addJob.ts:54-56`.)
5. WHEN the Prisma `where` clauses in `updateJobFromNames` run THEN they SHALL include `id` and `userId` and SHALL NOT include a `createdVia` condition.
6. WHEN `update_job` is called on a job with a discovery status, including "dismissed" THEN the server SHALL update it like any other owned job.

### Requirement 2 — Save a match result on any owned job

**User Story:** As a JobSync user, I want my agent to score any of my jobs against my resume, so that jobs from the app or an automation get the same MCP match analysis as the ones the agent added.

#### Acceptance Criteria

1. WHEN `save_match_result` is called with a valid `matchText` and the id of a job the caller owns whose `createdVia` is null THEN the server SHALL store the score and match data on that job, with the same provenance fields it writes today (`src/lib/mcp/tools/saveMatchResult.ts:72-84`).
2. WHEN the job already carries a match from the app, an automation or an earlier MCP call THEN the server SHALL replace it, as it does today for MCP-created jobs.
3. WHEN `save_match_result` reads the job's description completeness THEN that read SHALL use the same ownership scope as the update, with no `createdVia` condition.
4. WHEN `save_match_result` is called with an id owned by another user or an id that does not exist THEN the server SHALL return one not-found text for both, and that text SHALL no longer mention MCP eligibility.
5. WHEN `save_match_results_batch` is called THEN each item SHALL follow criteria 1 to 4, because the batch calls the single-item handler. (Invariant once criteria 1 to 4 hold — verified, not red-first.)

### Requirement 3 — Agent-facing text and user docs state the new rule

**User Story:** As an agent choosing between tools, I want the tool text to say which jobs I may write, so that I do not refuse a valid update or tell the user to edit a job by hand.

#### Acceptance Criteria

1. WHEN the `update_job` and `save_match_result` descriptions in `src/lib/mcp/toolDescriptions.ts` are read THEN neither SHALL restrict the tool to jobs added through MCP or created with `add_job`.
2. WHEN the `jobId` description in `McpUpdateJobInputShape` (`src/models/mcp.schema.ts:245-286`) is read THEN it SHALL NOT say that only jobs created through MCP can be updated.
3. WHEN `find_job` finds a job with a null `createdVia` THEN its reply SHALL offer `update_job` exactly as it does for an MCP-created job, and SHALL NOT say the job cannot be updated via MCP (`src/lib/mcp/tools/findJob.ts:46-63`).
4. WHEN `wiki/mcp.md` is read THEN it SHALL state that MCP writes reach every job the token's user owns, SHALL replace the guarantee at `wiki/mcp.md:121` that a hand-added job cannot be rewritten by an agent, SHALL list `save_cover_letter` and update both the tool count and the write/read split at `wiki/mcp.md:74` (thirteen tools, ten write and three read), and SHALL name the date-added field in the row description at `wiki/mcp.md:101`.
5. WHEN the `save_cover_letter` description is read THEN it SHALL say that the agent writes the letter itself, that each call stores a new version and points the job at it, and that earlier versions stay in the user's documents.

### Requirement 4 — Save a cover letter against a job

**User Story:** As a JobSync user, I want my agent to save the cover letter it drafted onto the job, so that I can read, edit and export it in the app instead of copying it from the chat.

#### Acceptance Criteria

1. WHEN `save_cover_letter` is called with `jobId` and `text` for a job the caller owns THEN the server SHALL, in one transaction, find or create the caller's `Profile`, create a `CoverLetter` row in it and set that job's `coverLetterId` to the new row; the profile find-or-create SHALL sit inside that same transaction.
2. WHEN the letter is stored THEN its content SHALL be the `text` rendered from Markdown to HTML with raw HTML escaped, using the same renderer settings as `src/actions/coverLetter.actions.ts:11`, so it displays in the job's Cover Letter tab (`src/components/myjobs/job-details/CoverLetterTab.tsx:16-60`).
3. WHEN the letter is stored THEN its title SHALL be built by `buildCoverLetterTitle` from the job's title and company label and the caller's existing letter titles (`src/lib/coverLetterTitle.ts:7-20`).
4. WHEN the handler runs THEN it SHALL trim `text` and, IF the trimmed length is shorter than `APP_CONSTANTS.MIN_COVER_LETTER_CHARS`, SHALL return a validation error and write nothing; this trim-then-compare SHALL run in the handler after the rate-limit unit is taken, as `save_match_result`'s SCORES check does (`src/lib/mcp/tools/saveMatchResult.ts:26-38`). The exact validation-error string is pinned in design, as criterion 8's not-found string is.
5. IF the caller has no `Profile` row THEN, inside the transaction of criterion 1, the server SHALL first create an empty `Profile`, then create the `CoverLetter` row in it so the new letter's id is in hand, then repoint the job to that id — the create-letter-then-repoint order of `generateCoverLetterForJob`'s transaction (`src/actions/coverLetter.actions.ts:194-205`). It SHALL NOT use `createCoverLetter`'s bundled nested write, which returns the profile and not the letter id (`src/actions/coverLetter.actions.ts:97-104`), nor its title-collision throw (`src/actions/coverLetter.actions.ts:79-81`).
6. WHEN the save succeeds THEN the reply SHALL be one text line giving the job id, the letter id and the letter title.
7. WHEN `get_job` is called on that job after the save THEN it SHALL show the new letter's title and id. (The `get_job` cover-letter line already exists at `src/lib/mcp/tools/getJob.ts:89`; this criterion is an invariant of that line — verified, not red-first.)
8. WHEN `save_cover_letter` is called with an id owned by another user or an id that does not exist THEN the server SHALL return one not-found text for both — the same job-not-found phrasing the other job-write tools return, with no mention of MCP eligibility — and SHALL write no `CoverLetter` row. (The exact string is pinned in design.)
9. WHEN the MCP server starts THEN `save_cover_letter` SHALL be registered in `src/app/api/mcp/route.ts` behind the `jobs:write` gate with its own input shape and schema, taking a required `jobId` string and a required non-empty `text` string; the router's Zod `safeParse` SHALL return `Validation error: …` before the handler runs (`src/app/api/mcp/route.ts:84-93`).

### Requirement 5 — Redrafts keep versions

**User Story:** As a JobSync user, I want each redraft saved as a new version, so that an agent's rewrite never destroys a letter I liked or edited.

#### Acceptance Criteria

1. WHEN `save_cover_letter` is called for a job that already has a cover letter THEN the server SHALL create a new `CoverLetter` row and repoint the job to it, and SHALL NOT modify or delete the earlier row.
2. WHEN a redraft is saved THEN its title SHALL be made unique by the same `buildCoverLetterTitle` path as the first save (R4 criterion 3), which applies the `ensureUniqueTitle` suffix rule (`src/lib/coverLetterTitle.ts:19`, `src/lib/resumeCopyTitle.ts:29-42`); no second uniquify step is added.
3. WHEN the user opens the cover letter list in Profile THEN each saved version SHALL be an ordinary `CoverLetter` row; that list loads only the caller's newest 100 letters, with no Load More for letters (`src/components/profile/ProfileContainer.tsx:79-90`, `:275`), so a version past the newest 100 stays in the database (criterion 1) but no read surface shows it: the job's Cover Letter tab (`src/components/myjobs/JobDetails.tsx:306-315`) and `get_job` (`src/lib/mcp/tools/getJob.ts:89`) show only the job's current letter (`job.coverLetterId`), consistent with R4 criterion 7. Recovery stays in-app, per D1. Changing that 100-item window is out of scope.
4. WHEN the same text is saved twice THEN the server SHALL store two versions; no deduplication is done.

### Requirement 6 — Cover-letter writes are scoped, rate-limited and owned

**User Story:** As a self-hosting user, I want the new write tool governed by the same token, scope and limit rules as the other job writes, so that it adds no new way in.

#### Acceptance Criteria

1. IF the caller's token does not carry `jobs:write` THEN `save_cover_letter` SHALL refuse with "Insufficient scope. Required: jobs:write", the text the other job-write tools return (`src/app/api/mcp/route.ts:194-200`).
2. WHEN `save_cover_letter` is called THEN it SHALL consume exactly one unit of the shared per-user rate limit, and IF the limit is exhausted THEN it SHALL return the same "Rate limit exceeded. Try again in Ns." text and write nothing.
3. WHEN any query the `save_cover_letter` handler runs reads or writes a job, a profile or a `CoverLetter` row — including the title-uniqueness read of the caller's letters and the new-row write — THEN its Prisma `where` SHALL include the caller's `userId`, directly or through the profile relation, and no raw SQL SHALL be used.
4. WHEN an unexpected error occurs THEN the tool SHALL return it as text and SHALL NOT throw, as the other handlers do.
5. WHEN this spec ships THEN no new token scope SHALL be added, and tokens issued before it SHALL work with `save_cover_letter` without re-issue.

### Requirement 7 — Rows carry the date added

**User Story:** As the jobscout `expire-stale` command, I want each `list_jobs` and `search_jobs` row to carry the date the job was added, so that I can age out stale jobs from one page instead of calling `get_job` once per row.

#### Acceptance Criteria

1. WHEN `list_jobs` or `search_jobs` returns a page THEN each row SHALL include the job's `createdAt` as a `YYYY-MM-DD` date, labelled `added`, appended as the last field of the row.
2. WHEN the date-added field is added THEN the existing fields of the row SHALL keep their order and format, so a parser that reads the current fields by their front index keeps working; a parser that reads the last field SHALL now read `added …` in place of the origin label, which was last before (`src/lib/mcp/jobQuery.ts:311-324`).
3. WHEN a row's date added is compared with `get_job`'s "Created" line for the same job THEN they SHALL be the same date (`src/lib/mcp/tools/getJob.ts:78`).
4. WHEN rows are fetched THEN the page SHALL be served by the same two queries as today, with no extra query per row. (`createdAt` is already in `ROW_SELECT` at `src/lib/mcp/jobQuery.ts:218-232`; invariant — verified, not red-first.)
5. WHEN the `list_jobs` description is read THEN it SHALL mention that each row carries the date the job was added.

### Requirement 8 — One match method on every surface

**User Story:** As a JobSync user, I want an MCP match and the in-app Match to score a job the same way, so that a re-score over MCP agrees with the app.

#### Acceptance Criteria

1. WHEN the match directive is built for `add_job`, `add_jobs_batch` or `update_job` THEN it SHALL hand the agent the in-app Match prompt — `JOB_MATCH_SYSTEM_PROMPT` and `buildJobMatchPrompt` (`src/lib/ai/prompts/job-match/index.ts:5-6`) — replacing its own resume block, instructions and four-section format (`src/lib/mcp/tools/matchDirective.ts:31-48`) but keeping the `jobId`, the scored `resumeId` and the closing call to `save_match_result` with both and `matchText` (`:29`, `:49-50`).
2. WHEN that directive is built THEN both the resume and the job description it carries SHALL be normalized server-side by `preprocessResume` and `preprocessJob` (`src/lib/ai/tools/preprocessing.ts:305-310`, `src/lib/ai/tools/preprocessing-job.ts:104`), the inputs the in-app Match feeds the prompt (`src/lib/agent/tools/matchJob.ts:67-70`, `:91`). The resume SHALL be the one in-app Match picks: `resolveResumeForAgent` with the job's `resumeId` as page resume (`src/lib/agent/tools/matchJob.ts:57-60`, `src/lib/agent/resumeLookup.ts:44-90`); IF none resolves THEN a one-line note replaces the directive, as today (`src/lib/mcp/tools/matchDirective.ts:74-80`).
3. WHEN the shared `JOB_MATCH_SYSTEM_PROMPT` is read THEN, at its Deal Breakers section (`src/lib/ai/prompts/job-match/system.ts:49-50`), it SHALL carry three additions both surfaces then use: (a) an eligibility check over location/residency, work authorization, language and clearance; (b) the rule not to invent employers, skills, titles, dates or credentials (`src/lib/mcp/tools/matchDirective.ts:34-35`); (c) the partial-description warning as a conditional rule: only a thin description makes the score provisional, and the agent fetches the full posting and calls `update_job` first where that tool exists (`src/lib/mcp/tools/matchDirective.ts:18-26`); the MCP directive keeps its completeness-gated warning.
4. WHEN an agent re-scores a job it already owns THEN it SHALL be able to get that job's match directive WITHOUT editing the job; design decides the mechanism.

### Requirement 9 — jobscout's client contract stays unchanged

**User Story:** As the jobscout MCP client, I want the args, rows and reply text I parse today to keep working, so that this spec needs no lockstep client change beyond the date-added field.

#### Acceptance Criteria

1. WHEN `list_jobs` is called THEN its args `status`, `applied`, `createdTo`, `matchScoreMax`, `sortBy`, `sortOrder`, `limit`, `cursor` and the optional `company` SHALL keep their current meaning and parsing (`src/models/mcp.schema.ts:177-213`).
2. WHEN a `list_jobs` or `search_jobs` row is rendered THEN the front nine ` | ` fields SHALL keep their order and format, field 8 reading `match N%` or `match -`, and the date-added field SHALL sit tenth (R7 criteria 1-2; `src/lib/mcp/jobQuery.ts:311-324`).
3. WHEN `get_job` is called THEN its reply SHALL keep its `Created:` and `URL:` lines (`src/lib/mcp/tools/getJob.ts:74`, `:78`).
4. WHEN `update_job` succeeds THEN its text SHALL keep starting `Job {id} updated.` (`src/lib/jobs/updateJobFromNames.ts:230`), and the `add_job` / `add_jobs_batch` leading text for a created job, a detected duplicate and the rate-limit message SHALL stay as is; the match-method change SHALL alter ONLY the appended directive text.
5. WHEN the directive is built THEN its own text, INCLUDING the shared prompt, SHALL never contain `rate limit exceeded`, `duplicate detected` or `job created` in any case nor start with `not attempted`; embedded resume and job text is exempt, as jobscout reads only the first line (criterion 6). No line, embedded text included, SHALL start with the batch prefix `[i/n] ` (`[`, digits, `/`, digits, `]`, space; `src/lib/mcp/tools/addJobsBatch.ts:17`, `:25`); design picks the neutralising step. Blank lines are allowed. A unit test SHALL assert this on fixture text carrying each phrase and a prefixed line.
6. WHEN the PR for this spec is opened THEN its body SHALL record the required jobscout counterpart: commit 8ecbf57 (accepts 9- or 10-field `list_jobs` rows with `added YYYY-MM-DD`; any `Job not found…` counts as skipped) and commit f2d0bce (classifies `add_job` / batch replies on the first line only), both on jobscout `main` and local only.

## Non-Functional Requirements

### Performance
- `save_cover_letter` SHALL use a bounded number of queries independent of the number of earlier versions, apart from the one read of the caller's letter titles that title uniqueness needs.

### Security
- Ownership is enforced in every Prisma `where`, never by filtering after the fact; this spec removes only the `createdVia` condition.
- An id belonging to another user stays indistinguishable from a nonexistent id in every changed or new tool.
- No new authentication mechanism, REST route or token scope is added.

### Reliability
- No new runtime dependency and no schema migration is added.
- A failed `save_cover_letter` leaves no orphan `CoverLetter` row, no orphan `Profile` row and no repointed job, because the find-or-create-profile, create-letter and repoint run in one transaction. `Profile.userId` carries no DB unique constraint, so two concurrent first-time saves could still create two profiles; inherited from the in-app create, out of scope here.

## Decisions taken in this document

- D1 — Money, personal data and legal posture: the spec touches no money or billing; edits stay in the user's own self-hosted database; no MCP delete or erase path is added and a redraft never destroys an earlier letter, so erasure stays the in-app delete; options were this stance, an MCP delete path, or overwrite-on-redraft; chosen because an agent should not destroy user-written content and the app already offers deletion.
- D2 — How redraft versions are stored: options were a new row per save with the job repointed, overwrite in place, or a new version table with a migration; chosen new row per save because the in-app Regenerate already works this way and needs no migration.
- D3 — Which scope gates the cover-letter tool: options were the existing jobs write scope, a new cover-letter scope, or no gate like the resume-review tools; chosen the jobs write scope because every token already carries it and the letter attaches to a job.
- D4 — Whether the add-job upsert path also loses the MCP-only restriction: options were lift it with the update tool or keep upsert limited to MCP-created duplicates; chosen lift because both use one patch helper and the decomposition removes the gate from that helper.
- D5 — What "date added" means: options were the creation timestamp, the discovery timestamp, or the applied date; chosen the creation timestamp because it is what the full-job read prints as Created and what the created sort and filter use.
- D6 — Where the date-added field sits in the row: options were appended last or inserted after the status; chosen appended last so a parser reading the existing fields by their front index does not break; a from-end parser reading the last field now reads `added` instead of the origin label (`src/lib/mcp/jobQuery.ts:322`).
- D7 — A user with no profile: options were create the profile or return an error; chosen create because the agent cannot create a profile itself and the in-app create action already does.
- D8 — Letter text format: options were render Markdown with raw HTML escaped or store raw text; chosen render because the job tab and editor expect the HTML the in-app generator stores.
- D9 — Duplicate saves: options were store every save as a version or skip a save matching the current letter; chosen store every save as the simplest rule, a retry costing only an extra version.
- D11 — One match method across surfaces: options were the MCP directive's own four-section prompt, the in-app Match (GUI) prompt, or a hybrid; chosen the in-app prompt, so both surfaces share one set of score bands, output format and inputs, resume choice included, leaving only the model different.
- D10 — Where `save_cover_letter` validates its input: options were a Zod `.min()` on `text` at the router or a trim-then-compare in the handler; chosen the handler because Zod does not trim and fires before the handler, which would skip the rate-limit unit and change the error string; the handler check matches `save_match_result`. Field presence and types stay a router Zod parse.

## Scope notes

- Out of scope, per the decomposition: a `set_status` wrapper (item 5 of #114); `update_job` already sets status with the app's stage and applied-date side effects.
- Not added: reading cover-letter content over MCP, listing versions over MCP, deleting or renaming a letter over MCP, a title argument on `save_cover_letter`, and a batch form of `save_cover_letter`. The decomposition lists none of these.
- The jobscout `expire-stale` command lives outside this repository; changing it to read the new row field is out of scope here. Per Matthew's ruling, jobscout's expire commands may expire hand-entered jobs once Requirement 1 lands.
- Carried items from the decomposition: none.

## Revision History

- **v6** (2026-10-06) — Post-cap corrective pass, adjudicated, not re-reviewed.
  - **R5-1 — fixed (MUST_FIX).** R8 AC1 now replaces only the directive's resume block, instructions and four-section format (matchDirective.ts:31-48) and keeps the jobId, resumeId and save_match_result call-back (:29, :49-50).
  - **R5-2 — fixed (SHOULD_FIX).** R8 AC2 makes the directive pick its resume as in-app Match does (resolveResumeForAgent with job.resumeId, matchJob.ts:57-60, resumeLookup.ts:44-90), so D11's only-the-model claim holds, as the decomposition pins.
  - **R5-3 — fixed (SHOULD_FIX).** R8 AC3(c) keeps the decomposition-pinned shared addition but worded as a conditional rule, update_job only where that tool exists; the MCP directive keeps its completeness-gated warning.
  - **R5-4 — fixed (SHOULD_FIX).** R9 AC5 scopes the phrase checks to the directive's own text, keeps the no-prefix-line rule over embedded text with the neutralising step left to design, and corrects the bracket gloss of `[i/n] `. Body trimmed elsewhere without change of meaning to stay under the 3500-word cap (3498).
- **v5** (2026-10-06) — Revision from the input below.
  - **Lint pass.** 0 fixed; rejected: L-1..L-35 (citation-identifier) — every flagged token is a registered MCP tool name (list_jobs, search_jobs, get_job, add_job, add_jobs_batch, update_job, find_job, save_cover_letter, save_match_result, all in src/app/api/mcp/route.ts), a Prisma model/field (Profile, CoverLetter, createdVia, matchText, jobId, coverLetterId), an analog/enclosing function or constant outside the cited range on purpose (MIN_COVER_LETTER_CHARS, createCoverLetter, generateCoverLetterForJob, buildCoverLetterTitle), or a prompt constant cited at its section rather than its declaration (JOB_MATCH_SYSTEM_PROMPT at system.ts Deal Breakers). New v5 citations re-verified against source: job-match/index.ts:5-6 (barrel exports JOB_MATCH_SYSTEM_PROMPT and buildJobMatchPrompt), system.ts:49-50 (the Deal Breakers section the eligibility check joins), matchDirective.ts:18-26, :28-51 and :34-35 (partial-description warning, four-section prompt, no-fabrication rule), mcp.schema.ts:177-213 (McpListJobsInputShape args), jobQuery.ts:311-324 (formatJobRow nine fields, field 8 match), getJob.ts:74 and :78 (URL and Created lines), updateJobFromNames.ts:230 (the Job id updated leading text). Pre-existing unchanged citation-identifier tokens suppressed per rule 4. doc-words passed: body 3497 under the 3500 cap.
  - **RI-1 — Accepted (MUST_FIX).** Added Requirement 8: the match directive for add_job, add_jobs_batch and update_job now hands the agent the in-app Match prompt with the resume and job description normalized server-side, the shared system prompt gains the eligibility, no-fabrication and partial-description additions at its Deal Breakers section for both surfaces, and an agent can re-score an owned job without editing it, with the mechanism deferred to design; D11 records the choice of the in-app prompt.
  - **RI-2 — Accepted (MUST_FIX).** Added Requirement 9 criteria 1 to 4: the list_jobs args, the front-nine row fields with field 8 reading the match value and the date-added field tenth, the get_job Created and URL lines, and the update_job, add_job and add_jobs_batch leading text all stay, with the match-method change touching only the appended directive text.
  - **RI-3 — Accepted (MUST_FIX).** The scope notes now record Matthew's ruling that jobscout's expire commands may expire hand-entered jobs once Requirement 1 lands.
  - **RI-4 — Accepted (MUST_FIX).** Requirement 9 criterion 5 pins that the built directive, including the shared prompt it carries, never contains the rate-limit, duplicate-detected or job-created phrases in any case, never starts with the not-attempted text, and has no line starting with the batch item prefix, asserted by a unit test; blank lines inside the directive stay allowed.
  - **RI-5 — Accepted (MUST_FIX).** Requirement 9 criterion 6 records the required jobscout counterpart commits and what each accepts, both on jobscout main and local only.
  - **R4-1 — Left as-is, carried to design (MINOR).** Requirement 6 criterion 3 and the Security note are untouched this round, per the input note.
- **v4** (2026-10-06) — Round-3 adversarial response (adversarial-analysis-requirements-r3.md, verdict iterate 1/0/2).
  - **Lint pass.** 0 fixed; rejected: L-1..L-25 (citation-identifier) — every flagged token is a registered MCP tool name (all live in src/app/api/mcp/route.ts), a Prisma model/field name (`Profile`, `CoverLetter`, `createdVia`, `matchText`, `jobId`, `coverLetterId`), or an analog/enclosing function or constant implemented outside the cited range on purpose (`MIN_COVER_LETTER_CHARS`, `createCoverLetter`, `generateCoverLetterForJob`, `buildCoverLetterTitle`). New v4 citations re-verified against source: coverLetterTitle.ts:19 (`ensureUniqueTitle` call) and resumeCopyTitle.ts:29-42 (the `(2)`/`(3)` suffix rule); JobDetails.tsx:306-315 (Cover Letter tab renders only `job.CoverLetter`, substantiating the R5 AC3 reachability correction). doc-words passed: the body is within the 3500-word cap (the reviser's 3596 count included the uncounted Revision History).
  - **R3-1 — Accepted (MUST_FIX).** R5 criterion 3 now reads that a version past the newest 100 is retained but surfaced by none of the three read surfaces — the Profile list caps at the newest 100, while the Cover Letter tab and `get_job` show only the job's current letter, which a redraft repoints to the newest row, consistent with R4 criterion 7; recovery stays the in-app model per D1. The false tab/`get_job` reachability clause and its contradiction of R4 criterion 7 are gone.
  - **R3-2 — Accepted (MINOR).** R5 criterion 2 now cross-references R4 criterion 3's `buildCoverLetterTitle` path, which already applies the `ensureUniqueTitle` suffix rule, and states no second uniquify step is added, removing the double-specification.
  - **R3-3 — Accepted (MINOR).** R6 criterion 3 now names the `CoverLetter` title-uniqueness read and new-row write alongside job and profile, so the ownership enumeration matches every query the handler runs.
- **v3** (2026-10-06) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/1).
  - **Lint pass.** 0 fixed; rejected L-1..L-23 (citation-identifier) — benign tool-name, model/field and analog/enclosing-function tokens. New v3 citations re-verified: ProfileContainer.tsx:79-90 and :275.
  - **R2-1 — Accepted (MUST_FIX).** R5 criterion 3 replaces the false pagination claim: the Profile list loads the caller's newest 100 letters in one fixed window that replaces rather than appends, its Load More gated on resumes, so a version past the newest 100 stays in the database but is not in this list; changing the 100-item window is out of scope.
  - **R2-2 — Accepted (SHOULD_FIX).** R4 criterion 5 now gives the concrete no-profile sequence inside the one transaction — create an empty profile, create the letter so its id is in hand, then repoint the job — following the generate action's create-then-repoint order, and no longer anchors the create to the bundled no-profile branch that returns the profile and hides the letter id.
  - **R2-3 — Accepted (MINOR).** R4 criterion 4 now states its validation-error string is pinned in design, as criterion 8's not-found string is, so the min-length clauses are each assertable.
- **v2** (2026-10-06) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/2/3).
  - **Lint pass.** 0 fixed; rejected L-1..L-21 (citation-identifier) — benign tool-name, model/field and analog/enclosing-function tokens. New v2 citations re-verified: saveMatchResult.ts:26-38, coverLetter.actions.ts:79-81/97-104/194-205, route.ts:84-93, wiki/mcp.md:74.
  - **R1-1 — Accepted (SHOULD_FIX).** R4 criterion 9 pins the input contract behind the write gate; criterion 4 and new decision D10 place the trim-then-compare min-length check in the handler after the rate-limit unit, matching the match-result tool.
  - **R1-2 — Accepted (SHOULD_FIX).** R4 criterion 1 runs find-or-create profile, create letter and repoint in one transaction; criterion 5 takes only the profile-create idea, not the title-collision throw; the Reliability note covers the orphan profile row and the missing unique constraint.
  - **R1-3 — Partially accepted (MINOR).** R5 criterion 3 drops the absolute "every version" and states versions appear in the newest-first paged list, falling to a later page once earlier pages fill.
  - **R1-4 — Partially accepted (MINOR).** R7 criterion 2 and D6 now say the guarantee holds for front-indexed parsers and that a last-field reader now reads the added date in place of the origin label.
  - **R1-5 — Partially accepted (MINOR).** R3 criterion 4 now requires the wiki write/read split updated to ten write and three read; R4 criterion 8 names the shared job-not-found phrasing with the exact string left to design; the UTC-vs-local skew sub-point is rejected as pre-existing and awareness-only, no change.
- **v1** (2026-10-06) — Initial draft.
  - **Lint pass.** 0 fixed; rejected L-1..L-16 (citation-identifier) — benign tool-name, model-name and analog/enclosing-function tokens whose load-bearing bodies sit outside the cited range on purpose.
