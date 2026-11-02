// Contract: Req 1.2/1.3/1.5/2.4 — the automation match and the on-demand
// analysis each send providerOptions.deepseek.thinking.type "disabled" and no
// other provider-options key, whatever the stored model (Req 2.3 regression
// guard: a stored deepseek-reasoner reaches getModel unchanged).
import { matchJobToResume } from "@/lib/scraper/automation-run/match";
import { analyzeDiscoveredJob } from "@/actions/automation/analyze";
import { MATCH_PROVIDER_OPTIONS } from "@/lib/ai/matchProviderOptions";
import { AiProvider } from "@/models/ai.model";
import db from "@/lib/db";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: (...args: unknown[]) => generateText(...(args as [])) };
});

const getModel = vi.fn();
const preprocessResume = vi.fn();
const preprocessJob = vi.fn();
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    getModel: (...args: unknown[]) => getModel(...(args as [])),
    preprocessResume: (...args: unknown[]) => preprocessResume(...(args as [])),
    preprocessJob: (...args: unknown[]) => preprocessJob(...(args as [])),
  };
});

vi.mock("@/lib/scraper/automation-run/resumeText", () => ({
  convertResumeForMatch: vi.fn().mockResolvedValue("RESUME TEXT"),
}));

vi.mock("@/lib/db", () => ({
  default: {
    job: { findFirst: vi.fn(), update: vi.fn() },
    userSettings: { findUnique: vi.fn() },
  },
}));
const requireUser = vi.fn();
vi.mock("@/actions/shared", () => ({ requireUser: (...args: unknown[]) => requireUser(...(args as [])) }));
const getResumeById = vi.fn();
vi.mock("@/actions/profile.actions", () => ({ getResumeById: (...args: unknown[]) => getResumeById(...(args as [])) }));
const getJobDetails = vi.fn();
vi.mock("@/actions/job.actions", () => ({ getJobDetails: (...args: unknown[]) => getJobDetails(...(args as [])) }));
vi.mock("@/lib/automation-logger", () => ({
  automationLogger: { isRunning: vi.fn().mockReturnValue(false) },
}));

const mockDb = db as any;

const MATCH_TEXT = "SCORES: match=72 recommendation=good\n\nBody text.";

function generated() {
  return { text: MATCH_TEXT, finishReason: "stop", totalUsage: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  generateText.mockResolvedValue(generated());
  getModel.mockResolvedValue({ id: "fake-model" });
});

describe("matchJobToResume providerOptions", () => {
  const job = {
    title: "Backend Engineer",
    company: "Acme",
    location: "Remote",
    description: "Build things",
    url: "https://example.com/job/1",
  } as any;
  const resume = { ResumeSections: [] } as any;

  it("sends deepseek.thinking.type disabled with no other provider key (Req 1.2, 1.3, 1.5)", async () => {
    await matchJobToResume(
      job,
      resume,
      "linkedin" as any,
      { provider: AiProvider.OLLAMA, model: "llama3.2" },
      "user-1",
    );
    const call = generateText.mock.calls[0][0];
    expect(call.providerOptions.deepseek.thinking.type).toBe("disabled");
    expect(Object.keys(call.providerOptions)).toEqual(["deepseek"]);
  });

  it("sends a stored deepseek-reasoner to getModel unchanged, with thinking disabled (Req 2.3, 2.4)", async () => {
    await matchJobToResume(
      job,
      resume,
      "linkedin" as any,
      { provider: AiProvider.DEEPSEEK, model: "deepseek-reasoner" },
      "user-1",
    );
    expect(getModel).toHaveBeenCalledWith(AiProvider.DEEPSEEK, "deepseek-reasoner", "user-1");
    const call = generateText.mock.calls[0][0];
    expect(call.providerOptions).toEqual(MATCH_PROVIDER_OPTIONS);
  });
});

describe("analyzeDiscoveredJob providerOptions", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ id: "user-1" });
    mockDb.job.findFirst.mockResolvedValue({
      id: "job-1",
      automationId: "auto-1",
      matchData: null,
      automation: { resumeId: "resume-1" },
    });
    mockDb.userSettings.findUnique.mockResolvedValue(null);
    mockDb.job.update.mockResolvedValue({});
    getResumeById.mockResolvedValue({ data: { id: "resume-1", title: "My Resume" }, success: true });
    getJobDetails.mockResolvedValue({ job: { id: "job-1", title: "Backend Engineer" }, success: true });
    preprocessResume.mockResolvedValue({ success: true, data: { normalizedText: "RESUME" } });
    preprocessJob.mockResolvedValue({ success: true, data: { normalizedText: "JOB" } });
  });

  it("sends deepseek.thinking.type disabled with no other provider key (Req 1.2, 1.3, 1.5)", async () => {
    await analyzeDiscoveredJob("job-1");
    const call = generateText.mock.calls[0][0];
    expect(call.providerOptions.deepseek.thinking.type).toBe("disabled");
    expect(Object.keys(call.providerOptions)).toEqual(["deepseek"]);
  });
});
