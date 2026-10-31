# Retrospective — mcp-write-tools

Compiled 2026-10-08 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Playwright config hardcodes :3737, the real-data homelab.** The only dev server
  is the production homelab on :3737, which rejects seeded admin login and holds real
  data, so the task-12 e2e spec could not run in-environment. The run was deferred and
  later verified green twice on a throwaway seeded instance on :3838. Evidence: retro log
  2026-10-07T07:32:54Z; task 12 review v1; deferral d-be11e67a; PR #3 a5c5462.
  Frequency: once (blocked the one e2e task). Cost: 1 deferral plus a follow-up PR.
- **F2 — An integration/e2e task cannot fail red-first.** Task 12 writes an e2e spec that
  has no pre-implementation red state; the TDD red step is structurally impossible, and
  the only defence was the gate, which caught 4 TS2345 type errors in the new spec.
  Evidence: retro log 2026-10-07T07:49:23Z. Frequency: once. Cost: 1 gate-fix round.

## Product bugs found

None found. Every defect surfaced in review was a spec/document or test issue, not a
latent product bug; the merged code was green at both PR merges.

## Tool and MCP errors or deficiencies

- **F3 — rtk eslint hook reports a false error.** The rtk-wrapped eslint hook reported
  "1 error in index.js" on task 6 while the eslint binary run directly exited 0 clean.
  The worker had to learn to trust the direct binary over the rtk output. Evidence: retro
  log 2026-10-07T05:36:15Z (task 6). Frequency: once this spec; a standing rtk-wrapper
  risk. Cost: minor investigation, no fix round.
- **F4 — A must-be-empty grep exits 1 and the gate scores it as failed.** A checks-file
  grep that must print nothing exits 1 when there is no match (success), and the gate read
  exit 1 as check-failed, producing one spurious gate fail before a re-run with the grep
  inverted. Evidence: retro log 2026-10-07T05:06:56Z (task 4, commit d2b015d).
  Frequency: once. Cost: 1 spurious gate fail, no fix round.

## Harness defects

- **F5 — Test/lint config does not exclude .claude/ nested worktrees.** vitest.config.ts
  and eslint.config.mjs exclude only e2e and node_modules, so every bare `npm test` /
  `npm run lint` globs the stale `.claude/worktrees/default-filter-expired` branch and
  runs its specs against main src via the `@->./src` alias, going red falsely. Each task
  had to add `--exclude '**/.claude/**'` / `--ignore-pattern '.claude/**'` by hand.
  Evidence: retro log 2026-10-07T02:43:30Z, 05:16:48Z, 06:08:28Z, 06:29:04Z (tasks 1, 2,
  5, 8, 9); deferral d-0c0f40e9 (open). Frequency: 5+ times in this spec. Cost: a manual
  exclude on every task's checks.
- **F6 — A subset gate check lacked the .claude exclude and burned a fix round.** The
  task-5 subset gate check `vitest run <files>` had no `--exclude '**/.claude/**'`, ran
  stale worktree copies and went red on pre-task-5 assertions; one fix round was spent
  correcting the check command with no code change needed. Evidence: retro log
  2026-10-07T05:21:52Z, 05:24:59Z (task 5, implementer bd534d8). Frequency: once.
  Cost: 1 wasted fix round / spawn.
- **F7 — phase.end written without a result key rejected the ledger.** The implementation
  orchestrator wrote its final `phase.end` with the note text in the state slot and no
  `result` key, so `harness phase-log` rejected the row; the supervisor had to patch it to
  `result=escalate`. Evidence: retro log 2026-10-07T07:58:37Z; harness-events.jsonl line
  405; error "phase.end event is missing its required result key". Frequency: once.
  Cost: 1 supervisor step.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F8 — Requirements took 6 rounds with a three-round fix-induced chain on R5 AC3.** The
  R5 AC3 cover-letter paging/versioning claim was broken by its own fixes three rounds
  running (R1-3 hardcoded getCoverLetterList(1,100) cap, R2-1 missing new-letter id,
  R3-1 false "superseded versions reachable" claim), and the cap was then hit when a v5
  revision added R8/R9 and raised MUST_FIX 0->1, forcing adjudication. Evidence: retro log
  requirements rounds 1-4 (2026-10-06T18:54–19:31Z), post-cap 20:03:11Z. Frequency: 3
  fix-induced defects on one AC. Cost: 5 reviewer + 4 reviser spawns, 1 adjudicator, 1
  checker over 6 rounds.
- **F9 — Design e2e sketch forced a "note not directive" across two rounds.** The design's
  e2e sketch expected get_job to carry a save_match_result directive, but the thin UI job
  (40-word classifier gate) and a ~130-char seeded resume (below the 200-char floor)
  forced a note instead; the defect recurred R1-1 -> R2-1 before v3 fixed the gates.
  Evidence: retro log design rounds 1-3 (2026-10-06T20:38–21:10Z). Frequency: 2 rounds.
  Cost: reviewer + reviser spawns across the recurrence.

## Documentation gaps

- **F10 — RED-IMPOSSIBLE acceptance criteria had no fresh red tests.** Task 10's R8 AC4
  sub-criteria (flag-off never calls the builder; flag-on + missing-job no builder call)
  are RED-IMPOSSIBLE pre-implementation and were covered only by existing byte-identical
  regression assertions, not fresh red tests; the verifier later wanted explicit coverage
  of the missing-job branch, costing a test-only fix round. Evidence: retro log
  2026-10-07T06:37:48Z, 06:59:39Z; task 10 review v2. Frequency: once. Cost: 1 test-only
  fix round, 2 verifier spawns.

## Model behaviour

- **F11 — Worker commits carried the Claude attribution trailer inconsistently and
  against the user rule.** Implementer commit bd534d8 ends with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` while sibling commits 878b995
  and d2b015d carry no trailer; the user's global CLAUDE.md states "NO Claude attribution"
  for commit messages, so the trailer should not appear at all. Harmless at the surface
  because the squash merge (ef8b38a) dropped per-commit trailers. Evidence: commit bd534d8
  vs 878b995, d2b015d. Frequency: 1 of 3 sampled branch commits. Cost: cosmetic.

## Process deviations and rulings

- **F12 — PR creation blocked by a token missing pull-requests:write.** `gh pr create`
  failed with "Resource not accessible by personal access token (createPullRequest)"
  because the GH_TOKEN fine-grained PAT lacked pull-requests:write; the branch pushed but
  the phase had to escalate and the operator opened the PR. Evidence: retro log
  2026-10-07T07:57:24Z. Frequency: once. Cost: 1 escalation, operator step.
- **F13 — Requirements reopened with new scope after gate-A approval.** A v5 revision after
  v4 had already been gate-A approved added R8 (one match method) and R9 (jobscout
  contract), raising MUST_FIX 0->1 and driving the phase past the round cap into
  adjudication. Evidence: retro log 2026-10-06T19:55:14Z, 20:03:11Z. Frequency: once.
  Cost: 1 extra reviewer + reviser + adjudicator + checker cycle.

## Decisions the harness made for the human

- **F14 — e2e verification deferred rather than blocking completion.** With no seeded test
  instance available, the harness accepted a static review of the e2e spec and deferred the
  real run (d-be11e67a), letting the spec complete on lint+unit green. Evidence: task 12
  review v1; retro log 2026-10-07T07:32:54Z. Frequency: once. Cost: deferred risk, later
  cleared by PR #3.
- **F15 — Completion gate closed against already-merged PRs.** The closeout run closed the
  completion gate against PR #2 (ef8b38a) and PR #3 (a5c5462), already merged, opening no
  new PR and merging nothing. Evidence: retro log 2026-10-08T21:13:29Z. Frequency: once.
  Cost: none.

## Repeat patterns

No earlier `retrospective.md` exists (the only other spec, mcp-read-tools, has none), so
there is no cross-spec comparison. The one strong within-spec repeat is **F5**: the
.claude nested-worktree test/lint pollution recurred across tasks 1, 2, 5, 8 and 9 and is
tracked as open deferral d-0c0f40e9.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v6, design v4, tasks v3 |
| Review rounds | requirements 6, design 4, tasks 3 |
| Fix rounds (impl) | 3 (task 5 non-code, task 10 test-only, task 12 type-only) |
| Adjudications | 1 (requirements post-cap) |
| Escalations | 1 (PR creation, token) |
| Rulings | 0 |
| Deferrals added | 2 (d-be11e67a resolved, d-0c0f40e9 open) |
| Orchestrator spawns | ~14 impl workers final run + doc-phase reviewer/reviser/checker cycles |
| PR | #2 ef8b38a (merged), #3 a5c5462 (e2e fix, merged) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
