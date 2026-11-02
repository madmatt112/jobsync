import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { buildMatchOffer } from "@/lib/mcp/tools/matchDirective";
import { enqueueServerMatch } from "@/lib/mcp/serverMatch/queue";
import { AiProvider } from "@/models/ai.model";
import type { DescriptionCompleteness } from "@/models/job.model";

export type MatchReply = {
  kind: "directive" | "note" | "queued" | "skipped";
  text: string;
};

export const QUEUED_TEXT =
  "Server-side match queued — JobSync will score this job with the configured AI model; read the result later with get_job.";
export const SKIPPED_TEXT =
  "Match skipped on request (skipMatch) — no fit analysis will be run for this job.";
export const NO_MODEL_TEXT =
  "No match queued — no AI model is configured. Pick one in Settings → AI Provider to enable server-side matching.";

export async function readServerMatchSettings(userId: string): Promise<{
  enabled: boolean;
  provider: AiProvider;
  model: string | undefined;
}> {
  try {
    const settings = await getUserAiSettings(userId);
    return {
      enabled: settings.serverSideMatch === true,
      provider: settings.provider,
      model: settings.model,
    };
  } catch {
    return { enabled: false, provider: AiProvider.OLLAMA, model: undefined };
  }
}

export async function resolveMatchReply(
  jobId: string,
  userId: string,
  completeness: DescriptionCompleteness | null,
  context: "add" | "update",
  skipMatch?: boolean,
): Promise<MatchReply> {
  if (skipMatch === true) {
    return { kind: "skipped", text: SKIPPED_TEXT };
  }

  const settings = await readServerMatchSettings(userId);
  if (!settings.enabled) {
    return buildMatchOffer(jobId, userId, completeness, context);
  }

  const offer = await buildMatchOffer(jobId, userId, completeness, context);
  if (offer.kind === "note") {
    return offer;
  }

  if (!settings.model) {
    return { kind: "note", text: NO_MODEL_TEXT };
  }

  enqueueServerMatch({
    jobId,
    userId,
    provider: settings.provider,
    model: settings.model,
  });
  return { kind: "queued", text: QUEUED_TEXT };
}
