import type { McpListJobsInput } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { renderJobPage, runJobQuery } from "@/lib/mcp/jobQuery";

export async function handleListJobs(
  input: McpListJobsInput,
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // One call is one request whatever the page size: the budget guards call
  // volume, and a 100-row page costs the server no more than a 25-row one.
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [{ type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` }],
    };
  }

  try {
    const result = await runJobQuery(userId, input);
    if (!result.ok) {
      return { content: [{ type: "text", text: result.error }] };
    }
    return { content: [{ type: "text", text: renderJobPage(result, "list_jobs") }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
