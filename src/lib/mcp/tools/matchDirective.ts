import { APP_CONSTANTS } from "@/lib/constants";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "@/lib/ai/prompts/job-match";
import type { DescriptionCompleteness } from "@/models/job.model";

type MatchContext = "add" | "update" | "rescore";

// Rewrites a leading batch-prefix "[n/m] " to "(n/m) " on any line, keeping
// any leading spaces. Only embedded resume or job text can match, because the
// directive's own text has no such line — this is the R9 AC5 neutralising
// step (design D8).
export function neutraliseBatchPrefix(text: string): string {
  return text.replace(/^([ \t]*)\[(\d+)\/(\d+)\] /gm, "$1($2/$3) ");
}

export function buildMatchDirective(
  jobId: string,
  resumeId: string,
  normalizedResumeText: string,
  normalizedJobText: string,
  completeness: DescriptionCompleteness | null,
  context: MatchContext,
): string {
  const source =
    context === "add"
      ? "the job description you just submitted in this same add_job call"
      : context === "update"
        ? "the job description now stored on this job (as just updated)"
        : "the job description stored on this job";

  const warning =
    completeness === "partial"
      ? `\n\nPARTIAL DESCRIPTION WARNING: this posting is under ` +
        `${APP_CONSTANTS.DESCRIPTION_FULL_MIN_WORDS} words, so any score you ` +
        `produce is provisional and will be labelled as such in JobSync. Weight ` +
        `your confidence accordingly, say plainly in the body what the ` +
        `description does not tell you, and if you can fetch the full posting, ` +
        `call update_job with it first and score the enriched version instead.`
      : "";

  const blocks = [
    `Produce a job-fit match of JobSync job id ${jobId} against ${source}, ` +
      `using resume id ${resumeId}, the resume the in-app Match picks (the ` +
      `job's linked resume, else the default resume, else the only one). Both ` +
      `are shown below, normalized.${warning}`,
    `Act as JobSync's in-app Match: follow the SYSTEM PROMPT, then answer the USER PROMPT.`,
    `SYSTEM PROMPT:\n${JOB_MATCH_SYSTEM_PROMPT}`,
    `USER PROMPT:\n${buildJobMatchPrompt(normalizedResumeText, normalizedJobText)}`,
    `Then call save_match_result with:\n` +
      `    { "jobId": "${jobId}", "resumeId": "${resumeId}", "matchText": "<the full SCORES line + markdown body>" }`,
  ];

  return neutraliseBatchPrefix(blocks.join("\n\n"));
}

// Decides whether a match is offered at all, and returns either the
// directive or the one-line note explaining why not. Callers append a
// "directive" with a blank line and a "note" with a single space.
export async function buildMatchOffer(
  jobId: string,
  userId: string,
  completeness: DescriptionCompleteness | null,
  context: MatchContext,
): Promise<{ kind: "directive" | "note"; text: string }> {
  if (completeness === "title-only") {
    const lead =
      context === "rescore"
        ? `No fit analysis — this job's stored description is too thin to ` +
          `score (under ${APP_CONSTANTS.DESCRIPTION_PARTIAL_MIN_WORDS} words).`
        : `The description is too thin to score (under ` +
          `${APP_CONSTANTS.DESCRIPTION_PARTIAL_MIN_WORDS} words) — the job was ` +
          `saved, but no fit analysis was requested.`;
    return {
      kind: "note",
      text:
        `${lead} Fetch the full posting and call update_job with jobId ` +
        `"${jobId}" to get one.`,
    };
  }

  const jobLookup = await resolveJobForAgent(userId, jobId);
  if (jobLookup.status === "no_job") {
    return { kind: "note", text: "The job couldn't be loaded for matching." };
  }
  const job = jobLookup.job;

  // The job's linked resume takes the pageResumeId slot, exactly as in-app
  // Match does (src/lib/agent/tools/matchJob.ts:57-60), with no title.
  const resumeLookup = await resolveResumeForAgent(userId, {
    pageResumeId: job.resumeId ?? undefined,
  });
  if (
    resumeLookup.status === "no_resumes" ||
    resumeLookup.status === "needs_selection"
  ) {
    return {
      kind: "note",
      text: "No default resume set — set one in Profile → Resumes to enable automatic matching.",
    };
  }
  const resume = resumeLookup.resume;

  // Both preprocess together, as matchJob.ts:67-70; the job check runs first.
  const [resumePre, jobPre] = await Promise.all([
    preprocessResume(resume),
    preprocessJob(job),
  ]);
  if (!jobPre.success) {
    return {
      kind: "note",
      text:
        `The job description couldn't be used for matching (it may be too ` +
        `short) — fetch the full posting and call update_job with jobId ` +
        `"${jobId}" to get one.`,
    };
  }
  if (!resumePre.success) {
    return {
      kind: "note",
      text: "The resume couldn't be used for matching (it may be too short or missing content) — check it in Profile → Resumes.",
    };
  }

  return {
    kind: "directive",
    text: buildMatchDirective(
      jobId,
      resume.id!,
      resumePre.data.normalizedText,
      jobPre.data.normalizedText,
      completeness,
      context,
    ),
  };
}

// Shared by add_job and update_job so both compose the offer identically.
export function composeOfferMessage(
  message: string,
  offer: { kind: "directive" | "note"; text: string },
): string {
  return offer.kind === "directive"
    ? `${message}\n\n${offer.text}`
    : `${message} ${offer.text}`;
}
