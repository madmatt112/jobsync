import {
  buildMatchOffer,
  buildMatchDirective,
  neutraliseBatchPrefix,
} from "@/lib/mcp/tools/matchDirective";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "@/lib/ai/prompts/job-match";

vi.mock("@/lib/agent/jobLookup", () => ({
  resolveJobForAgent: vi.fn(),
}));

vi.mock("@/lib/agent/resumeLookup", () => ({
  resolveResumeForAgent: vi.fn(),
}));

vi.mock("@/lib/ai/tools/preprocessing", () => ({
  preprocessResume: vi.fn(),
}));

vi.mock("@/lib/ai/tools/preprocessing-job", () => ({
  preprocessJob: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildMatchDirective", () => {
  // Requirements 8.1: the directive hands over the in-app Match prompt
  // verbatim and keeps jobId/resumeId/the save_match_result call-back,
  // dropping the old resume block and four-section format. Expected
  // values come from design.md C6 post-conditions 3-6 and D6.
  it("carries jobId, resumeId, the save_match_result call-back and the in-app prompts verbatim, with no default-resume misdescription", () => {
    const text = buildMatchDirective(
      "job-1",
      "resume-1",
      "NORMALIZED RESUME TEXT",
      "NORMALIZED JOB TEXT",
      "full",
      "add",
    );

    expect(text).toContain("job-1");
    expect(text).toContain(
      "Act as JobSync's in-app Match: follow the SYSTEM PROMPT, then answer the USER PROMPT.",
    );
    expect(text).toContain(JOB_MATCH_SYSTEM_PROMPT);
    expect(text).toContain(
      buildJobMatchPrompt("NORMALIZED RESUME TEXT", "NORMALIZED JOB TEXT"),
    );
    expect(text).toContain(
      `{ "jobId": "job-1", "resumeId": "resume-1", "matchText": "<the full SCORES line + markdown body>" }`,
    );
    expect(text).not.toContain("against the user's default resume");
    expect(text).not.toContain("## Overall Fit");
  });

  // Requirement 8.1 / design C6 post-condition 2: the warning of :18-26 is
  // appended only when completeness is "partial".
  it("adds the partial-description warning only when completeness is partial", () => {
    const partial = buildMatchDirective("job-1", "resume-1", "R", "J", "partial", "add");
    const full = buildMatchDirective("job-1", "resume-1", "R", "J", "full", "add");

    expect(partial).toContain("PARTIAL DESCRIPTION WARNING");
    expect(full).not.toContain("PARTIAL DESCRIPTION WARNING");
  });

  // Requirement 9.5: the directive's own text, including the shared prompt,
  // never contains the forbidden reply phrases; only embedded resume/job
  // text may. Fixture 1 of design's Testing Strategy note. Routed through
  // buildMatchOffer so the job text is genuinely embedded via the real
  // normalizedJobText argument position, not guessed positionally.
  it("confines the forbidden reply phrases to embedded resume and job text (R9 AC5)", async () => {
    const resumeText =
      "Experience: RATE LIMIT EXCEEDED team, Duplicate Detected project, Job Created pipeline.";
    const jobText =
      "Requires rate limit exceeded tooling, duplicate detected handling, job created workflows.";
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: null },
    });
    (resolveResumeForAgent as any).mockResolvedValue({
      status: "ok",
      resume: { id: "resume-1" },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: jobText },
    });
    (preprocessResume as any).mockResolvedValue({
      success: true,
      data: { normalizedText: resumeText },
    });

    const offer = await buildMatchOffer("job-1", "user-1", "full", "add");
    const withoutEmbedded = offer.text.split(resumeText).join("").split(jobText).join("");

    expect(withoutEmbedded.toLowerCase()).not.toContain("rate limit exceeded");
    expect(withoutEmbedded.toLowerCase()).not.toContain("duplicate detected");
    expect(withoutEmbedded.toLowerCase()).not.toContain("job created");
  });

  // Requirement 9.5: no line, embedded text included, starts with the batch
  // prefix "[i/n] " after optional leading spaces. Fixture 2. Also routed
  // through buildMatchOffer, for the same reason as above.
  it("neutralises an embedded batch-prefix line so no line of the directive starts with it (R9 AC5)", async () => {
    const jobText = "[2/3] Senior engineer role with on-call rotation.";
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: null },
    });
    (resolveResumeForAgent as any).mockResolvedValue({
      status: "ok",
      resume: { id: "resume-1" },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: jobText },
    });
    (preprocessResume as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "R" },
    });

    const offer = await buildMatchOffer("job-1", "user-1", "full", "add");

    for (const line of offer.text.split("\n")) {
      expect(line).not.toMatch(/^[ \t]*\[\d+\/\d+\] /);
    }
  });
});

describe("neutraliseBatchPrefix", () => {
  // Design D8 / C6: every line matching the batch-prefix regex has its
  // brackets rewritten to parentheses, with leading spaces kept.
  it("rewrites a leading batch-prefix bracket to parentheses, keeping leading spaces, and leaves other text alone", () => {
    const input = "  [2/3] embedded line\nplain line\n[10/20] another line\nmid [1/2] untouched";

    const output = neutraliseBatchPrefix(input);

    expect(output).toBe(
      "  (2/3) embedded line\nplain line\n(10/20) another line\nmid [1/2] untouched",
    );
  });
});

describe("buildMatchOffer", () => {
  // Design C6 post-condition 3: resolveResumeForAgent is called with the
  // job's resumeId as pageResumeId, as matchJob.ts:57-60 does.
  it("resolves the resume using the job's linked resumeId as the page resume", async () => {
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: "resume-42" },
    });
    (resolveResumeForAgent as any).mockResolvedValue({
      status: "ok",
      resume: { id: "resume-42", title: "Linked Resume" },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "J" },
    });
    (preprocessResume as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "R" },
    });

    await buildMatchOffer("job-1", "user-1", "full", "add");

    expect(resolveResumeForAgent).toHaveBeenCalledWith("user-1", {
      pageResumeId: "resume-42",
    });
  });

  // Design C6 post-condition 3: no_resumes or needs_selection both return
  // the existing "No default resume set" note, unchanged (R8 AC2, D9).
  it("returns the No default resume set note for both no_resumes and needs_selection", async () => {
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: null },
    });

    (resolveResumeForAgent as any).mockResolvedValue({ status: "no_resumes" });
    const noResumes = await buildMatchOffer("job-1", "user-1", "full", "add");
    expect(noResumes.kind).toBe("note");
    expect(noResumes.text).toContain("No default resume set");

    (resolveResumeForAgent as any).mockResolvedValue({
      status: "needs_selection",
      resumes: [],
    });
    const needsSelection = await buildMatchOffer("job-1", "user-1", "full", "add");
    expect(needsSelection.kind).toBe("note");
    expect(needsSelection.text).toContain("No default resume set");
  });

  // Design C6 post-condition 4: a failed job and a failed resume each give
  // their own pinned note, and the job check runs first.
  it("returns the job's pinned note first, and the resume's pinned note only once the job preprocesses fine", async () => {
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: null },
    });
    (resolveResumeForAgent as any).mockResolvedValue({
      status: "ok",
      resume: { id: "resume-1" },
    });

    (preprocessJob as any).mockResolvedValue({ success: false });
    (preprocessResume as any).mockResolvedValue({ success: false });
    const bothFail = await buildMatchOffer("job-1", "user-1", "full", "add");
    expect(bothFail.kind).toBe("note");
    expect(bothFail.text).toContain(
      "The job description couldn't be used for matching",
    );
    expect(bothFail.text).toContain('update_job with jobId "job-1"');

    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "J" },
    });
    (preprocessResume as any).mockResolvedValue({ success: false });
    const resumeFails = await buildMatchOffer("job-1", "user-1", "full", "add");
    expect(resumeFails.kind).toBe("note");
    expect(resumeFails.text).toContain(
      "The resume couldn't be used for matching",
    );
  });

  // Design C6 post-condition 1 (R1-2): on a "rescore" context, the
  // title-only note no longer claims the job was just saved; it names the
  // stored description as too thin, and nothing was looked up to get there.
  it("says the stored description is too thin to score when rescoring a title-only job", async () => {
    const result = await buildMatchOffer("job-1", "user-1", "title-only", "rescore");

    expect(result.kind).toBe("note");
    expect(result.text).toContain("this job's stored description is too thin to score");
    expect(result.text).not.toContain("the job was saved");
    expect(resolveJobForAgent).not.toHaveBeenCalled();
  });
});
