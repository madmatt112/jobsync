# Adversarial Review Memory — tasks

Last updated: 2026-11-01 (after v3 review / round 3)

## Cumulative Findings Summary

### Accepted
- none yet

### Partially Accepted
- none yet

### Rejected
- none yet

### Unresolved
- **R1-1 / R2-1 / R3-1 (MINOR, Recurring)** — Req 5.7 (provisional badge on `"partial"` completeness) is not listed in any task's `_Requirements` or the coverage scope note. Covered-by-invariant: task 9 sets `descriptionCompleteness` (Req 5.6) and `MatchDetails.tsx:42-50` renders the badge, so no code is missing. Raised in r1, r2 and r3; deliberately kept MINOR (not escalated) each time — escalating an invariant-covered traceability pointer with zero implementation would be padding. Optional traceability fix only.
- **R3-2 (MINOR, Novel)** — Intro dependency-order paragraph (line 5) says "Tasks 1-3 … stand alone," but task 2 imports `MATCH_PROVIDER_OPTIONS` from task 1 (2→1 is a hard edge). Ordering is still correct (1<2) and task 2's detail line + prompt state the dependency, so no implementation can go wrong. Intro-prose imprecision only. Optional reword.

## Patterns & Themes
- The tasks document is tightly grounded. Round 1 verified every cited range/path; round 2 re-verified all five lint-pass citation edits; round 3 independently re-grounded the load-bearing ones (getJob `include` + "visible score null", rate-limit `configuredMax` env-read-at-call, status.ts `saveJobMatchResult` inline update) — all accurate, no drift across three rounds.
- Dependency order is clean: no forward references; the two module cycles (queue↔run, offer↔matchDirective) are resolved by ordering and `import type`. Round 3's fresh lens (cross-task line-number drift) found none — each file is edited by a single task and every cross-task reference is by symbol name, not line.
- Success-clause coverage (retro P7) and the `Test:` line gate are clean across **all 14 tasks** (round 3 checked every task, not just the heavy ones).
- No Gate B (p-limit pre-exists and is already used) and no Gate C (no task exceeds the approved requirements).
- Atomicity is sound: tasks 9 and 12 are large but cohesive; splitting either would force a forward reference or a red intermediate.
- Coverage complete except the Req 5.7 invariant (traceability only).

## Guidance for Next Review
- The document has converged twice (r2 0/0/1, r3 0/0/2, both MINOR-only). Unless a reviser pass changes the document, further rounds should expect a clean/MINOR result — do not pad.
- If the reviser touches task 9 or the Scope notes, confirm R3-1 is threaded in or explicitly left as covered-by-invariant. Do not escalate R3-1 above MINOR without new evidence that real implementation is missing.
- If the reviser reworks the intro dependency paragraph, confirm R3-2's "stand alone" wording is corrected or consciously kept.
- Watch the design's closed reason set and the task-9 timeout string ("Timed out after N s.", N=timeoutMs/1000) stay in lockstep if either is edited.
- Well-covered, do not re-examine without new evidence: citation accuracy (verified three rounds), dependency order, cross-task line drift, enum-narrowing safety, task-2 getModel seam, success-clause coverage, Test-line gate, Gate B/C, decomposition scope.
- Rulings closed by Revision History (design R1-1..R1-3; requirements R1/R2 rounds; the lint-pass task-number→prose-gloss edits accepted r2) are not to be re-opened.
