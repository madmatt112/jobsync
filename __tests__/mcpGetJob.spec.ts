import { handleGetJob } from "@/lib/mcp/tools/getJob";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { buildMatchOffer } from "@/lib/mcp/tools/matchDirective";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = { job: { findFirst: vi.fn() } };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

// Same partial-module-mock pattern as __tests__/mcpUpdateJob.spec.ts:14-17 —
// only buildMatchOffer is replaced, everything else (composeOfferMessage) is
// the real implementation so the composition itself isn't mocked away.
vi.mock("@/lib/mcp/tools/matchDirective", async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, buildMatchOffer: vi.fn() };
});

// The smallest row the include graph can return: every optional relation
// absent, every nullable scalar null.
function minimalJob(overrides: Record<string, any> = {}) {
  return {
    id: "job-1",
    userId: "user-1",
    jobUrl: null,
    description: "A short posting.",
    jobType: "Full-time",
    workplaceType: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    applied: false,
    appliedDate: null,
    dueDate: null,
    salaryRange: null,
    matchScore: null,
    matchData: null,
    discoveryStatus: null,
    discoveredAt: null,
    automationId: null,
    createdVia: null,
    descriptionCompleteness: null,
    JobTitle: { label: "Engineer" },
    Company: { label: "Acme", careersUrl: null, websiteUrl: null, industry: null },
    Status: { label: "Draft", value: "draft" },
    Location: null,
    JobSource: null,
    Resume: null,
    CoverLetter: null,
    tags: [],
    Notes: [],
    contactLinks: [],
    stages: [],
    ...overrides,
  };
}

function fullJob() {
  return minimalJob({
    jobUrl: "https://acme.example/jobs/42",
    description: "We are hiring a senior engineer to build things.",
    workplaceType: "Remote",
    applied: true,
    appliedDate: new Date("2026-09-03T00:00:00Z"),
    dueDate: new Date("2026-09-30T00:00:00Z"),
    salaryRange: "$150k-$180k",
    matchScore: 78,
    matchData: JSON.stringify({
      matchScore: 78,
      recommendation: "good",
      body: "Strong overlap on TypeScript.",
      matchedAt: "2026-09-04T12:00:00Z",
      provider: "mcp",
      model: "claude-desktop",
      analyzed: true,
    }),
    createdVia: "claude-desktop",
    descriptionCompleteness: "full",
    Company: {
      label: "Acme",
      careersUrl: "https://acme.example/careers",
      websiteUrl: null,
      industry: "Robotics",
    },
    Status: { label: "Applied", value: "applied" },
    Location: { label: "Calgary", stateProv: "AB", country: "Canada" },
    JobSource: { label: "LinkedIn" },
    Resume: { id: "res-1", title: "Main resume" },
    CoverLetter: { id: "cl-1", title: "Acme letter" },
    tags: [{ label: "TypeScript" }, { label: "React" }],
    Notes: [{ content: "Recruiter replied.", createdAt: new Date("2026-09-05T00:00:00Z") }],
    contactLinks: [
      {
        Role: { label: "Recruiter" },
        Contact: {
          id: "c-1",
          name: "Sam Lee",
          title: "Talent partner",
          email: "sam@acme.example",
          phone: null,
          linkedinUrl: null,
          Company: { label: "Acme" },
        },
      },
    ],
    stages: [
      {
        id: "st-2",
        occurredAt: new Date("2026-09-10T00:00:00Z"),
        createdAt: new Date("2026-09-06T00:00:00Z"),
        isCurrent: true,
        outcome: null,
        format: "video",
        location: null,
        durationMins: 45,
        notes: "Panel with two engineers.",
        StageType: { label: "Interview", sortOrder: 3, Status: { value: "interview" } },
        interviewers: [{ Contact: { name: "Sam Lee" } }],
        prepQuestions: [{ Question: { question: "secret" } }, { Question: { question: "also secret" } }],
      },
      {
        id: "st-1",
        occurredAt: new Date("2026-09-03T00:00:00Z"),
        createdAt: new Date("2026-09-06T00:00:00Z"),
        isCurrent: false,
        outcome: null,
        format: null,
        location: null,
        durationMins: null,
        notes: null,
        StageType: { label: "Applied", sortOrder: 2, Status: { value: "applied" } },
        interviewers: [],
        prepQuestions: [],
      },
    ],
  });
}

describe("handleGetJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("scopes the lookup to the caller", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);

    await handleGetJob({ jobId: "job-1" }, "user-1");

    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-1" } }),
    );
  });

  it("answers an unknown or unowned id with one neutral line", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);

    const result = await handleGetJob({ jobId: "someone-elses" }, "user-1");

    expect(result.content[0].text).toBe("No job with that id.");
  });

  it("renders every section on a full record", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(fullJob());

    const text = (await handleGetJob({ jobId: "job-1" }, "user-1")).content[0].text;

    expect(text).toContain("Job job-1");
    expect(text).toContain("Title: Engineer");
    expect(text).toContain("Company: Acme | careers: https://acme.example/careers | industry: Robotics");
    expect(text).toContain("Status: Applied");
    expect(text).toContain("Location: Calgary, AB, Canada");
    expect(text).toContain("Source: LinkedIn");
    expect(text).toContain("Type: Full-time · Remote");
    expect(text).toContain("URL: https://acme.example/jobs/42");
    expect(text).toContain("Salary: $150k-$180k");
    expect(text).toContain("Applied: yes, 2026-09-03");
    expect(text).toContain("Due: 2026-09-30");
    expect(text).toContain("Created: 2026-09-01");
    expect(text).toContain("Origin: mcp (claude-desktop)");
    expect(text).toContain("Description completeness: full");
    expect(text).toContain("Tags: TypeScript, React");
    expect(text).toContain("Resume: Main resume (id: res-1)");
    expect(text).toContain("Cover letter: Acme letter (id: cl-1)");
    expect(text).toContain("Score: 78% — recommendation: good, matched 2026-09-04, via mcp/claude-desktop");
    expect(text).toContain("Strong overlap on TypeScript.");
    expect(text).toContain("## Description\nWe are hiring a senior engineer");
    expect(text).toContain("## Notes (1)\n- [2026-09-05] Recruiter replied.");
    expect(text).toContain("## Contacts (1)\n- Sam Lee — Recruiter (Talent partner, Acme) — sam@acme.example");
  });

  it("orders the timeline by stage order and counts prep questions without quoting them", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(fullJob());

    const text = (await handleGetJob({ jobId: "job-1" }, "user-1")).content[0].text;

    const applied = text.indexOf("[2026-09-03] Applied");
    const interview = text.indexOf("[2026-09-10] Interview (current)");
    expect(applied).toBeGreaterThan(-1);
    expect(interview).toBeGreaterThan(applied);
    expect(text).toContain("format: video; 45 min; interviewers: Sam Lee; prep questions: 2");
    expect(text).toContain("  notes: Panel with two engineers.");
    expect(text).not.toContain("secret");
  });

  it("omits absent fields and empty sections", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(minimalJob());

    const text = (await handleGetJob({ jobId: "job-1" }, "user-1")).content[0].text;

    expect(text).toContain("Origin: app");
    expect(text).toContain("Applied: no");
    expect(text).toContain("## Match\nNot scored.");
    expect(text).not.toContain("Salary:");
    expect(text).not.toContain("Location:");
    expect(text).not.toContain("Tags:");
    expect(text).not.toContain("## Notes");
    expect(text).not.toContain("## Timeline");
    expect(text).not.toContain("## Contacts");
  });

  it("hides a score the app hides (unanalyzed automation pre-rank)", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(
      minimalJob({
        matchScore: 55,
        matchData: JSON.stringify({ prerankScore: 12, analyzed: false }),
        automationId: "auto-1",
      }),
    );

    const text = (await handleGetJob({ jobId: "job-1" }, "user-1")).content[0].text;

    expect(text).toContain("Not scored.");
    expect(text).not.toContain("55");
    expect(text).toContain("Origin: automation");
  });

  it("labels agent-chat jobs by their marker", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(minimalJob({ createdVia: "chat" }));

    const text = (await handleGetJob({ jobId: "job-1" }, "user-1")).content[0].text;

    expect(text).toContain("Origin: chat");
  });

  it("returns a Prisma failure as text", async () => {
    (prisma.job.findFirst as any).mockRejectedValue(new Error("db down"));

    const result = await handleGetJob({ jobId: "job-1" }, "user-1");

    expect(result.content[0].text).toBe("Error: db down");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 3000 });

    const result = await handleGetJob({ jobId: "job-1" }, "user-1");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  describe("matchDirective flag (R8 AC4)", () => {
    it("appends the offer builder's directive after the detail, with a blank line between", async () => {
      (prisma.job.findFirst as any).mockResolvedValue(minimalJob());
      (buildMatchOffer as any).mockResolvedValue({
        kind: "directive",
        text: "DIRECTIVE calling save_match_result",
      });

      const result = await handleGetJob(
        { jobId: "job-1", matchDirective: true } as any,
        "user-1",
      );
      const text = result.content[0].text;

      expect(text.endsWith("\n\nDIRECTIVE calling save_match_result")).toBe(true);
      expect(text).toContain("Job job-1");
      // Folded in: R8 AC4's "one rate-limit check" — this assertion already
      // holds pre-implementation (the handler checks the limit once
      // regardless of the flag), so on its own it is RED-IMPOSSIBLE; it is
      // carried here, in an otherwise-red test, rather than as its own case.
      expect(checkMcpRateLimit).toHaveBeenCalledTimes(1);
    });

    it("asks the offer builder for a rescore using the job's id, the caller and its completeness", async () => {
      (prisma.job.findFirst as any).mockResolvedValue(minimalJob({ descriptionCompleteness: "partial" }));
      (buildMatchOffer as any).mockResolvedValue({ kind: "note", text: "a note" });

      await handleGetJob({ jobId: "job-1", matchDirective: true } as any, "user-1");

      expect(buildMatchOffer).toHaveBeenCalledWith("job-1", "user-1", "partial", "rescore");
    });
  });
});
