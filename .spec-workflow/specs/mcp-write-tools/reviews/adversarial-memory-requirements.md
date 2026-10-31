# Adversarial Review Memory — requirements
Last updated: 2026-10-06 (after v5 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — save_cover_letter input wire contract. Fixed v2 (R4 AC9 + D10). Settled.
- **R1-2 (SHOULD_FIX, v1)** — transaction / orphan-Profile. Reliability NFR covers it. Settled.
- **R2-1 (MUST_FIX, v2)** — R5 AC3 false pagination. Fixed v3, superseded by R3-1 (fixed v4). Settled.
- **R2-2 (SHOULD_FIX, v2)** — R4 AC5 no-profile sequence. Fixed v3. Settled.
- **R2-3 (MINOR, v2)** — R4 AC4 min-length string pinned in design. Settled.
- **R3-1 (MUST_FIX, v3)** — R5 AC3 false reachability + R4 AC7 contradiction. Fixed v4, re-verified. Settled.
- **R3-2 (MINOR, v3)** — R5 AC2 double-spec. Fixed v4. Settled.
- **R3-3 (MINOR, v3)** — R6 AC3 ownership enumeration too narrow. Fixed v4 but spawned R4-1.

### Partially Accepted
- **R1-3 / R1-4 / R1-5 (MINOR, v1)** — all closed/settled by v4.

### Rejected
- L-1..L-35 (citation-identifier) — benign tool/model/analog tokens. Do not re-open.
- UTC-vs-local date skew for `added` — pre-existing, awareness-only.

### Unresolved (open for v6)
- **R5-1 (MUST_FIX, v5; Novel, fix-induced)** — R8 AC1 replaces the whole directive body
  (`matchDirective.ts:28-51`) with `JOB_MATCH_SYSTEM_PROMPT` + `buildJobMatchPrompt`, which
  carry neither the jobId, the resumeId, nor the "call `save_match_result`" instruction
  (`system.ts:6-55`, `user.ts:11-26`). The MCP round-trip never saves a match → breaks R2
  precondition. Ambiguous "four-section prompt" vs cited full range. Must keep jobId/resumeId/call-back.
- **R5-2 (SHOULD_FIX, v5; Novel, fix-induced)** — D11 "only the model different" + R8 user story
  "score the same way" are false: MCP uses default resume (`matchDirective.ts:74`), in-app uses
  job-linked resume (`matchJob.ts:57-60`). Align selection or correct the claim.
- **R5-3 (SHOULD_FIX, v5; Novel, fix-induced)** — R8 AC3(c) bakes the conditional, MCP-only
  partial-description warning (references `update_job`) into the static shared prompt the in-app
  single-shot surface runs (`matchJob.ts:90`). "both surfaces then use" false for (c).
- **R5-4 (SHOULD_FIX, v5; Novel, fix-induced)** — R9 AC5 "never contain … in any case" cannot
  hold: directive embeds unbounded resume (`matchDirective.ts:31`) + job text (`user.ts:19-23`);
  a posting line "[2/3] …" or token "job created" breaks jobscout batch segmentation (R9 AC6).
  Also AC5 gloss drops the brackets of real prefix `[i/n] ` (`addJobsBatch.ts:17`).
- **R5-5 (MINOR, v5; Novel, fix-induced)** — R8 AC3's eligibility + no-fab additions change the
  shipped in-app Match output; Introduction's "MCP adopts app prompt" framing omits this.
- **R4-1 (MINOR, v4→v5; Recurring, Compounds R3-3)** — R6 AC3 / Security NFR express
  create-ownership as a `where` invariant; the two `create` writes own via `data`. Precision only,
  untouched in v5. Does not keep the loop alive.

### Carried (raise only with new evidence)
- **R5 AC2 best-effort uniqueness (v1)** — no DB unique on `CoverLetter.title`. Unchanged.

## Patterns & Themes
- Fix-induced defects remain the signature hazard: every post-v1 defect sits in the text the
  previous delta wrote. v5 added R8/R9 wholesale and introduced four new defects (R5-1..R5-4),
  all in the new requirements. The pattern now extends from cover-letter text to the match-method
  unification.
- New v5 theme — the match directive is a **client contract**, not a prompt. R8 treats
  `JOB_MATCH_SYSTEM_PROMPT`/`buildJobMatchPrompt` as drop-in replacements but they omit the
  jobId/resumeId/save-call wiring (R5-1) and differ in resume source (R5-2); R9 asserts wire
  invariants the embedded free text can violate (R5-4). Citations are accurate; the gaps are
  semantic/omission.
- Cover-letter area (R3-1/R3-2/R3-3, scope gate, rate limit, escaping, no-profile sequence,
  wire contract R4 AC9/D10) is closed and correct. Not re-litigated.

## Guidance for Next Review
- Attack R8/R9 first. Confirm R5-1 fixed: directive must still carry jobId, resumeId and the
  `save_match_result` call-back. Confirm R5-2: resume-source parity decided or claim corrected.
  Confirm R5-3: (c) kept MCP-only. Confirm R5-4: embedded text flattened/scoped + bracket gloss.
- Do NOT re-litigate: all cover-letter findings; L-tokens; R9 AC1-AC4 wire pins (verified accurate
  against `mcp.schema.ts:177-213`, `jobQuery.ts:311-324`, `getJob.ts:74,78`, `updateJobFromNames.ts:230`).
- R4-1 is MINOR/precision; do not iterate on it alone.
- Carried, new evidence only: R5 AC2 best-effort uniqueness.
