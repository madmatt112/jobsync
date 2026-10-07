import { handleSaveCoverLetter } from "@/lib/mcp/tools/saveCoverLetter";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { JOB_NOT_FOUND_MESSAGE } from "@/lib/jobs/updateJobFromNames";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient: any = {
    job: { findFirst: vi.fn(), update: vi.fn() },
    profile: { findFirst: vi.fn(), create: vi.fn() },
    coverLetter: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mPrismaClient.$transaction.mockImplementation((fn: any) => fn(mPrismaClient));
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const letterText = "A full cover letter body here.";

describe("handleSaveCoverLetter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
    (prisma as any).$transaction.mockImplementation((fn: any) => fn(prisma));
    (prisma.job.findFirst as any).mockResolvedValue({
      JobTitle: { label: "Engineer" },
      Company: { label: "Acme" },
    });
    (prisma.profile.findFirst as any).mockResolvedValue({ id: "profile-1" });
    (prisma.profile.create as any).mockResolvedValue({ id: "profile-1" });
    (prisma.coverLetter.findMany as any).mockResolvedValue([]);
    (prisma.coverLetter.create as any).mockResolvedValue({
      id: "letter-1",
      title: "Engineer - Acme",
    });
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  // R4 AC1 / R2-3 transaction shape: letter create happens before the repoint.
  it("creates the letter before repointing the job", async () => {
    const order: string[] = [];
    (prisma.coverLetter.create as any).mockImplementation(async () => {
      order.push("letter.create");
      return { id: "letter-1", title: "Engineer - Acme" };
    });
    (prisma.job.update as any).mockImplementation(async () => {
      order.push("job.update");
      return { id: "job-1" };
    });

    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-1");

    expect(order).toEqual(["letter.create", "job.update"]);
  });

  // R4 AC5 — no-profile path: profile create runs first, then the letter uses its id.
  it("creates a profile first when the caller has none, and the new letter uses its id", async () => {
    (prisma.profile.findFirst as any).mockResolvedValue(null);
    (prisma.profile.create as any).mockResolvedValue({ id: "new-profile-1" });

    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-1");

    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
    });
    const profileCreateOrder = (prisma.profile.create as any).mock.invocationCallOrder[0];
    const letterCreateOrder = (prisma.coverLetter.create as any).mock.invocationCallOrder[0];
    expect(profileCreateOrder).toBeLessThan(letterCreateOrder);
    const letterCall = (prisma.coverLetter.create as any).mock.calls[0][0];
    expect(letterCall.data.profileId).toBe("new-profile-1");
  });

  // R4 AC3 / R5 AC2 — title from buildCoverLetterTitle, uniquified on collision.
  it("builds the title from buildCoverLetterTitle, suffixing on a collision", async () => {
    (prisma.coverLetter.findMany as any).mockResolvedValue([
      { title: "Engineer - Acme" },
    ]);

    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-1");

    const letterCall = (prisma.coverLetter.create as any).mock.calls[0][0];
    expect(letterCall.data.title).toBe("Engineer - Acme (2)");
  });

  // R4 AC2 — rendered with the same renderer settings; raw HTML is escaped.
  it("escapes raw HTML in the rendered, stored content", async () => {
    const raw = "Dear hiring manager, <script>alert(1)</script> I am excited.";

    await handleSaveCoverLetter({ jobId: "job-1", text: raw }, "user-1");

    const letterCall = (prisma.coverLetter.create as any).mock.calls[0][0];
    expect(letterCall.data.content).not.toContain("<script>");
    expect(letterCall.data.content).toContain("&lt;script&gt;");
  });

  // R4 AC4 / D10 — trim-then-compare runs after the rate-limit unit is taken.
  it("returns the pinned validation text for under-10 trimmed characters, after taking the rate-limit unit", async () => {
    const result = await handleSaveCoverLetter(
      { jobId: "job-1", text: "  123456789  " },
      "user-1",
    );

    expect(checkMcpRateLimit).toHaveBeenCalledWith("user-1");
    expect(result.content[0].text).toBe(
      "Validation error: text must be at least 10 characters after trimming.",
    );
    expect(prisma.coverLetter.create).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  // R6 AC2 — rate limit refusal returns the shared text and writes nothing.
  it("returns the rate-limit text and writes nothing when the limit is exhausted", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 5000 });

    const result = await handleSaveCoverLetter(
      { jobId: "job-1", text: letterText },
      "user-1",
    );

    expect(result.content[0].text).toBe("Rate limit exceeded. Try again in 5s.");
    expect(prisma.coverLetter.create).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  // R4 AC8 — a missing/unowned job returns the shared constant, with no letter written.
  it("returns the not-found constant and writes no letter when the job doesn't exist or isn't owned", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);

    const result = await handleSaveCoverLetter(
      { jobId: "missing-job", text: letterText },
      "user-1",
    );

    expect(result.content[0].text).toBe(JOB_NOT_FOUND_MESSAGE);
    expect(prisma.coverLetter.create).not.toHaveBeenCalled();
  });

  // R4 AC8 — a P2025 on the repoint also returns the shared constant.
  it("returns the not-found constant on a P2025 repoint failure", async () => {
    (prisma.job.update as any).mockRejectedValue({ code: "P2025" });

    const result = await handleSaveCoverLetter(
      { jobId: "job-1", text: letterText },
      "user-1",
    );

    expect(result.content[0].text).toBe(JOB_NOT_FOUND_MESSAGE);
  });

  // R6 AC3 — every read and write carries the caller's userId.
  it("scopes every job, profile and cover-letter query to the caller's userId", async () => {
    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-42");

    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-42" } }),
    );
    expect(prisma.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-42" } }),
    );
    expect(prisma.coverLetter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profile: { userId: "user-42" } } }),
    );
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-42" } }),
    );
  });

  // R5 AC1 / AC4 — redraft never touches the earlier row; two saves make two rows.
  it("stores two versions for two saves of the same text, never updating or deleting a letter", async () => {
    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-1");
    await handleSaveCoverLetter({ jobId: "job-1", text: letterText }, "user-1");

    expect(prisma.coverLetter.create).toHaveBeenCalledTimes(2);
    expect(prisma.coverLetter.update).not.toHaveBeenCalled();
    expect(prisma.coverLetter.delete).not.toHaveBeenCalled();
  });

  // R4 AC6 — success reply names the job id, the letter title and its id.
  it("returns the success line naming the job id, title and letter id", async () => {
    (prisma.coverLetter.create as any).mockResolvedValue({
      id: "letter-99",
      title: "Engineer - Acme",
    });

    const result = await handleSaveCoverLetter(
      { jobId: "job-1", text: letterText },
      "user-1",
    );

    expect(result.content[0].text).toBe(
      'Cover letter saved for job job-1: "Engineer - Acme" (id: letter-99).',
    );
  });

  // R6 AC4 — an unexpected error is returned as text, never thrown.
  it("returns an unexpected error as text instead of throwing", async () => {
    (prisma.job.findFirst as any).mockRejectedValue(new Error("db exploded"));

    const result = await handleSaveCoverLetter(
      { jobId: "job-1", text: letterText },
      "user-1",
    );

    expect(result.content[0].text).toBe("Error: db exploded");
  });
});
