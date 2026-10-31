# Requirements Document

## Introduction

Three read-only MCP tools — `get_job`, `list_jobs` and `search_jobs` — that let an agent holding a JobSync MCP token answer questions about jobs already saved in the tracker. They are for a self-hosting JobSync user whose assistant can currently only write jobs and look one up by exact posting URL. They change nothing about what an agent may write: the `createdVia`-only update rule, token issuance and the rate limiter all stay as they are, apart from one added scope.

## Alignment with Product Vision

This project has no steering documents, so the reference points are upstream issue #114 (opened by upendedshark, 2026-09-02) and the spec outline at `/home/mcf/repo/jobsync-read-tools-spec-outline.md`. Issue #114 asks for five things; this spec implements items 1 and 2 only, as stated in the comment posted to #114 on 2026-09-21. Upstream conventions win over anything in this document, and a maintainer reply on #114 overrides both.

## Requirements

### Requirement 1 — Browse the tracked jobs

**User Story:** As a JobSync user with an agent connected over MCP, I want the agent to list my saved jobs newest first, a page at a time, so that I can ask "what is in my pipeline" without opening the app.

#### Acceptance Criteria

1. WHEN `list_jobs` is called with no arguments THEN the server SHALL return the caller's own jobs ordered newest first, at most one page of them.
2. WHEN a page is returned THEN each row SHALL carry the job id, title, company, status, applied date, due date, source, location, match score and `createdVia`.
3. WHEN more jobs match than fit on the page THEN the response SHALL include an opaque cursor and SHALL state the total number of matches.
4. WHEN `list_jobs` is called with a cursor from a previous call THEN the server SHALL return the next page under the same filters and sort, repeating no row and skipping none.
5. IF no job matches THEN the server SHALL return a single line saying so, not an error.
6. WHEN a job carries `discoveryStatus` "dismissed" THEN the server SHALL exclude it unless the caller supplies the `discoveryStatus` filter explicitly, matching the web app's own list behaviour.
7. IF a job's match score was never analyzed THEN the server SHALL report no score for that job, matching what the web app shows.

### Requirement 2 — Narrow and sort the list

**User Story:** As a JobSync user, I want to ask for a specific slice of my jobs, so that the agent answers "which Netherlands roles have I not applied to" in one call instead of reading everything.

#### Acceptance Criteria

1. WHEN `list_jobs` is called with any of status, company, location, applied flag, tag, `createdVia`, origin, discovery status, match-score range, or a date range on created, applied or due date THEN the server SHALL return only jobs matching every supplied filter.
2. WHEN a company or location filter is supplied THEN the server SHALL match it as a substring of the stored label, case-insensitively for ASCII characters (SQLite's own LIKE folding).
3. WHEN a status filter is supplied that is not one of the eleven known status values THEN the server SHALL return a validation error, and the valid values SHALL be advertised in the tool's input schema and description so the agent can correct itself.
4. WHEN `sortBy` is supplied THEN the server SHALL sort by the named date field — created, applied or due — in the supplied direction, defaulting to newest first.
5. IF a job's sort field is null THEN the server SHALL still return that job, grouped after all non-null values when sorting descending and before them when sorting ascending, which is SQLite's own ordering (see design decision D4).
6. WHEN a page size is supplied THEN the server SHALL honour it up to 100 and SHALL return a validation error above that or below 1.

### Requirement 3 — Find a job by words rather than URL

**User Story:** As a JobSync user, I want the agent to find a saved job from words I remember, so that a repost saved under a different URL is recognised instead of added twice.

#### Acceptance Criteria

1. WHEN `search_jobs` is called with a query THEN the server SHALL return jobs whose title, company, description or notes contain that text, case-insensitively for ASCII characters.
2. WHEN `search_jobs` is called with filters, sort, page size or a cursor THEN it SHALL behave exactly as `list_jobs` does for those arguments.
3. WHEN a saved job shares a title and company with the query but has a different posting URL THEN `search_jobs` SHALL return it.
4. WHEN the tool descriptions are read by an agent THEN they SHALL state that `find_job` answers "is this exact URL saved" and `search_jobs` answers "is anything like this saved", so the agent routes between them without trying both.

### Requirement 4 — Read one job in full

**User Story:** As a JobSync user, I want the agent to pull one job's complete record by id, so that it can draft against the real posting without me pasting it back in.

#### Acceptance Criteria

1. WHEN `get_job` is called with an id the caller owns THEN the server SHALL return every scalar field on that job, plus status, company including careers URL and industry when set, location, source, tags, notes, the stage timeline with its interviewers, linked contacts with their role, resume and cover-letter references, and the match score and analysis.
2. IF a field is null or a relation is empty THEN the server SHALL omit it or mark it absent rather than printing an empty label.
3. WHEN `get_job` is called with an id belonging to another user THEN the server SHALL respond exactly as it does for an id that does not exist.
4. WHEN a job's match score was never analyzed THEN `get_job` SHALL report no score, as the list does.

### Requirement 5 — Responses an agent can afford to read

**User Story:** As an agent with a finite context window, I want read responses laid out compactly and predictably, so that a full page costs me a bounded amount of context.

#### Acceptance Criteria

1. WHEN any of the three tools responds THEN it SHALL return text content in the same shape the existing tools use: `{ content: [{ type: "text", text }] }`.
2. WHEN a list or search page is returned THEN each job SHALL occupy one line.
3. WHEN `get_job` returns THEN it SHALL be laid out in labelled sections rather than one line.
4. WHEN an error occurs THEN the server SHALL return it as text, never throw, matching `findJob.ts`.
5. WHEN the default page size is used THEN the whole response SHALL stay small enough to sit comfortably inside an agent's context alongside its other work.

### Requirement 6 — Read access is scoped

**User Story:** As a self-hosting user, I want read access governed by the same token scopes as everything else, so that revoking or re-issuing a token behaves the way the app already documents.

#### Acceptance Criteria

1. WHEN a token is created THEN it SHALL carry `jobs:read` alongside the scopes it already carries.
2. IF a caller's token carries neither `jobs:read` nor `jobs:write` THEN all three tools SHALL refuse with the same "Insufficient scope" text shape the existing checks produce.
3. IF a token was issued before this feature and carries `jobs:write` THEN the three tools SHALL work, so no existing agent breaks on upgrade.
4. WHEN the scopes paragraph in `wiki/mcp.md` is read THEN it SHALL state what `jobs:read` covers and how existing tokens are treated.

### Requirement 7 — Reads cost the same as writes

**User Story:** As a self-hosting user, I want reads to share the existing rate-limit budget, so that an agent looping over my tracker cannot escape the limit that already governs writes.

#### Acceptance Criteria

1. WHEN any of the three tools is called THEN it SHALL consume exactly one unit of the shared per-user rate limit, whatever the page size.
2. IF the rate limit is exhausted THEN the tool SHALL return the same "Rate limit exceeded. Try again in Ns." text the existing handlers return.

### Requirement 8 — No new exposure

**User Story:** As a JobSync user, I want the read tools to expose only what I can already see in the app, so that connecting an agent does not widen what a leaked token reaches.

#### Acceptance Criteria

1. WHEN any read query runs THEN its Prisma `where` clause SHALL include the caller's `userId`, and no raw SQL SHALL be used.
2. WHEN a field is hidden from the user in the web app THEN the read tools SHALL hide it too.
3. WHEN these tools are added THEN no new authentication mechanism, REST route or write path SHALL be introduced.
4. IF a job's match score is hidden THEN no filter SHALL let a caller select on that hidden value or infer it by narrowing a range.

### Requirement 9 — Fork-only: a rate limit the operator can set

**User Story:** As the operator of this fork, I want to raise the MCP rate limit without editing source, so that a bulk import is not throttled by a constant compiled into the app.

#### Acceptance Criteria

1. IF the environment sets `MCP_RATE_LIMIT_MAX` to a positive integer THEN the limiter SHALL use it.
2. IF that variable is unset or not a positive integer THEN the limiter SHALL use the current default of 60.
3. WHEN this change is committed THEN it SHALL be its own commit on a fork-only branch, so it can be dropped or offered upstream separately.

### Requirement 10 — Fork-only: something to run and something to connect

**User Story:** As the operator of this fork, I want the read tools running on my own machine and reachable from my clients, so that I can use them before upstream merges anything.

#### Acceptance Criteria

1. WHEN the three feature branches are integrated THEN there SHALL be a single fork branch carrying all of them plus Requirement 9.
2. WHEN that branch is built as a container image THEN it SHALL run against the existing `deploy/` compose setup with no edits beyond environment values.
3. WHEN the connection note is read THEN it SHALL give the endpoint URL, a Claude Desktop `mcp-remote` config, and the equivalent `claude mcp add` command.
4. WHEN the acceptance criteria above are verified THEN it SHALL be against a running instance with a real token, not only unit tests.

## Non-Functional Requirements

### Performance
- A page of jobs at the default size SHALL be served by at most two Prisma queries: one for the page, one for the count.

### Security
- Ownership is enforced in the query, not by filtering results after the fact.
- An id belonging to another user is indistinguishable from a nonexistent one in the response text.

### Reliability
- No new runtime dependency is added to the project.
- Cursor paging SHALL be stable across pages when two jobs share the same sort date.

## Decisions taken in this document

- D1 — Legacy token behaviour: imply `jobs:read` from `jobs:write`, or require re-issue; chosen to imply, because `resume:write` shipped deliberately ungated so pre-existing tokens kept working (`src/app/api/mcp/route.ts:236`), and implying is the closest reading of that precedent that still satisfies a real scope check. Overridden if the maintainer answers differently on #114.
- D2 — Page size: 25 default and 100 maximum, matching `APP_CONSTANTS.RECORDS_PER_PAGE` and the outline; chosen because the app's own list already pages at 25.
- D3 — Dismissed discovered jobs: include by default, or exclude as the app does; chosen to exclude, because Requirement 8 says the agent sees what the user sees, and the web app hides them.
- D4 — Unanalyzed match scores: chosen to hide, reusing `hideUnanalyzedScore`, for the same reason as D3.
- D5 — Status filter validation: reject an unknown status rather than return an empty page, because an agent that mistypes a status learns more from a validation error listing the ten valid values than from zero rows.
- D6 — Fork-only work (Requirements 9 and 10) is specified here but kept off the three upstream branches, so upstream PRs carry no homelab-specific change.

## Scope notes

There is no decomposition document for this project and no steering documents. Items 3, 4 and 5 of issue #114 — relaxing the `createdVia` update rule, `save_cover_letter`, and a `set_status` wrapper — are out of scope and were declined publicly in the #114 comment. Reads over resumes, cover letters, questions, tasks, activities and automations are out of scope. Aggregation and reporting tools are out of scope: an agent can compute funnel counts from `list_jobs` output. The spreadsheet migration in section 7 of the outline is out of band and is not part of this spec.
