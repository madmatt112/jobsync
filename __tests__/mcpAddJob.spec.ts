import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { createJobFromNames } from "@/lib/jobs/createJobFromNames";
import { updateJobFromNames } from "@/lib/jobs/updateJobFromNames";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { enqueueServerMatch } from "@/lib/mcp/serverMatch/queue";
import { QUEUED_TEXT, SKIPPED_TEXT, NO_MODEL_TEXT } from "@/lib/mcp/serverMatch/offer";
import { AiProvider } from "@/models/ai.model";
import { McpAddJobSchema, McpAddJobsBatchSchema } from "@/models/mcp.schema";

vi.mock("@/lib/jobs/createJobFromNames", () => ({
  createJobFromNames: vi.fn(),
}));

vi.mock("@/lib/jobs/updateJobFromNames", () => ({
  updateJobFromNames: vi.fn(),
}));

vi.mock("@/lib/agent/jobLookup", () => ({
  resolveJobForAgent: vi.fn(),
}));

vi.mock("@/lib/agent/resumeLookup", () => ({
  resolveResumeForAgent: vi.fn(),
}));

vi.mock("@/lib/ai/tools/preprocessing-job", () => ({
  preprocessJob: vi.fn(),
}));

vi.mock("@/lib/ai/tools/preprocessing", () => ({
  preprocessResume: vi.fn(),
}));

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

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
const fullDescription = words(200);
const partialDescription = words(60);
const stubDescription = "Frontend Developer, $120k, Remote.";

const baseInput = {
  company: "Acme",
  jobTitle: "Engineer",
  jobDescription: fullDescription,
};

function mockCreated(completeness: string) {
  (createJobFromNames as any).mockResolvedValue({
    created: true,
    jobId: "job-1",
    resolutions: [],
    descriptionCompleteness: completeness,
    message: "Created Acme; Created Engineer. Job created (id: job-1).",
  });
}

function mockUsableResume() {
  (resolveJobForAgent as any).mockResolvedValue({
    status: "ok",
    job: { id: "job-1", resumeId: null },
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
}

describe("handleAddJob match gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
  });

  it("issues the full directive for a full description with a usable resume", async () => {
    mockCreated("full");
    mockUsableResume();

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain("Job created (id: job-1)");
    expect(text).toContain("NORMALIZED RESUME TEXT");
    expect(text).toContain("save_match_result");
    expect(text).toContain(
      "SCORES: match=<0-100> recommendation=<strong|good|partial|weak>",
    );
    expect(text).toContain("## Summary");
    expect(text).toContain("## Requirements");
    expect(text).toContain("## Skills");
    expect(text).toContain("## Deal Breakers");
    expect(text).toContain('"resumeId": "resume-1"');
    expect(text).not.toContain("PARTIAL DESCRIPTION WARNING");
  });

  it("passes dueDate to createJobFromNames unchanged, leaving an omitted one to its default", async () => {
    mockCreated("full");
    mockUsableResume();
    const dueDate = new Date("2030-02-01T00:00:00Z");

    await handleAddJob({ ...baseInput, dueDate } as any, "user-1", "my-token");
    await handleAddJob(baseInput as any, "user-1", "my-token");

    const calls = (createJobFromNames as any).mock.calls;
    expect(calls[0][0].dueDate).toBe(dueDate);
    expect(calls[1][0].dueDate).toBeUndefined();
  });

  it("issues a directive WITH a provisional warning for a partial description", async () => {
    mockCreated("partial");
    mockUsableResume();

    const result = await handleAddJob(
      { ...baseInput, jobDescription: partialDescription } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain("save_match_result");
    expect(text).toContain("PARTIAL DESCRIPTION WARNING");
    expect(text).toContain("update_job");
  });

  it("refuses to offer a match for a title-only description", async () => {
    mockCreated("title-only");

    const result = await handleAddJob(
      { ...baseInput, jobDescription: stubDescription } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain("Job created (id: job-1)");
    expect(text).toContain("too thin to score");
    expect(text).toContain("update_job");
    expect(text).not.toContain("save_match_result");
    expect(resolveResumeForAgent).not.toHaveBeenCalled();
  });

  it("notes a missing default resume and still reports the job as created", async () => {
    mockCreated("full");
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-1", resumeId: null },
    });
    (resolveResumeForAgent as any).mockResolvedValue({ status: "no_resumes" });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain("Job created (id: job-1)");
    expect(text).toContain("No default resume set");
    expect(text).not.toContain("save_match_result");
  });

  it("notes an unusable default resume", async () => {
    mockCreated("full");
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
      data: { normalizedText: "NORMALIZED JOB TEXT", metadata: {}, isValid: true },
    });
    (preprocessResume as any).mockResolvedValue({ success: false });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain("couldn't be used for matching");
    expect(text).not.toContain("save_match_result");
  });

  it("returns the duplicate message with no match offer", async () => {
    (createJobFromNames as any).mockResolvedValue({
      created: false,
      duplicateOf: { id: "job-9", title: "Engineer", company: "Acme" },
      resolutions: [],
      message: 'Duplicate detected — existing job "Engineer" at "Acme" (id: job-9).',
    });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain("Duplicate detected");
    expect(text).not.toContain("save_match_result");
    expect(resolveResumeForAgent).not.toHaveBeenCalled();
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 5000 });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(createJobFromNames).not.toHaveBeenCalled();
  });
});

describe("handleAddJob upsert routing", () => {
  const duplicateResult = {
    created: false,
    duplicateOf: { id: "job-9", title: "Engineer", company: "Acme" },
    resolutions: [],
    message: 'Duplicate detected — existing job "Engineer" at "Acme" (id: job-9).',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-9", resumeId: null },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "NORMALIZED JOB TEXT", metadata: {}, isValid: true },
    });
  });

  it("updates the existing job instead of duplicating when upsert is true", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated. Fields changed: description.",
    });
    mockUsableResume();

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(updateJobFromNames).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-9", jobDescription: fullDescription }),
      "user-1",
    );
    expect(text).toContain("Job job-9 updated");
    expect(text).toContain("save_match_result");
    expect(text).not.toContain("Duplicate detected");
  });

  it("does not pass add-only fields through to the update", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated.",
    });

    await handleAddJob(
      { ...baseInput, upsert: true, allowDuplicate: false } as any,
      "user-1",
      "my-token",
    );

    const passed = (updateJobFromNames as any).mock.calls[0][0];
    expect(passed).not.toHaveProperty("upsert");
    expect(passed).not.toHaveProperty("allowDuplicate");
    expect(passed).not.toHaveProperty("createdVia");
  });

  it("reports the duplicate normally when upsert is not set", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(updateJobFromNames).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("Duplicate detected");
  });

  it("patches the duplicate when it is an owned job the caller didn't add through MCP", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: false,
      descriptionCompleteness: null,
      resolutions: [],
      message: "Job job-9 updated.",
    });

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );

    expect(result.content[0].text).toContain("Job job-9 updated.");
    expect(result.content[0].text).not.toContain("not eligible");
  });
});

// Contract (design C4/C5, Req 4.1, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3):
//
// 1. "a directive-worthy add queues a match with no directive when the
//     setting is on"
//    Pre:   setting on with a provider and model, full description, usable
//           resume (the offer would be a directive).
//    Test:  handleAddJob(input, userId, tokenName).
//    Result: reply contains QUEUED_TEXT, not "SYSTEM PROMPT:" or
//            "save_match_result"; enqueueServerMatch called once with
//            { jobId, userId, provider, model }.
//    Source: design.md C4 Order step 5 / C5 handleAddJob bullet.
//
// 2. "a title-only add keeps its note when the setting is on"
//    Pre:   setting on, title-only description (offer would be a note).
//    Test:  handleAddJob(input, userId, tokenName).
//    Result: reply keeps the thin-description note; getUserAiSettings was
//            called (proves the setting was actually read); enqueueServerMatch
//            never called.
//    Source: design.md C4 Order step 3 (Req 4.6).
//
// 3. "a directive-worthy add with no configured model gets the no-model note"
//    Pre:   setting on, model undefined, full description, usable resume.
//    Test:  handleAddJob(input, userId, tokenName).
//    Result: reply contains NO_MODEL_TEXT; enqueueServerMatch never called.
//    Source: design.md C4 Order step 4 (Req 4.7).
//
// 4. "skipMatch gives the skipped text and no enqueue, whatever the setting"
//    Pre:   setting off, then setting on; skipMatch: true on a directive-
//           worthy add.
//    Test:  handleAddJob(input, userId, tokenName).
//    Result: reply contains SKIPPED_TEXT, not "save_match_result";
//            enqueueServerMatch never called.
//    Source: design.md C4 Order step 1 (Req 8.2, 8.3).
describe("handleAddJob server-side match setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
  });

  it("queues a match with no directive when the setting is on and the offer would be a directive", async () => {
    mockCreated("full");
    mockUsableResume();
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain(QUEUED_TEXT);
    expect(text).not.toContain("SYSTEM PROMPT:");
    expect(text).not.toContain("save_match_result");
    expect(enqueueServerMatch).toHaveBeenCalledTimes(1);
    expect(enqueueServerMatch).toHaveBeenCalledWith({
      jobId: "job-1",
      userId: "user-1",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });
  });

  it("keeps the thin-description note when the setting is on", async () => {
    mockCreated("title-only");
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(
      { ...baseInput, jobDescription: stubDescription } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(getUserAiSettings).toHaveBeenCalledWith("user-1");
    expect(text).toContain("too thin to score");
    expect(text).not.toContain(QUEUED_TEXT);
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("replies with the no-model note when the setting is on but no model is configured", async () => {
    mockCreated("full");
    mockUsableResume();
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: undefined,
      serverSideMatch: true,
    });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");
    const text = result.content[0].text;

    expect(text).toContain(NO_MODEL_TEXT);
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("skipMatch gives the skipped text and no enqueue even when the setting is off", async () => {
    mockCreated("full");
    mockUsableResume();

    const result = await handleAddJob(
      { ...baseInput, skipMatch: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain(SKIPPED_TEXT);
    expect(text).not.toContain("save_match_result");
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("skipMatch gives the skipped text and no enqueue when the setting is on", async () => {
    mockCreated("full");
    mockUsableResume();
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(
      { ...baseInput, skipMatch: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain(SKIPPED_TEXT);
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });
});

// Contract (design C4/C5, Req 4.1, 4.3, 4.8, 8.5; D13):
//
// 1. "an upsert description update queues a match with no directive when the
//     setting is on"
//    Pre:   a duplicate routed to upsert, descriptionChanged: true, setting
//           on with a model, usable resume.
//    Test:  handleAddJob({ ...input, upsert: true }, userId, tokenName).
//    Result: reply contains QUEUED_TEXT, not "save_match_result";
//            enqueueServerMatch called once with the job-9 task.
//    Source: design.md C5 upsertExisting bullet (Req 4.3).
//
// 2. "skipMatch on an upsert description update gives the skipped text and
//     no enqueue"
//    Pre:   same upsert routing, skipMatch: true.
//    Test:  handleAddJob({ ...input, upsert: true, skipMatch: true }, ...).
//    Result: reply contains SKIPPED_TEXT; enqueueServerMatch never called.
//    Source: design.md C5 upsertExisting bullet (Req 8.5).
//
// 3. "a duplicate without upsert never reaches the setting, whatever its
//     value" (D13 regression guard, Req 4.8 invariant)
//    Pre:   setting on; no upsert flag.
//    Test:  handleAddJob(input, userId, tokenName).
//    Result: reply stays "Duplicate detected..."; getUserAiSettings and
//            enqueueServerMatch are never called.
//    Source: design.md D13 — the duplicate-without-upsert path returns
//            before resolveMatchReply is ever called.
//
// 4. "an unchanged description on upsert never reaches the setting, whatever
//     its value" (D13 regression guard, Req 4.8 invariant)
//    Pre:   setting on; upsert routes to an update with descriptionChanged:
//           false.
//    Test:  handleAddJob({ ...input, upsert: true }, userId, tokenName).
//    Result: reply stays the base update message; getUserAiSettings and
//            enqueueServerMatch are never called.
//    Source: design.md D13 — the unchanged-description path returns before
//            resolveMatchReply is ever called.
describe("handleAddJob upsert routing with the server-side match setting", () => {
  const duplicateResult = {
    created: false,
    duplicateOf: { id: "job-9", title: "Engineer", company: "Acme" },
    resolutions: [],
    message: 'Duplicate detected — existing job "Engineer" at "Acme" (id: job-9).',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.OLLAMA,
      model: undefined,
      serverSideMatch: false,
    });
    (resolveJobForAgent as any).mockResolvedValue({
      status: "ok",
      job: { id: "job-9", resumeId: null },
    });
    (preprocessJob as any).mockResolvedValue({
      success: true,
      data: { normalizedText: "NORMALIZED JOB TEXT", metadata: {}, isValid: true },
    });
  });

  it("queues a match for an upsert description update when the setting is on", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated. Fields changed: description.",
    });
    mockUsableResume();
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain("Job job-9 updated");
    expect(text).toContain(QUEUED_TEXT);
    expect(text).not.toContain("save_match_result");
    expect(enqueueServerMatch).toHaveBeenCalledTimes(1);
    expect(enqueueServerMatch).toHaveBeenCalledWith({
      jobId: "job-9",
      userId: "user-1",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });
  });

  it("skipMatch on an upsert description update gives the skipped text and no enqueue", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: true,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated. Fields changed: description.",
    });
    mockUsableResume();

    const result = await handleAddJob(
      { ...baseInput, upsert: true, skipMatch: true } as any,
      "user-1",
      "my-token",
    );
    const text = result.content[0].text;

    expect(text).toContain(SKIPPED_TEXT);
    expect(enqueueServerMatch).not.toHaveBeenCalled();
  });

  it("never reaches the setting for a duplicate reported without upsert", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(baseInput as any, "user-1", "my-token");

    expect(result.content[0].text).toContain("Duplicate detected");
    expect(enqueueServerMatch).not.toHaveBeenCalled();
    expect(getUserAiSettings).not.toHaveBeenCalled();
  });

  it("never reaches the setting for an unchanged description on upsert", async () => {
    (createJobFromNames as any).mockResolvedValue(duplicateResult);
    (updateJobFromNames as any).mockResolvedValue({
      updated: true,
      jobId: "job-9",
      descriptionChanged: false,
      descriptionCompleteness: "full",
      resolutions: [],
      message: "Job job-9 updated.",
    });
    (getUserAiSettings as any).mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });

    const result = await handleAddJob(
      { ...baseInput, upsert: true } as any,
      "user-1",
      "my-token",
    );

    expect(result.content[0].text).toBe("Job job-9 updated.");
    expect(enqueueServerMatch).not.toHaveBeenCalled();
    expect(getUserAiSettings).not.toHaveBeenCalled();
  });
});

// Contract (design C5 McpAddJobInputShape bullet, Req 8.1):
//
// 1. "McpAddJobSchema keeps skipMatch on a single add_job parse"
//    Pre:   a valid add_job payload with skipMatch: true.
//    Test:  McpAddJobSchema.safeParse(payload).
//    Result: parse succeeds and data.skipMatch is true.
//    Source: design.md C5 — "McpAddJobInputShape ... gains skipMatch ...
//            McpAddJobSchema ... inherit it."
//
// 2. "McpAddJobsBatchSchema keeps skipMatch on each batch item parse"
//    Pre:   a batch of one valid job with skipMatch: true.
//    Test:  McpAddJobsBatchSchema.safeParse({ jobs: [payload] }).
//    Result: parse succeeds and data.jobs[0].skipMatch is true.
//    Source: design.md C5 — "the batch item ... inherit it."
describe("McpAddJobSchema skipMatch", () => {
  it("keeps skipMatch on a single add_job parse", () => {
    const result = McpAddJobSchema.safeParse({ ...baseInput, skipMatch: true });

    expect(result.success).toBe(true);
    expect((result as any).data.skipMatch).toBe(true);
  });

  it("keeps skipMatch on each add_jobs_batch item parse", () => {
    const result = McpAddJobsBatchSchema.safeParse({
      jobs: [{ ...baseInput, skipMatch: true }],
    });

    expect(result.success).toBe(true);
    expect((result as any).data.jobs[0].skipMatch).toBe(true);
  });
});
