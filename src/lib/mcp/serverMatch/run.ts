import { generateText } from "ai";
import prisma from "@/lib/db";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { writeJobMatch } from "@/lib/jobs/writeJobMatch";
import { getModel } from "@/lib/ai/providers";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "@/lib/ai/prompts/job-match";
import { parseJobMatch } from "@/lib/ai/jobMatch/parse";
import { MATCH_PROVIDER_OPTIONS } from "@/lib/ai/matchProviderOptions";
import { TEMPERATURES } from "@/lib/ai/config";
import { APP_CONSTANTS } from "@/lib/constants";
import {
  genAiRequestAttrs,
  genAiResponseAttrs,
  SURFACES,
  withSpan,
  log,
} from "@/lib/telemetry";
import type { AiProvider } from "@/models/ai.model";
import type { JobMatchData } from "@/models/ai.schemas";

export type ServerMatchTask = {
  jobId: string;
  userId: string;
  provider: AiProvider;
  model: string;
};

type RunResult = "saved" | "failed" | "dropped";

const NO_RESUME_REASON =
  "No resume could be resolved — set a default resume in Profile → Resumes.";
const JOB_UNREADABLE_REASON =
  "The job description could not be prepared for matching.";
const RESUME_UNREADABLE_REASON =
  "The resume could not be prepared for matching.";
const NO_SCORES_REASON = "The reply had no SCORES line.";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Design C6 "Fail" paragraph: records the reason on the job row, scoped to
// { id, userId } so a deleted job's updateMany matches nothing and the
// result stays "dropped" with no log line.
export async function recordServerMatchFailure(
  task: ServerMatchTask,
  reason: string,
): Promise<RunResult> {
  const { jobId, userId, provider, model } = task;
  const { count } = await prisma.job.updateMany({
    where: { id: jobId, userId },
    data: { serverMatchError: reason, serverMatchFailedAt: new Date() },
  });
  if (count === 0) return "dropped";
  log.error("[server-match] match failed", {
    jobId,
    userId,
    provider,
    model,
    reason,
  });
  return "failed";
}

export async function runServerMatch(
  task: ServerMatchTask,
  timeoutMs: number = APP_CONSTANTS.AI_JOB_MATCH_TIMEOUT_MS,
): Promise<RunResult> {
  const { jobId, userId, provider, model } = task;

  const jobLookup = await resolveJobForAgent(userId, jobId);
  if (jobLookup.status === "no_job") return "dropped";
  const job = jobLookup.job;

  const resumeLookup = await resolveResumeForAgent(userId, {
    pageResumeId: job.resumeId ?? undefined,
  });
  if (
    resumeLookup.status === "no_resumes" ||
    resumeLookup.status === "needs_selection"
  ) {
    return recordServerMatchFailure(task, NO_RESUME_REASON);
  }
  const resume = resumeLookup.resume;

  const [resumePre, jobPre] = await Promise.all([
    preprocessResume(resume),
    preprocessJob(job),
  ]);
  if (!jobPre.success) {
    return recordServerMatchFailure(task, JOB_UNREADABLE_REASON);
  }
  if (!resumePre.success) {
    return recordServerMatchFailure(task, RESUME_UNREADABLE_REASON);
  }

  const signal = AbortSignal.timeout(timeoutMs);
  const promptText = buildJobMatchPrompt(
    resumePre.data.normalizedText,
    jobPre.data.normalizedText,
  );

  let text: string;
  let finishReason: string;
  try {
    const languageModel = await getModel(provider, model, userId);
    const generated = await withSpan(
      "mcp.server_match",
      {
        ...genAiRequestAttrs({
          provider,
          model,
          temperature: TEMPERATURES.FEEDBACK,
          numCtx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX,
          surface: SURFACES.JOB_MATCH,
          system: JOB_MATCH_SYSTEM_PROMPT,
          prompt: promptText,
        }),
        "jobsync.user_id": userId,
        "jobsync.job_id": jobId,
      },
      async (span) => {
        const result = await generateText({
          model: languageModel,
          system: JOB_MATCH_SYSTEM_PROMPT,
          prompt: promptText,
          temperature: TEMPERATURES.FEEDBACK,
          abortSignal: signal,
          providerOptions: {
            ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } },
            ...MATCH_PROVIDER_OPTIONS,
          },
        });
        span.setAttrs(
          genAiResponseAttrs({
            usage: result.totalUsage,
            finishReason: result.finishReason,
            text: result.text,
          }),
        );
        return result;
      },
    );
    text = generated.text;
    finishReason = generated.finishReason;
  } catch (err) {
    const reason = signal.aborted
      ? `Timed out after ${timeoutMs / 1000} s.`
      : `Provider error: ${errorMessage(err).slice(0, 200)}`;
    return recordServerMatchFailure(task, reason);
  }

  if (finishReason !== "stop") {
    return recordServerMatchFailure(
      task,
      `The generation stopped early (finish reason: ${finishReason}).`,
    );
  }

  const { scores, body } = parseJobMatch(text);
  if (!scores) {
    return recordServerMatchFailure(task, NO_SCORES_REASON);
  }

  const matchData: JobMatchData = {
    ...scores,
    body,
    resumeId: resume.id!,
    resumeTitle: resume.title,
    matchedAt: new Date().toISOString(),
    provider,
    model,
    surface: APP_CONSTANTS.SERVER_MATCH_SURFACE,
    analyzed: true,
    descriptionCompleteness: job.descriptionCompleteness ?? undefined,
  };

  try {
    await writeJobMatch(userId, jobId, scores.matchScore, JSON.stringify(matchData));
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") return "dropped";
    throw err;
  }
  return "saved";
}
