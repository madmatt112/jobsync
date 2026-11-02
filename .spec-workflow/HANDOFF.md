> **READ FIRST — SDD routing (2026-10-08, harness v4).** Active spec **`mcp-write-tools`** (finished).
> Live phase **closeout**, state **items 14/14**, last result **closed** (jobsync PR #4, spec-workflow-mcp PR #87 open for merge; P12 PAT scope is a human to-do).
> Roots: spec store `/home/mcf/repo/jobsync/.spec-workflow`, code `/home/mcf/repo/jobsync`.
> A re-run does: starts the next spec named in decomposition.md, at requirements.

## Phase log

| Date | Spec | Stage | State | Result | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-10-06 | mcp-write-tools | requirements | v1 | gate-a |  |
| 2026-10-06 | mcp-write-tools | requirements | v4 | approved | 4 rounds, iterate 0/2/3 to converged 0/0/1 |
| 2026-10-06 | mcp-write-tools | requirements | v6 | approved | 6 rounds across 2 runs, converged then revised for R8/R9, post-cap adjudicated and verified |
| 2026-10-06 | mcp-write-tools | design | v4 | approved | 4 rounds, iterate 0/1/3 -> 1/1/1 -> 0/1/1 -> SHOULD_FIX-only v4, narrow check VERIFIED 2/2 |
| 2026-10-06 | mcp-write-tools | tasks | v1 | resume | 1 round, iterate 0/2/2, revise to v2 pending |
| 2026-10-07 | mcp-write-tools | tasks | v3 | approved | 3 rounds, converged via SHOULD_FIX-only pass then VERIFIED 1/1 |
| 2026-10-07 | mcp-write-tools | implementation | tasks 8/12 | resume | budget of 5 reached; tasks 9-12 open |
| 2026-10-07 | mcp-write-tools | implementation | tasks 12/12 | escalate | PR blocked (token) |
| 2026-10-08 | mcp-write-tools | implementation | tasks 12/12 | complete | gate closed against merged PR #2 + e2e fix PR #3; no new PR |
| 2026-10-08 | mcp-write-tools | implementation |  | complete |  |
| 2026-10-08 | mcp-write-tools | retrospective |  | retro-ready |  |
| 2026-10-08 | mcp-write-tools | retrospective | APPROVED | retro-ready | plan approved: 14 proposals, P1/P12/P13 option (a), P15 no change |
| 2026-10-08 | mcp-write-tools | closeout | items 14/14 | closed | 10 done, 3 skipped, 1 to-do; PRs jobsync#4 swm#87 |
| 2026-10-31 | server-side-match | requirements | v3 | approved | 3 rounds |
| 2026-10-31 | server-side-match | design | v2 | approved | 2 rounds |
| 2026-11-01 | server-side-match | tasks | v1 | approved | 3 rounds |

## mcp-write-tools — requirements

| Field | Value |
| --- | --- |
| State | approved at v6 on 2026-10-06 |
| Rounds | 6; verdicts iterate 0/2/3 → iterate 1/1/1 → iterate 1/0/2 → converged 0/0/1 (v4 gate-A) → revision added R8/R9 → iterate 1/3/2 → post-cap v6, narrow check VERIFIED 4/4 |
| Approval | `approval_1791317141381_y23cnsbig` |
| Rulings | none |
| Cut scope | none |
| Carried items | R4-1 — userId scoping on the no-profile create: open MINOR; design to confirm the R6 AC3 / Security NFR phrasing, since a Prisma `create` has no `where` userId clause | R5-5 — R8 AC3 changes the shipped in-app Match scoring prompt, not acknowledged by the Introduction's "MCP adopts the app prompt" framing; reconcile the framing in design | Deferred (narrow check r6): matchDirective.ts:29 "against the user's default resume" wording vs R8 AC2's job-linked resume source; and whether R8 AC3(c)'s shared conditional warning supersedes matchDirective.ts:18-26's own completeness-gated warning for partial-description MCP jobs |
| Next phase loads | requirements.md (approved v6), then reviews/adversarial-analysis-requirements-r6.md for the open MINORs R4-1 and R5-5 and the two deferred narrow-check findings |

## mcp-write-tools — design

| Field | Value |
| --- | --- |
| State | approved at v4 on 2026-10-06 |
| Rounds | 4; verdicts iterate 0/1/3 → iterate 1/1/1 → iterate 0/1/1 → SHOULD_FIX-only pass v4 → narrow check VERIFIED 2/2 |
| Approval | `approval_1791321360331_4ssrzmsr4` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | design.md (approved v4); requirements.md v6 for the EARS ACs each task maps to |

## mcp-write-tools — tasks

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-10-07 |
| Rounds | 3; verdicts iterate 0/2/2 → iterate 0/1/0 → SHOULD_FIX-only pass v3 → VERIFIED 1/1 |
| Approval | `approval_1791332171599_pboqadig5` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | design.md (component map C1-C8 → tasks 1-11, e2e = task 12) and the gate-B veto list / `## Sensitive paths` before the first implementation spawn |

## mcp-write-tools — implementation

| State | implemented 2026-10-07, tasks 12/12, merged to main (PR #2 ef8b38a, e2e fix PR #3 a5c5462), completion gate closed 2026-10-08 |
| Deferrals | 2 added by this spec, 1 still deferred: d-be11e67a (verification/e2e) RESOLVED by PR #3 — e2e green twice on seeded :3838; d-0c0f40e9 (tooling — test/lint config does not exclude .claude/ nested worktrees) still deferred |
| PR | MERGED — branch feat/mcp-write-tools squash-merged as PR #2 (ef8b38a, "feat(mcp): write tools on any owned job, cover letters, one match method"), merged 2026-10-07; follow-up e2e stabilisation PR #3 (a5c5462), merged 2026-10-08. Local main fast-forwarded to a5c5462. Both PRs green at merge. No new PR opened, nothing merged by this run. |
| Work next | d-0c0f40e9 (clean up the stray .claude/worktrees/default-filter-expired worktree that pollutes bare `npm test`/`npm run lint`); then the retrospective |
| Gotchas | Unit suite is green only with `--exclude '**/.claude/worktrees/**'` / `--ignore-pattern '.claude/**'` (stray worktree, d-0c0f40e9). Never run e2e against :3737 (real-data homelab); use a seeded instance (e.g. :3838). tools.json is gitignored and regenerated via `cd evals && npx tsx mcp-tools/generate-tools.ts`, not committed. The R9 AC6 PR-body paragraph (jobscout commits 8ecbf57, f2d0bce) lives in task 11's implementation log. The working tree has an unrelated one-line .gitignore change that must never be staged. |

## mcp-write-tools — closeout

| Field | Value |
| --- | --- |
| State | CLOSED — items 14/14 resolved (10 done, 3 skipped, 1 to-do human) |
| Done | P1, P5 (jobsync PR #4); P2, P6, P8, P10, P11, P13 (swm PR #87); P3 (RTK.md, in place, no commit); P9 (spec-store steering, git-excluded, no commit) |
| Skipped | P4 (covered by dashboard-shell P15), P7 (covered by dashboard-shell P10/G2), P14 (no change needed beyond P1 per decision) |
| To-do (human) | P12 — add `pull-requests:write` to the GH_TOKEN PAT (operator action on the token; cannot be done from here) |
| PRs | jobsync PR #4 https://github.com/madmatt112/jobsync/pull/4 (branch chore/mcp-write-tools-retro, 2 commits) — open, not merged. spec-workflow-mcp PR #87 https://github.com/madmatt112/spec-workflow-mcp/pull/87 (branch chore/mcp-write-tools-harness, 6 commits) — open, not merged. Overwatch merges both. |
| Deferrals | d-0c0f40e9 resolved by P5 (jobsync PR #4). |
| Gotchas | Both retro worktrees remain under `.claude/worktrees/` (jobsync: mcp-write-tools-retro; swm: mcp-write-tools-harness); remove them after the PRs land. jobsync spec store is git-excluded, so P9's steering file and all spec-store commits are on-disk only, not version-controlled. The unrelated one-line jobsync `.gitignore` change in the main checkout was left unstaged. swm PR #87 was rebased on origin/main at open (origin/main had not moved). |

## server-side-match — requirements

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-10-31 |
| Rounds | 3; verdicts should-fix-only → converged |
| Approval | `approval_1793411970847_h1dr0eqka` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | codebase-context.md |


## server-side-match — design

| Field | Value |
| --- | --- |
| State | approved at v2 on 2026-10-31 |
| Rounds | 2; verdicts converged |
| Approval | `approval_1793468413853_eq3eumshx` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | codebase-context.md |


## server-side-match — tasks

| Field | Value |
| --- | --- |
| State | approved at v2 on 2026-11-02 |
| Rounds | 3; verdicts gate-b annotation |
| Approval | `approval_1793586597673_uh7a78ud2` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | codebase-context.md |


## server-side-match — implementation

| Field | Value |
| --- | --- |
| State | tasks 8/14, last commit acca938, next task 9 |
