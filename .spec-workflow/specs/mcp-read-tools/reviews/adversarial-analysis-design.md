# Adversarial Analysis — mcp-read-tools/design (v1), Round 1

Target: `/home/mcf/repo/jobsync/.spec-workflow/specs/mcp-read-tools/design.md`
Prior phase: `/home/mcf/repo/jobsync/.spec-workflow/specs/mcp-read-tools/requirements.md`
Outline: `/home/mcf/repo/jobsync-read-tools-spec-outline.md`

This is v1: no Revision History, no `## Changes since`. The whole document is in scope. I read
both ends of every cited range in the codebase before ruling. Correct citations are listed under
"What checked out" so the loop can see the work.

---

## Findings

### R1-1 — Keyset paging drops every null-sort-field row from page 2 onward (MUST_FIX)

Dimension 1. D2/D3/D4 assert a keyset cursor that is stable "repeating no row and skipping none"
(Requirement 1 criterion 4), but the design never writes the `where` predicate, and the natural
one is wrong at the null boundary.

Work the boundary by hand. `sortBy=applied`, `sortOrder=desc`. D4 pins nulls last in descending
(SQLite orders NULL low; confirmed `provider = "sqlite"` in `prisma/schema.prisma`). Page 1 ends on
a non-null row `(v1, id1)`. The keyset predicate the design implies is:

```
where: { userId, ...filters, OR: [
  { appliedDate: { lt: v1 } },
  { appliedDate: v1, id: { lt: id1 } },
]}
```

In SQL `appliedDate < v1` and `appliedDate = v1` are both false/NULL for rows where `appliedDate IS
NULL`. So this predicate returns null-dated jobs **never** — not once, not twice. Paging walks the
non-null rows and then returns an empty page while null rows remain, terminating early. That
violates Requirement 1 criterion 4 ("skipping none") and Requirement 2 criterion 5 ("SHALL still
return that job"). The correct descending-nulls-last predicate needs an explicit third branch
`{ appliedDate: null }` to cross into the tail, then `{ appliedDate: null, id: { lt: id1 } }` once
`v` is null. The cursor payload stores `v: string | null`, acknowledging the null case, yet the
design specifies no branching decode. The Testing section claims a "cursor round-trip across a
two-page fixture with a shared sort date" plus "null-date ordering" — a shared-date fixture does not
exercise the null boundary at all, so the described test would pass while the bug ships. The design's
own stability claim contradicts its (unwritten but implied) mechanism.

### R1-2 — `matchScoreMin/Max` filters the raw column that `hideUnanalyzedScore` hides, leaking a value the app refuses to show (MUST_FIX)

Dimension 4. `hideUnanalyzedScore` (`src/actions/job/shared.ts:9-17`) nulls `matchScore` **after**
the query when `matchData.analyzed === false`; the comment (lines 6-8) says an unanalyzed automation
job still carries a real keyword pre-rank in the `matchScore` column. The design filters
`matchScoreMin/Max` against that stored column inside the `where` clause, i.e. before hiding. So:
`list_jobs matchScoreMin=95` returns job X, whose row prints `match -` (hidden), and the agent now
knows X's suppressed score is ≥95. Sweeping min/max pins the exact hidden value. The web app has no
score-range filter (`buildJobsWhereClause`, `queries.ts:89-174`, filters only by status/type/facets),
so this is capability the UI does not have. That breaks Requirement 8 criterion 2 ("a field hidden
in the web app SHALL be hidden") and the Requirement 8 user story ("expose only what I can already
see"). The design must exclude unanalyzed rows from the score filter (e.g. require
`matchData.analyzed !== false` in the same clause) or drop the filter. Single-user self-hosted data,
so no human escalation — but a real requirement violation.

### R1-3 — Four cited artifacts point at the wrong lines (MUST_FIX)

Standing directive: a misstated artifact is an automatic MUST_FIX. The behaviours are right; the line
numbers are wrong, and one points at unrelated text. An implementer told to "reuse `X:63`" will read
the wrong code.

- Design line 49 — getJob "Reuses the include graph at `queries.ts:41-70`." The include graph
  `JOB_DETAILS_INCLUDE` is **lines 45-77**. Lines 41-43 belong to `JOB_EXPORT_SELECT`
  (`dueDate/applied/appliedDate`); line 70 stops mid-`contactLinks`, cutting off `stages` (71-77) —
  which is where "interviews" actually live. Also "extended with the job's notes and interviews" is
  loose: `stages` is already in the graph (interviews are `JobStage` rows), so only `Notes` must be
  added.
- Design line 49 — getJob "the error-as-text shape of `findJob.ts:60-66`." The `catch` that returns
  `Error: <message>` is **lines 66-70**; 60-65 is the success-message template.
- Design line 97 (Error Handling #6) — "matching `findJob.ts:63`." Line 63 is `edit it there
  instead.` (part of the success string). The `Error: ${err?.message}` shape is **line 68**.
- Design line 117 (D11) — "two queries per list call ... matching `queries.ts:186-196`." The
  `Promise.all([findMany, count])` is **lines 201-215**; 186-196 is the function preamble and holds
  no count query.

### R1-4 — Requirement 6 criterion 1 (new tokens carry `jobs:read`) has no design home (SHOULD_FIX)

Dimension 2/5. `createMcpToken` hardcodes
`scopes: JSON.stringify(["jobs:write","questions:write","resume:write"])`
(`src/actions/mcpToken.actions.ts:46`) — no `jobs:read`. Requirement 6.1 and outline deliverable 1
("the `jobs:read` scope (token creation ...)") require new tokens to carry it. The design's component
list (getJob.ts, jobQuery.ts, listJobs/searchJobs, route.ts registration) never names
`mcpToken.actions.ts`, and the schema comment on `McpAccessToken.scopes` would also go stale. Because
D5 accepts `jobs:write` as an alias, reads still work without the scope, so the omission hides
behind the gate — but Requirement 6.1 is unmet and the settings badges / `wiki/mcp.md` scopes
paragraph (Requirement 6.4, `wiki/mcp.md:84`) would never show or describe `jobs:read`. The wiki edit
is likewise unassigned in the design (see R1-8).

### R1-5 — No `discoveryStatus` filter, so Requirement 1 criterion 6's escape hatch is unreachable (SHOULD_FIX)

Dimension 4. Requirement 1.6 says dismissed jobs are excluded by default "unless the caller filters
for that status explicitly," matching the web app. The web app does this: `filter === "dismissed"`
toggles `discoveryStatus` (`queries.ts:105,123-129`). The design's filter set exposes only a `status`
enum of `JobStatus` values (new … withdrawn) — none of which is a `discoveryStatus`
(new/accepted/dismissed). So there is no way for an agent to ask for dismissed jobs, and Requirement
1.6's conditional is unsatisfiable. Separately, the design never states that `buildJobWhere` must
replicate the default dismissed-exclusion clause at all; "Reuses the filter-building idiom" does not
call it out.

### R1-6 — Filter fingerprint `f` has no canonicalization spec: spurious rejects and silent collisions (SHOULD_FIX)

Dimension 1. `f` = "first 8 hex of sha256 over the canonicalized filter set," but canonicalization is
undefined, so which fields are hashed and how values normalize is unknown.

- Semantically identical → different fingerprint: `{status:"applied"}` vs
  `{status:"applied", limit:25}` (25 is the default), or `createdFrom:"2026-01-01T00:00:00Z"` vs
  `"2026-01-01T00:00:00.000Z"` (same instant). A cursor from one is rejected by the other under Error
  Handling #4, so the agent can never page — Requirement 1.4 fails.
- Different call → same fingerprint: if `query` is excluded from the set (plausible, since `list_jobs`
  and `search_jobs` share the builder), a cursor from `query="foo"` is accepted by `query="bar"` and
  returns "foo"-ordered rows under "bar" — silently wrong, and Error Handling #4's promise to catch a
  mismatch is defeated. 8 hex is 32 bits; chance collisions are negligible, but the undefined field
  set is the real hole.

### R1-7 — Response size: `get_job` is unbounded and the one-line row has no escaping (SHOULD_FIX)

Dimension 3. Two parts.

- `get_job` returns the full non-null `description` (`prisma/schema.prisma`, `Job.description
  String`) — `add_job` demands the whole posting "copied in full — do not summarize"
  (`mcp.schema.ts` jobDescription) — plus the rendered `matchData` analysis body (D10). A long
  posting (2000+ words ≈ 15 KB) plus an LLM fit write-up (≈ 2-5 KB) is a 15-20 KB single response with
  no cap, truncation, ellipsis, or "description omitted, call get_job" rule anywhere. Requirement 5.5
  binds only the default *page*, so `get_job` is technically exempt — but the design should say so and
  should cap or note the match body rather than leave it silent.
- The list row is a `|`-delimited single line, but `title`, `company`, `location`, `source` and the
  `createdVia` token name are free text. A title containing `\n` (nothing forbids it —
  `jobTitle: z.string().min(1)`) makes one job span two lines, breaking Requirement 5.2 ("each job
  SHALL occupy one line") and any line-based parse; a `|` in a company name breaks column parsing. The
  renderer specifies no sanitization. A 100-row page with long free-text fields also reaches ~30 KB,
  but that is the caller's explicit `limit`, so acceptable; the newline/`|` corruption is not.

### R1-8 — PR split: PR 2 breaches the ~400-line cap and the routing text (Req 3.4) is unhomed (SHOULD_FIX)

Dimension 5. The outline caps each PR at ~400 changed lines excluding generated files/migrations
(tests counted). From the design's own component list, PR 2 carries `jobQuery.ts` (the entire shared
module: `buildJobWhere` over ~12 filters incl. three date ranges, keyset encode/decode with the null
branching R1-1 requires, `formatJobRow`, `runJobQuery` with two queries), `listJobs.ts`, the
~12-field `McpListJobsInputShape` with descriptions, plus `mcpListJobs.spec.ts` with a two-page
fixture asserting every filter, cursor round-trip and null ordering. That is realistically 500-700
lines — PR 2 breaches, while PR 3 (`searchJobs`, "adds one OR block") is trivial. The design front-
loads all shared complexity into PR 2.

The `find_job` vs `search_jobs` routing text Requirement 3.4 demands has no assigned home. It must
live in `MCP_TOOL_DESCRIPTIONS` (`src/lib/mcp/toolDescriptions.ts`) and requires editing `find_job`'s
existing description to add the "exact URL" contrast. If that edit lands before PR 3, the description
references a `search_jobs` tool that does not yet exist; it must ship in PR 3. The design never names
`toolDescriptions.ts`, `wiki/mcp.md`, or `evals/mcp-tools/` as components, though all three PRs touch
wiki and evals (the outline requires an eval routing case per PR) — sequential PRs editing the same
files couple them and conflict on rebase.

### R1-9 — "Ten valid statuses" is false; the enum has eleven (SHOULD_FIX)

Dimension 4. Error Handling #3 ("the enum error names the ten valid statuses"), the Testing section,
and Requirements 2.3/3 all say ten. `JOB_STATUS_VALUES` is derived from `JOB_STATUSES`
(`src/lib/constants.ts:293-305`), which has **eleven** entries: new, draft, applied, interview, offer,
offer-accepted, offer-declined, rejected, expired, archived, withdrawn. A validation-error string or
test asserting "ten" will be wrong. Note on the prompt's enum-vs-table probe: they do **not** disagree
at runtime — `auth.actions.ts:55-61` seeds `JobStatus` by iterating the same `JOB_STATUSES` constant,
so table and enum both carry eleven and "new" exists (badge-colors confirms it). The stale
`src/lib/data/jobStatusesData.ts` (ten rows, missing "new") is imported nowhere and is a red herring,
not the seed. So there is no empty-result hole from `status=new`; the only defect is the false count.

### R1-10 — `createdVia="web"` conflates web-app and automation jobs (SHOULD_FIX)

Dimension 4. D8 maps reserved `web` to `createdVia IS NULL`. But the schema comment on `Job.createdVia`
says "null = UI **or automation**." So filtering `createdVia=web` returns automation-discovered jobs
too, and the row renders every automation job as `web` via `<createdVia|web>`. An agent asking "which
jobs did I enter by hand" gets automation finds mixed in and mislabelled. This is a semantic hole
independent of the token-name collision the design already admits.

### R1-11 — Minor notes (MINOR)

- D11 total count is taken per page. Between pages a create/delete moves it; an agent that trusts or
  sums "N matched" across pages sees it drift. Inherent to live paging; worth one sentence, not a
  redesign.
- D6 case-insensitivity is ASCII-only (SQLite `LIKE`). Honest in D6, but Requirements 2.2/3.1 say
  "case-insensitive" unqualified; "München"/"Zürich"/"São Paulo" match case-sensitively. Low
  frequency; note the limitation.
- `buildJobWhere` shared by list and search: the dismissed-exclusion wants an `OR` and the search
  query wants an `OR`. The app avoids the key clash by nesting dismissed under `AND:[{OR:[...]}]`
  (`queries.ts:124`) and search under top-level `OR` (line 170). The design's "adds one OR block"
  glosses this; naively setting `where.OR` twice clobbers.

---

## What checked out (verified, no finding)

- `route.ts:92-99` (find_job's `jobs:write` gate) and `route.ts:236-240` (the intentionally ungated
  resume comment) are cited correctly. D5 does not claim to copy the ungated precedent — it adds a
  real `jobs:read OR jobs:write` gate, stricter than the precedent, consistent with requirements D1.
- Error-message honesty (Requirement 6.2): "Insufficient scope. Required: jobs:read" is shown only to
  a token holding neither scope; a `jobs:write`-only token is accepted and never sees it. Naming the
  canonical scope to request is fine, not dishonest.
- `findJob.ts:5-9` (handler contract), `shared.ts:8-17` (`hideUnanalyzedScore`), `queries.ts:83-170`
  (filter idiom) and `queries.ts:153-166` (search `contains`) are cited accurately enough to land on
  the right construct.
- `McpListJobsInputShape`/`sortBy`/`cursor` do not yet exist in `mcp.schema.ts` — consistent with the
  design introducing them. Default 25 / max 100 matches `APP_CONSTANTS.RECORDS_PER_PAGE`.

---

## Top 5 risks/gaps
1. Keyset paging silently drops null-sort-field jobs (R1-1).
2. Score-range filter leaks the hidden `matchScore` the app suppresses (R1-2).
3. Requirement 6.1 token-creation change and the wiki scopes edit are unhomed (R1-4, R1-8).
4. No `discoveryStatus` filter — Requirement 1.6's escape hatch is unreachable (R1-5).
5. Fingerprint canonicalization undefined — unpageable or cross-filter cursors (R1-6).

## Top 3 conclusions to challenge or reverse
1. "keyset ... repeating no row and skipping none" (D2/D4): reverse. As specified it skips every null
   row on page 2+. Write the three-branch predicate and test the actual null boundary, not a shared
   date.
2. "hideUnanalyzedScore" reuse makes the score safe (D10 / Reuses note): challenge. Hiding runs after
   the query; the `matchScoreMin/Max` filter runs before it and re-exposes the value.
3. "Nothing else from the requirements is cut" (Scope notes): reverse. Token-creation (6.1), the wiki
   scopes line (6.4), the `discoveryStatus` filter (1.6), and the tool-description routing text (3.4)
   have no design coverage.

## What's missing before acting
- The exact page-2 `where` for each `sortBy`/`sortOrder`, including the null branch and the
  `v === null` decode path.
- A definition of the canonicalized filter set behind `f` (field list + value normalization).
- The score-filter/hiding reconciliation.
- A `discoveryStatus` filter (or an explicit ruling that dismissed stays unreachable, overriding 1.6).
- Row escaping/sanitization rules and a `get_job` size posture.
- Component entries for `mcpToken.actions.ts`, `toolDescriptions.ts`, `wiki/mcp.md`,
  `evals/mcp-tools/`, and a per-PR line estimate proving PR 2 fits ~400.

---

```
VERDICT: iterate
MUST_FIX: 3
SHOULD_FIX: 7
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
