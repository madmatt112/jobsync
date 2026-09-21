import { handleListJobs } from "@/lib/mcp/tools/listJobs";
import { decodeCursor, encodeCursor, fingerprint } from "@/lib/mcp/jobQuery";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = { job: { findMany: vi.fn(), count: vi.fn() } };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const DISMISSED_CLAUSE = {
  OR: [{ discoveryStatus: null }, { discoveryStatus: { not: "dismissed" } }],
};

let seq = 0;
function row(overrides: Record<string, any> = {}) {
  seq++;
  return {
    id: `job-${String(seq).padStart(3, "0")}`,
    createdAt: new Date(Date.UTC(2026, 8, 1, 12, 0, seq)),
    appliedDate: null,
    dueDate: null,
    matchScore: null,
    matchData: null,
    createdVia: null,
    automationId: null,
    JobTitle: { label: "Engineer" },
    Company: { label: "Acme" },
    Status: { value: "draft" },
    Location: null,
    JobSource: null,
    ...overrides,
  };
}

function rows(n: number, overrides: Record<string, any> = {}) {
  return Array.from({ length: n }, () => row(overrides));
}

// Both the where passed to findMany and the one passed to count.
function whereOf(call: number = 0) {
  return (prisma.job.findMany as any).mock.calls[call][0].where;
}

async function list(input: Record<string, any> = {}, data = rows(1), total = data.length) {
  (prisma.job.findMany as any).mockResolvedValue(data);
  (prisma.job.count as any).mockResolvedValue(total);
  return (await handleListJobs(input as any, "user-1")).content[0].text;
}

describe("handleListJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seq = 0;
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("lists newest first with the caller's userId and the dismissed default", async () => {
    const text = await list({}, rows(2), 2);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", AND: [DISMISSED_CLAUSE] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 26,
      }),
    );
    expect(prisma.job.count).toHaveBeenCalledWith({
      where: { userId: "user-1", AND: [DISMISSED_CLAUSE] },
    });
    expect(text).toContain("2 matched now, showing rows 1-2, sorted by created desc.");
    expect(text).not.toContain("Next page");
  });

  it("renders one line per job with every column", async () => {
    const text = await list(
      {},
      [
        row({
          id: "job-abc",
          appliedDate: new Date("2026-09-03T00:00:00Z"),
          dueDate: new Date("2026-09-30T00:00:00Z"),
          matchScore: 78,
          matchData: JSON.stringify({ analyzed: true }),
          createdVia: "claude-desktop",
          Status: { value: "applied" },
          Location: { label: "Calgary" },
          JobSource: { label: "LinkedIn" },
        }),
      ],
    );

    expect(text.split("\n")[1]).toBe(
      "job-abc | Engineer @ Acme | applied | applied 2026-09-03 | due 2026-09-30 | Calgary | via LinkedIn | match 78% | mcp (claude-desktop)",
    );
  });

  it("keeps a job on one line: newlines collapse, pipes become slashes, long values truncate", async () => {
    const text = await list(
      {},
      [row({ JobTitle: { label: "Senior\nEngineer | Lead" }, Company: { label: "A".repeat(100) } })],
    );
    const line = text.split("\n")[1];

    expect(line).toContain("Senior Engineer / Lead @ " + "A".repeat(79) + "…");
    expect(text.split("\n")).toHaveLength(2);
  });

  it("says so when nothing matches", async () => {
    expect(await list({ status: "offer" }, [], 0)).toBe("No jobs match.");
  });

  describe("filters", () => {
    it("status, company, location, applied, tag and createdVia", async () => {
      await list({
        status: "applied",
        company: "acme",
        location: "nether",
        applied: false,
        tag: "react",
        createdVia: "desk",
      });

      expect(whereOf()).toEqual(
        expect.objectContaining({
          Status: { value: "applied" },
          Company: { label: { contains: "acme" } },
          Location: { label: { contains: "nether" } },
          applied: false,
          tags: { some: { label: { contains: "react" } } },
          createdVia: { contains: "desk" },
        }),
      );
    });

    it.each([
      ["chat", { createdVia: "chat" }],
      ["mcp", { AND: [{ createdVia: { not: null } }, { createdVia: { not: "chat" } }] }],
      ["automation", { automationId: { not: null } }],
      ["app", { createdVia: null, automationId: null }],
    ])("origin=%s", async (origin, clause) => {
      await list({ origin });
      expect(whereOf().AND).toEqual(expect.arrayContaining([clause]));
    });

    it("discoveryStatus replaces the dismissed default instead of stacking on it", async () => {
      await list({ discoveryStatus: "dismissed" });

      expect(whereOf().discoveryStatus).toBe("dismissed");
      expect(whereOf().AND).not.toEqual(expect.arrayContaining([DISMISSED_CLAUSE]));
    });

    it("date ranges on created, applied and due", async () => {
      const from = new Date("2026-09-01T00:00:00Z");
      const to = new Date("2026-09-30T00:00:00Z");
      await list({ createdFrom: from, appliedTo: to, dueFrom: from, dueTo: to });

      expect(whereOf()).toEqual(
        expect.objectContaining({
          createdAt: { gte: from },
          appliedDate: { lte: to },
          dueDate: { gte: from, lte: to },
        }),
      );
    });

    it("a score range also excludes rows whose score the app hides", async () => {
      await list({ matchScoreMin: 70, matchScoreMax: 90 });

      expect(whereOf().matchScore).toEqual({ gte: 70, lte: 90 });
      expect(whereOf().AND).toEqual(
        expect.arrayContaining([
          { OR: [{ matchData: null }, { NOT: { matchData: { contains: '"analyzed":false' } } }] },
        ]),
      );
      // The marker must match how the automation writes it (JSON.stringify, no spaces).
      expect(JSON.stringify({ prerankScore: 3, analyzed: false })).toContain('"analyzed":false');
    });

    it("hides an unanalyzed score in the row even when it is stored", async () => {
      const text = await list(
        {},
        [row({ matchScore: 55, matchData: JSON.stringify({ analyzed: false }), automationId: "a1" })],
      );

      expect(text).toContain("| match - | automation");
      expect(text).not.toContain("55");
    });
  });

  describe("sorting and paging", () => {
    it("sorts by the chosen date with id as the tiebreaker", async () => {
      await list({ sortBy: "due", sortOrder: "asc", limit: 10 });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: 11 }),
      );
    });

    it("issues a cursor when a page overflows, and continues after the last shown row", async () => {
      const data = rows(26);
      const text = await list({}, data, 40);

      expect(text).toContain("40 matched now, showing rows 1-25");
      expect(text.split("\n")).toHaveLength(27);
      const cursor = text.match(/cursor "([^"]+)"/)![1];
      const last = data[24];
      expect(decodeCursor(cursor)).toEqual({
        v: last.createdAt.toISOString(),
        id: last.id,
        s: "created",
        o: "desc",
        f: fingerprint({}),
        n: 26,
      });

      vi.clearAllMocks();
      const page2 = await list({ cursor }, rows(3), 40);

      // createdAt is non-nullable: no null arm, or Prisma rejects the filter.
      expect(whereOf().AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { createdAt: { lt: last.createdAt } },
              { createdAt: last.createdAt, id: { lt: last.id } },
            ],
          },
        ]),
      );
      // The count is over the base filters, not the keyset remainder.
      expect((prisma.job.count as any).mock.calls[0][0].where.AND).toEqual([DISMISSED_CLAUSE]);
      expect(page2).toContain("showing rows 26-28");
    });

    it("continues descending from a dated row into the null run on a nullable column", async () => {
      const v = new Date("2026-09-05T00:00:00Z");
      const cursor = encodeCursor({
        v: v.toISOString(),
        id: "job-010",
        s: "applied",
        o: "desc",
        f: fingerprint({}),
        n: 26,
      });
      await list({ sortBy: "applied", cursor }, rows(2), 30);

      expect(whereOf().AND).toEqual(
        expect.arrayContaining([
          { OR: [{ appliedDate: { lt: v } }, { appliedDate: v, id: { lt: "job-010" } }, { appliedDate: null }] },
        ]),
      );
    });

    it("walks into and through the null run when sorting descending", async () => {
      // Page 1 ends on a row with no applied date: the cursor carries v: null.
      const data = rows(26);
      const text = await list({ sortBy: "applied" }, data, 30);
      const cursor = text.match(/cursor "([^"]+)"/)![1];
      expect(decodeCursor(cursor)!.v).toBeNull();

      vi.clearAllMocks();
      await list({ sortBy: "applied", cursor }, rows(4), 30);

      expect(whereOf().AND).toEqual(
        expect.arrayContaining([{ AND: [{ appliedDate: null }, { id: { lt: data[24].id } }] }]),
      );
    });

    it("walks out of the null run when sorting ascending", async () => {
      const cursor = encodeCursor({
        v: null,
        id: "job-010",
        s: "applied",
        o: "asc",
        f: fingerprint({}),
        n: 26,
      });
      await list({ sortBy: "applied", sortOrder: "asc", cursor }, rows(2), 30);

      expect(whereOf().AND).toEqual(
        expect.arrayContaining([
          { OR: [{ appliedDate: null, id: { gt: "job-010" } }, { appliedDate: { not: null } }] },
        ]),
      );
    });

    it("continues ascending from a dated row", async () => {
      const v = new Date("2026-09-05T00:00:00Z");
      const cursor = encodeCursor({
        v: v.toISOString(),
        id: "job-010",
        s: "due",
        o: "asc",
        f: fingerprint({}),
        n: 26,
      });
      await list({ sortBy: "due", sortOrder: "asc", cursor }, rows(2), 30);

      expect(whereOf().AND).toEqual(
        expect.arrayContaining([
          { OR: [{ dueDate: { gt: v } }, { dueDate: v, id: { gt: "job-010" } }] },
        ]),
      );
    });

    it("rejects a cursor issued under different filters, sort, or garbage", async () => {
      const cursor = encodeCursor({
        v: null,
        id: "job-001",
        s: "created",
        o: "desc",
        f: fingerprint({ status: "applied" }),
        n: 26,
      });

      for (const input of [
        { cursor, status: "rejected" },
        { cursor, status: "applied", sortOrder: "asc" },
        { cursor: "not-a-cursor" },
      ]) {
        vi.clearAllMocks();
        const text = await list(input);
        expect(text).toContain("Re-run the query without a cursor");
        expect(prisma.job.findMany).not.toHaveBeenCalled();
      }

      vi.clearAllMocks();
      expect(await list({ cursor, status: "Applied" })).not.toContain("Re-run");
    });

    it("lets the page size change mid-walk", async () => {
      const cursor = encodeCursor({
        v: null,
        id: "job-001",
        s: "created",
        o: "desc",
        f: fingerprint({}),
        n: 26,
      });
      await list({ cursor, limit: 50 }, rows(2), 60);

      expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
    });
  });

  it("returns a Prisma failure as text", async () => {
    (prisma.job.findMany as any).mockRejectedValue(new Error("db down"));
    (prisma.job.count as any).mockResolvedValue(0);

    const result = await handleListJobs({} as any, "user-1");

    expect(result.content[0].text).toBe("Error: db down");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 3000 });

    const result = await handleListJobs({} as any, "user-1");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });
});
