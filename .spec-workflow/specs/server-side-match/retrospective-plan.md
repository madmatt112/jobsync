# Retrospective plan — server-side-match

Status: APPROVED
Date: 2026-11-02

## Approved proposals

- **P1 (F1) — Seed the admin user in e2e globalSetup, not per-spec.** `playwright.config.ts`
  already defaults `baseURL` to a throwaway :3838 instance (mcp-write-tools P1 landed that),
  but it has no `globalSetup`, so a fresh db has no `admin@example.com` and no suite can log
  in until a signup runs. Add an idempotent `globalSetup` that ensures the admin user exists
  (upsert, no-op if present), so suites stop hand-rolling signup (`e2e-local.setup.ts`) or
  seeding admin in-spec (commit a553b75).
  Target: product code (project config).
  Effort: S. Risk: low: the setup is idempotent and only runs for `test:e2e`.
  Prerequisites: a seed path reachable from Node (the in-spec seed proves one exists).
  Eval case: e2e-fresh-db-login — grader starts a throwaway db, runs any suite, asserts login
  succeeds with no manual signup step.
  DECISION NEEDED: no.

- **P2 (F2) — Import a new shared const directly from its module, never via a barrel.** Task 2
  first added a `MATCH_PROVIDER_OPTIONS` re-export to `src/lib/ai/index.ts` (outside its file
  list); the fix reverted to a direct import from `@/lib/ai/matchProviderOptions`, matching
  matchJob.ts. Have decomposition name the exact import path for any shared const a task
  introduces, and tell the implementer to match the sibling import style rather than add a
  barrel re-export outside the task's file list.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: codifies an existing convention the fix round restored.
  Prerequisites: none.
  Eval case: none — convention/guidance, no code surface to grade.
  DECISION NEEDED: no.

- **P3 (F3) — No change: the rtk eslint gotcha is already documented.** The phantom "JSON parse
  failed" on a clean pass is the documented RTK.md gotcha ("confirm eslint results with the
  direct binary"), which mcp-write-tools P3 landed; the worker followed it both times with no
  fix round. The note already does its job.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Mark RED-IMPOSSIBLE tasks so the red step is not demanded.** Every task's success
  criteria were RED-IMPOSSIBLE (integration/e2e and flag-gated AC), all 13 tdd bases came back
  inconclusive, and tasks 4 and 14 filed author reports and were routed implementer-only. This
  is the mcp-write-tools P2/P10 pattern recurring. Adopt a task-kind marker that exempts such
  tasks from the red-first gate and, when an AC is RED-IMPOSSIBLE, require the task to name the
  assertion that covers each branch (see P5). No new mechanism beyond mcp-write-tools P2/P10.
  Target: harness skills or agents (TDD gate / decomposition).
  Effort: M. Risk: low: narrows the gate only for a declared kind.
  Prerequisites: a task-kind field in the decomposition template (mcp-write-tools P2).
  Eval case: tdd-red-impossible-skip — grader checks a kind-marked task skips red-first and
  still runs type-check + lint + live run.
  DECISION NEEDED: no.

- **P5 (F5) — Require a reader before a writer task's flag guard counts.** Task 4 wrote
  `serverSideMatch` with no reader in its seam, so its acceptance passed vacuously at base and
  the implementer added an unnamed regression guard. When a task writes a flag or setting,
  decomposition should either pair it with the reader task or require a test that reads the
  written value back, so the guard asserts behaviour, not shape. Closely related to P4's
  "name the covering assertion".
  Target: harness skills or agents (decomposition / verifier).
  Effort: S. Risk: low: adds a coverage declaration for writer tasks.
  Prerequisites: none.
  Eval case: writer-task-needs-reader — grader flags a task whose AC writes a flag no
  assertion reads.
  DECISION NEEDED: no.

- **P6 (F6) — No change: closing on local green with no remote was correct.** This repo is a
  hard fork with no remote, so there was nothing to push or open a PR against; the gate
  accepting 14/14 logged and reviewed tasks is the right behaviour. Same ruling as
  mcp-write-tools P15.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — No change: info-level findings may be deferred to complete.** Both deferred
  findings (F8, F9) are harness-owned info gaps, not latent defects, so not blocking completion
  on them was correct. They stay open and should be worked in the normal deferral loop (where
  P8 and P9 dispose of them), not treated as a completion-gate defect.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Reset the server-match switch in a finally, not before the try.** The e2e enables
  and saves the switch before the try/finally (e2e/mcp-server-match.spec.ts:99), so an
  assertion that throws before line 110 skips the reset and leaves it on for the shared e2e
  user, contrary to design D6. Move the enable inside the try, or register the reset in
  `finally` (or `afterEach`) so it always runs. Closes deferral d-6da4d629.
  Target: product code (e2e test).
  Effort: S. Risk: low: tightens teardown; no behaviour change on a passing run.
  Prerequisites: none.
  Eval case: none — test-robustness fix; verified by the suite still passing green.
  DECISION NEEDED: no.

- **P9 (F9) — Add a test for the scored-job-without-matchedAt failure line.** The server-match
  failure-line branch in getJob.ts (scored job with no `matchData.matchedAt`) is untested.
  Add one unit test exercising that branch. Closes deferral d-ae72e9d2.
  Target: product code (test).
  Effort: S. Risk: low: pure test addition.
  Prerequisites: none.
  Eval case: getjob-missing-matchedat — grader asserts a test covers the scored-no-matchedAt
  branch of getJob.ts.
  DECISION NEEDED: no.

## Decisions

None.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P3: skipped — no change chosen
- P6: skipped — no change chosen
- P7: skipped — no change chosen
- P2: skipped — no change needed; already committed in 17c7013 — .spec-workflow/steering/shared-const-imports.md fully matches the item (decomposition names exact module path, adds to file list, forbids barrel; implementation imports directly, matches matchJob.ts, forbids barrel re-export)
- P4: to-do (human) — Targets harness TDD-gate/decomposition skill plus eval harness/evals/tdd-red-impossible-skip/; neither is under jobsync/.spec-workflow (no agent-rules.md, no harness tree). Needs another repo/file.
- P5: to-do (human) — Targets harness decomposition/verifier skill plus eval harness/evals/writer-task-needs-reader/; not reachable under jobsync/.spec-workflow.
- P1: to-do (human) — Branch predates the server-side-match feature; no Node-reachable admin seed path here, premise (in-spec/signup seed it would replace) and the required harness/evals/ dir match main's state not this branch. Forcing it would be a wrong build.
- P8: to-do (human) — e2e/mcp-server-match.spec.ts does not exist on this branch (branch cut from pre-feature main e2ac014; file only exists on main).
- P9: to-do (human) — getJob.ts on this branch has no serverMatchFailedAt failure-line branch (server-side-match feature absent; present only on main).
