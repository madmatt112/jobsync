# Adversarial Review Memory — design

Last updated: 2026-10-31 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Req 8.3 ("reply SHALL state skipped, whatever the setting") vs D13. On the non-create paths — duplicate-without-`upsert` (`addJob.ts:27-36`, returns before `resolveMatchReply`), unchanged-description, rate-limit-exceeded, and the `catch` error reply — a `skipMatch:true` add keeps the base reply and never states "skipped on request." D13 justifies this by "the requirements fix those replies at base," but only Req 4.8 (no-skip invariant) does so; Req 4.8 is silent on `skipMatch:true`, so 8.3 and 4.8 collide and the design picks 4.8 without recording the override. Testing Strategy omits duplicate+skip / error+skip, so it is neither covered nor caught. Fix: emit skipped text on those paths, OR explicitly scope 8.3 to offer-composing paths and add a duplicate+skip test.
- **R1-2 (MINOR)** — `matchData` carries an "Illustrative — verify against the test fake" hedge though Req 5.6 references it; all fields are enumerated and fit `JobMatchData` (`ai.schemas.ts:60-76`), so adequate, but commit the shape.
- **R1-3 (MINOR)** — server-match `ollamaGate` (`pLimit(1)`) does not coordinate with automation/in-app Ollama use; >1 Ollama generation can run process-wide across surfaces. Within Req 6.1's scope (server matches only) and pre-existing, so not a defect — wants a one-line scope note.

## Patterns & Themes
- The design is unusually well-probed: every delta citation, every library-capability claim (`@ai-sdk/deepseek` 2.0.4, `ai` 6.0.256, the `ai/test` mock harness), Data Models, and the security user-id flow were verified accurate against the installed tree. Round-1 pressure should concentrate on requirement-to-design *semantic* gaps, not citation accuracy.
- The one real soft spot is the skip-flag's interaction with the early-return reply paths — a place where an approved SHALL ("whatever the setting") meets a design decision that narrows it.

## Guidance for Next Review
- Re-probe R1-1's disposition first: did the reviser emit skipped text on the duplicate/unchanged/error paths, or scope Req 8.3 and add the duplicate+skip test? If scoped, confirm the scope note names Req 4.8 as the governing invariant and does not contradict Req 8.3's approved text — this is a requirements-deviation, so watch that the reviser does not quietly edit the closed requirements instead of the design.
- Do not re-litigate the verified-sound areas (C9 `matchedAt`, C8 budget/limiter, C1 library probes, security NFR, migration style, `updateUserSettings` callers) without new evidence.
- Fresh lenses still available for later rounds: restart/crash recovery wording vs NFR reliability; multi-user limiter fairness; test-double fidelity (`doGenerateCalls` assertions vs real provider option merge order).
