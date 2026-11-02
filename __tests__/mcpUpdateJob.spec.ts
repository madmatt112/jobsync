import { handleUpdateJob } from "@/lib/mcp/tools/updateJob";
import {
  updateJobFromNames,
  JOB_NOT_FOUND_MESSAGE,
} from "@/lib/jobs/updateJobFromNames";
import { buildMatchOffer } from "@/lib/mcp/tools/matchDirective";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { enqueueServerMatch } from "@/lib/mcp/serverMatch/queue";
import { QUEUED_TEXT, NO_MODEL_TEXT } from "@/lib/mcp/serverMatch/offer";
import { AiProvider } from "@/models/ai.model";

vi.mock("@/lib/jobs/updateJobFromNames", async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, updateJobFromNames: vi.fn() };
});

vi.mock("@/lib/mcp/tools/matchDirective", async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, buildMatchOffer: vi.fn() };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

vi.mock("@/lib/scraper/automation-run/aiSettings", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/scraper/automation-run/aiSettings")
  >("@/lib/scraper/automation-run/aiSettings");
  return { ...actual, getUserAiSettings: vi.fn() };
});

vi.mock("@/lib/mcp/serverMatch/queue", () => ({
  enqueueServerMatch: vi.fn(),
}));

describe("handleUpdateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
    (buildMatchOffer as any).mockResolvedValue({
      kind: "directive",
      text: "DIRECTIVE calling save_match_result",
    });
  });

  it("re-offers a match when the description was enriched to full", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: description.",
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", jobDescription: "x".repeat(50) } as any,
      "user-1",
    );
    const text = result.content[0].text;

    expect(text).toContain("Job job-1 updated");
    expect(text).toContain("DIRECTIVE calling save_match_result");
    expect(buildMatchOffer).toHaveBeenCalledWith("job-1", "user-1", "full", "update");
  });

  it("does not re-offer a match when the description was not touched", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: statusId.",
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", status: "applied" } as any,
      "user-1",
    );

    expect(result.content[0].text).toBe("Job job-1 updated. Fields changed: statusId.");
    expect(buildMatchOffer).not.toHaveBeenCalled();
  });

  it("returns the helper's message unchanged when the update failed", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: false,
      jobId: "job-x",
      descriptionChanged: false,
      descriptionCompleteness: null,
      resolutions: [],
      message: JOB_NOT_FOUND_MESSAGE,
    });

    const result = await handleUpdateJob(
      { jobId: "job-x", salaryRange: "$1" } as any,
      "user-1",
    );

    expect(result.content[0].text).toBe(JOB_NOT_FOUND_MESSAGE);
    expect(buildMatchOffer).not.toHaveBeenCalled();
  });

  it("surfaces resolver errors as an Error: message", async () => {
    (updateJobFromNames as any).mockRejectedValue(
      new Error('Invalid jobType "Freelance". Valid values: Full-time, Part-time, Contract'),
    );

    const result = await handleUpdateJob(
      { jobId: "job-1", jobType: "Freelance" } as any,
      "user-1",
    );

    expect(result.content[0].text).toContain("Invalid jobType");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 7000 });

    const result = await handleUpdateJob({ jobId: "job-1" } as any, "user-1");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(updateJobFromNames).not.toHaveBeenCalled();
  });
});

// Contract (design C4/C5, Req 4.2, 4.6, 4.7, 4.8; D13):
//
// 1. "a directive-worthy update queues a match with no directive when the
//     setting is on"
//    Pre:   descriptionChanged: true, buildMatchOffer returns a directive,
//           setting on with a model.
//    Test:  handleUpdateJob(input, userId).
//    Result: reply contains QUEUED_TEXT, not "save_match_result";
//            enqueueServerMatch called once with { jobId, userId, provider,
//            model }.
//    Source: design.md C5 handleUpdateJob bullet (Req 4.2).
//
// 2. "a note from buildMatchOffer passes through unchanged when the setting
//     is on"
//    Pre:   descriptionChanged: true, buildMatchOffer returns a note,
//           setting on with a model.
//    Test:  handleUpdateJob(input, userId).
//    Result: reply contains the note text; getUserAiSettings was called
//            (proves the setting was actually read); enqueueServerMatch
//            never called.
//    Source: design.md C4 Order step 3 (Req 4.6).
//
// 3. "a directive-worthy update with no configured model gets the no-model
//     note"
//    Pre:   descriptionChanged: true, buildMatchOffer returns a directive,
//           setting on, model undefined.
//    Test:  handleUpdateJob(input, userId).
//    Result: reply contains NO_MODEL_TEXT; enqueueServerMatch never called.
//    Source: design.md C4 Order step 4 (Req 4.7).
//
// 4. "an unchanged description never reaches the setting, whatever its
//     value" (D13 regression guard, Req 4.8 invariant)
//    Pre:   descriptionChanged: false, setting on.
//    Test:  handleUpdateJob(input, userId).
//    Result: reply stays the base message; getUserAiSettings and
//            enqueueServerMatch are never called.
//    Source: design.md D13 — the unchanged-description path returns before
//            resolveMatchReply is ever called.
describe("handleUpdateJob server-side match setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
  });

  it("queues a match with no directive when the setting is on", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: description.",
    });
    (buildMatchOffer as any).mockResolvedValue({
      kind: "directive",
      text: "DIRECTIVE calling save_match_result",
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", jobDescription: "x".repeat(50) } as any,
      "user-1",
    );
    const text = result.content[0].text;

    expect(text).toContain("Job job-1 updated");
    expect(text).toContain(QUEUED_TEXT);
    expect(text).not.toContain("save_match_result");
    expect(enqueueServerMatch).toHaveBeenCalledTimes(1);
    expect(enqueueServerMatch).toHaveBeenCalledWith({
      jobId: "job-1",
      userId: "user-1",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });
  });

  it("passes a note from buildMatchOffer through unchanged when the setting is on", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: true,
      descriptionCompleteness: "title-only",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: description.",
    });
    (buildMatchOffer as any).mockResolvedValue({
      kind: "note",
      text: "NOTE TEXT",
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", jobDescription: "x".repeat(50) } as any,
      "user-1",
    );

    expect(getUserAiSettings).toHaveBeenCalledWith("user-1");
    expect(result.content[0].text).toContain("NOTE TEXT");
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("replies with the no-model note when the setting is on but no model is configured", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: description.",
    });
    (buildMatchOffer as any).mockResolvedValue({
      kind: "directive",
      text: "DIRECTIVE calling save_match_result",
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: undefined,
      serverSideMatch: true,
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", jobDescription: "x".repeat(50) } as any,
      "user-1",
    );

    expect(result.content[0].text).toContain(NO_MODEL_TEXT);
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("never reaches the setting when the description was not touched", async () => {
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-1",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-1 updated. Fields changed: statusId.",
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleUpdateJob(
      { jobId: "job-1", status: "applied" } as any,
      "user-1",
    );

    expect(result.content[0].text).toBe("Job job-1 updated. Fields changed: statusId.");
    expect(enqueueServerMatch).not.toHaveBeenCalled();
    expect(getUserAiSettings).not.toHaveBeenCalled();
  });
});
