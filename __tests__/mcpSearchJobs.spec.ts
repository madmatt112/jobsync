import { handleSearchJobs } from "@/lib/mcp/tools/searchJobs";
import { encodeCursor, fingerprint } from "@/lib/mcp/jobQuery";
import { McpSearchJobsSchema } from "@/models/mcp.schema";
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

const queryClause = (q: string) => ({
  OR: [
    { JobTitle: { label: { contains: q } } },
    { Company: { label: { contains: q } } },
    { description: { contains: q } },
    { Notes: { some: { content: { contains: q } } } },
  ],
});

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
    JobTitle: { label: "Staff Platform Engineer" },
    Company: { label: "Northwind Cloud" },
    Status: { value: "draft" },
    Location: null,
    JobSource: null,
    ...overrides,
  };
}

function whereOf() {
  return (prisma.job.findMany as any).mock.calls[0][0].where;
}

async function search(input: Record<string, any>, data = [row()], total = data.length) {
  (prisma.job.findMany as any).mockResolvedValue(data);
  (prisma.job.count as any).mockResolvedValue(total);
  return (await handleSearchJobs(input as any, "user-1")).content[0].text;
}

describe("handleSearchJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seq = 0;
    (checkMcpRateLimit as any).mockReturnValue({ allowed: true, resetIn: 0 });
  });

  it("matches the query over title, company, description and notes, ANDed with the defaults", async () => {
    await search({ query: "platform" });

    expect(whereOf()).toEqual({
      userId: "user-1",
      AND: [DISMISSED_CLAUSE, queryClause("platform")],
    });
    expect(prisma.job.count).toHaveBeenCalledWith({
      where: { userId: "user-1", AND: [DISMISSED_CLAUSE, queryClause("platform")] },
    });
  });

  it("combines the query with the same filters list_jobs takes", async () => {
    await search({ query: "platform", status: "applied", company: "north", sortBy: "applied" });

    expect(whereOf()).toEqual(
      expect.objectContaining({
        Status: { value: "applied" },
        Company: { label: { contains: "north" } },
        AND: [DISMISSED_CLAUSE, queryClause("platform")],
      }),
    );
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ appliedDate: "desc" }, { id: "desc" }] }),
    );
  });

  it("finds a repost saved under a different URL: the URL is never part of the where", async () => {
    const text = await search({ query: "Staff Platform Engineer" }, [
      row({ id: "job-old" }),
      row({ id: "job-repost" }),
    ]);

    expect(JSON.stringify(whereOf())).not.toContain("jobUrl");
    expect(text).toContain("job-old | Staff Platform Engineer @ Northwind Cloud");
    expect(text).toContain("job-repost | Staff Platform Engineer @ Northwind Cloud");
    expect(text).toContain("2 matched now");
  });

  it("names itself in the next-page footer", async () => {
    const text = await search({ query: "engineer", limit: 1 }, [row(), row()], 2);

    expect(text).toContain("Next page: call search_jobs again");
  });

  it("refuses a cursor issued for a different query", async () => {
    const cursor = encodeCursor({
      v: null,
      id: "job-001",
      s: "created",
      o: "desc",
      f: fingerprint({ query: "platform" }),
      n: 26,
    });

    const text = await search({ query: "backend", cursor });

    expect(text).toContain("Re-run the query without a cursor");
    expect(prisma.job.findMany).not.toHaveBeenCalled();

    vi.clearAllMocks();
    expect(await search({ query: "  Platform ", cursor })).not.toContain("Re-run");
  });

  it("requires a query at the schema level", () => {
    expect(McpSearchJobsSchema.safeParse({}).success).toBe(false);
    expect(McpSearchJobsSchema.safeParse({ query: "" }).success).toBe(false);
    const parsed = McpSearchJobsSchema.safeParse({ query: "x", limit: 5, status: "Applied" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe("applied");
  });

  it("returns a Prisma failure as text", async () => {
    (prisma.job.findMany as any).mockRejectedValue(new Error("db down"));
    (prisma.job.count as any).mockResolvedValue(0);

    const result = await handleSearchJobs({ query: "x" } as any, "user-1");

    expect(result.content[0].text).toBe("Error: db down");
  });

  it("short-circuits when rate limited", async () => {
    (checkMcpRateLimit as any).mockReturnValue({ allowed: false, resetIn: 3000 });

    const result = await handleSearchJobs({ query: "x" } as any, "user-1");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });
});
