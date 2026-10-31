# Adversarial Analysis — mcp-write-tools/requirements (v5)

Round 5. Primary surface: completeness, ambiguity, scope. Fresh lens: client-contract
regression and cross-surface consistency — is R8 (one match method on every surface)
precise enough to implement, and does R9 genuinely preserve the jobscout wire contract
rather than only asserting it.

No v4 checkpoint commit exists (prompt `## Changes: no checkpoint commit found for v4`),
so the v5 deltas are reconstructed from the Revision History: RI-1 (new Requirement 8 +
D11), RI-2 (Requirement 9 criteria 1–4), RI-3 (scope note), RI-4 (R9 criterion 5), RI-5
(R9 criterion 6), plus the D10 reorder. All new citations in R8/R9 were read at both ends.

## Deltas attacked first — citations re-verified (all accurate)

- R8 AC1: `job-match/index.ts:5-6` exports `JOB_MATCH_SYSTEM_PROMPT` and `buildJobMatchPrompt` — correct.
- R8 AC2: `preprocessResume` (`preprocessing.ts:305-310`), `preprocessJob` (`preprocessing-job.ts:104`),
  and in-app usage `matchJob.ts:67-70` (Promise.all preprocess) / `:91` (buildJobMatchPrompt) — correct.
- R8 AC3: Deal Breakers at `system.ts:49-50`, no-fab rule `matchDirective.ts:34-35`, partial
  warning `matchDirective.ts:18-26`, four-section body `matchDirective.ts:28-51` — all correct.
- R9 AC1: `mcp.schema.ts:177-213` carries status/applied/createdTo/matchScoreMax/sortBy/sortOrder/limit/cursor/company — correct.
- R9 AC2: `formatJobRow` (`jobQuery.ts:311-324`) emits nine ` | ` fields, field 8 `match ${match}` = `match N%`/`match -` — correct; `added` tenth is consistent with R7/D6.
- R9 AC3: `getJob.ts:74` = `field("URL", job.jobUrl)`, `:78` = `field("Created", day(job.createdAt))` — correct.
- R9 AC4: `updateJobFromNames.ts:230` = `Job ${jobId} updated. Fields changed: …` — correct.
- R9 AC5: batch prefix `addJobsBatch.ts:17` (`[${i+1}/${total}] …`), `:25` (`${label}: ${text}`) — correct.

Citations are clean. The defects are semantic: what the new requirements omit or over-promise.

## Findings

### R5-1 — R8 AC1 drops the `save_match_result` call-back, the jobId and the resumeId the MCP round-trip depends on — MUST_FIX (Novel; fix-induced)

R8 AC1 says the directive "SHALL hand the agent … `JOB_MATCH_SYSTEM_PROMPT` and
`buildJobMatchPrompt`" and "SHALL NOT keep the directive's own four-section prompt
(`matchDirective.ts:28-51`)." The cited range `28-51` is the **entire** directive body,
which carries three things the match flow cannot work without:
- the target `jobId` (line 29),
- the `resumeId` to score against (line 50),
- the closing instruction "Then call `save_match_result` with `{ jobId, resumeId, matchText }`" (lines 49-50).

Neither replacement prompt supplies any of them. `JOB_MATCH_SYSTEM_PROMPT` (`system.ts:6-55`)
ends at "Be honest about gaps." `buildJobMatchPrompt` (`user.ts:11-26`) embeds the resume
and job text and ends "Output the scores line first, then the markdown analysis …" — it
never names a job id and never tells the agent to call anything back. The MCP server does
not call the model; the agent does and then calls `save_match_result` (`saveMatchResult.ts`).
An agent handed only the two shared prompts produces a scores line + markdown and stops — no
`save_match_result` call, so nothing is ever stored. That breaks R2's entire precondition and
the Introduction's promise ("a re-score over MCP agrees with what the app produces").

The criterion is also ambiguous: "four-section prompt" could mean only the four `##`
sections (lines 45-48). Under the narrow reading the save-call survives, but then R8 AC3(b)'s
no-fabrication addition duplicates `matchDirective.ts:34-38`, and the kept body's SCORES/format
spec collides with the shared prompt's own OUTPUT FORMAT (`system.ts:24-55`). Under the literal
(cited-range) reading the save-call is lost. Both resolutions are defective; the contract for
the wire the whole feature rides on is left unstated. Secondary consequence: dropping the
directive's `resumeId` template silently defeats `saveMatchResult.ts:44-51` ("Prefer the
resumeId add_job handed the agent"), degrading provenance to the default-resume fallback.

Fix: R8 must state that the directive still carries the jobId, the resumeId and the
"then call `save_match_result`" instruction, wrapping — not replacing — the shared prompt.

### R5-2 — "score the same way … only the model different" is false: the two surfaces pick different resumes — SHOULD_FIX (Novel; fix-induced)

R8's user story and the Introduction promise MCP and in-app Match "score a job the same way,
so that a re-score over MCP agrees with the app," and D11 asserts the two surfaces share one
pipeline "leaving only the model different." The code contradicts the enumeration:
- in-app Match scores against the job-linked / caller-selected resume — `matchJob.ts:57-60`
  passes `pageResumeId: job.resumeId` into `resolveResumeForAgent`.
- the MCP directive scores against the user's **default** resume — `matchDirective.ts:74`
  `getDefaultResumeForUser(userId)`, and the directive text says so (line 29, "the user's default resume").

When a job is linked to resume A but the user's default is resume B, the two surfaces feed
different resumes into the same prompt and diverge regardless of model. D11's "only the model
different" is inaccurate, and the agreement goal is not delivered by unifying the prompt alone.
R8 AC2's "the same inputs the in-app Match already feeds" is true only for the *pipeline*
(`preprocessResume`/`preprocessJob`), not the resume document. Fix: either align resume
selection across surfaces or correct D11/the user story to state the resume source can differ.

### R5-3 — R8 AC3(c) forces a conditional, MCP-only warning into the static shared prompt the in-app surface also uses — SHOULD_FIX (Novel; fix-induced)

R8 AC3 says the shared `JOB_MATCH_SYSTEM_PROMPT` "SHALL carry three additions both surfaces
then use," the third being the partial-description warning (`matchDirective.ts:18-26`). That
warning is (a) **conditional** — `buildMatchDirective` emits it only when
`completeness === "partial"` and it interpolates `DESCRIPTION_FULL_MIN_WORDS` for this job;
and (b) **MCP-specific** — it tells the agent to "fetch the full posting and call `update_job`
with it first." Baking it into a static shared constant:
- makes it unconditional — it now fires for full-description jobs too, telling the agent to
  go fetch a posting it already has;
- injects a "call `update_job`" instruction into the in-app Match, whose system prompt is this
  same constant (`matchJob.ts:90`). The in-app surface is a single server-side generation
  (`runNestedGeneration`) with no tools and no `update_job`, so the instruction is dead/wrong there.

"both surfaces then use" is therefore false for (c). Fix: keep (c) in the MCP directive layer
(conditional, as today) and share only the eligibility check (a) and no-fabrication rule (b).

### R5-4 — R9 AC5's "SHALL never contain … in any case" cannot hold once the directive embeds unbounded resume and job-description text — SHOULD_FIX (Novel; fix-induced)

R9 AC5 requires the built directive to "never contain `rate limit exceeded`, `duplicate
detected` or `job created` in any case," "never start with `not attempted`," and have "no line
starting with the batch item prefix `[i/n] `," asserted by a unit test. But under R8 the
directive now embeds the normalized resume (`matchDirective.ts:31`) **and** the normalized job
description (via `buildJobMatchPrompt`, `user.ts:19-23`) — both unbounded user/agent free text.
A resume bullet "Job created the data pipeline" or a posting line "Duplicate detected alerts"
makes the built directive contain a banned substring; and because the template puts the job
description on its own line after `JOB DESCRIPTION:\n`, a posting that begins "[2/3] Senior …"
produces a directive line starting with the batch prefix. In a batch reply (items joined by
`\n\n`, each `"[i/n] label: <reply incl. directive>"`) that spurious `[2/3] ` line desyncs
jobscout's item segmentation — the exact client-contract break R9 AC6's `f2d0bce` ("classifies
replies on the first line only") relies on not happening. A unit test over one fixture cannot
prove "in any case." Fix: scope AC5's guarantee to the static directive scaffolding and require
the embedded resume/job text to be flattened (newlines stripped, prefix/token neutralised), or
state the guarantee holds only for the template.

Sub-point: AC5's parenthetical gloss "(a digit run, slash, digit run, space)" drops the
brackets of the real prefix `[i/n] ` (`addJobsBatch.ts:17`). A test author following the gloss
writes `/^\d+\/\d+ /`, which does not match `[1/5] `. The backtick literal is authoritative;
the gloss should match it.

### R5-5 — R8 AC3 changes the shipped in-app Match's scoring prompt, unacknowledged by the Introduction's "MCP adopts the app prompt" framing — MINOR (Novel; fix-induced)

The Introduction frames R8 as the MCP directive adopting "the same prompt the in-app Match
uses," but R8 AC3 also adds a new eligibility check (a) and the no-fabrication rule (b) to the
shared `JOB_MATCH_SYSTEM_PROMPT`, which the in-app Match reads unchanged (`matchJob.ts:90`).
Existing in-app users' match output/scores will shift (new eligibility consideration in Deal
Breakers). No requirement bounds or acknowledges this behaviour change to the shipped surface.
Completeness gap, not a blocker.

### R4-1 — R6 AC3 / Security NFR still express create-ownership as a `where` invariant — MINOR (Recurring; Compounds R3-3; unresolved)

Untouched this round (the v5 Revision History confirms R6 AC3 and the Security NFR were left
as-is). R6 AC3 still requires "its Prisma `where` SHALL include the caller's `userId` …
including … the new-row write," but that write is `coverLetter.create` (and the no-profile
`profile.create`) — a `create` has no `where`; ownership is via `data` (`profileId`/`userId`).
Redundant with R4 AC1/AC5, so precision only. Does not keep the loop alive.

## Top risks / gaps

1. R5-1 (MUST_FIX) — R8 AC1 as written severs the MCP match round-trip: the directive loses
   the jobId, resumeId and the `save_match_result` call-back, so no match is ever saved; R2's
   precondition and the Introduction's agreement goal both fail.
2. R5-2 (SHOULD_FIX) — the "same score" / "only the model different" promise is false while MCP
   uses the default resume and in-app uses the job-linked resume; unifying the prompt alone does
   not deliver agreement.
3. R5-4 (SHOULD_FIX) — R9 AC5's absolute no-forbidden-token guarantee is unachievable because
   the directive embeds arbitrary resume + job text; a benign posting can desync jobscout's
   batch parser (the R9 AC6 contract).
4. R5-3 (SHOULD_FIX) — R8 AC3(c) pushes a conditional, `update_job`-referencing MCP warning
   into the static shared prompt the in-app single-shot surface also runs.
5. Citations in R8/R9 are all accurate; the row/field, leading-text and get_job wire pins in
   R9 AC1-AC4 correctly match the code.

## Top conclusions to challenge or reverse

1. R8 AC1 "SHALL NOT keep the directive's own four-section prompt (`matchDirective.ts:28-51`)"
   — reverse to preserve the jobId, resumeId and `save_match_result` call-back; wrap the shared
   prompt, do not replace the whole body.
2. D11 "leaving only the model different" — reverse: resume selection also differs
   (default vs job-linked), so scores can diverge; either align selection or drop the claim.
3. R9 AC5 "SHALL never contain … in any case" — reverse to a template-scoped guarantee plus a
   flatten/neutralise step on the embedded resume/job text; otherwise the unit test proves
   nothing about real content.

## What's missing before acting

- A directive-contract statement in R8 that keeps the jobId, resumeId and `save_match_result`
  call-back (R5-1) — the single blocker.
- A decision on resume-source parity across the two surfaces, or an honest correction to D11
  and the R8 user story (R5-2).
- A sanitisation/scoping rule for the embedded resume and job text so R9 AC5's wire guarantee
  is real (R5-4), and the AC5 bracket-gloss fixed.
- A note acknowledging the in-app Match output change from the shared-prompt additions (R5-5).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
