# Retrospective proposals — mcp-write-tools

Drafted 2026-10-08 by the retro analyst from `retrospective.md`. One proposal per finding.

- **P1 (F1) — Make the e2e base URL configurable, keep :3737 off-limits.** `playwright.e2e-local.config.ts`
  already reads `E2E_PORT ?? "3838"`, added by PR #3; the gap is that `playwright.config.ts` still
  hardcodes `http://localhost:3737` (the real-data homelab) as the default any bare `playwright test`
  hits. Point the default config's `baseURL` and `webServer.url` at an env var (`E2E_PORT`/`E2E_BASE_URL`)
  with a non-3737 default, so no run can touch production by accident.
  Target: product code (project config).
  Effort: S. Risk: low: the local config already proves the pattern; only the default changes.
  Prerequisites: none.
  DECISION NEEDED: yes. Where does a seeded e2e instance come from for routine runs?
  - (a) **[recommended]** Standardise on the throwaway seeded :3838 instance the two green runs used;
    document a one-line start command and make it the config default.
  - (b) Add a `webServer` block that boots a seeded dev server per run (slower, fully self-contained).
  - (c) Leave e2e as operator-run only and never default to a live port.

- **P2 (F2) — Exempt integration/e2e tasks from the red-first TDD gate.** A spec that exercises a running
  server has no meaningful pre-implementation red state. Add a task-type marker (e.g. `kind: e2e`) that
  tells the TDD gate to skip the red-first step and rely instead on type-check + lint + the live run,
  which is what actually caught the 4 TS2345 errors here.
  Target: harness skills or agents (TDD gate).
  Effort: M. Risk: low: narrows the gate only for a declared task kind.
  Prerequisites: a task-kind field in the decomposition template.
  DECISION NEEDED: no.

- **P3 (F3) — Trust the direct eslint exit code over the rtk-wrapped hook.** The rtk eslint wrapper
  reported a phantom "1 error" while the binary exited 0. Add a one-line note to the rtk gotchas that
  eslint results must be confirmed with the direct binary, matching the existing `find`/`ls` carve-outs.
  Target: CLAUDE.md, memory or settings (RTK.md gotchas).
  Effort: S. Risk: low: documentation only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Write must-be-empty checks so success exits 0.** A grep that must print nothing exits 1 on
  no-match, which the gate reads as failure. Make the checks convention wrap such greps as
  `! grep -q <pattern> <file>` (or `grep -c ... ; test "$n" -eq 0`) so an empty result is exit 0.
  Target: harness skills or agents (checks-file convention).
  Effort: S. Risk: low: a documented idiom for check authors.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Exclude `.claude/` from vitest and eslint globs.** `vitest.config.ts` excludes only
  `["e2e/**", "**/node_modules/**"]` and `eslint.config.mjs` ignores only `.next/ coverage/ __mocks__/`,
  so every bare run globs the stale `.claude/worktrees/*` branch and runs its specs against main `src`
  via the `@` alias. Add `"**/.claude/**"` to the vitest `exclude` and `".claude/**"` to the eslint
  `ignores`. This is the smallest fix and closes open deferral d-0c0f40e9.
  Target: product code (project config).
  Effort: S. Risk: low: excludes a non-source directory only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Let subset gate checks inherit the config excludes.** Once P5 lands, `vitest run <files>`
  still re-globs worktree copies unless the gate's subset command also respects the config exclude. Have
  the gate build subset checks as `vitest run --exclude '**/.claude/**' <files>` (or resolve file paths
  so they cannot match worktree copies). P5 removes most of this; this closes the subset path.
  Target: harness skills or agents (subset gate check generation).
  Effort: S. Risk: low: adds an exclude already proven in P5.
  Prerequisites: P5.
  DECISION NEEDED: no.

- **P7 (F7) — Require a `result` key on every `phase.end` the orchestrator writes.** The impl
  orchestrator wrote `phase.end` with the note in the state slot and no `result`, so `harness phase-log`
  rejected the row and the supervisor patched it to `result=escalate`. Add `result` to the orchestrator's
  `phase.end` template/checklist and, ideally, a pre-write validation that fails loudly before the ledger
  rejects it.
  Target: harness skills or agents (impl orchestrator).
  Effort: S. Risk: low: enforces an already-required field.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Add a fix-induced-regression guard to the requirements reviser.** R5 AC3 broke under its own
  fixes three rounds running (cap, missing id, false reachability claim). Have the reviser re-run the
  prior round's failing assertion against each new revision before handing back, so a fix that re-breaks a
  settled AC is caught in-round rather than across three. This is the main driver of the 6-round cost.
  Target: harness skills or agents (reviser).
  Effort: M. Risk: medium: adds a re-check step that lengthens each round slightly but should cut total
  rounds.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Fix the e2e seed fixtures, not the sketch, when thresholds bite.** The design note-vs-directive
  defect recurred because a ~130-char seeded resume sat below the 200-char floor and the thin 40-word
  classifier gate could not emit a directive. Record seed-data thresholds (resume >=200 chars, etc.) in the
  project's test-data/design conventions so sketches and fixtures agree up front.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: documents existing thresholds.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — Name the expected coverage for RED-IMPOSSIBLE acceptance criteria.** Task 10's R8 AC4
  branches (flag-off no builder; flag-on + missing-job no builder) were covered only by byte-identical
  regression assertions, and the verifier later demanded an explicit missing-job test. When an AC is
  RED-IMPOSSIBLE, require the task to state which existing assertion covers each branch and add a fresh
  negative test for any branch not yet asserted.
  Target: harness skills or agents (TDD guidance / verifier).
  Effort: S. Risk: low: adds a coverage declaration step.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — Honour the user's "NO Claude attribution" rule in worker commits.** Commit bd534d8 carried
  the `Co-Authored-By: Claude` trailer while siblings did not; the user's global CLAUDE.md forbids
  attribution trailers. The attribution system-reminder itself defers to the user's own rule, so workers
  should suppress the trailer consistently. Make the commit step read CLAUDE.md attribution rules and omit
  the trailer when the user forbids it.
  Target: harness skills or agents (commit step).
  Effort: S. Risk: low: aligns behaviour with an explicit user rule.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — Grant the PR token `pull-requests:write` or route PR creation to the operator.** `gh pr
  create` failed because the fine-grained PAT lacked `pull-requests:write`; the branch pushed and the phase
  escalated. Fix the token scope so the closeout can open PRs itself.
  Target: CLAUDE.md, memory or settings (token/settings).
  Effort: S. Risk: low: scope widening on a PAT the operator controls.
  Prerequisites: operator access to the PAT.
  DECISION NEEDED: yes. How should PR creation be authorised?
  - (a) **[recommended]** Add `pull-requests:write` to the existing GH_TOKEN PAT.
  - (b) Keep the narrow token and make operator PR creation the documented norm (no escalation surprise).

- **P13 (F13) — Gate scope changes after gate-A approval.** A v5 revision added R8/R9 after v4 was gate-A
  approved, raising MUST_FIX 0->1 and forcing adjudication past the round cap. Add a rule that new scope
  after gate-A approval opens a fresh scoped round (or a new spec) rather than reopening the approved
  requirement in place, so the round cap is not blown by late additions.
  Target: harness skills or agents (requirements phase / gate policy).
  Effort: M. Risk: medium: needs a clear trigger for "new scope" vs ordinary fix.
  Prerequisites: none.
  DECISION NEEDED: yes. What happens when new scope lands after gate-A?
  - (a) **[recommended]** Reset the round counter for the added requirements only; keep approved ones frozen.
  - (b) Require a new spec for post-approval scope; reject in-place additions.
  - (c) Allow the addition but auto-raise the round cap by the number of new requirements.

- **P14 (F14) — Keep e2e deferral allowed, but tie it to the P1 instance.** Deferring the live e2e run on
  lint+unit green was reasonable given no seeded instance, and PR #3 later cleared it. Once P1 gives a
  standing seeded instance, change the default so the e2e task runs rather than defers; keep deferral as
  the fallback when no instance is reachable. No change needed beyond P1.
  Target: harness skills or agents (completion policy).
  Effort: S. Risk: low: tightens only once an instance exists.
  Prerequisites: P1.
  DECISION NEEDED: no.

- **P15 (F15) — No change: closeout against merged PRs was correct.** The closeout closed the completion
  gate against already-merged PR #2 and #3, opened nothing and merged nothing; cost was none. This is the
  right idempotent behaviour when the work already shipped. Leave as is.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

This is the first spec with a `retrospective.md` (mcp-read-tools has none), so no pattern yet recurs
across two or more specs' findings. Nothing meets the two-spec bar for promotion.

One within-spec pattern is strong enough to pre-stage and promote the moment a second spec repeats it:

- **Candidate (F5/F6) — Exclude nested `.claude/` worktrees from all test and lint globs.** Recurred 5+
  times across tasks 1, 2, 5, 8, 9 and burned a fix round; tracked as open deferral d-0c0f40e9. Proposed
  rule text, for project steering (test/lint conventions):
  > "Every test and lint config MUST exclude `.claude/` (e.g. vitest `exclude: ['**/.claude/**']`, eslint
  > `ignores: ['.claude/**']`). Nested worktrees under `.claude/` resolve the `@` alias to main `src` and
  > go red falsely. Subset gate checks MUST carry the same exclude."
