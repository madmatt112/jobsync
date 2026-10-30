/**
 * Export the bake-off sample from a JobSync database.
 *
 * Run from the repo root so tsconfig's `@/` paths resolve:
 *   npx tsx evals/job-match-bakeoff/export.ts [--db <path>]
 *
 * It copies the database with `sqlite3 -readonly ... .backup` and reads only
 * the copy, so the live instance is never opened for writing. It picks 40 jobs
 * that Claude already scored over MCP, spread across Claude's four tiers, and
 * builds each prompt with the same preprocessing and prompt builder as the
 * in-app Match. Everything it writes goes to .data/ (gitignored).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resumeDetailInclude } from "@/lib/jobs/resumeDetailInclude";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { buildJobMatchPrompt } from "@/lib/ai/prompts/job-match";
import type { Resume } from "@/models/profile.model";
import type { JobResponse } from "@/models/job.model";
import type { JobMatchData } from "@/models/ai.schemas";

const DEFAULT_DB = "/home/mcf/jobsync-deploy/jobsyncdb/data/dev.db";
const SAMPLE_SIZE = 40;
const SEED = 20261030;
const TIERS = ["strong", "good", "partial", "weak"] as const;
type Tier = (typeof TIERS)[number];

const here = path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.join(here, ".data");

// Paths are relative to where you ran the command; npm scripts cd to the repo
// root first, and INIT_CWD keeps the original directory.
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0
    ? path.resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[i + 1])
    : undefined;
}

// mulberry32: small seeded PRNG so the same seed always picks the same jobs.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Stored recommendations read "strong match"; the tier is the first word.
function tierOf(recommendation: string | undefined): Tier | null {
  const word = recommendation?.split(" ")[0]?.toLowerCase();
  return (TIERS as readonly string[]).includes(word ?? "") ? (word as Tier) : null;
}

// Give each tier an even share; a tier with too few jobs gives its spare
// places to the others.
function quotas(sizes: Record<Tier, number>, total: number): Record<Tier, number> {
  const q = { strong: 0, good: 0, partial: 0, weak: 0 } as Record<Tier, number>;
  let left = total;
  while (left > 0) {
    const open = TIERS.filter((t) => q[t] < sizes[t]);
    if (open.length === 0) break;
    for (const t of open) {
      if (left === 0) break;
      q[t]++;
      left--;
    }
  }
  return q;
}

async function main() {
  const source = arg("--db") ?? DEFAULT_DB;
  if (!existsSync(source)) throw new Error(`No database at ${source}`);
  mkdirSync(dataDir, { recursive: true });
  const snapshot = path.join(dataDir, "snapshot.db");
  execFileSync("sqlite3", ["-readonly", source, `.backup '${snapshot}'`]);

  const prisma = new PrismaClient({ datasourceUrl: `file:${snapshot}` });
  try {
    const jobs = await prisma.job.findMany({
      where: { matchData: { not: null } },
      include: { JobTitle: true, Company: true, Location: true },
      orderBy: { id: "asc" },
    });

    // Claude scored some jobs against a resume that was later deleted; those
    // jobs cannot be re-run on the same input, so they are left out.
    const resumeIds = new Set(
      (await prisma.resume.findMany({ select: { id: true } })).map((r) => r.id),
    );

    type Candidate = { job: (typeof jobs)[number]; match: JobMatchData; resumeId: string; tier: Tier };
    const byTier: Record<Tier, Candidate[]> = { strong: [], good: [], partial: [], weak: [] };
    for (const job of jobs) {
      const match = JSON.parse(job.matchData!) as JobMatchData;
      const resumeId = match.resumeId;
      if (match.provider !== "mcp" || !resumeId || !resumeIds.has(resumeId)) continue;
      const tier = tierOf(match.recommendation);
      if (tier) byTier[tier].push({ job, match, resumeId, tier });
    }

    const rand = rng(SEED);
    const sizes = Object.fromEntries(TIERS.map((t) => [t, byTier[t].length])) as Record<Tier, number>;
    const q = quotas(sizes, SAMPLE_SIZE);
    const picked = TIERS.flatMap((t) => shuffle(byTier[t], rand).slice(0, q[t]));
    // Mix the tiers so the labelling order gives no hint of Claude's tier.
    const ordered = shuffle(picked, rand);

    const resumeCache = new Map<string, { title: string; text: string }>();
    const cases = [];
    const labelJobs = [];
    const baseline = [];
    const skipped: string[] = [];

    for (const { job, match, resumeId, tier } of ordered) {
      let resume = resumeCache.get(resumeId);
      if (!resume) {
        const row = await prisma.resume.findUnique({
          where: { id: resumeId },
          include: resumeDetailInclude,
        });
        if (!row) {
          skipped.push(`${job.id}: resume ${resumeId} not found`);
          continue;
        }
        const pre = await preprocessResume(row as unknown as Resume);
        if (!pre.success) {
          skipped.push(`${job.id}: resume preprocessing failed (${pre.error.code})`);
          continue;
        }
        resume = { title: row.title, text: pre.data.normalizedText };
        resumeCache.set(resumeId, resume);
      }
      const jobPre = await preprocessJob(job as unknown as JobResponse);
      if (!jobPre.success) {
        skipped.push(`${job.id}: job preprocessing failed (${jobPre.error.code})`);
        continue;
      }

      // promptfoo test shape. The user prompt is built here, not in prompt.ts,
      // because promptfoo cannot resolve the `@/` imports the builder chain
      // uses. buildDateNote() therefore carries the export date.
      cases.push({
        description: job.id,
        vars: {
          jobId: job.id,
          resumeId,
          user: buildJobMatchPrompt(resume.text, jobPre.data.normalizedText),
        },
      });
      labelJobs.push({
        jobId: job.id,
        title: job.JobTitle?.label ?? "",
        company: job.Company?.label ?? "",
        location: job.Location?.label ?? "",
        url: job.jobUrl ?? null,
        completeness: match.descriptionCompleteness ?? null,
        description: jobPre.data.normalizedText,
        resumeId,
      });
      baseline.push({
        jobId: job.id,
        tier,
        score: match.matchScore,
        model: match.model,
        matchedAt: match.matchedAt,
      });
    }

    const resumes = Object.fromEntries(
      [...resumeCache].map(([id, r]) => [id, r]),
    );
    const write = (name: string, value: unknown) =>
      writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2));

    // cases.json feeds promptfoo; label-jobs.json and resumes.json feed the
    // labelling page; claude-baseline.json is read only by the report, so the
    // page has no way to show Claude's tier.
    write("cases.json", cases);
    write("label-jobs.json", labelJobs);
    write("resumes.json", resumes);
    write("claude-baseline.json", baseline);
    write("export-meta.json", {
      exportedAt: new Date().toISOString(),
      source,
      seed: SEED,
      quotas: q,
      available: sizes,
      skipped,
    });

    console.log(
      `Exported ${cases.length} jobs (quotas ${JSON.stringify(q)}), ` +
        `${resumeCache.size} resume(s), ${skipped.length} skipped.`,
    );
    for (const s of skipped) console.log(`  skipped ${s}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
