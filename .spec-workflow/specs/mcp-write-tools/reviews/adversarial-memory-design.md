# Adversarial Review Memory — design
Last updated: 2026-10-06 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (v1, SHOULD_FIX)** — e2e re-score could not emit the asserted directive.
  Fixed across v2/v3; v3 now pins both gates (see R2-1). Closed.
- **R1-2 (v1, MINOR)** — title-only note reworded for rescore. Closed.
- **R2-1 (v2, MUST_FIX, Recurring/Compounds R1-1)** — e2e returned a note not a
  directive on two legs. **Resolved in v3** (design line 169): ≥150-word `update_job`
  posting clears the 40-word title-only gate and is persisted
  (`updateJobFromNames.ts:161-163`); resume seeded with extra section content to
  clear `preprocessResume`'s 200-char floor (`createResumeForMatching` ≈130 chars).
  Re-verified. Closed.
- **R2-2 (v2, SHOULD_FIX)** — unguarded profile find-or-create race. **Resolved in
  v3**: C3 Ownership documents the tolerated race (Profile.userId not unique,
  pre-exists in createResume, letters visible via relation filter, no migration).
- **R2-3 (v2, MINOR)** — md.render inside the transaction. **Resolved in v3**: C3
  step 2 renders before any transaction.

### Partially Accepted
- (none)

### Rejected
- **R1-3 (v1, MINOR)** — read-only token handed an unfulfillable directive.
  Documented trade-off, writes nothing. Do not re-raise without new evidence.

### Unresolved
- **R3-1 (v3, SHOULD_FIX, Novel, carried)** — C6 both keeps and forbids "default
  resume". D6 chose an opening line with "else the default resume" (choice order),
  but C6 block 1's post-condition claim ("The text no longer says 'default resume'")
  and the `mcpMatchDirective.spec.ts` assertion ("no 'default resume' text",
  Testing Strategy line 166) ban the substring. The guarding test cannot pass against
  the specified directive. Fix: forbid the old "against the user's default resume"
  misdescription, not the bare substring — tighten claim + test, or drop the phrase
  from the choice order.
- **R3-2 (v3, MINOR, Novel)** — R1 AC6 (dismissed/discovery jobs updateable) holds
  (no status gate in `updateJobFromNames`) but is not traced in C1. Cosmetic.

## Patterns & Themes
- Citation fidelity remains perfect across v1/v2/v3 — every path, range, value and
  the markdown-it 14.3.0 capability check out. Defects are behavioral or internal
  contradictions, never codebase misstatements.
- The recurring e2e weak spot (R1-1 → R2-1) is now closed: both binding gates
  (≥40-word title-only classifier on the job, 200-char preprocess floor on BOTH job
  and resume) are pinned. Do not re-open unless a future delta touches the e2e bullet.
- New pattern for v3: the only live defect is a three-way internal contradiction
  (a decision, a component post-condition, and a unit-test assertion disagreeing),
  surfaced by the consistency/traceability lens — not a seam or a race.

## Guidance for Next Review
- Re-check only R3-1's next fix diff: does the revised C6 post-condition + the
  `mcpMatchDirective.spec.ts` assertion forbid only the old "against the user's
  default resume" misdescription (not the bare substring), consistent with D6's
  kept choice order? Scope to C6 block 1 and the test bullet; do not re-review.
- Well-covered, do NOT re-examine: citation accuracy (perfect three times);
  markdown-it 14.3.0 renderer settings (grounded); the e2e R8 AC4 gates (R2-1 closed);
  the profile race (R2-2 documented); the render relocation (R2-3); R4-1/R5-5 carried
  items and D6/D7 deferred items (resolved, modulo R3-1's wording); C6 lookups
  (`resolveJobForAgent`/`resolveResumeForAgent` grounded); buildMatchOffer gate order;
  the P2025 ownership rollback and JOB_NOT_FOUND_MESSAGE sharing; Data Models
  completeness and error-branch directives (satisfied — offer type enumerated, MCP
  results are text with no HTTP status to pin).
- If a future delta rewrites the C6 opening line or the directive tests, re-verify
  the no-forbidden-phrase / no-batch-prefix invariants (R9 AC5) still hold on the
  new text.
