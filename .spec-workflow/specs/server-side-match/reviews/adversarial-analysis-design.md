# Adversarial Analysis — server-side-match/design (v1, round 1)

First review. Deltas since `3058b20` attacked first (every changed citation re-probed, both ends of each range), then a fresh pass over feasibility, consistency and edge cases. Scope checked against decomposition §3 (`.spec-workflow/spec-decomposition/decomposition.md:21-31`): opt-in server match for MCP adds/updates, DeepSeek thinking-off on every match surface, a `skipMatch` flag, at lower cost than Claude — the design covers all of it.

## What I verified (so the clean areas are earned, not assumed)

- **Every delta citation is accurate.** `AiSettings.tsx:16-23` (Select/Label imports), `aiSettings.ts:26-39` (`getDefaultModelForProvider` returning `DEEPSEEK_CHAT` today), `userSettings.model.ts:22-30` (`defaultUserSettings`, no `serverSideMatch`), `addJob.ts:8-46`/`57-78`/line 62 strip, `updateJob.ts:7-37`, `createJobFromNames.ts:54-75` (named-field destructure drops unknowns), `matchDirective.ts:95-100`, `analyze.ts:100-109` (`surface: SURFACES.JOB_MATCH`), `getJob.ts:50-111` (`renderDetail`). No wrong path, range, signature or behaviour in the diff.
- **Every library-capability claim is proven against the installed tree.** `@ai-sdk/deepseek` 2.0.4: thinking enum `["enabled","disabled"]` (`index.js:300-307`), provider-options key `deepseek` (`index.js:418-420`, `:805` provider id `deepseek.chat`), copied into body (`index.js:473`). `ai` 6.0.256: `generateText` takes `providerOptions?: ProviderOptions` (`index.d.ts:1361`,`:1390`). Test harness: `MockLanguageModelV3.doGenerateCalls: LanguageModelV3CallOptions[]` (`ai/dist/test/index.d.ts:60`) and call options carry `providerOptions` (`@ai-sdk/provider/dist/index.d.ts:1467`). Versions confirmed by `require(...)`.
- **Data Models are pinned, not union-arms-only.** `MatchReply` (`{kind;text}`), `ServerMatchTask`, `readServerMatchSettings` return, `takeServerMatchBudget` return, and `matchData` all enumerate full fields; `matchData` maps cleanly onto `JobMatchData` (`ai.schemas.ts:60-76`) and `provider: "deepseek"`/`model: "deepseek-flash"` yields the Req 5.8 `via deepseek/deepseek-flash` through `getJob.ts:107` (`AiProvider.DEEPSEEK = "deepseek"`).
- **Security NFR holds.** `userId` flows from the token through `enqueueServerMatch` → `runServerMatch` into every lookup/write (`resolveJobForAgent`, `resolveResumeForAgent`, `writeJobMatch`, `recordServerMatchFailure`), never from the job row or tool input. `writeJobMatch`'s `update({where:{id,userId}})` mirrors the existing `saveJobMatchResult` pattern (`status.ts:60-63`), so a foreign/deleted job yields P2025 → `dropped` with no cross-user write.
- **The budget/merge refactors are safe.** `updateUserSettings` has only two callers (`updateAiSettings`, `updateDisplaySettings`), both compatible with the widened `{ai?:Partial<AiSettings>;display?:Partial<DisplaySettings>}`; the merge body already deep-merges `ai` (lines 68-72), so `serverSideMatch` survives a model save (Req 3.3). `getUserAiSettings` already returns the stored `ai` with no session (Req 3.4). Migration style (`ADD COLUMN ... TEXT` / `DATETIME`, SQLite) matches `20260712184644_add_resume_review_data`.

## Topics attacked

### 1. Skip-flag semantics on the non-create paths (C4 order, D13 vs Req 8.3)
- **Challenge the claim** that D13's "skipped text only where an offer would otherwise be composed" satisfies Req 8.3. `handleAddJob` returns the duplicate reply at `addJob.ts:27-36` **before** `resolveMatchReply` is ever called, so a `skipMatch:true` add that hits a duplicate-without-`upsert` returns "…No match offered for duplicates…" and **never** states "skipped on request." Req 8.3 says the reply SHALL state the match was skipped on request "whatever the setting" — unconditional. The design silently narrows that SHALL.
- **Stress-test** the justification "the requirements fix those replies at base." That is true only of Req 4.8 (the no-skip invariant); Req 4.8 says nothing about `skipMatch:true`. So when `skipMatch:true` AND duplicate-without-`upsert`, Req 8.3 ("state skipped") and Req 4.8 ("unchanged from base") collide, and D13 picks 4.8 without recording that it is overriding 8.3's literal text.
- **Probe the test plan.** The integration list (`skipMatch on add, on upsert and on batch items`) has no duplicate+skip or error-path+skip case, so the deviation is neither covered nor caught — it ships as a wrong implementation against an approved requirement.
- The same tension exists for the rate-limit-exceeded reply and the `catch` error reply with `skipMatch:true`; D13 lumps them in but does not reconcile them with 8.3.

### 2. Failure-line supersession (C9)
- **Stress-test** the use of `matchedAt` as the supersession signal: there is **no `matchedAt` column** (`schema.prisma:432-483`); it lives only inside the `matchData` JSON. I confirmed all four analyzed-match surfaces write it (`matchJob.ts:148`, `analyze.ts:148`, `atsRun.ts:368`, `saveMatchResult.ts:79`), and `JobMatchData.matchedAt?` is optional (`ai.schemas.ts:64`) — so "any later saved match sets a later matchedAt" (Req 7.5) holds. The notation `job.serverMatchFailedAt` (column) vs bare `matchedAt` (from `matchData`) is internally consistent with `renderDetail`'s existing `data.matchedAt` (`getJob.ts:106`). The three disjuncts (score hidden / matchedAt missing / matchedAt < failedAt) each resolve correctly, including the unanalyzed-prerank case via `hideUnanalyzedScore`. **Sound.**
- **Confirmed** `GET_JOB_INCLUDE` uses `include`, so the two new scalars load with no query edit.

### 3. Queue, budget and limiter (C8, Req 6)
- **Stress-test** Req 6.3's "50 jobs in the hour": MCP adds cost 50 of 60 MCP units (`rate-limit.ts`, per-item), and each match costs 1 of a **separate** 60-unit server-match budget taken at run time in `drive` step 1 — both fit. The budget's own `Map` never touches `checkRateLimit` (Req 6.2/6.5). `mcpRateLimitMax()` ≥ `MCP_RATE_LIMIT_MAX` (Req 6.3 floor, D5). Over-budget → sleep `resetIn`, retry, never fail (Req 6.4). Wait precedes the limiter slot (D6). **Sound.**
- **Probe** the Ollama bound: `ollamaGate = pLimit(1)` in front of `limiter` holds server Ollama matches to 1 and total to `SERVER_MATCH_CONCURRENCY` (Req 6.1). Note the gate does **not** coordinate with the automation runner's or in-app match's Ollama use, so >1 Ollama generation can run process-wide across surfaces — but Req 6.1 scopes only to server matches among themselves, and cross-surface collision pre-dates this spec. Not a defect; a known limitation worth a one-line scope note.

### 4. Reply path performance and the setting-off invariant (C4, Req 3.5, NFR)
- **Confirmed** the off path returns `buildMatchOffer(...)` unchanged → byte-identical composed reply (Req 3.5); `composeOfferMessage` widening keeps directive=blank-line / else=space, so queued/skipped get a space (Req 4.5). The queued path is `off + synchronous enqueue`, no provider call → NFR satisfied. `buildMatchOffer` runs the preprocess at reply time and `runServerMatch` runs it again at run time; the second is required by Req 5.2 (read description at run time), so the double preprocess is intended, not waste.

### 5. Run/fail discriminants (C6)
- **Confirmed** each closed-set reason has a clear discriminant: `finishReason !== "stop"`, no scores from `parseJobMatch`, job/resume preprocess `.success`, provider throw, and timeout attributed by "the timeout signal aborted" (`AbortSignal.timeout`). There is no HTTP response for a background run, so the error-branch status-code rule does not bite; the coalescing "loser" task is discarded without running (reply already sent), so there is no unpinned race-loser shape (Req 4.10, D14).

## Top risks / gaps

1. **(SHOULD_FIX) Req 8.3 vs D13 on non-create paths.** `skipMatch:true` on a duplicate-without-`upsert`, an unchanged-description, a rate-limited or an errored add returns the base reply with no "skipped on request" text, contradicting Req 8.3's unconditional "whatever the setting." Reconcile in the design: either emit the skipped text on those paths, or state explicitly that Req 8.3's "state skipped" is scoped to paths where an offer would compose and 4.8 governs the rest — and cover duplicate+skip in the test plan.
2. **(MINOR) `matchData` "Illustrative — verify against the test fake" hedge.** Req 5.6 references the object; all fields are enumerated and fit `JobMatchData`, so this is adequate, but drop the hedge and commit the shape so tasks do not re-derive it.
3. **(MINOR) Cross-surface Ollama concurrency.** The server-match `ollamaGate` does not serialise against automation/in-app Ollama use; add a one-line scope note that Req 6.1's Ollama=1 bound is within the server-match surface only.
4. Queue/budget/limiter, failure-line, security, NFR, library probes and Data Models are all verified sound — no gap.
5. No MUST_FIX: no false codebase claim, no internal contradiction, no unimplementable step, no data/security hole.

## Top conclusions to challenge

1. **"D13 … the requirements fix those replies at base."** Only Req 4.8 (no-skip invariant) fixes them; it does not cover `skipMatch:true`. Against `skipMatch:true`, Req 8.3 demands the skipped text and Req 4.8 demands the base reply — a genuine requirements conflict the design resolves without flagging. Reverse the framing to an explicit, scoped reconciliation.
2. **"integration tests cover it" (D10 / Testing Strategy).** The integration skip cases omit duplicate+skip and error-path+skip, the exact cases where D13 diverges from Req 8.3; the claim that integration tests cover the skip surface is incomplete.
3. **Nothing else.** The feared weak points — `matchedAt` with no column, the budget not leaking into `checkRateLimit`, the `updateUserSettings` type change breaking callers, the `via deepseek/deepseek-flash` display, P2025 cross-user safety — each held up under direct code reads. Do not manufacture findings there.

## What's missing before acting

- A one-paragraph reconciliation of Req 8.3 with D13 for the duplicate / unchanged / rate-limited / error paths, plus a duplicate+skip test case, so the red-first test author does not encode the contradiction.
- Optional one-liners: drop the `matchData` "illustrative" hedge; scope-note the Ollama=1 bound to the server-match surface.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
