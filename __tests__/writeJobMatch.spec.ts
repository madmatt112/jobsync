import { writeJobMatch } from "@/lib/jobs/writeJobMatch";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Same partial mock pattern as __tests__/mcpGetJob.spec.ts:8-11 — the
// PrismaClient constructor returns one fixed mock instance.
vi.mock("@prisma/client", () => {
  const mPrismaClient = { job: { update: vi.fn() } };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

describe("writeJobMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Contract: pre-condition — a job exists for this user; call — writeJobMatch
  // scopes the write to (id, userId); observable result — prisma.job.update
  // receives where: { id, userId } and data: { matchScore, matchData } exactly;
  // expected value source — design C7 (src/lib/jobs/writeJobMatch.ts) and
  // Req 5.5.
  it("updates the job scoped by id and userId with matchScore and matchData", async () => {
    (prisma.job.update as any).mockResolvedValue({});

    await writeJobMatch("user-1", "job-1", 85, '{"matchScore":85}');

    expect(prisma.job.update).toHaveBeenCalledTimes(1);
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: { matchScore: 85, matchData: '{"matchScore":85}' },
    });
  });

  // Contract: pre-condition — the job row is gone (deleted) so the scoped
  // update matches no row; call — writeJobMatch for that job id; observable
  // result — the P2025 rejection from prisma.job.update propagates out of
  // writeJobMatch instead of being caught; expected value source — design C7
  // ("lets a P2025 throw") and Req 5.5.
  it("lets a rejected P2025 error propagate", async () => {
    const p2025 = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    });
    (prisma.job.update as any).mockRejectedValue(p2025);

    await expect(
      writeJobMatch("user-1", "job-1", 85, '{"matchScore":85}'),
    ).rejects.toBe(p2025);
  });
});
