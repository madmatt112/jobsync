/**
 * Score the bake-off against Matthew's labels and the Claude baseline.
 *
 * Run from the repo root so tsconfig's `@/` paths resolve:
 *   npx tsx evals/job-match-bakeoff/report.ts [--results <file>] [--labels <file>]
 *
 * Writes .data/report.md and prints the leaderboard. Parsing uses the app's
 * own parseJobMatch, so a reply counts as scored exactly when the app would
 * save it.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseJobMatch } from "@/lib/ai/jobMatch/parse";

const here = path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.join(here, ".data");

// USD per 1M tokens, checked 2026-10-30. DeepSeek: api-docs.deepseek.com
// pricing page, deepseek-flash peak rates (off-peak is half). OpenRouter:
// /api/v1/models pricing for the two ids. Re-check before trusting the cost
// column on a later run.
const PRICES_CHECKED = "2026-10-30";
const PRICES: Record<string, { input: number; cacheHit: number; output: number }> = {
  "deepseek-chat": { input: 0.3, cacheHit: 0.006, output: 1.2 },
  "deepseek-reasoner": { input: 0.3, cacheHit: 0.006, output: 1.2 },
  "gemini-3.8-flash": { input: 0.825, cacheHit: 0.825, output: 4.125 },
  "gpt-5.4-mini": { input: 0.75, cacheHit: 0.75, output: 4.5 },
};

// The agreed switch rule (grill, 2026-10-30).
const RULE = { maxExactGapPts: 10, maxParseFailRate: 0.02 };

const TIERS = ["weak", "partial", "good", "strong"] as const;
type Tier = (typeof TIERS)[number];
const ord = (t: Tier) => TIERS.indexOf(t);

// Paths are relative to where you ran the command; npm scripts cd to the repo
// root first, and INIT_CWD keeps the original directory.
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0
    ? path.resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[i + 1])
    : undefined;
}
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

// "strong match" (app) and "strong" (labels) both reduce to the first word.
const tierOf = (s: string | undefined): Tier | null => {
  const w = s?.split(" ")[0]?.toLowerCase();
  return (TIERS as readonly string[]).includes(w ?? "") ? (w as Tier) : null;
};

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// Average ranks, so tied values share a rank (needed: labels have 4 values).
function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
// Spearman = Pearson correlation of the ranks.
function spearman(a: number[], b: number[]): number {
  if (a.length < 3) return NaN;
  const ra = ranks(a), rb = ranks(b);
  const ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}

type Run = { score: number; tier: Tier } | null; // null = reply the app would not save
type ModelStats = {
  model: string;
  jobs: number;
  replies: number;
  apiErrors: number;
  parseFailRate: number;
  exact: number;
  withinOne: number;
  strongMisses: number;
  spearman: number;
  scoreStdDev: number | null;
  tierFlipRate: number | null;
  costPer100: number | null;
  billedPer100: number | null;
  medianSeconds: number | null;
  perJob: Map<string, { tier: Tier; score: number }>;
};

function main() {
  const resultsFile = arg("--results") ?? path.join(dataDir, "results.json");
  const labelsFile = arg("--labels") ?? path.join(dataDir, "labels.json");
  for (const f of [resultsFile, labelsFile]) {
    if (!existsSync(f)) throw new Error(`Missing ${f}`);
  }
  const jobs: { jobId: string; title: string; company: string; excluded?: string }[] = readJson(
    path.join(dataDir, "label-jobs.json"),
  );
  // Jobs marked out of scope (export --mark-scope) count nowhere in the report.
  const excluded = new Set(jobs.filter((j) => j.excluded).map((j) => j.jobId));
  const labelsRaw: Record<string, { tier: string }> = readJson(labelsFile);
  const labels = new Map<string, Tier>();
  for (const [jobId, l] of Object.entries(labelsRaw)) {
    const t = tierOf(l.tier);
    if (t && !excluded.has(jobId)) labels.set(jobId, t);
  }
  const titleOf = new Map(jobs.map((j) => [j.jobId, `${j.title} — ${j.company}`]));
  const baseline: { jobId: string; tier: Tier; score: number }[] = readJson(
    path.join(dataDir, "claude-baseline.json"),
  );
  const results = readJson(resultsFile).results.results as any[];

  // model -> jobId -> runs
  const runs = new Map<string, Map<string, Run[]>>();
  const meta = new Map<string, any[]>();
  const errors = new Map<string, number>();
  for (const r of results) {
    const model: string = r.provider?.label ?? r.provider?.id;
    const jobId: string = r.vars?.jobId ?? r.testCase?.vars?.jobId;
    if (excluded.has(jobId)) continue;
    if (!runs.has(model)) {
      runs.set(model, new Map());
      meta.set(model, []);
      errors.set(model, 0);
    }
    if (r.error || r.response?.error || typeof r.response?.output !== "string") {
      errors.set(model, errors.get(model)! + 1);
      continue;
    }
    const { scores } = parseJobMatch(r.response.output);
    const run: Run = scores
      ? { score: scores.matchScore, tier: tierOf(scores.recommendation)! }
      : null;
    const byJob = runs.get(model)!;
    if (!byJob.has(jobId)) byJob.set(jobId, []);
    byJob.get(jobId)!.push(run);
    if (r.response.metadata?.bakeoff) meta.get(model)!.push(r.response.metadata.bakeoff);
  }

  const stats: ModelStats[] = [];
  for (const [model, byJob] of runs) {
    const allRuns = [...byJob.values()].flat();
    const parsed: { jobId: string; run: NonNullable<Run> }[] = [];
    for (const [jobId, rs] of byJob) for (const r of rs) if (r) parsed.push({ jobId, run: r });

    // Agreement is per reply: one reply is what the app saves for one job.
    const labelled = parsed.filter((p) => labels.has(p.jobId));
    const dist = labelled.map((p) => Math.abs(ord(p.run.tier) - ord(labels.get(p.jobId)!)));
    const strongMisses = labelled.filter(
      (p) => labels.get(p.jobId) === "strong" && ord("strong") - ord(p.run.tier) >= 2,
    ).length;

    const perJob = new Map<string, { tier: Tier; score: number }>();
    const sds: number[] = [];
    let flips = 0, multi = 0;
    for (const [jobId, rs] of byJob) {
      const ok = rs.filter((r): r is NonNullable<Run> => r !== null);
      if (ok.length === 0) continue;
      const score = median(ok.map((r) => r.score));
      // Job-level tier: the reply whose score is closest to the median.
      const tier = [...ok].sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score))[0].tier;
      perJob.set(jobId, { tier, score });
      if (ok.length > 1) {
        multi++;
        sds.push(stdDev(ok.map((r) => r.score)));
        if (new Set(ok.map((r) => r.tier)).size > 1) flips++;
      }
    }
    const ranked = [...perJob].filter(([id]) => labels.has(id));

    const m = meta.get(model)!;
    const price = PRICES[model];
    const cold = price
      ? m.map((x) => (x.promptTokens * price.input + x.completionTokens * price.output) / 1e6)
      : [];
    const billed = m.filter((x) => typeof x.billedCost === "number").map((x) => x.billedCost);

    stats.push({
      model,
      jobs: byJob.size,
      replies: allRuns.length,
      apiErrors: errors.get(model)!,
      parseFailRate: allRuns.length ? allRuns.filter((r) => r === null).length / allRuns.length : NaN,
      exact: dist.length ? dist.filter((d) => d === 0).length / dist.length : NaN,
      withinOne: dist.length ? dist.filter((d) => d <= 1).length / dist.length : NaN,
      strongMisses,
      spearman: spearman(ranked.map(([, v]) => v.score), ranked.map(([id]) => ord(labels.get(id)!))),
      scoreStdDev: multi ? mean(sds) : null,
      tierFlipRate: multi ? flips / multi : null,
      costPer100: cold.length ? mean(cold) * 100 : null,
      billedPer100: billed.length ? mean(billed) * 100 : null,
      medianSeconds: m.length ? median(m.map((x) => x.latencyMs)) / 1000 : null,
      perJob,
    });
  }

  // Claude baseline: the stored MCP matches, one reply per job.
  const claudeLabelled = baseline.filter((b) => labels.has(b.jobId));
  const claudeDist = claudeLabelled.map((b) => Math.abs(ord(b.tier) - ord(labels.get(b.jobId)!)));
  const claude: ModelStats = {
    model: "claude (stored)",
    jobs: baseline.length,
    replies: baseline.length,
    apiErrors: 0,
    parseFailRate: NaN,
    exact: claudeDist.filter((d) => d === 0).length / (claudeDist.length || NaN),
    withinOne: claudeDist.filter((d) => d <= 1).length / (claudeDist.length || NaN),
    strongMisses: claudeLabelled.filter(
      (b) => labels.get(b.jobId) === "strong" && ord("strong") - ord(b.tier) >= 2,
    ).length,
    spearman: spearman(claudeLabelled.map((b) => b.score), claudeLabelled.map((b) => ord(labels.get(b.jobId)!))),
    scoreStdDev: null,
    tierFlipRate: null,
    costPer100: null,
    billedPer100: null,
    medianSeconds: null,
    perJob: new Map(baseline.map((b) => [b.jobId, { tier: b.tier, score: b.score }])),
  };

  // Switch rule.
  const qualifies = (s: ModelStats) => {
    const why: string[] = [];
    if (!(s.exact >= claude.exact - RULE.maxExactGapPts / 100)) why.push("exact agreement too far below Claude");
    if (s.strongMisses > 0) why.push(`${s.strongMisses} reply(ies) 2+ tiers off on a job you called strong`);
    if (!(s.parseFailRate <= RULE.maxParseFailRate)) why.push("parse failures above 2%");
    if (s.costPer100 === null) why.push("no cost data");
    if (s.jobs < baseline.length) why.push(`ran on ${s.jobs} of ${baseline.length} jobs`);
    return why;
  };
  const verdicts = stats.map((s) => ({ s, why: qualifies(s) }));
  const winner = verdicts
    .filter((v) => v.why.length === 0)
    .sort((a, b) => a.s.costPer100! - b.s.costPer100!)[0]?.s;

  // Biggest disagreements with the labels, any model including Claude.
  const disagreements: { jobId: string; model: string; label: Tier; tier: Tier; score: number; d: number }[] = [];
  for (const s of [claude, ...stats]) {
    for (const [jobId, v] of s.perJob) {
      const label = labels.get(jobId);
      if (!label) continue;
      const d = Math.abs(ord(v.tier) - ord(label));
      if (d > 0) disagreements.push({ jobId, model: s.model, label, tier: v.tier, score: v.score, d });
    }
  }
  disagreements.sort((a, b) => b.d - a.d || a.model.localeCompare(b.model));

  const pct = (x: number | null) => (x === null || Number.isNaN(x) ? "—" : `${Math.round(x * 100)}%`);
  const num = (x: number | null, dp = 2) => (x === null || Number.isNaN(x) ? "—" : x.toFixed(dp));
  const usd = (x: number | null) => (x === null ? "—" : `$${x.toFixed(2)}`);

  const rows = [claude, ...stats].map((s) =>
    `| ${s.model} | ${s.jobs} | ${s.replies} | ${pct(s.exact)} | ${pct(s.withinOne)} | ${s.strongMisses} | ` +
      `${num(s.spearman)} | ${num(s.scoreStdDev, 1)} | ${pct(s.tierFlipRate)} | ${pct(s.parseFailRate)} | ` +
      `${s.apiErrors} | ${usd(s.costPer100)} | ${usd(s.billedPer100)} | ${num(s.medianSeconds, 1)} |`,
  );

  const lines = [
    `# Job match bake-off report`,
    ``,
    `Generated ${new Date().toISOString()} from \`${path.basename(resultsFile)}\` and \`${path.basename(labelsFile)}\`.`,
    `Labels: ${labels.size} of ${jobs.length} jobs.${labels.size < jobs.length ? " **Labelling is not complete; the figures are provisional.**" : ""}`,
    ``,
    `## Result`,
    ``,
    winner
      ? `**${winner.model}** is the cheapest model that passes the switch rule (${usd(winner.costPer100)} per 100 matches).`
      : `**No model passes the switch rule.** Keep Claude for matching.`,
    ``,
    `Switch rule: exact tier agreement no more than ${RULE.maxExactGapPts} points below Claude (${pct(claude.exact)}), ` +
      `no reply 2+ tiers off on a job you labelled strong, parse failures at most 2%; then the cheapest wins.`,
    ``,
    ...verdicts.map((v) => `- ${v.s.model}: ${v.why.length ? `fails — ${v.why.join("; ")}` : "passes"}`),
    ``,
    `## Leaderboard`,
    ``,
    `| Model | Jobs | Replies | Exact tier | Within one | Strong misses | Spearman | Score SD | Tier flips | Parse fail | API errors | Cost /100 (cold) | Billed /100 | Median s |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
    ...rows,
    ``,
    `- Exact tier, within one and strong misses count each reply, because one reply is what the app saves.`,
    `- Spearman compares each job's median score with your tier (1 = same order as you).`,
    `- Score SD and tier flips use the repeats of each job. Claude has no repeats.`,
    `- Cost (cold) prices every input token at the cache-miss rate (prices checked ${PRICES_CHECKED}, DeepSeek at peak; off-peak is half). Billed is what OpenRouter charged, with its cache discounts.`,
    ``,
    `## Biggest disagreements with your labels`,
    ``,
    `| Job | Model | Your tier | Model tier | Model score |`,
    `|---|---|---|---|---|`,
    ...disagreements
      .slice(0, 10)
      .map((x) => `| ${titleOf.get(x.jobId) ?? x.jobId} | ${x.model} | ${x.label} | ${x.tier} | ${x.score} |`),
    ``,
  ];
  const report = lines.join("\n");
  writeFileSync(path.join(dataDir, "report.md"), report);
  console.log(report);
}

main();
