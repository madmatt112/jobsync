import { MockLanguageModelV3 } from "ai/test";
import { PrismaClient } from "@prisma/client";
import { runServerMatch, type ServerMatchTask } from "@/lib/mcp/serverMatch/run";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { writeJobMatch } from "@/lib/jobs/writeJobMatch";
import { getModel } from "@/lib/ai/providers";
import { log } from "@/lib/telemetry";
import { APP_CONSTANTS } from "@/lib/constants";
import { TEMPERATURES } from "@/lib/ai/config";
import {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "@/lib/ai/prompts/job-match";
import { MATCH_PROVIDER_OPTIONS } from "@/lib/ai/matchProviderOptions";
import { parseJobMatch } from "@/lib/ai/jobMatch/parse";
import { AiProvider } from "@/models/ai.model";

// Same seams __tests__/mcpAddJob.spec.ts:10-32 mocks for the lookup and
// preprocessing pair, plus the write, the provider resolver and Prisma for
// recordServerMatchFailure's updateMany (design C6 "Fail" paragraph).
vi.mock("@/lib/agent/jobLookup", () => ({ resolveJobForAgent: vi.fn() }));
vi.mock("@/lib/agent/resumeLookup", () => ({ resolveResumeForAgent: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing", () => ({ preprocessResume: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing-job", () => ({ preprocessJob: vi.fn() }));
vi.mock("@/lib/jobs/writeJobMatch", () => ({ writeJobMatch: vi.fn() }));
vi.mock("@/lib/ai/providers", () => ({ getModel: vi.fn() }));

vi.mock("@prisma/client", () => {
  const mPrismaClient = { job: { updateMany: vi.fn() } };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

const prisma = new PrismaClient();
const updateMany = prisma.job.updateMany as unknown as ReturnType<typeof vi.fn>;

const findJob = resolveJobForAgent as unknown as ReturnType<typeof vi.fn>;
const findResume = resolveResumeForAgent as unknown as ReturnType<typeof vi.fn>;
const preResume = preprocessResume as unknown as ReturnType<typeof vi.fn>;
const preJob = preprocessJob as unknown as ReturnType<typeof vi.fn>;
const write = writeJobMatch as unknown as ReturnType<typeof vi.fn>;
const resolveModel = getModel as unknown as ReturnType<typeof vi.fn>;

const task: ServerMatchTask = {
  jobId: "job-1",
  userId: "user-1",
  provider: AiProvider.DEEPSEEK,
  model: "deepseek-flash",
};

const JOB = {
  id: "job-1",
  resumeId: "resume-1",
  descriptionCompleteness: "partial",
  JobTitle: { label: "Senior Backend Engineer" },
  Company: { label: "Northwind Cloud" },
};

const RESUME = { id: "resume-1", title: "Senior Engineer Resume" };

const RESUME_TEXT = "R".repeat(300);
const JOB_TEXT = "Job Title: Senior Backend Engineer\nCompany: Northwind Cloud";

const usage = {
  inputTokens: { total: 10, noCache: 10 },
  outputTokens: { total: 5, text: 5 },
  totalTokens: 15,
} as any;

const MATCH_TEXT =
  "SCORES: match=72 recommendation=good\n\n## Summary\n\nStrong backend overlap.";

function modelReturning(result: unknown) {
  return new MockLanguageModelV3({
    doGenerate: (async () => result) as any,
  });
}

function modelThrowing(error: unknown) {
  return new MockLanguageModelV3({
    doGenerate: (async () => {
      throw error;
    }) as any,
  });
}

// A real provider either returns in time or respects the abort signal; it
// never settles on its own. This rejects only when the caller's abortSignal
// fires, so the SDK's own retry-on-timeout path is exercised honestly.
function neverResolvingModel() {
  return new MockLanguageModelV3({
    doGenerate: ((options: { abortSignal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        options.abortSignal?.addEventListener("abort", () => {
          reject(options.abortSignal!.reason);
        });
      })) as any,
  });
}

describe("runServerMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(log, "error").mockImplementation(() => {});
    findJob.mockResolvedValue({ status: "ok", job: JOB });
    findResume.mockResolvedValue({
      status: "ok",
      resume: RESUME,
      source: "page",
      ambiguousTitle: false,
    });
    preResume.mockResolvedValue({
      success: true,
      data: { normalizedText: RESUME_TEXT, metadata: {}, isValid: true },
    });
    preJob.mockResolvedValue({
      success: true,
      data: { normalizedText: JOB_TEXT, metadata: {}, isValid: true },
    });
    resolveModel.mockResolvedValue(
      modelReturning({
        content: [{ type: "text", text: MATCH_TEXT }],
        finishReason: "stop",
        usage,
      }),
    );
    write.mockResolvedValue(undefined);
    updateMany.mockResolvedValue({ count: 1 });
  });

  // Contract: pre-condition — the lookups, preprocessing and generation all
  // succeed with a scored reply; call — runServerMatch(task); observable
  // result — the model's doGenerateCalls[0] carries the shared system prompt,
  // the built user prompt, TEMPERATURES.FEEDBACK and both provider options;
  // expected value source — design C6 step 5 (Req 5.3, 1.4).
  it("sends the shared prompt, FEEDBACK temperature and both provider options", async () => {
    const model = modelReturning({
      content: [{ type: "text", text: MATCH_TEXT }],
      finishReason: "stop",
      usage,
    });
    resolveModel.mockResolvedValue(model);

    await runServerMatch(task);

    expect(model.doGenerateCalls).toHaveLength(1);
    const call = model.doGenerateCalls[0] as any;
    expect(call.prompt[0]).toMatchObject({
      role: "system",
      content: JOB_MATCH_SYSTEM_PROMPT,
    });
    expect(call.prompt[1].content[0].text).toBe(
      buildJobMatchPrompt(RESUME_TEXT, JOB_TEXT),
    );
    expect(call.temperature).toBe(TEMPERATURES.FEEDBACK);
    expect(call.providerOptions).toEqual({
      ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } },
      ...MATCH_PROVIDER_OPTIONS,
    });
  });

  // Contract: pre-condition — the task carries the token's own userId and the
  // job's id; call — runServerMatch(task); observable result —
  // resolveJobForAgent is invoked with exactly those two values, scoping the
  // load to the token's user and reading the job fresh at run time; expected
  // value source — design C6 step 1 and the Security NFR (Req 5.2).
  it("loads the job scoped to the task's userId and jobId at run time", async () => {
    await runServerMatch(task);

    expect(findJob).toHaveBeenCalledWith(task.userId, task.jobId);
  });

  // Contract: pre-condition — a scored reply parses with parseJobMatch; call
  // — runServerMatch(task); observable result — writeJobMatch receives the
  // matchData shape from design Data Models, with surface "server"; expected
  // value source — design Data Models / C6 step 7 (Req 5.6).
  it("saves matchData with every design field and surface \"server\"", async () => {
    const result = await runServerMatch(task);

    expect(result).toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
    const [userId, jobId, matchScore, matchDataJson] = write.mock.calls[0];
    expect(userId).toBe(task.userId);
    expect(jobId).toBe(task.jobId);

    const { scores, body } = parseJobMatch(MATCH_TEXT);
    const matchData = JSON.parse(matchDataJson);
    expect(matchScore).toBe(scores!.matchScore);
    expect(matchData).toMatchObject({
      matchScore: scores!.matchScore,
      recommendation: scores!.recommendation,
      body,
      resumeId: RESUME.id,
      resumeTitle: RESUME.title,
      provider: task.provider,
      model: task.model,
      surface: APP_CONSTANTS.SERVER_MATCH_SURFACE,
      analyzed: true,
      descriptionCompleteness: JOB.descriptionCompleteness,
    });
    expect(matchData.surface).toBe("server");
    expect(() => new Date(matchData.matchedAt).toISOString()).not.toThrow();
  });

  // Each case below drives one closed-set failure reason (design C6 "Reasons
  // (exact, closed set)") and checks the shared Fail paragraph's three
  // effects once: the failure columns are written through updateMany scoped
  // to { id, userId }, one error line is logged, and writeJobMatch is never
  // reached (Req 7.2, 7.3).
  describe.each([
    {
      name: "no resume can be resolved",
      arrange: () => findResume.mockResolvedValue({ status: "no_resumes" }),
      reason:
        "No resume could be resolved — set a default resume in Profile → Resumes.",
    },
    {
      name: "the job no longer preprocesses",
      arrange: () =>
        preJob.mockResolvedValue({
          success: false,
          error: { code: "TOO_SHORT", message: "too short" },
        }),
      reason: "The job description could not be prepared for matching.",
    },
    {
      name: "the resume no longer preprocesses",
      arrange: () =>
        preResume.mockResolvedValue({
          success: false,
          error: { code: "TOO_SHORT", message: "too short" },
        }),
      reason: "The resume could not be prepared for matching.",
    },
    {
      name: "the generation throws",
      arrange: () =>
        resolveModel.mockResolvedValue(modelThrowing(new Error("rate limited"))),
      reason: "Provider error: rate limited",
    },
    {
      name: "the generation finishes without the stop reason",
      arrange: () =>
        resolveModel.mockResolvedValue(
          modelReturning({
            content: [{ type: "text", text: MATCH_TEXT }],
            finishReason: "length",
            usage,
          }),
        ),
      reason: "The generation stopped early (finish reason: length).",
    },
    {
      name: "the reply has no SCORES line",
      arrange: () =>
        resolveModel.mockResolvedValue(
          modelReturning({
            content: [{ type: "text", text: "no scores here" }],
            finishReason: "stop",
            usage,
          }),
        ),
      reason: "The reply had no SCORES line.",
    },
  ])("fails when $name", ({ arrange, reason }) => {
    it(`records "${reason}" on the job and logs one error line`, async () => {
      arrange();

      const result = await runServerMatch(task);

      expect(result).toBe("failed");
      expect(write).not.toHaveBeenCalled();
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: task.jobId, userId: task.userId },
        data: { serverMatchError: reason, serverMatchFailedAt: expect.any(Date) },
      });
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.error).toHaveBeenCalledWith("[server-match] match failed", {
        jobId: task.jobId,
        userId: task.userId,
        provider: task.provider,
        model: task.model,
        reason,
      });
    });
  });

  // Contract: pre-condition — the job row is already gone when the match
  // runs; call — runServerMatch(task); observable result — "dropped" with no
  // write and no failure record at all; expected value source — design C6
  // step 1 and the Fail paragraph's P2025/no-match carve-outs (Req 7.6).
  it("drops silently with no record when the job can't be loaded", async () => {
    findJob.mockResolvedValue({ status: "no_job" });

    const result = await runServerMatch(task);

    expect(result).toBe("dropped");
    expect(write).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  // Contract: pre-condition — the job is scored successfully but was deleted
  // just before the write, so writeJobMatch rejects with a Prisma P2025; call
  // — runServerMatch(task); observable result — "dropped" with no failure
  // record; expected value source — design C6 step 7 ("A Prisma P2025 from
  // the write means the job is gone → \"dropped\"", Req 7.6).
  it("drops silently with no record when the write reports the job is gone", async () => {
    const p2025 = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    });
    write.mockRejectedValue(p2025);

    const result = await runServerMatch(task);

    expect(result).toBe("dropped");
    expect(updateMany).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  // Contract: pre-condition — a failure reason fires, but the job was deleted
  // between the failure and the attempt to record it, so updateMany matches
  // no row; call — runServerMatch(task); observable result — "dropped" with
  // no error line; expected value source — design C6 Fail paragraph ("A count
  // of 0 → \"dropped\", with no record and no error line", Req 7.6).
  it("drops silently with no log line when the failure record matches no row", async () => {
    findResume.mockResolvedValue({ status: "no_resumes" });
    updateMany.mockResolvedValue({ count: 0 });

    const result = await runServerMatch(task);

    expect(result).toBe("dropped");
    expect(write).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  // Contract: pre-condition — the provider never responds; call —
  // runServerMatch(task, 5); observable result — "failed" with the timeout
  // reason computed from the given timeoutMs; expected value source — design
  // C6 Reasons ("Timed out after N s. (N = timeoutMs / 1000, used when the
  // timeout signal aborted)").
  it("returns failed with the timeout reason when the model never responds", async () => {
    resolveModel.mockResolvedValue(neverResolvingModel());

    const result = await runServerMatch(task, 5);

    expect(result).toBe("failed");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: task.jobId, userId: task.userId },
      data: {
        serverMatchError: "Timed out after 0.005 s.",
        serverMatchFailedAt: expect.any(Date),
      },
    });
  });
});
