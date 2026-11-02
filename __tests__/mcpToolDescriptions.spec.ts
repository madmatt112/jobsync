import { MCP_TOOL_DESCRIPTIONS } from "@/lib/mcp/toolDescriptions";

// Contract (per criterion):
// Req 4.12 — add_job: pre: MCP_TOOL_DESCRIPTIONS loaded. Test: read .add_job.
//   Result: contains "match directive" and "queued when server-side matching is on".
//   Source: requirements.md Req 4 criterion 12; design.md C5.
// Req 4.12 — update_job: same call/result shape against .update_job.
// Req 4.12 — add_jobs_batch: same call/result shape against .add_jobs_batch.
// Req 8.1 — add_job names skipMatch: pre/Test as above. Result: .add_job contains "skipMatch".
// Req 8.1 — add_jobs_batch names skipMatch: same against .add_jobs_batch.

describe("MCP_TOOL_DESCRIPTIONS — match directive and queued reply (Req 4.12)", () => {
  it("add_job names the directive and the queued reply", () => {
    expect(MCP_TOOL_DESCRIPTIONS.add_job).toContain("match directive");
    expect(MCP_TOOL_DESCRIPTIONS.add_job).toContain(
      "queued when server-side matching is on"
    );
  });

  it("update_job names the directive and the queued reply", () => {
    expect(MCP_TOOL_DESCRIPTIONS.update_job).toContain("match directive");
    expect(MCP_TOOL_DESCRIPTIONS.update_job).toContain(
      "queued when server-side matching is on"
    );
  });

  it("add_jobs_batch names the directive and the queued reply", () => {
    expect(MCP_TOOL_DESCRIPTIONS.add_jobs_batch).toContain("match directive");
    expect(MCP_TOOL_DESCRIPTIONS.add_jobs_batch).toContain(
      "queued when server-side matching is on"
    );
  });
});

describe("MCP_TOOL_DESCRIPTIONS — skipMatch named (Req 8.1)", () => {
  it("add_job names skipMatch", () => {
    expect(MCP_TOOL_DESCRIPTIONS.add_job).toContain("skipMatch");
  });

  it("add_jobs_batch names skipMatch", () => {
    expect(MCP_TOOL_DESCRIPTIONS.add_jobs_batch).toContain("skipMatch");
  });
});
