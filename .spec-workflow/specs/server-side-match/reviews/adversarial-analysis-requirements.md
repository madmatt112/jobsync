# Adversarial Analysis — server-side-match/requirements (v1, round 1)

First review. Attack surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, query params, response shapes, client
state). No checkpoint commit exists for v1, so there is no delta to attack
first; the whole document is new.

All cited code artifacts were read at both ends of every range. The probe in
Requirement 1 (DeepSeek `thinking.type` enum, options key `deepseek`, body copy)
checks out against `node_modules/@ai-sdk/deepseek/dist/index.{d.ts,js}`. The
`saveJobMatchResult` signature, `buildMatchOffer` note branches, `checkRateLimit`
buckets, `getAutomationMatchLimit`, `getFallbackModels`, the `DeepseekModel`
enum, the settings merge in `updateUserSettings`, and `runNestedGeneration`'s
hardcoded `providerOptions` were all verified. No artifact is misstated — no
MUST_FIX on that axis.

## Topics attacked

### Topic A — Requirement 2, "DeepSeek default model and model list" vs the live models endpoint

- Challenge the assumption that constraining `getDefaultModelForProvider`
  (AC1) and the **fallback** list in `getFallbackModels` (AC2) satisfies the
  user story "a new setup does not pick a retired alias." The DeepSeek settings
  dropdown is normally populated from the **live** endpoint
  `deepseek/models` via `parseModelsResponse: (data) => data.data?.map(m => m.id)`
  (`src/lib/ai/provider-registry.ts:70-71`). The fallback list
  (`AiSettings.tsx:80-81`, `Object.values(DeepseekModel)`) is used only when that
  fetch fails or returns empty (`AiSettings.tsx:94-102,124-138,147-156`).
  Requirement 2 says nothing about what the live endpoint returns.
- Stress-test the silent assumption that the live `/models` response contains
  `deepseek-flash`. D9 and the decomposition state DeepSeek "serves both
  aliases with the new model" — i.e. `deepseek-chat`/`deepseek-reasoner` remain
  valid ids the API still lists. If the live list returns the aliases and not
  `deepseek-flash`, AC2's change is invisible on the normal path: a DeepSeek
  user with a working key still picks a retired alias from the dropdown, exactly
  the outcome the story exists to prevent.
- Attack the client-state fallout of AC1. The new default is `deepseek-flash`
  (AC1), but `modelValue` renders empty when `selectedModel.model` is not in
  `fetchedModels` (`AiSettings.tsx:204-207`), and `fetchModelsForProvider` clears
  a selected model absent from the fetched list (`AiSettings.tsx:141-145`). A
  fresh DeepSeek user who inherits the `deepseek-flash` default and opens
  Settings with a working key whose live list lacks `deepseek-flash` sees a
  blank model selector, and `saveModelSettings` then blocks on "Please select a
  model" (`AiSettings.tsx:176-180`).
- The decomposition says "the model list name `deepseek-flash`." Requirement 2
  reads "the model list" as the fallback list only; the user-facing list is the
  live dropdown. The requirement under-scopes its own source.

### Topic B — Requirement 4, criteria 6 and 7: unspecified precedence between the note branches

- Stress-test the interaction when AC6 and AC7 are both true. AC6 fires when the
  offer "would be a note" (title-only, no job, no resume, unreadable job,
  unreadable resume — the five branches of `buildMatchOffer`,
  `src/lib/mcp/tools/matchDirective.ts:71-128`). AC7 fires when "the user's AI
  settings have no model." A title-only add from a user with no model configured
  satisfies both. The document gives no precedence, so two implementers produce
  two different reply texts for the same call.
- Challenge the ordering this leaves to chance. If the no-model guard runs
  first, every note case for a no-model user is overwritten by the no-model note
  — the title-only / unreadable guidance never reaches jobscout. If the offer is
  computed first, the no-model note never fires for those jobs. Both are
  defensible readings of the current text.
- This also has a cost/ordering angle the document's own NFR cares about:
  `buildMatchOffer` does a job lookup plus `preprocessResume`/`preprocessJob`
  (`matchDirective.ts:87-113`). If the no-model note wins, computing the offer
  first is wasted work; if the offer wins, the model read is wasted. The spec
  should state which check runs first.

### Topic C — Requirement 1 AC1 + AC7: one shared generation path, two opposite demands

- AC1 requires the in-app Match (`match_job`) generation to carry
  `deepseek.thinking.type: "disabled"`. AC7 requires `review_resume` and
  `generate_cover_letter` provider options to stay unchanged. All three run
  through the same `runNestedGeneration`, whose `providerOptions` is hardcoded
  to `{ ollama: { options: { num_ctx } } }` with a deliberate "no think" comment
  (`src/lib/agent/nestedGeneration.ts:98-107`). The two criteria are jointly
  satisfiable only if the thinking option is threaded per-label, not added to the
  shared literal. This is not a contradiction, but the requirement states the
  end state without noting that the single shared call site is what forces a
  per-label option. Flagging so the design does not add the option to the shared
  literal and silently regress AC7. Verified fine as written; recorded as a
  constraint, not a defect.

### Topic D — Requirement 5/6: surface and limiter scope (checked, minor)

- AC5.6 requires a `matchData.surface` distinct from `"chat"` and the `"mcp"`
  marker. Confirmed `"chat"` is `AGENT_CHAT_MATCH_SURFACE` and `"mcp"` is a
  **provider** marker (`saveMatchResult.ts:80`), a different field — so the
  constraint is coherent and the chosen shape (provider = real id, model = real
  name, plus `surface`, `analyzed`, `descriptionCompleteness`) is cleanly
  distinguishable from both the in-app and agent-save shapes. Fine.
- The requirement is silent on the **telemetry** surface. Every existing match
  generation records `jobsync.surface` from the fixed six-value `SURFACES`
  (`src/lib/telemetry/genai.ts:7-14`, whose comment warns a seventh value
  "silently splits a comparison"). A server-side match runs generation outside
  the agent and would need a telemetry surface too; the document never says
  whether to reuse `job.match` or add one. Observability gap, not a contract
  defect. MINOR.
- AC6.1 says concurrency is capped "across the process … as `getAutomationMatchLimit`
  does." `getAutomationMatchLimit` returns a **per-call** `pLimit`
  (`aiSettings.ts:18-24`); the match queue needs one **process-wide** limiter.
  The citation is right for the Ollama=1 / else=constant rule but could mislead
  on scope. MINOR wording.

## Top risks / gaps

1. **(SHOULD_FIX)** Requirement 2 constrains only the default and the fallback
   list; the live DeepSeek `/models` dropdown — the normal path a user "who
   picks DeepSeek" uses — is unaddressed, and the requirement silently assumes it
   returns `deepseek-flash`. Failure: live list returns the retired aliases
   (consistent with D9), the dropdown keeps offering them, and the new
   `deepseek-flash` default renders as a blank, unsaveable model selector.
2. **(SHOULD_FIX)** Requirement 4 AC6 and AC7 overlap (title-only / unreadable
   job *and* no model configured) with no stated precedence, so the queued-vs-note
   reply contract is ambiguous. Failure: a no-model user's title-only add returns
   the no-model note under one implementation and the title-only note under
   another — divergent wire replies for identical input.
3. **(MINOR)** Telemetry surface for the server-side match is unspecified against
   a `SURFACES` set that is deliberately closed at six values.
4. **(MINOR)** AC6.1's "across the process … as `getAutomationMatchLimit` does"
   conflates a per-call limiter with the required process-wide one.
5. **(MINOR)** Requirement 7 AC4 ("failed after its last saved match") is
   underspecified for a job that was never scored at all; AC7.3/7.5 set/clear
   semantics resolve it in practice, but the "after its last saved match" clause
   reads oddly when there is no saved match to come after.

## Top 3 conclusions to challenge or reverse

1. **"The DeepSeek model list names `deepseek-flash`" is treated as done once the
   fallback list changes.** Reverse: the fallback is a failure-path list; the
   binding surface is the live `/models` dropdown. Either add a probe/claim about
   what the live endpoint returns for this account, or add a criterion covering
   the live list, or scope-note explicitly that only the fallback and default are
   in scope and the dropdown is not — and accept that the user story is then only
   partly met.
2. **D5 "check the existing note conditions and a configured model before
   queuing" is treated as a complete rule.** Challenge: it lists two pre-queue
   checks but does not order them, which is exactly the AC6/AC7 ambiguity.
   Promote the ordering into the criteria (offer first, then model, or the
   reverse) so the reply is deterministic.
3. **Requirement 5's "same analysis the in-app Match produces" invites the reader
   to expect the in-app matchData shape.** It does not: AC5.6 adds `analyzed`,
   `descriptionCompleteness` and a new `surface` that the in-app path
   (`matchJob.ts:143-152`) never writes. The claim is about the *scores*, not the
   JSON keys. Worth a one-line clarification so the design does not "match" the
   in-app shape and drop the fields the Provisional badge (AC5.7) needs.

## What's missing before acting on this document

- A statement of what the live DeepSeek `/models` endpoint returns for this
  account (or an explicit scope exclusion of the dropdown), resolving risk 1.
- A precedence rule between the note conditions and the no-model guard
  (risk 2), ideally folded into AC4.6/4.7 or D5.
- A line on the telemetry surface for the server-side match (reuse `job.match`
  or not), resolving risk 3.
- Nothing else blocks design. The queue/budget arithmetic is sound: the MCP add
  budget (60/hr, `MCP_RATE_LIMIT_MAX`) caps queued matches at ≤60/hr and the
  match-budget floor (AC6.3, ≥60/hr) keeps pace, so the queue cannot outrun its
  budget; the in-process/restart-drops posture (D2, NFR Reliability) is
  internally consistent; the setting survives an AI-settings save because
  `updateUserSettings` carries `...currentSettings` forward (AC3.3 verified).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
