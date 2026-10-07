import { z } from "zod";
import {
  APP_CONSTANTS,
  DISCOVERY_STATUS_VALUES,
  JOB_STATUS_VALUES,
  MCP_JOB_ORIGINS,
  MCP_JOB_SORT_FIELDS,
  MCP_JOB_SORT_ORDERS,
} from "@/lib/constants";
import { WORKPLACE_TYPES, matchEnumEntry } from "@/models/job.model";

// An enum rather than a described string, for the same reason status is one:
// a small local model fills an enum-constrained slot and ignores prose hints.
// It sent "On-site" — the posting's own spelling — and when that was rejected
// it dropped the field entirely, losing a value the posting stated. The
// preprocess folds case and separators through matchEnumEntry, so "On-site",
// "on site" and "REMOTE" all still validate for existing MCP callers.
// Verified this keeps the JSON-schema `enum: [...]` the model and the MCP SDK
// read. Shared by both shapes because they resolve through the same resolver.
const workplaceTypeField = z
  .preprocess(
    (v) => (typeof v === "string" ? (matchEnumEntry(WORKPLACE_TYPES, v)?.[1] ?? v) : v),
    z.enum(WORKPLACE_TYPES),
  )
  .optional()
  .describe(`Work arrangement stated in the posting. One of: ${Object.values(WORKPLACE_TYPES).join(", ")}.`);

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpAddJobInputShape = {
  company: z.string().min(1, "company is required"),
  jobTitle: z.string().min(1, "jobTitle is required"),
  jobDescription: z.string()
    .refine((val) => val === "N/A" || val.length >= 10, "jobDescription must be at least 10 characters")
    .describe("The complete job posting text, copied in full — do not summarize, shorten, or paraphrase it. Markdown-formatted is supported; plain text also works. Use 'N/A' only if no description is available at all."),
  location: z.string().optional().describe("City, province/state, country, or 'Remote' — e.g. 'Calgary, AB'. Do not include a street address."),
  source: z.string().optional().describe("Job board or site the listing came from, e.g. 'LinkedIn', 'Indeed', 'company website'. If not stated explicitly, infer it from the job posting's URL/domain when possible instead of leaving it blank."),
  jobType: z.string().optional().describe("Employment type: 'Full-time', 'Part-time', or 'Contract'"),
  workplaceType: workplaceTypeField,
  // Lowercased before the enum check so a caller sending "Applied"/"Draft"
  // (capitalized, like the old free-text field silently tolerated via
  // resolveJobStatus's case-insensitive DB lookup) still validates instead
  // of being newly rejected by this stricter enum. Verified this preserves
  // the JSON-schema `enum: [...]` the MCP SDK exposes in tools/list (zod v4's
  // pipe-aware conversion keeps the target enum on the input side too) — it
  // is NOT just cosmetic.
  status: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toLowerCase() : v),
      z.enum(JOB_STATUS_VALUES),
    )
    .optional()
    .describe(
      `Application status. One of: ${JOB_STATUS_VALUES.join(", ")}. Defaults to '${APP_CONSTANTS.MCP_DEFAULT_STATUS}'.`,
    ),
  dueDate: z.string().datetime({ offset: true }).optional().describe("Application deadline as an ISO-8601 datetime string. Defaults to 3 days from now if omitted."),
  applied: z.boolean().optional().describe("Set true if you have already submitted the application"),
  appliedDate: z.string().datetime({ offset: true }).optional().describe("Date the application was submitted as an ISO-8601 datetime string"),
  jobUrl: z.string().url().optional().describe("Direct URL to the job posting"),
  salaryRange: z.string().optional().describe("Salary range as a free-form string, e.g. '$120k–$150k' or '100,000 CAD'"),
  tags: z.array(z.string()).optional().describe("Skills required for the job (max 10 applied, extras are dropped). Tags are created if they don't exist. e.g. ['React', 'TypeScript', 'Node.js']"),
  allowDuplicate: z
    .boolean()
    .optional()
    .describe(
      "Force-create even if a matching job already exists. Prefer upsert:true for re-runs of the same search; use this only for a genuinely different posting.",
    ),
  upsert: z
    .boolean()
    .optional()
    .describe(
      "If this posting is already saved, update it with the fields supplied here instead of reporting a duplicate. A posting counts as already saved when it matches on URL, or on company+title within the dedupe window — so this works for postings with no URL at all. Set this on every re-run of a saved or scheduled search, whether or not you have a URL.",
    ),
};

// Full schema with transforms for parsing raw MCP input in the handler
export const McpAddJobSchema = z.object({
  ...McpAddJobInputShape,
  dueDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  appliedDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type McpAddJobInput = z.infer<typeof McpAddJobSchema>;

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpAddQuestionInputShape = {
  question: z.string()
    .min(APP_CONSTANTS.MIN_QUESTION_LENGTH, `question must be at least ${APP_CONSTANTS.MIN_QUESTION_LENGTH} characters`)
    .max(APP_CONSTANTS.MAX_QUESTION_LENGTH, `question cannot exceed ${APP_CONSTANTS.MAX_QUESTION_LENGTH} characters`),
  answer: z.string()
    .min(APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH, `answer must be at least ${APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH} characters`)
    .max(APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH, `answer cannot exceed ${APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH} characters`)
    .describe("Markdown-formatted answer/notes (required). Plain text also works."),
  tags: z.array(z.string()).optional()
    .describe("Skill/topic tags (max 10 applied, extras dropped). Created if they don't exist."),
};

export const McpAddQuestionSchema = z.object(McpAddQuestionInputShape);
export type McpAddQuestionInput = z.infer<typeof McpAddQuestionSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpSaveMatchResultInputShape = {
  jobId: z.string().min(1).describe("The id of the job, as given in the match directive."),
  resumeId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The id of the resume this match was scored against, exactly as given in the match directive. Omit only if the directive had none.",
    ),
  matchText: z.string().min(20).describe(
    "Your full match analysis: a leading 'SCORES: match=<0-100> recommendation=<strong|good|partial|weak>' line, then a markdown body.",
  ),
};

export const McpSaveMatchResultSchema = z.object(McpSaveMatchResultInputShape);
export type McpSaveMatchResultInput = z.infer<typeof McpSaveMatchResultSchema>;

// No arguments — always reviews the caller's default resume.
export const McpReviewResumeInputShape = {};

export const McpReviewResumeSchema = z.object(McpReviewResumeInputShape);
export type McpReviewResumeInput = z.infer<typeof McpReviewResumeSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpSaveResumeReviewInputShape = {
  resumeId: z
    .string()
    .min(1)
    .describe(
      "The id of the resume this review was produced for, exactly as given in the review_resume directive.",
    ),
  reviewText: z.string().min(20).describe(
    "Your full resume review: a leading 'SCORES: overall=<0-100> impact=<0-100> clarity=<0-100> ats=<0-100>' line, then a markdown body.",
  ),
};

export const McpSaveResumeReviewSchema = z.object(
  McpSaveResumeReviewInputShape,
);
export type McpSaveResumeReviewInput = z.infer<
  typeof McpSaveResumeReviewSchema
>;

// find_job — URL is the only lookup key; it's the one identifier an agent
// reliably has from a job board, and it's what add_job dedupes on.
export const McpFindJobInputShape = {
  jobUrl: z
    .string()
    .url()
    .describe(
      "Direct URL to the job posting. Matched against saved jobs using the same canonical key as add_job's duplicate detection, so tracking parameters and host casing don't matter.",
    ),
};

export const McpFindJobSchema = z.object(McpFindJobInputShape);
export type McpFindJobInput = z.infer<typeof McpFindJobSchema>;

// get_job — id is the only key. Agents get ids from list_jobs, search_jobs,
// find_job or add_job; a URL lookup stays with find_job.
export const McpGetJobInputShape = {
  jobId: z
    .string()
    .min(1, "jobId is required")
    .describe(
      "The id of a saved job, as returned by list_jobs, search_jobs, find_job or add_job. If you only have a posting URL, call find_job instead.",
    ),
};

export const McpGetJobSchema = z.object(McpGetJobInputShape);
export type McpGetJobInput = z.infer<typeof McpGetJobSchema>;

// list_jobs — every field optional; filters AND together. Dates are ISO-8601
// on the wire and Date objects after parsing, like add_job's.
const isoDate = (what: string) =>
  z.string().datetime({ offset: true }).optional().describe(`${what}, ISO-8601 datetime.`);

export const McpListJobsInputShape = {
  status: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toLowerCase() : v),
      z.enum(JOB_STATUS_VALUES),
    )
    .optional()
    .describe(`Only jobs in this status. One of: ${JOB_STATUS_VALUES.join(", ")}.`),
  company: z.string().min(1).optional().describe("Substring of the company name (case-insensitive for ASCII)."),
  location: z.string().min(1).optional().describe("Substring of the location label, e.g. 'Netherlands' or 'Remote'."),
  applied: z.boolean().optional().describe("true = only jobs you have applied to; false = only jobs you have not."),
  tag: z.string().min(1).optional().describe("Substring of a tag label."),
  createdVia: z.string().min(1).optional().describe("Substring of the MCP token name that created the job. For agent-vs-app, use origin instead."),
  origin: z
    .enum(MCP_JOB_ORIGINS)
    .optional()
    .describe("Who added the job: mcp (any MCP token), chat (in-app agent chat), automation (found by a board scan), app (entered by hand in the web app)."),
  discoveryStatus: z
    .enum(DISCOVERY_STATUS_VALUES)
    .optional()
    .describe(`Board-scan state: ${DISCOVERY_STATUS_VALUES.join(", ")}. Dismissed discoveries are hidden unless you pass this.`),
  matchScoreMin: z.number().int().min(0).max(100).optional().describe("Lowest match score to include (0-100). Unscored jobs are excluded."),
  matchScoreMax: z.number().int().min(0).max(100).optional().describe("Highest match score to include (0-100)."),
  createdFrom: isoDate("Saved on or after"),
  createdTo: isoDate("Saved on or before"),
  appliedFrom: isoDate("Applied on or after"),
  appliedTo: isoDate("Applied on or before"),
  dueFrom: isoDate("Due on or after"),
  dueTo: isoDate("Due on or before"),
  sortBy: z
    .enum(MCP_JOB_SORT_FIELDS)
    .optional()
    .describe("Date to sort by: created (default), applied or due. Jobs missing that date come last when descending and first when ascending."),
  sortOrder: z.enum(MCP_JOB_SORT_ORDERS).optional().describe("desc (default, newest first) or asc."),
  limit: z.number().int().min(1).max(100).optional().describe("Rows per page, 1-100. Default 25."),
  cursor: z.string().min(1).optional().describe("Cursor from the previous page's footer. Pass the same filters and sort with it."),
};

const toDate = (v: string | undefined) => (v ? new Date(v) : undefined);

export const McpListJobsSchema = z.object({
  ...McpListJobsInputShape,
  createdFrom: McpListJobsInputShape.createdFrom.transform(toDate),
  createdTo: McpListJobsInputShape.createdTo.transform(toDate),
  appliedFrom: McpListJobsInputShape.appliedFrom.transform(toDate),
  appliedTo: McpListJobsInputShape.appliedTo.transform(toDate),
  dueFrom: McpListJobsInputShape.dueFrom.transform(toDate),
  dueTo: McpListJobsInputShape.dueTo.transform(toDate),
});
export type McpListJobsInput = z.infer<typeof McpListJobsSchema>;

// search_jobs — list_jobs plus a required free-text query. query comes first
// so it leads the advertised schema.
export const McpSearchJobsInputShape = {
  query: z
    .string()
    .min(1, "query is required")
    .describe("Words to find in a job's title, company, description or notes (case-insensitive for ASCII). Not a URL — use find_job for that."),
  ...McpListJobsInputShape,
};

export const McpSearchJobsSchema = McpListJobsSchema.extend({
  query: McpSearchJobsInputShape.query,
});
export type McpSearchJobsInput = z.infer<typeof McpSearchJobsSchema>;

// update_job — every field except jobId is optional; only supplied fields
// change. Mirrors add_job's field names exactly.
export const McpUpdateJobInputShape = {
  jobId: z
    .string()
    .min(1)
    .describe(
      "The id of the job to update, as returned by add_job, find_job, list_jobs, search_jobs or get_job.",
    ),
  company: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  jobDescription: z
    .string()
    .min(10)
    .optional()
    .describe(
      "The complete job posting text, copied in full — do not summarize. Supplying this re-classifies the job's description completeness and, if it is now substantive enough, a fresh match analysis is requested.",
    ),
  location: z.string().optional(),
  source: z.string().optional(),
  jobType: z.string().optional().describe("Employment type: 'Full-time', 'Part-time', or 'Contract'"),
  workplaceType: workplaceTypeField,
  // Same lowercase-preprocess treatment as add_job's status (Task 1) — the
  // SDK validates against this exact shape, so the case-insensitivity has to
  // live here too, not just on the transformed McpUpdateJobSchema.
  status: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toLowerCase() : v),
      z.enum(JOB_STATUS_VALUES),
    )
    .optional()
    .describe(`Application status. One of: ${JOB_STATUS_VALUES.join(", ")}.`),
  dueDate: z.string().datetime({ offset: true }).optional(),
  applied: z.boolean().optional(),
  appliedDate: z.string().datetime({ offset: true }).optional(),
  jobUrl: z.string().url().optional(),
  salaryRange: z.string().optional(),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "Skills required for the job, e.g. ['React', 'TypeScript']. Replaces the job's existing tags wholesale rather than merging, so include the tags returned by find_job that should be kept (max 10 applied).",
    ),
};

export const McpUpdateJobSchema = z.object({
  ...McpUpdateJobInputShape,
  dueDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  appliedDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type McpUpdateJobInput = z.infer<typeof McpUpdateJobSchema>;

// Batch wrappers — the per-item shapes are reused verbatim so the batch and
// single-item tools can never drift apart.
export const McpAddJobsBatchInputShape = {
  jobs: z
    .array(z.object(McpAddJobInputShape))
    .min(1)
    .max(APP_CONSTANTS.MCP_BATCH_MAX_ITEMS)
    .describe(
      `Up to ${APP_CONSTANTS.MCP_BATCH_MAX_ITEMS} jobs, each with the same fields as add_job. Processed in order; each item consumes one unit of the MCP rate-limit budget.`,
    ),
};

export const McpAddJobsBatchSchema = z.object({
  jobs: z.array(McpAddJobSchema).min(1).max(APP_CONSTANTS.MCP_BATCH_MAX_ITEMS),
});
export type McpAddJobsBatchInput = z.infer<typeof McpAddJobsBatchSchema>;

export const McpSaveMatchResultsBatchInputShape = {
  results: z
    .array(z.object(McpSaveMatchResultInputShape))
    .min(1)
    .max(APP_CONSTANTS.MCP_BATCH_MAX_ITEMS)
    .describe(
      `Up to ${APP_CONSTANTS.MCP_BATCH_MAX_ITEMS} match analyses, each with the same fields as save_match_result.`,
    ),
};

export const McpSaveMatchResultsBatchSchema = z.object({
  results: z
    .array(McpSaveMatchResultSchema)
    .min(1)
    .max(APP_CONSTANTS.MCP_BATCH_MAX_ITEMS),
});
export type McpSaveMatchResultsBatchInput = z.infer<
  typeof McpSaveMatchResultsBatchSchema
>;
