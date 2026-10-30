# Job match bake-off

This eval compares low-cost models with Claude on the job match analysis. It
answers one question: which is the least expensive model that scores jobs
almost as well as Claude does? If a model passes, it can do routine matching
in place of Claude.

The eval is not part of the product. It uses the JobSync data and the same
code paths as the in-app Match, but it runs only on your machine.

## What it measures

You give a tier (strong, good, partial or weak) to 40 real jobs. Then each
model scores the same 40 jobs 3 times. The report compares each model with
your tiers and with the Claude matches that are already stored in JobSync.

For each model, the report shows:

| Column | Meaning |
|---|---|
| Exact tier | Percentage of replies that have the same tier as your label. |
| Within one | Percentage of replies that are 0 or 1 tiers from your label. |
| Strong misses | Number of replies that are 2 or more tiers below a job that you labelled strong. |
| Spearman | How well the model's scores put the jobs in the same order as your tiers (1 = the same order, 0 = no relation). |
| Score SD | Mean standard deviation of the 3 scores for one job. A low value is more consistent. |
| Tier flips | Percentage of jobs where the 3 replies do not all give the same tier. |
| Parse fail | Percentage of replies that the app parser cannot read. The app does not save these. |
| Cost /100 (cold) | USD for 100 matches, with all input tokens at the cache-miss price. |
| Billed /100 | USD for 100 matches that OpenRouter really charged (OpenRouter models only). |
| Median s | Median seconds for one match. |

### The switch rule

A model passes when all of these conditions are true:

1. Its exact tier agreement is not more than 10 points below Claude's.
2. It has no strong misses.
3. Its parse failure rate is 2% or less.
4. It ran on all of the sample jobs.

If more than one model passes, the model with the lowest cold cost wins. If no
model passes, keep Claude.

## Contenders

| Label | API | Model id | Notes |
|---|---|---|---|
| deepseek-chat | DeepSeek | `deepseek-flash` | Thinking off, temperature 0.3. |
| deepseek-reasoner | DeepSeek | `deepseek-flash` | Thinking on. Temperature has no effect. |
| gemini-3.8-flash | OpenRouter | `google/gemini-3.8-flash` | Temperature 0.3. The model uses reasoning tokens by default. |
| gpt-5.4-mini | OpenRouter | `openai/gpt-5.4-mini` | The model does not accept a temperature. |
| claude (stored) | none | Claude over MCP | Stored matches. No API calls. |

The model ids were checked on 2026-10-30 with DeepSeek `/models` and
OpenRouter `/api/v1/models`. DeepSeek retired `deepseek-chat` and
`deepseek-reasoner` as models. Both names now go to `deepseek-flash`, so the
two DeepSeek contenders are `deepseek-flash` with thinking off and on.

## Procedure

Do these steps from the `evals/` folder.

### 1. Set the API keys

Put the keys in one of these files:

- `~/.config/jobsync-eval/.env` (recommended; this file stays when a
  worktree is deleted). Set its mode to 600.
- `evals/job-match-bakeoff/.env`. If this file exists, the runner uses it
  and ignores the first file.

Use `.env.example` as the template. Do not commit a key. Both files are
outside git.

### 2. Export the sample

```bash
npm run bakeoff:export
```

The export copies the live database with `sqlite3 -readonly ... .backup` and
reads only the copy. It does not write to the running JobSync instance. To
use a different database, add `-- --db <path>`.

The export writes these files to `.data/` (outside git):

| File | Contents | Read by |
|---|---|---|
| `snapshot.db` | Read-only copy of the database. | export |
| `cases.json` | One promptfoo test per job, with the full user prompt. | promptfoo |
| `label-jobs.json` | Job text for the labelling page. | label server, report |
| `resumes.json` | Normalized resume text. | label server |
| `claude-baseline.json` | Claude's stored tier and score per job. | report only |
| `export-meta.json` | Seed, tier quotas, skipped jobs. | you |

### 3. Label the jobs

```bash
npm run bakeoff:label
```

Open `http://127.0.0.1:4319/`. For each job, click a tier or push 1 to 4.
Each click saves to `.data/labels.json` immediately. You can stop and
continue later. To remove a label, click the same tier again.

Give the tier that you think is correct for you, as if you decide whether to
apply. Do not look at the stored match in JobSync before you label a job.

### 4. Run the models

```bash
npm run bakeoff:run
```

This makes 40 jobs × 3 repeats × 4 models = 480 calls, at a concurrency of 2.
It takes approximately 1 hour. Expected cost: approximately $2.50 to $3 on
OpenRouter and approximately $1 on DeepSeek (half that off-peak). For a short test,
add `-- --repeat 1 -n 2`. To run only some models, add
`-- --filter-providers 'deepseek'`.

To see each reply, run `npm run eval:view`.

### 5. Make the report

```bash
npm run bakeoff:report
```

The report goes to `.data/report.md`. It shows the result of the switch rule,
the leaderboard and the 10 largest disagreements with your labels. If you
have not labelled all 40 jobs, the report says that the figures are
provisional.

## Why the eval works this way

### Your labels are the answer key

The question is "Does the model judge fit as you do?" Only your judgement can
answer that question. A reference model, for example Claude, can only show
that a model agrees with Claude. Claude is in the report, but as a
contender, not as the answer key.

### Blind labels

The labelling page does not show Claude's tier or score. The label server does
not read `claude-baseline.json`. If you see a score before you decide, the
score can change your decision (anchoring). Then Claude's agreement with you
goes up for the wrong reason.

### Tiers, not scores

People cannot reliably tell a 62 from a 68, but they can tell "good" from
"partial". Tiers make your labels repeatable. The model scores are still
useful: Spearman uses them to measure the order of the jobs.

### A stratified sample

A random sample of the stored matches has many weak jobs and few strong jobs.
Then a model that always says "weak" gets a good agreement figure. The export
takes jobs from each of Claude's 4 tiers as evenly as the data permits:

| Tier (Claude) | Available | Taken |
|---|---|---|
| strong | 5 | 5 |
| good | 11 | 11 |
| partial | 13 | 12 |
| weak | 20 | 12 |

Claude scored 13 more jobs against a resume that is now deleted. The export
does not use them, because their input cannot be built again. This removed 3
strong jobs, so the strong tier is small. Read the strong-miss column with
care: 5 jobs is a small number.

The sample uses Claude's tiers only to spread the jobs. Your labels decide
what is correct. The seed (`20261030`) makes the same sample each time.

### Repeats

The models are not deterministic. One run can be lucky. Three runs per job
show how much a score moves (Score SD) and how often the tier changes (Tier
flips). In the app, one reply is saved per job, so the agreement columns
count each reply, not the mean of the three.

### Rank correlation

Spearman correlation compares two orders, not two values. A model can give
all scores 10 points too high and still put the jobs in your order. For a
shortlist, the order is the important part. Your tiers have many ties (40
jobs, 4 values), so the report uses average ranks for ties.

### The same input as the app

- The export uses `preprocessResume`, `preprocessJob` and
  `buildJobMatchPrompt` from `src/`. `prompt.ts` imports
  `JOB_MATCH_SYSTEM_PROMPT` from `src/`. The report uses the app's
  `parseJobMatch`.
- Temperature is 0.3, the same as the in-app Match and the automation match
  (`TEMPERATURES.FEEDBACK`). The value 0.1 (`TEMPERATURES.ANALYSIS`) is not
  used by the match.
- The app does not shorten the resume or the job text. `TEXT_LIMITS` in
  `src/lib/ai/config.ts` is not used, so the eval does not shorten the text
  either.
- Each job uses the same resume that Claude used for its stored match.

Two differences remain:

1. The export builds the user prompt, not promptfoo. promptfoo cannot
   resolve the `@/` imports that the prompt builder uses. As a result, the
   date line in the prompt is the date of the export.
2. Claude scored each job at an earlier date. If you edited a job description
   after that date, Claude saw a different text.

### Why the Claude baseline costs nothing

The stored Claude matches came from the MCP match directive. The directive
uses the same system prompt, user prompt and preprocessing. The eval uses
these stored replies, so it makes no Claude API calls. The limits:

- There is only one reply per job, so there are no consistency figures for
  Claude.
- There are no token counts, so there is no cost or latency for Claude.
- Claude ran in Claude Code, not through the API. The conditions are almost
  the same, but not exactly the same.

### Cost and latency

- `provider.mjs` measures each call. The promptfoo OpenAI provider gave
  approximately 0.5 s for a DeepSeek call that takes approximately 10 s, so
  the eval does not use that provider.
- The cold cost uses the price table in `report.ts` (`PRICES`, checked
  2026-10-30). DeepSeek prices are peak prices. Off-peak prices are half.
  Prices change: examine the table before you trust the cost column.
- The cold cost ignores the prompt cache. In the eval, the 3 repeats of a
  job share the same prompt, so the cache hit rate is higher than in normal
  use. In the app, many jobs share the system prompt and the resume, so some
  cache hits also occur. The real cost is between the cold cost and the
  billed cost.
- Thinking models (deepseek-reasoner, gemini-3.8-flash) bill their reasoning
  tokens as output tokens.

## Files

| File | Purpose |
|---|---|
| `export.ts` | Copies the database and writes the sample to `.data/`. |
| `label-server.mjs`, `label.html` | Local labelling page (127.0.0.1 only). |
| `promptfooconfig.yaml` | The contenders and the format check. |
| `provider.mjs` | promptfoo provider for OpenAI-compatible APIs, with timing and cost data. |
| `prompt.ts` | System prompt from `src/` plus the prebuilt user prompt. |
| `run.mjs` | Starts promptfoo with the correct env file and defaults. |
| `report.ts` | Calculates the figures and applies the switch rule. |
