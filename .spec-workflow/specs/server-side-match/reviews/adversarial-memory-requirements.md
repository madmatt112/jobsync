# Adversarial Review Memory — requirements
Last updated: 2026-10-30 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-2 (v1)** — Req 4 AC6/AC7 precedence: scoped AC7 to a would-be directive and
  ordered the two pre-queue checks in D5 (offer first). Verified in v2: clean.
- **R1-4 (v1)** — AC6.1 reworded to one process-wide limiter, keeping
  `getAutomationMatchLimit` only for the Ollama=1/else-constant rule. Verified.
- **R1-5 (v1)** — Req 7 AC4 reworded to "no successful match saved since,
  whether or not the job was ever scored." Verified.

### Partially Accepted
- **R1-1 (v1)** — Req 2 vs live `/models` dropdown: reviser scope-excluded the
  dropdown (mirrors DeepSeek's catalogue, not spec-controlled). The round-1
  blank-selector consequence of the new `deepseek-flash` default is now an
  accepted settings-UX limitation. CLOSED by ruling — do not re-open without new
  evidence (Recurring).
- **R1-3 (v1)** — telemetry `jobsync.surface`: added to the deferred-to-design
  list (reuse `job.match` or add one; SURFACES closed at six). Bounded defer.

### Rejected
- v1/v2 lint-pass rejections L-1..L-13 (node_modules paths outside code root;
  nested-generation shared-path label citations; MCP wire-name-as-prose). CLOSED
  in Revision History; do not re-open.

### Unresolved (raised this round, v2)
- **R2-1 (SHOULD_FIX, Novel, carried)** — concurrency during a *running* match is
  unspecified. AC4.10 dedups only "queued and has not started"; Req 7 AC6 drops
  only a job deleted "before its queued match runs." A requeue during an in-flight
  match (M1 old text, M2 new text) can finish out of order and let M1 overwrite
  M2's fresh score via AC5.5, defeating AC5.2's read-at-runtime purpose. A
  mid-run deletion also contradicts AC7.1 ("job SHALL stay saved") and AC7.3
  (record on a now-deleted row). Needs a write-ordering/supersession rule and a
  mid-run-delete outcome.
- **R2-2 (MINOR, Novel)** — `skipMatch` registered only on `add_job` and
  `add_jobs_batch` (AC8.1); `update_job` cannot skip a description-update match.
  Likely intended; wants one line of rationale or the flag added.

## Patterns & Themes
- v1 weak spots clustered at persisted-value-vs-live-surface seams; v2 resolved
  or scope-excluded all of them cleanly.
- New v2 theme (data lifecycle): the spec specifies concurrency only up to the
  moment a match *starts* (AC4.10, Req 7 AC6) and goes silent on the in-flight
  window, where AC5.2's freshness intent, AC5.5's write, and AC7.1/7.3's
  failure-record all collide. This is the lens the v1 memory flagged for next
  round, now confirmed as a live gap.
- Code citations remain accurate throughout both versions; no MUST_FIX on the
  artifact axis in either round.

## Guidance for Next Review
- If R2-1 is addressed, verify the fix states the stored-score outcome (not just
  the read): either a per-job in-flight-or-queued dedup guard, or a last-queued-
  wins write rule, plus a mid-run-deletion outcome that is consistent with
  AC7.1/AC7.3. Check it does not reintroduce double-queueing (AC4.10).
- If R2-2 is addressed, confirm either a decision record explaining the add-only
  skip, or `skipMatch` added to `update_job` with matching reply semantics.
- Well-covered, do not re-examine: Req 2 default/fallback vs live dropdown
  (R1-1, scope-excluded); AC6/AC7 precedence (R1-2); limiter wording (R1-4);
  telemetry surface (R1-3, deferred); queue/budget arithmetic (sound, round 1);
  matchData.surface vs "mcp"/"chat" (coherent, round 1); the DeepSeek SDK probe
  and all node_modules/@ai-sdk citations.
- Do not re-raise the lint-pass rulings.
