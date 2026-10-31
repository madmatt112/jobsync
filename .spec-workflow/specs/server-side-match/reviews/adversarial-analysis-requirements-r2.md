# Adversarial Analysis — server-side-match/requirements (v2, round 2)

Attack surface: completeness, ambiguity, scope. Fresh lens for this round: none
(prompt). No v1 checkpoint commit exists, so the deltas are read from the v2
Revision History (R1-1..R1-5 plus the lint pass).

## Deltas attacked first (all verified against code — clean)

Every v2 change was re-checked against the artifact it cites. All hold:

- **R1-1 scope note (line 165).** Binds Req 2 to the default + fallback list and
  scope-excludes the live dropdown. Citations verified: live endpoint
  `provider-registry.ts:70-71` (`modelsEndpoint: "deepseek/models"`,
  `parseModelsResponse`), fallback-only-on-fail/empty `AiSettings.tsx:124-156`
  (`if (!response.ok)` → fallback; `models.length > 0 ? models : fallback`; catch
  → fallback). Accurate. The round-1 blank-selector consequence is now an
  accepted limitation (partial accept); closed by ruling, not re-opened.
- **R1-2 AC4.7 + D5 ordering (lines 66, 147).** `buildMatchOffer`
  (`matchDirective.ts:65-141`) computes the offer — title-only, no_job,
  no_resume, jobPre fail, resumePre fail, else directive — and never reads the AI
  model, so "offer first, then the no-model check only for a would-be directive"
  is implementable with no overlap between AC6 and AC7. Clean.
- **R1-3 telemetry deferral (line 164).** `SURFACES` is exactly six values
  (`genai.ts:7-14`), comment warns a seventh "silently splits a comparison."
  Deferring "reuse `job.match` or add one" to design is a bounded, honest defer.
- **R1-4 AC6.1 reword (line 94).** `getAutomationMatchLimit` returns
  `pLimit(concurrency)` with Ollama=1 / else `AUTOMATION_MATCH_CONCURRENCY`
  (`aiSettings.ts:18-24`). "The per-call `pLimit` that function returns" vs. one
  shared limiter is now stated correctly.
- **R1-5 AC7.4 reword (line 109).** "no successful match saved since, whether or
  not the job was ever scored" reads cleanly; AC7.5 clears it on a later success.

No MUST_FIX on the artifact-accuracy axis. The deltas introduced no new claim
error. Round-1's two SHOULD_FIX and three MINOR are all dispositioned.

## New finding — concurrency during a *running* match

### R2-1 — In-flight match overlap and mid-run deletion are unspecified (SHOULD_FIX, Novel, carried)

The document takes a position on two concurrency cases but stops at the boundary
of a *running* match:

- AC4.10 dedups only a match that is "queued and **has not started**."
- Req 7 AC6 drops a match only when the job is deleted "**before** its queued
  match runs."

Both leave the in-flight window unspecified, and AC5.2 ("read the job's
description at run time, not the text present when the match was queued") exists
precisely to keep a score fresh — which the gap defeats.

**Failure scenario A (stale overwrite).** `update_job` sets description D1 →
match M1 queued → M1 starts (reads D1; up to `AI_JOB_MATCH_TIMEOUT_MS` = 180000
ms to run). During M1, `update_job` sets D2 → AC4.10 does not apply (M1 has
started) → M2 queued, runs, reads D2, writes score(D2). M1 then finishes and
writes score(D1) through the same `saveJobMatchResult` path (AC5.5),
**overwriting the fresh score with one for a description the job no longer has.**
No criterion specifies write-ordering or in-flight supersession, so a literal
implementation ships the stale result — directly against AC5.2's purpose.

**Failure scenario B (delete mid-run).** Job deleted after M1 loads it (AC5.1)
but before AC5.5 writes. Req 7 AC6 covers only deletion *before* the run; AC7.1
("the job SHALL stay saved") is impossible for a deleted job, and recording a
failure reason/time on the job (AC7.3) has no row to write to. Unspecified.

The spec already chose to specify concurrency at the requirements level (AC4.10,
Req 7 AC6), so covering the in-flight cases is in-scope here, not design
overreach. Carried (AC5.2/AC4.10 are v1 text the v2 delta did not touch); Novel
(round 1 validated queue/budget arithmetic but not run-overlap ordering).

## Minor

- **R2-2 (MINOR, Novel).** `skipMatch` is registered only on `add_job` and each
  `add_jobs_batch` item (AC8.1); `update_job` has no skip flag, so a
  description update (Req 4 AC2) always queues when the setting is on. For
  jobscout updating a job it already graded this is a small hole in the Req 8
  user story. Likely a deliberate "skip is an add-time signal" choice — if so,
  one line saying why `update_job` is excluded closes it.

## Top risks / gaps

1. **(SHOULD_FIX) R2-1** — a stale in-flight match overwrites a fresh score, and
   a mid-run deletion contradicts AC7.1; the dedup/drop rules stop at
   "has not started" / "before it runs."
2. **(MINOR) R2-2** — no `skipMatch` on `update_job`.

## Top 3 conclusions to challenge

1. **"AC4.10 + Req 7 AC6 cover the concurrency surface."** Reverse: they cover
   only the pre-start window. State the intended outcome for a requeue or delete
   while a match is in flight (last-queued wins, or guard dedup on
   in-flight-or-queued, not just queued-not-started).
2. **"AC5.2 read-at-runtime guarantees a fresh stored score."** It guarantees a
   fresh *read*, not a fresh *final write* — overlapping runs can land out of
   order. The guarantee the user story wants is on the stored value.
3. **"Skip is fully covered."** It is add-only; the update path can't opt out.

## What's missing before acting

- A write-ordering / in-flight-supersession rule for overlapping matches on one
  job, and a mid-run-deletion outcome (resolves R2-1).
- One line on why `update_job` carries no `skipMatch`, or add it (R2-2).
- Nothing else blocks design. Deltas are clean; citations accurate throughout.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
