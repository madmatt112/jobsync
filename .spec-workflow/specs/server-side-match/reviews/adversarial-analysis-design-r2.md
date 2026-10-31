# Adversarial Analysis — server-side-match/design (v2, round 2)

Deltas since `5677037` attacked first (R1-1 D13 rewrite, R1-2 matchData commit, R1-3 Ollama scope note), then a fresh pass over the paths round 1 did not read directly (`resolveJobForAgent` field availability, `parseJobMatch` output vs the now-committed matchData shape, multi-user limiter fairness, restart recovery, the background error-branch shape). design.md is committed at `0a38e35` with no working-tree edits, so the committed v2 is what I read.

## Delta verification (the v2 changes are the first attack surface)

- **R1-1 — D13 rewrite + C5 note + new citations. Correct and closed.** The three line citations the delta introduced are accurate against `src/lib/mcp/tools/addJob.ts`: `27-36` is the `!result.created` block that returns the duplicate message (duplicate-without-upsert reply at 31-35), `65-67` is the unchanged-description early return in `upsertExisting`, `14-18` is the rate-limit early return. Each of those paths returns **before** `resolveMatchReply` is called, so `skipMatch:true` genuinely never reaches `enqueueServerMatch` there — D13's no-queue claim (Req 8.2) holds. The reviser took exactly the resolution round 1 offered as acceptable ("state explicitly that Req 8.3's skipped text is scoped to the offer paths and 4.8 governs the rest, and add a duplicate+skip test"): D13 names Req 4.8 as governing, the C5 bullet gained "`skipMatch` does not alter them — D13", and the integration list gained the duplicate-without-upsert + skip case. This ruling is recorded in the v2 Revision History and is closed; I confirmed the scope note was written correctly rather than re-litigating it.
- **R1-2 — matchData shape committed. Correct.** The "Illustrative — verify against the test fake" hedge is gone. I verified the committed shape is complete, not just adequate: `parseJobMatch` (`src/lib/ai/jobMatch/parse.ts:24-45`) returns `scores = { matchScore, recommendation }` and nothing else, so the design's `{ matchScore, recommendation, body … }` enumerates every parsed field. All fields map onto `JobMatchData` (`src/models/ai.schemas.ts:60-76`): `analyzed?`, `descriptionCompleteness?`, `surface?` are all present and optional. `descriptionCompleteness: job.descriptionCompleteness ?? undefined` is type-safe.
- **R1-3 — Ollama cross-surface scope note. Correct.** The added sentence states the Ollama=1 bound covers server matches only and does not coordinate with the automation runner or in-app Match — true, and matches round 1's finding. Pre-existing, in-scope note only.

## Fresh-lens checks (paths round 1 did not read)

- **`resolveJobForAgent` field availability (fresh).** C6 step 2 reads `job.resumeId` and the matchData build reads `job.descriptionCompleteness`. `resolveJobForAgent` (`src/lib/agent/jobLookup.ts:12-27`) uses `prisma.job.findFirst({ where, include: {JobTitle,Company,Location} })` with **no `select`**, so every Job scalar — `resumeId`, `descriptionCompleteness` — is returned. The in-app `match_job` relies on the same `job.resumeId ?? undefined` (`src/lib/agent/tools/matchJob.ts:59`). **Sound** — the codebase-context's "title, company, location" names the includes, not the scalar set.
- **matchData parity vs in-app (fresh).** The in-app `match_job` matchData (`matchJob.ts:143-152`) omits `analyzed` and `descriptionCompleteness`; the server match adds both. This is not a divergence defect — Req 5.6 **mandates** `analyzed: true` and `descriptionCompleteness`, and `analyzed: true` is what keeps the server score out of `hideUnanalyzedScore` so C9's line logic reads correctly. The design is right to add them.
- **Background error-branch shape (prompt directive).** `runServerMatch` returns the discriminated union `"saved" | "failed" | "dropped"`; each closed-set reason maps to one discriminant (preprocess `.success`, provider throw, `finishReason !== "stop"`, no-scores, timeout-signal). There is no HTTP response for a background run, so the status-code half of the rule does not bite; the coalescing loser task is discarded unrun (reply already sent), so there is no unpinned race-loser shape. **Satisfied.**
- **Multi-user limiter fairness (fresh).** One process-wide `pLimit(3)` is FIFO across users, so a 50-job burst can delay another user's single job. This is not a defect: Req 6.1 explicitly mandates "one process-wide limiter", the per-user budget caps each user's rate, the NFR (no slow MCP replies, no interactive-budget use) still holds, and inter-user completion fairness is not a stated requirement.
- **Restart recovery wording.** C8 "Process" and Error Handling #5 match the NFR reliability clause and requirements D2 word-for-word (in-memory, dropped on restart, re-score via `get_job`+`matchDirective:true`). **Consistent.**

## Findings

### R2-1 — (MINOR, Compounding: R1-1) Scoped early-return paths are under-tested
The R1-1 resolution scopes Req 8.3 away from four early-return paths (duplicate-without-upsert, unchanged-description, rate-limit, `catch` error). The reviser added a test for only the first; round 1 had specifically named "error-path+skip" too. The unchanged-description-with-skip and error-with-skip behaviours (both "keep base reply") are neither asserted nor regression-guarded. The mechanism is identical to the tested duplicate case, so this is nice-to-have coverage, not a correctness gap — it does not keep the loop alive.

## Top risks / gaps

1. The one real round-1 issue (Req 8.3 vs the early-return paths) is resolved via the scoping option round 1 itself blessed, with accurate citations and a representative test. No MUST_FIX or SHOULD_FIX survives.
2. matchData shape, `resolveJobForAgent` fields, parse output, background error-branch shape, limiter and restart wording all verified sound on direct reads.
3. Only residue is minor test coverage of the other scoped early-return paths (R2-1).

## Top conclusions to challenge

1. **"D13 scopes Req 8.3."** Tempting to re-raise as a design-vs-approved-requirement contradiction, since Req 8.3 still reads "whatever the setting." But round 1 explicitly offered design-level scoping as an acceptable resolution and the reviser adopted it; the ruling is recorded and closed. Re-opening it without new evidence is forbidden — and I found none.
2. **"every requirement is covered" (Scope notes).** Accurate; the residual gap is test breadth on the scoped paths (R2-1), not a requirement left uncovered.
3. **Nothing else.** The feared seams — `job.resumeId`/`descriptionCompleteness` availability, the committed matchData completeness, cross-surface Ollama, FIFO limiter fairness — each held up under direct code reads. No manufactured finding.

## What's missing before acting

- Optional only: add unchanged-description+skip and error-path+skip cases alongside the duplicate+skip integration case so every scoped early-return path is regression-guarded. Not blocking.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
