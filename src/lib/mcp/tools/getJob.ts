import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { originLabel } from "@/lib/mcp/jobQuery";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { hideUnanalyzedScore } from "@/actions/job/shared";
import { STAGE_DETAIL_INCLUDE, sortStages } from "@/actions/jobStage/shared";
import { buildMatchOffer, composeOfferMessage } from "@/lib/mcp/tools/matchDirective";
import type { DescriptionCompleteness } from "@/models/job.model";

// The app's JOB_DETAILS_INCLUDE (src/actions/job/queries.ts) is private to a
// "use server" module, so the graph is restated here with the one addition a
// detail read needs: the notes themselves, not just their count. Resume and
// cover letter are references only — their content is out of scope for reads.
const GET_JOB_INCLUDE = {
  JobSource: true,
  JobTitle: true,
  Company: true,
  Status: true,
  Location: true,
  Resume: { select: { id: true, title: true } },
  CoverLetter: { select: { id: true, title: true } },
  // Alphabetical, so the same job renders the same way on every read.
  tags: { orderBy: { label: "asc" as const } },
  Notes: { orderBy: { createdAt: "asc" as const } },
  contactLinks: {
    include: {
      Role: true,
      Contact: {
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          phone: true,
          linkedinUrl: true,
          Company: { select: { label: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  stages: { include: STAGE_DETAIL_INCLUDE },
} satisfies Prisma.JobInclude;

type JobDetail = Prisma.JobGetPayload<{ include: typeof GET_JOB_INCLUDE }>;

const day = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

function renderDetail(job: JobDetail): string {
  const lines: string[] = [];
  const field = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  lines.push(`Job ${job.id}`);
  field("Title", job.JobTitle.label);

  const company = [job.Company.label];
  if (job.Company.careersUrl) company.push(`careers: ${job.Company.careersUrl}`);
  if (job.Company.websiteUrl) company.push(`website: ${job.Company.websiteUrl}`);
  if (job.Company.industry) company.push(`industry: ${job.Company.industry}`);
  field("Company", company.join(" | "));

  field("Status", job.Status.label);
  if (job.Location) {
    field(
      "Location",
      [job.Location.label, job.Location.stateProv, job.Location.country]
        .filter(Boolean)
        .join(", "),
    );
  }
  field("Source", job.JobSource?.label);
  field("Type", [job.jobType, job.workplaceType].filter(Boolean).join(" · "));
  field("URL", job.jobUrl);
  field("Salary", job.salaryRange);
  field("Applied", job.applied ? `yes${job.appliedDate ? `, ${day(job.appliedDate)}` : ""}` : "no");
  field("Due", day(job.dueDate));
  field("Created", day(job.createdAt));
  field("Origin", originLabel(job));
  if (job.discoveryStatus) {
    field(
      "Discovery",
      `${job.discoveryStatus}${job.discoveredAt ? `, discovered ${day(job.discoveredAt)}` : ""}`,
    );
  }
  field("Description completeness", job.descriptionCompleteness);
  if (job.tags.length) field("Tags", job.tags.map((t) => t.label).join(", "));
  if (job.Resume) field("Resume", `${job.Resume.title} (id: ${job.Resume.id})`);
  if (job.CoverLetter) field("Cover letter", `${job.CoverLetter.title} (id: ${job.CoverLetter.id})`);

  // hideUnanalyzedScore decides visibility exactly as the app's list does; the
  // body is read from the original row only when the score is showable.
  const visible = hideUnanalyzedScore(job);
  lines.push("", "## Match");
  if (visible.matchScore == null) {
    lines.push("Not scored.");
  } else {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(job.matchData ?? "{}");
    } catch {}
    const meta = [
      data.recommendation ? `recommendation: ${data.recommendation}` : null,
      data.matchedAt ? `matched ${day(new Date(String(data.matchedAt)))}` : null,
      data.provider ? `via ${[data.provider, data.model].filter(Boolean).join("/")}` : null,
    ].filter(Boolean);
    lines.push(`Score: ${visible.matchScore}%${meta.length ? ` — ${meta.join(", ")}` : ""}`);
    if (typeof data.body === "string" && data.body.trim()) lines.push(data.body.trim());
  }

  lines.push("", "## Description", job.description);

  if (job.Notes.length) {
    lines.push("", `## Notes (${job.Notes.length})`);
    for (const n of job.Notes) lines.push(`- [${day(n.createdAt)}] ${n.content}`);
  }

  if (job.stages.length) {
    lines.push("", `## Timeline (${job.stages.length} stages)`);
    for (const s of sortStages(job.stages)) {
      const parts = [
        s.outcome ? `outcome: ${s.outcome}` : null,
        s.format ? `format: ${s.format}` : null,
        s.location ? `location: ${s.location}` : null,
        s.durationMins != null ? `${s.durationMins} min` : null,
        s.interviewers.length
          ? `interviewers: ${s.interviewers.map((i) => i.Contact.name).join(", ")}`
          : null,
        // Prep questions are Question Bank entries; reads over the bank are a
        // non-goal, so only the count is surfaced.
        s.prepQuestions.length ? `prep questions: ${s.prepQuestions.length}` : null,
      ].filter(Boolean);
      lines.push(
        `- [${day(s.occurredAt) ?? "undated"}] ${s.StageType.label}${s.isCurrent ? " (current)" : ""}` +
          (parts.length ? ` — ${parts.join("; ")}` : ""),
      );
      if (s.notes) lines.push(`  notes: ${s.notes}`);
    }
  }

  if (job.contactLinks.length) {
    lines.push("", `## Contacts (${job.contactLinks.length})`);
    for (const link of job.contactLinks) {
      const c = link.Contact;
      const who = [c.title, c.Company?.label].filter(Boolean).join(", ");
      const reach = [c.email, c.phone, c.linkedinUrl].filter(Boolean).join(" · ");
      lines.push(
        `- ${c.name} — ${link.Role.label}${who ? ` (${who})` : ""}${reach ? ` — ${reach}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

export async function handleGetJob(
  input: { jobId: string; matchDirective?: boolean },
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [{ type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` }],
    };
  }

  try {
    // userId in the where: an id the caller doesn't own is the same "not
    // found" as an id that never existed, so ownership can't be probed.
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      include: GET_JOB_INCLUDE,
    });
    if (!job) {
      return { content: [{ type: "text", text: "No job with that id." }] };
    }

    const detail = renderDetail(job);
    if (!input.matchDirective) {
      return { content: [{ type: "text", text: detail }] };
    }

    // Re-score an owned job without editing it: the detail is unchanged and a
    // match offer for the stored description is appended in the "rescore"
    // context, composed exactly as add_job and update_job compose theirs.
    const offer = await buildMatchOffer(
      job.id,
      userId,
      job.descriptionCompleteness as DescriptionCompleteness | null,
      "rescore",
    );
    return {
      content: [{ type: "text", text: composeOfferMessage(detail, offer) }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
