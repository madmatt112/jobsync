# Adversarial Review Memory — tasks

Last updated: 2026-10-06 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1→v2).** Task 1 reframes the stale duplicate-upsert test
  (`mcpAddJob.spec.ts:256-274`) to assert the upsert patches an owned job; scope note routes R1 AC2
  as inherited through `addJob.ts:57-78`. Verified sound in v2.
- **R1-2 (SHOULD_FIX, v1→v2).** Task 4's grep drops "returned by add_job"; all four live forbidden-
  phrase matches sit in lines task 4 edits. Verified sound in v2.
- **R1-3 (MINOR, v1→v2).** Scope note routes R1 AC6 (discovery-status) as verified by the
  id/userId-only `where`. Verified sound in v2.

### Partially Accepted
- (none)

### Rejected
- **R1-4 (MINOR, v1).** New tool's scope/validation branches proven only end-to-end (no route-level
  unit suite exists; D6). Rejected as awareness-only; do not re-raise without new evidence.

### Unresolved
- **R2-1 (SHOULD_FIX, Novel) — Task 9.** The rebuilt `buildMatchOffer` loads the job via
  `resolveJobForAgent` before the resume step. Task 9's exact-value enumeration (tasks.md line 97)
  covers only the first `describe` of `mcpAddJob.spec.ts`; the upsert happy-path test at `:196-222`
  (reaches `buildMatchOffer` via the unchanged `:69-74` "update" caller, `descriptionChanged:true`)
  asserts "save_match_result" at `:220` but has only `mockUsableResume()` (resume side) — so
  `resolveJobForAgent` returns `no_job`, the reply becomes the "couldn't be loaded" note, and `:220`
  goes red, breaking task 9's own "full suite pass" gate. design.md:160 shares the omission. Fix:
  anchor `:196-222` + a shared job-lookup mock in the upsert `describe`.

## Patterns & Themes
- "Every test that reaches the changed code path must be re-mocked" — R1-1 (gate flip at `:256`) and
  R2-1 (builder rebuild at `:196`) are the same family: a task enumerates first-block test changes
  precisely but misses a test in a *second* describe block that also hits the modified path.
- Drafter's source citations remain accurate across v1 and v2; no MUST_FIX in two rounds. The risk
  is in the test-change enumeration completeness, not in code claims.
- Short-circuit awareness: `upsertExisting` returns early when `descriptionChanged` is false, which
  is why task 1's reframe (descriptionChanged:false) is robust but the `:196` test
  (descriptionChanged:true) is not — check the `descriptionChanged` branch when reasoning about
  which add-path tests reach `buildMatchOffer`.
- Cross-artifact drift: design.md Testing Strategy (`:160`, `:264/:273`) lags the accepted R1-1
  tasks fix; design is not under review here but the stale line could mislead an implementer.

## Guidance for Next Review
- Re-check R2-1 scoped to task 9's fix diff only: did it add `:196-222` to the anchors and a
  job-side mock (`resolveJobForAgent`→ok, `preprocessJob`→success) to the upsert `describe`'s setup?
  Do not re-review the whole task.
- Well-covered, do not re-examine: R1-1/R1-2/R1-3 fixes (verified sound); source citations for
  addJob, matchDirective, jobLookup, resumeLookup, matchJob, getJob:45-46/78, jobQuery row logic,
  toolDescriptions/mcp.schema forbidden-phrase grep, mcpBatch (fully mocked), mcpUpdateJob (partial
  mock), mcpReviewResume (getDefaultResumeForUser kept). Requirement↔task coverage and
  success-clause coverage both verified complete.
- Closed by ruling / do not re-open: R1-4 (no route-level unit suite); UTC-vs-local date skew
  (awareness-only); read-only token receiving the re-score directive (design R1-3).
- If task 9's anchors are fixed, next round is likely clean — look only at the R2-1 fix diff and any
  new delta; otherwise expect convergence.
