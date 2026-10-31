# Adversarial Review — mcp-read-tools/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/jobsync/.spec-workflow/specs/mcp-read-tools/design.md

## Execution context
- Workspace: /home/mcf/repo/jobsync
- Workflow root: /home/mcf/repo/jobsync

## Analysis dimensions

Read the target document first, then the prior-phase document at
`/home/mcf/repo/jobsync/.spec-workflow/specs/mcp-read-tools/requirements.md`, then the codebase files the
design cites. Attack these five dimensions. Add a sixth of your own only if you find something none of
them reaches.

### 1. Keyset paging (D2, D3, D4, the cursor payload)

- Work the null boundary by hand: sorting by `applied` descending over a set where some jobs have a null
  `appliedDate`, write the exact Prisma `where` the design implies for page 2 and show whether the null rows
  are returned once, twice, or never. The design asserts a keyset scheme but never writes the clause.
- Challenge the claim that a keyset cursor is stable "repeating no row and skipping none" (Requirement 1
  criterion 4) when a job is created, deleted or re-dated between page 1 and page 2.
- Stress-test the filter fingerprint `f`: the design says eight hex of sha256 over "the canonicalized filter
  set" but never defines canonicalization. Name a pair of semantically identical calls that would produce
  different fingerprints, and a pair of different calls that would collide.
- The design returns a total count with every page (D11) but the count is taken at page time. Show what an
  agent concludes when the count moves between pages.

### 2. The scope gate (D5) against Requirement 6

- Requirement 6 criterion 2 says a token holding neither scope is refused with the text
  `Insufficient scope. Required: jobs:read`. Challenge whether that text is honest when a token holding only
  `jobs:write` is accepted.
- Compare against the deliberate ungated precedent at `src/app/api/mcp/route.ts:236-240` and judge whether
  D5 actually follows it or merely claims to.
- Examine what happens to `jobs:read` on tokens created before the change and never re-issued: does any
  surface (the settings page, the wiki scopes paragraph) now misreport what a token can do?

### 3. Response size (Requirement 5, D10) — the unbounded fields

- `get_job` returns the full `description` (a whole job posting, `prisma/schema.prisma` makes it non-null)
  plus the rendered match body. Neither is capped anywhere in the design. Compute a realistic worst case and
  judge it against Requirement 5 criterion 5.
- Do the same for a 100-row page: the row format is fixed but `title`, `company` and `location` are
  free-text. Show the worst case and whether the design's "one line per job" survives a title with a newline
  in it.
- Challenge the absence of any truncation, ellipsis or "description omitted, call get_job" rule.

### 4. Filter semantics (D6, D8, D9) and the hidden-score hole

- The design filters on `matchScoreMin`/`matchScoreMax` against the stored column, but D4 of the
  requirements hides unanalyzed scores via `hideUnanalyzedScore` (`src/actions/job/shared.ts:8-17`), which
  runs on the rows *after* the query. Determine whether an agent can infer a score the app refuses to show,
  and rule on it against Requirement 8 criterion 2.
- Attack the reserved value `web` in D8 on grounds beyond the token-name collision the design already admits.
- Substring matching (D6, D9) is claimed to be case-insensitive because SQLite's LIKE is. Verify that claim
  against the actual provider configuration in `prisma/schema.prisma` and state where it stops being true.
- The `status` filter is an enum but statuses live in a `JobStatus` table. Show what happens when the enum
  and the table disagree.

### 5. The three-PR split (Architecture, Scope notes) against the outline's constraints

- The outline caps each PR at ~400 changed lines excluding generated files. Estimate each PR from the
  design's own component list and name which one breaches it.
- Requirement 10 criterion 1 and the deliverables require each PR to be independently mergeable. Test that
  against `searchJobs.ts` depending on a module introduced by PR 2, and against the wiki and eval files all
  three PRs touch.
- The design assigns no home to the `find_job` versus `search_jobs` routing text that Requirement 3
  criterion 4 demands. Say where it must live and what breaks if it lands in the wrong PR.

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
Write your analysis to: /home/mcf/repo/jobsync/.spec-workflow/specs/mcp-read-tools/reviews/adversarial-analysis-design.md
