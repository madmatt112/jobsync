// Contract (design Architecture diagram, C4-C6/C8, Req 4.11):
//
// 1. "the MCP reply returns the queued text before the generation starts,
//     and the save happens only after the reply has already resolved"
//    Pre:   the setting on with a model, a directive-worthy add
//           (createJobFromNames, the job/resume lookups and preprocessing
//           all stubbed to succeed), getModel stubbed to a
//           MockLanguageModelV3 that returns a scored reply.
//    Call:  handleAddJob(input, userId, tokenName) — through the real
//           resolveMatchReply, the real queue, and the real runServerMatch
//           — then await whenServerMatchIdle().
//    Result: handleAddJob's own promise resolves with the queued text
//            before writeJobMatch is ever called; writeJobMatch is called
//            exactly once once the queue drains.
//    Source: design.md C8 "enqueueServerMatch ... is synchronous and
//            returns before any await" and Architecture diagram
//            (H -> R -> Q, Q -> ... -> W); requirements.md Req 4.11.

import { MockLanguageModelV3 } from "ai/test";
import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { createJobFromNames } from "@/lib/jobs/createJobFromNames";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { writeJobMatch } from "@/lib/jobs/writeJobMatch";
import { getModel } from "@/lib/ai/providers";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { whenServerMatchIdle, resetServerMatchQueue } from "@/lib/mcp/serverMatch/queue";
import { QUEUED_TEXT } from "@/lib/mcp/serverMatch/offer";
import { AiProvider } from "@/models/ai.model";

vi.mock("@/lib/jobs/createJobFromNames", () => ({
  createJobFromNames: vi.fn(),
}));
vi.mock("@/lib/agent/jobLookup", () => ({ resolveJobForAgent: vi.fn() }));
vi.mock("@/lib/agent/resumeLookup", () => ({ resolveResumeForAgent: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing-job", () => ({ preprocessJob: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing", () => ({ preprocessResume: vi.fn() }));
vi.mock("@/lib/jobs/writeJobMatch", () => ({ writeJobMatch: vi.fn() }));
vi.mock("@/lib/ai/providers", () => ({ getModel: vi.fn() }));

vi.mock("@/lib/scraper/automation-run/aiSettings", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/scraper/automation-run/aiSettings")
  >("@/lib/scraper/automation-run/aiSettings");
  return { ...actual, getUserAiSettings: vi.fn() };
});

const MATCH_TEXT =
  "SCORES: match=81 recommendation=good\n\n## Summary\n\nGood overlap.";

function mockModel() {
  return new MockLanguageModelV3({
    doGenerate: (async () => ({
      content: [{ type: "text", text: MATCH_TEXT }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10 },
        outputTokens: { total: 5, text: 5 },
        totalTokens: 15,
      },
    })) as any,
  });
}

describe("server-side match flow: handleAddJob through the real queue to the real run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServerMatchQueue();

    (createJobFromNames as any).mockResolvedValue({
      created: true,
      jobId: "job-flow-1",
      resolutions: [],
      descriptionCompleteness: "full",
      message: "Created Acme; Created Engineer. Job created (id: job-flow-1).",
    });
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: {
        id: "job-flow-1",
        resumeId: null,
        descriptionCompleteness: "full",
      },
    });
    (resolveResumeForAgent as any).mockResolvedValue({
      status: "ok",
      resume: { id: "resume-1", title: "My Resume" },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "NORMALIZED JOB TEXT", metadata: {}, isValid: true },
    });
    (preprocessResume as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "NORMALIZED RESUME TEXT", metadata: {}, isValid: true },
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });
    (getModel as any).mockResolvedValue(mockModel());
    (writeJobMatch as any).mockResolvedValue(undefined);
  });

  it("returns the queued reply before the generation starts, then saves the match once the queue drains", async () => {
    const order: string[] = [];
    (writeJobMatch as any).mockImplementation(async () => {
      order.push("write");
    });

    const result = await handleAddJob(
      {
        company: "Acme",
        jobTitle: "Engineer",
        jobDescription: Array.from({ length: 200 }, () => "word").join(" "),
      } as any,
      "flow-user-1",
      "my-token",
    );
    order.push("reply-resolved");

    expect(result.content[0].text).toContain(QUEUED_TEXT);

    await whenServerMatchIdle();

    expect(writeJobMatch).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["reply-resolved", "write"]);
  });
});
