import type { McpSearchJobsInput } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { renderJobPage, runJobQuery } from "@/lib/mcp/jobQuery";

// list_jobs with a query: the same module does the work, and the query is
// part of the cursor fingerprint so a page from one search can't be replayed
// against another.
export async function handleSearchJobs(
  input: McpSearchJobsInput,
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
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
    return { content: [{ type: "text", text: renderJobPage(result, "search_jobs") }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
