# Adversarial Review Memory — requirements

Last updated: 2026-10-30 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- none yet (first round).

### Partially Accepted
- none.

### Rejected
- none this round. (v1 lint-pass rejections L-1..L-13 are recorded in the
  document Revision History and are closed; do not re-open.)

### Unresolved (raised this round)
- **R1-1 (SHOULD_FIX, Novel)** — Req 2 constrains only the default and the
  fallback model list; the live DeepSeek `/models` dropdown
  (`provider-registry.ts:70-71`, `parseModelsResponse`) is the normal path and
  is unaddressed. Assumes without stating that the live list returns
  `deepseek-flash`. If it returns the retired aliases (per D9), the dropdown
  keeps offering them and the new default renders blank/unsaveable
  (`AiSettings.tsx:141-145,204-207`).
- **R1-2 (SHOULD_FIX, Novel)** — Req 4 AC6 (offer-is-a-note) and AC7 (no model
  configured) overlap with no stated precedence; the queued-vs-note reply for a
  no-model + title-only/unreadable add is ambiguous. D5 lists both checks but
  does not order them.
- **R1-3 (MINOR, Novel)** — telemetry `jobsync.surface` for the server-side
  match is unspecified against the closed six-value `SURFACES` set
  (`telemetry/genai.ts:7-14`).
- **R1-4 (MINOR, Novel)** — AC6.1 "across the process … as
  `getAutomationMatchLimit` does" conflates a per-call `pLimit` with the required
  process-wide limiter.
- **R1-5 (MINOR, Novel)** — Req 7 AC4 "failed after its last saved match" reads
  oddly for a never-scored job; AC7.3/7.5 set/clear semantics cover it in
  practice.

## Patterns & Themes
- The weak spots cluster at the boundary between a persisted/constrained value
  and the *live* surface that actually drives behaviour: fallback list vs live
  dropdown (R1-1); matchData.surface vs telemetry surface (R1-3); per-call vs
  process-wide limiter (R1-4). The acceptance criteria tend to pin the static
  artifact and leave the dynamic/wire surface implicit.
- Note-branch precedence (R1-2) is an unspecified interaction between two
  independently-stated criteria — a recurring risk wherever "IF X … THEN note"
  criteria can co-fire.
- Code citations are accurate throughout; the probe for the DeepSeek SDK is
  correct. No MUST_FIX on the artifact-accuracy axis.

## Guidance for Next Review
- If a reviser addresses R1-1, verify the fix scopes the live `/models` path
  (not just the fallback), or scope-excludes the dropdown explicitly. Re-check
  `AiSettings.tsx` client-state behaviour for the blank-selector failure.
- If R1-2 is addressed, confirm the precedence is stated in AC4.6/4.7 or D5 and
  that both orderings are not left open.
- Next fresh lens (if requirements iterate again): data lifecycle / failure
  record storage (Req 7 + D3) — where the failure reason/time lives on the Job
  row without polluting matchData, and how AC7.5 clears it.
- Do not re-raise the lint-pass rulings (node_modules paths, nested-generation
  label citations, MCP wire-name-as-prose) — closed in Revision History.
