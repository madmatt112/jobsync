import { McpAddJobInputShape, McpListJobsInputShape } from "@/models/mcp.schema";
import {
  DISCOVERY_STATUS_VALUES,
  JOB_STATUS_VALUES,
  MCP_JOB_ORIGINS,
  MCP_JOB_SORT_FIELDS,
  MCP_JOB_SORT_ORDERS,
} from "@/lib/constants";

describe("McpAddJobInputShape.status", () => {
  it("exposes the valid status values as a Zod enum", () => {
    const def: any = (McpAddJobInputShape.status as any)._def;
    // Unwrap ZodOptional -> ZodPipe (the lowercase preprocess) -> ZodEnum.
    const pipeOut = def.innerType?._def?.out;
    const inner = pipeOut ?? def.innerType ?? def;
    const values = inner._def.values ?? Object.values(inner._def.entries ?? {});
    expect([...values].sort()).toEqual([...JOB_STATUS_VALUES].sort());
  });

  it("accepts a valid status and rejects an invalid one", () => {
    expect(McpAddJobInputShape.status.safeParse("applied").success).toBe(true);
    expect(McpAddJobInputShape.status.safeParse("interested").success).toBe(
      false,
    );
  });

  it("accepts a capitalized status and normalizes it to lowercase", () => {
    const result = McpAddJobInputShape.status.safeParse("Applied");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("applied");
  });

  it("includes every value in the human-readable description", () => {
    for (const v of JOB_STATUS_VALUES) {
      expect((McpAddJobInputShape.status as any).description).toContain(v);
    }
  });
});

describe("McpListJobsInputShape enums", () => {
  const values = (field: any) => {
    const def: any = field._def;
    const inner = def.innerType ?? def;
    return [...(inner._def.values ?? Object.values(inner._def.entries ?? {}))].sort();
  };

  it("exposes the sort, order, origin and discovery-status enums", () => {
    expect(values(McpListJobsInputShape.sortBy)).toEqual([...MCP_JOB_SORT_FIELDS].sort());
    expect(values(McpListJobsInputShape.sortOrder)).toEqual([...MCP_JOB_SORT_ORDERS].sort());
    expect(values(McpListJobsInputShape.origin)).toEqual([...MCP_JOB_ORIGINS].sort());
    expect(values(McpListJobsInputShape.discoveryStatus)).toEqual(
      [...DISCOVERY_STATUS_VALUES].sort(),
    );
  });

  it("reuses the job status enum with the same lowercase normalization", () => {
    const result = McpListJobsInputShape.status.safeParse("Applied");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("applied");
    expect(McpListJobsInputShape.status.safeParse("interested").success).toBe(false);
  });

  it("bounds limit to 1-100 and scores to 0-100", () => {
    expect(McpListJobsInputShape.limit.safeParse(100).success).toBe(true);
    expect(McpListJobsInputShape.limit.safeParse(101).success).toBe(false);
    expect(McpListJobsInputShape.limit.safeParse(0).success).toBe(false);
    expect(McpListJobsInputShape.matchScoreMin.safeParse(101).success).toBe(false);
  });
});
