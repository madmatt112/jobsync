import { z } from "zod";
import MarkdownIt from "markdown-it";
import prisma from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { McpSaveCoverLetterSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { JOB_NOT_FOUND_MESSAGE } from "@/lib/jobs/updateJobFromNames";
import { buildCoverLetterTitle } from "@/lib/coverLetterTitle";

// Same renderer settings as the in-app save action (coverLetter.actions.ts:11):
// html:false escapes raw HTML in the model output before it is ever stored, so
// the saved document is the shape a hand-written letter produces. Rendered
// before the transaction, as that action does, so the SQLite write lock never
// covers the render.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true });

export async function handleSaveCoverLetter(
  input: z.infer<typeof McpSaveCoverLetterSchema>,
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // Shares the per-user MCP bucket. The unit is taken before validation, so a
  // rejected letter still costs a unit — the caller can retry or save in-app.
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [
        { type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` },
      ],
    };
  }

  const markdown = input.text.trim();
  if (markdown.length < APP_CONSTANTS.MIN_COVER_LETTER_CHARS) {
    return {
      content: [
        {
          type: "text",
          text: `Validation error: text must be at least ${APP_CONSTANTS.MIN_COVER_LETTER_CHARS} characters after trimming.`,
        },
      ],
    };
  }

  const content = md.render(markdown);

  try {
    const letter = await prisma.$transaction(async (tx) => {
      // a. Owner-scoped job read; supplies the title parts.
      const job = await tx.job.findFirst({
        where: { id: input.jobId, userId },
        include: { JobTitle: true, Company: true },
      });
      if (!job) {
        return null;
      }

      // b. Find-or-create the caller's profile; both own through userId.
      let profile = await tx.profile.findFirst({ where: { userId } });
      if (!profile) {
        profile = await tx.profile.create({ data: { userId } });
      }

      // c. One user-scoped title read for the uniquifier.
      const existing = await tx.coverLetter.findMany({
        where: { profile: { userId } },
        select: { title: true },
      });

      // d. Build the "title - company" name, suffixed on a collision.
      const title = buildCoverLetterTitle(
        job.JobTitle?.label ?? "Cover Letter",
        job.Company?.label ?? "",
        existing.map((letter) => letter.title),
      );

      // e. The new version; owns through profileId from step b.
      const created = await tx.coverLetter.create({
        data: { profileId: profile.id, title, content },
      });

      // f. Repoint the job at the new letter.
      await tx.job.update({
        where: { id: input.jobId, userId },
        data: { coverLetterId: created.id },
      });

      return created;
    });

    if (!letter) {
      return {
        content: [{ type: "text", text: JOB_NOT_FOUND_MESSAGE }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Cover letter saved for job ${input.jobId}: "${letter.title}" (id: ${letter.id}).`,
        },
      ],
    };
  } catch (error: any) {
    if (error?.code === "P2025") {
      return {
        content: [{ type: "text", text: JOB_NOT_FOUND_MESSAGE }],
      };
    }
    return {
      content: [
        { type: "text", text: `Error: ${error?.message ?? "Unknown error"}` },
      ],
    };
  }
}
