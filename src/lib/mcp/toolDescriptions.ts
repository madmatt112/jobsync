// Tool descriptions are prompt surface, not documentation: the agent routes
// between add_job / update_job / add_jobs_batch on this text alone. Kept out
// of route.ts so evals/mcp-tools can assert against the exact strings the
// server registers instead of a copy that silently drifts.
export const MCP_TOOL_DESCRIPTIONS = {
  add_job:
    "Add a job application to JobSync. Resolves or creates company, job title, location, and source by name. Returns a transparency report of what was matched vs. created.",
  find_job:
    "Check whether one posting is already saved, by its exact URL. Call this before add_job when re-running a search. It answers 'is this URL saved?', not 'is anything like this saved?' — for that, or with no URL, use search_jobs. To add without a URL check, use add_job's upsert.",
  get_job:
    "Read one saved job in full by id: every stored field, status, company, location, source, tags, notes, stage timeline, contacts, resume and cover-letter references, and the match analysis. Read-only. Use find_job when you only have a URL.",
  list_jobs:
    "List the user's saved jobs, newest first, one compact line each, with a cursor for the next page. Filter by status, company, location, applied, tag, origin, match score or date ranges; sort by created, applied or due date. Read-only. Use this for 'what do I have', 'what's open', 'what's due' — not for looking up one posting by URL (find_job).",
  search_jobs:
    "Find saved jobs by words in their title, company, description or notes — a role you remember by name, or a repost saved under a different URL. Same filters, sort and paging as list_jobs; same one-line rows. Read-only. With the exact posting URL, use find_job instead.",
  update_job:
    "Correct or enrich a job previously added through MCP. Only the fields you supply change. Supplying a fuller jobDescription re-classifies the posting and requests a fresh match analysis — use this instead of re-adding with allowDuplicate.",
  add_question:
    "Add an entry to the Question Bank. Resolves or creates tags by name. Returns a transparency report of what was matched vs. created.",
  save_match_result:
    "Persist a job-fit match analysis (produced by you, the agent) against a job previously created with add_job. Call this after add_job hands you a match directive.",
  add_jobs_batch:
    "Add several jobs in one call. Same per-item behaviour as add_job (including upsert and the match directive); returns one labelled result per item. Use this for scheduled runs instead of N sequential add_job calls.",
  save_match_results_batch:
    "Persist several job-fit match analyses in one call. Same per-item behaviour as save_match_result; returns one labelled result per item.",
  review_resume:
    "Fetch the user's default resume so you can review it. Returns the normalized resume text plus a directive — produce the review yourself, then call save_resume_review with the result.",
  save_resume_review:
    "Persist a resume review (produced by you, the agent) against the resume previously handed to you by review_resume. Call this after review_resume hands you a review directive.",
} as const;

export type McpToolName = keyof typeof MCP_TOOL_DESCRIPTIONS;
