# Spec decomposition — jobsync (hard fork)

The fork is a hard fork of Gsync/jobsync at 1.1.21 (2026-10-06). Specs target `main` of `madmatt112/jobsync`. Upstream PR size and scope constraints no longer apply.

## 1. `mcp-read-tools`

Complete. `get_job`, `list_jobs`, `search_jobs` and the `jobs:read` scope (items 1 and 2 of Gsync/jobsync#114).

## 2. `mcp-write-tools`

MCP write access that the read-tools spec declared out of scope (items 3 and 4 of #114), plus one read-row field:

- `update_job` and `save_match_result` work on any job the token's user owns. The `createdVia: { not: null }` gate is removed (`src/lib/jobs/updateJobFromNames.ts`, `src/lib/mcp/tools/saveMatchResult.ts`).
- `save_cover_letter(jobId, text)` persists a cover letter against the job, visible in the app, with versions when the letter is redrafted. The `CoverLetter` model and `Job.coverLetterId` exist.
- `list_jobs` and `search_jobs` rows carry the date the job was added to JobSync. The jobscout `expire-stale` command needs it and currently calls `get_job` once per row to get it.

- One match method on every surface. The MCP match directive (`src/lib/mcp/tools/matchDirective.ts`, used by `add_job`, `add_jobs_batch` and `update_job`) stops using its own 4-section prompt. It hands the agent the same prompt as the in-app Match (`JOB_MATCH_SYSTEM_PROMPT` and `buildJobMatchPrompt` in `src/lib/ai/prompts/job-match/`), with the resume and the job description both normalized server-side (`preprocessResume`, `preprocessJob`). That gives one set of score bands, one output format and one set of inputs. The only difference left is the model. The shared prompt gets three additions, which the in-app Match also uses: (a) an explicit eligibility check (location/residency, work authorization, language, clearance) as part of Deal Breakers; (b) the MCP directive's rule not to invent employers, skills, titles, dates or credentials; (c) the partial-description warning (score is provisional; fetch the full posting and call update_job first when possible). The agent needs a way to get the directive for an existing job without editing it, so a re-score uses the same method; the design decides how.

Out of scope: a `set_status` wrapper (item 5 of #114). `update_job` already sets status with the same stage and applied-date side effects as the app.

## 3. `server-side-match`

JobSync scores jobs that arrive over MCP itself, with the configured DeepSeek model, so a job pushed by jobscout gets a match without a Claude session following the match directive. The aim is consistent matching at a lower cost than Claude.

Evidence: the match bake-off in `evals/job-match-bakeoff/` (PRs #7, #8; operator labels and results are local, under `.data/`). `deepseek-flash` with thinking off agreed with the operator's tier on 68% of 31 jobs (Claude's stored matches: 52%) and on 62% of 55 further jobs, within one tier on 97-98%, with 0 parse failures in 258 replies and about USD 0.30 per 100 matches. With thinking on it was less accurate (46%) and less stable (26% of jobs changed tier between repeats).

- **Match model settings.** Every match surface (in-app Match, automation match, the new server-side match) calls DeepSeek with thinking disabled, set explicitly in the request. Today no match call sets it. The DeepSeek default model and the model list name `deepseek-flash`; `deepseek-chat` and `deepseek-reasoner` are retired aliases (`src/models/ai.model.ts`, `getDefaultModelForProvider` in `src/lib/scraper/automation-run/aiSettings.ts`). A stored setting that names a retired alias keeps working. The agent chat is out of scope: its tool calls may need thinking.
- **Server-side match for MCP adds.** A user setting, off by default, turns it on. When it is on, `add_job`, `add_jobs_batch` and an `update_job` that changes the description queue a match for each job with the user's configured provider and model, the same prompt, preprocessing and parser as the in-app Match, and save it with `saveJobMatchResult` (provider, model and a surface that names this path). The tool reply says the match is queued and carries no match directive. When the setting is off, the replies and the directive are unchanged. Matches run in the background with a concurrency limit and a rate budget of their own, so a 50-job batch does not use the 5-per-minute interactive budget or slow the MCP reply. A failed match leaves the job unscored and records why; it never fails the add.
- **Skip a match on request.** `add_job` and `add_jobs_batch` accept an optional per-job flag that asks JobSync not to score that job. jobscout can then skip jobs it graded stretch or possible: none of the 33 such jobs in the bake-off sample was good or strong for the operator. The jobscout change that sets the flag is out of scope (jobscout repo).

Out of scope: a match provider or model separate from the chat setting (the operator's chat setting is already DeepSeek `deepseek-flash`); prompt changes (a later prompt-optimisation loop uses the bake-off labels); scoring jobs added in the app.
