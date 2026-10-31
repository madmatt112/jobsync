# Adversarial Review Memory — design

Last updated: 2026-10-31 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-2 (MINOR, v1)** — matchData "Illustrative" hedge. Accepted: dropped in v2, shape committed. Verified complete in round 2 (`parseJobMatch` returns exactly `{matchScore,recommendation}`; all fields fit `JobMatchData`).
- **R1-3 (MINOR, v1)** — Cross-surface Ollama concurrency note. Accepted: one-line scope note added to C8 step 2 in v2. Correct.

### Partially Accepted
- **R1-1 (SHOULD_FIX, v1)** — Req 8.3 ("state skipped, whatever the setting") vs the early-return paths. Partially accepted in v2: reviser scoped Req 8.3 to the offer paths in D13, named Req 4.8 as governing the early returns, added the C5 "`skipMatch` does not alter them — D13" note, and added a duplicate-without-upsert+skip integration case. This is the exact option round 1 offered as acceptable. **Closed** — recorded in v2 Revision History; do not re-open.

### Rejected
- (none)

### Unresolved
- (none)

## Patterns & Themes
- The design is unusually well-probed; two rounds have found one real SHOULD_FIX (R1-1) and three MINORs, all now dispositioned. Round-2 pressure on citations, Data Models, library probes, security, budget/limiter and failure-line all confirmed sound again.
- R1-1's resolution is a design-level scoping of an approved requirement's literal text. It is defensible only because round 1 explicitly offered scoping as acceptable. Had it not, this would be a design-vs-requirement seam worth a MUST_FIX. Note for any future requirements-doc review: Req 8.3 still reads "whatever the setting" unconditionally while the design narrows it — a latent artifact-consistency wrinkle, but closed by ruling for the design.
- New verification this round: `resolveJobForAgent` uses `findFirst` with no `select`, so all Job scalars (`resumeId`, `descriptionCompleteness`) are available to C6 — the codebase-context's "title/company/location" names only the includes.

## Guidance for Next Review
- If a round 3 happens, the only live residue is R2-1 (MINOR): unchanged-description+skip and error-path+skip are untested alongside the duplicate+skip case. Nice-to-have, not loop-keeping.
- Do NOT re-open R1-1 scoping — closed by ruling. Do not re-litigate the verified-sound areas: matchData shape/parse output, `resolveJobForAgent` fields, C8 budget/limiter, FIFO multi-user fairness (requirement-mandated), restart wording, C1 library probes, security user-id flow, C9 `matchedAt` supersession.
- Remaining unused lenses are largely exhausted; a clean round is the expected result unless a later delta introduces a claim error.
