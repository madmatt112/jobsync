# Retrospective — server-side-match

Compiled 2026-11-02 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — e2e login needs a one-time admin signup on a fresh db.** `test:e2e`'s
  `playwright.config.ts` has no `globalSetup`, so a throwaway db has no `admin@example.com`
  and no suite can log in until a signup runs (the untracked `e2e-local.setup.ts` does this
  by hand). Task 14 hit this and the fix round added an in-spec admin seed. Evidence: retro
  log 2026-11-02T05:01:50Z; commits 1fd25e0, a553b75; task 14 review v1. Frequency: once this
  spec; seen in mcp-write-tools too. Cost: 1 fix round, 2 implementer spawns.
- **F2 — A new const must be importable from the seam, not via a barrel.** Task 2 needed
  `MATCH_PROVIDER_OPTIONS` in match.ts/analyze.ts; the first attempt added a barrel re-export
  in `src/lib/ai/index.ts` (outside the task's file list), and the fix round reverted it to a
  direct import from `@/lib/ai/matchProviderOptions`, matching matchJob.ts. Evidence: retro
  log 2026-11-02T02:45:24Z; commit 1c08db6; task 2 review v1. Frequency: once. Cost: 1 fix
  round, 2 implementer spawns.

## Product bugs found

None found. Every review verdict was pass; the two review findings were info-level gaps
(F8, F9), not latent product defects, and were deferred rather than fixed.

## Tool and MCP errors or deficiencies

- **F3 — rtk's eslint wrapper reports a phantom failure on a clean pass.** On tasks 9 and 10
  the rtk eslint wrapper printed "JSON parse failed" / "JSON parse failed: EOF" while the
  direct `./node_modules/.bin/eslint` exited 0 with no output; the worker trusted the direct
  binary per RTK.md's documented gotcha. Evidence: retro log 2026-11-02T03:46:38Z,
  04:09:46Z. Frequency: 2 times this spec; seen in mcp-write-tools too (F3). Cost: minor
  investigation, no fix round.

## Harness defects

None found. The .claude nested-worktree test/lint pollution that dogged mcp-write-tools
(its F5) did not recur in this spec's retro log.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — Whole-spec TDD was vacuous: no task could fail red-first.** Every task's success
  criteria were RED-IMPOSSIBLE; tasks 4 and 14 filed author reports and were routed
  implementer-only, and spec-status shows all 13 tdd bases "inconclusive" with no
  tdd-test-command wired. Evidence: retro log 2026-11-02T02:56:24Z (task 4), 04:52:53Z (task
  14); spec-status tddCoverage. Frequency: spec-wide. Cost: red step gave no signal on any
  task; echoes mcp-write-tools F2/F10.

## Documentation gaps

- **F5 — Task 4 had no reader for the flag it wrote, so its guards were vacuous.** No reader
  of `serverSideMatch` existed in task 4's seam, so the acceptance was satisfied vacuously at
  base; the implementer added a regression guard ("defaultUserSettings has no serverSideMatch
  key") that no prior assertion named. Evidence: retro log 2026-11-02T02:56:24Z; commit
  9cb7127. Frequency: once. Cost: implementer judgement, no fix round.

## Model behaviour

None found. Branch commits carried no Claude attribution trailer, so the user's "NO Claude
attribution" rule held (contrast mcp-write-tools F11, where it did not). Evidence: git log
1fd25e0, a553b75, 9cb7127 (no Co-Authored-By trailer).

## Process deviations and rulings

None found. 0 adjudications, 0 escalations, 0 rulings; requirements converged at v3 after a
SHOULD_FIX-only corrective pass (not an adjudication), design at v2, tasks at v2. Evidence:
HANDOFF all four sections; ledger round events; retro log 2026-11-02T05:33:19Z.

## Decisions the harness made for the human

- **F6 — No PR opened; completion closed on local green.** The spec completed with PR "none
  (no remote, or not opened)"; the completion gate accepted 14/14 logged and reviewed tasks
  with no remote to push to. Evidence: HANDOFF implementation (PR none); spec-status
  completed. Frequency: once; echoes mcp-write-tools F15. Cost: none (local-only repo).
- **F7 — Two review findings deferred to unblock completion, not fixed.** Both deferrals are
  harness-owned info-findings left open rather than fixed in-spec, so completion did not wait
  on them. Evidence: deferrals list; HANDOFF "Next". Frequency: 2. Cost: carried risk.
- **F8 — Task 14 switch left persisted-on if a mid-test assertion throws.** The e2e enables
  and saves the server-match switch before the try/finally, so a failure before line 110
  skips the reset and leaves it on for the shared e2e user (contrary to design D6); green on a
  passing run, so the gate stayed green. Deferred, not fixed. Evidence: task 14 review v1
  finding (e2e/mcp-server-match.spec.ts:99); deferral d-6da4d629. Frequency: once. Cost: 1
  open deferral.
- **F9 — get_job failure line: no test for scored-job-without-matchedAt.** The server-match
  failure-line branch in getJob.ts has an untested path (scored job with no
  `matchData.matchedAt`); logged as an info gap and deferred. Evidence: deferral d-ae72e9d2;
  retro log 2026-11-02T03:17:49Z (task 6). Frequency: once. Cost: 1 open deferral.

## Repeat patterns

- **F1 ↔ mcp-write-tools F1.** e2e cannot run without a seeded admin on a throwaway instance;
  the config has no globalSetup / hardcodes the homelab. Both specs. References: F1 above;
  mcp-write-tools retrospective.md F1.
- **F3 ↔ mcp-write-tools F3.** rtk eslint wrapper reports a false failure on a clean pass.
  Both specs. References: F3 above; mcp-write-tools F3.
- **F4 ↔ mcp-write-tools F2/F10.** TDD red step is structurally impossible for these tasks
  (integration/e2e and flag-gated AC), leaving no red signal. Both specs. References: F4
  above; mcp-write-tools F2, F10.
- **F6 ↔ mcp-write-tools F15.** Completion gate closes without opening a new PR. Both specs.
  References: F6 above; mcp-write-tools F15.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v3, design v2, tasks v2 |
| Review rounds | requirements 3, design 2, tasks 3 |
| Fix rounds (impl) | 2 (task 2 import path; task 14 e2e admin seed) |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 2 (d-6da4d629, d-ae72e9d2; both open, both info-findings) |
| Spawns | 66 (implementation run; 67 spawn.start across the full run in the ledger) |
| PR | none (no remote) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  Eval case: <case id — what its grader checks | none — why>. Required when Target is
  harness skills or agents, or server code, docs or templates.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
