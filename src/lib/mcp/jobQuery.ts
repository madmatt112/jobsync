import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  APP_CONSTANTS,
  DISCOVERY_STATUS_VALUES,
  MCP_JOB_ORIGINS,
  MCP_JOB_SORT_FIELDS,
  MCP_JOB_SORT_ORDERS,
} from "@/lib/constants";
import { hideUnanalyzedScore } from "@/actions/job/shared";

// Shared by list_jobs and search_jobs: the filter set -> Prisma where, keyset
// paging, and the one-line row. The app's own list (src/actions/job/queries.ts)
// is the model for every clause; the differences are deliberate and named.

export type JobSortField = (typeof MCP_JOB_SORT_FIELDS)[number];
export type JobSortOrder = (typeof MCP_JOB_SORT_ORDERS)[number];
export type JobOrigin = (typeof MCP_JOB_ORIGINS)[number];

export interface JobReadFilters {
  status?: string;
  company?: string;
  location?: string;
  applied?: boolean;
  tag?: string;
  createdVia?: string;
  origin?: JobOrigin;
  discoveryStatus?: (typeof DISCOVERY_STATUS_VALUES)[number];
  matchScoreMin?: number;
  matchScoreMax?: number;
  createdFrom?: Date;
  createdTo?: Date;
  appliedFrom?: Date;
  appliedTo?: Date;
  dueFrom?: Date;
  dueTo?: Date;
  sortBy?: JobSortField;
  sortOrder?: JobSortOrder;
}

export interface JobReadInput extends JobReadFilters {
  limit?: number;
  cursor?: string;
}

const SORT_COLUMN: Record<JobSortField, "createdAt" | "appliedDate" | "dueDate"> = {
  created: "createdAt",
  applied: "appliedDate",
  due: "dueDate",
};

// Written by JSON.stringify with no spaces (automation-run/persist.ts), so the
// substring is exact. Pinned by a unit test.
const UNANALYZED_MARKER = '"analyzed":false';

// One vocabulary for "who added this" across get_job rows and list rows. null
// createdVia covers both the web app and automation; automationId splits them.
export function originLabel(job: { createdVia: string | null; automationId: string | null }): string {
  if (job.createdVia === APP_CONSTANTS.AGENT_CHAT_CREATED_VIA) return "chat";
  if (job.createdVia != null) return `mcp (${job.createdVia})`;
  if (job.automationId != null) return "automation";
  return "app";
}

function originClause(origin: JobOrigin): Prisma.JobWhereInput {
  const chat = APP_CONSTANTS.AGENT_CHAT_CREATED_VIA;
  switch (origin) {
    case "chat":
      return { createdVia: chat };
    case "mcp":
      return { AND: [{ createdVia: { not: null } }, { createdVia: { not: chat } }] };
    case "automation":
      return { automationId: { not: null } };
    case "app":
      return { createdVia: null, automationId: null };
  }
}

// Every OR-bearing block goes into one AND array so no clause clobbers another
// (the app nests its dismissed exclusion the same way, queries.ts:124).
export function buildJobWhere(userId: string, f: JobReadFilters): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [];
  const where: Prisma.JobWhereInput = { userId, AND: and };

  if (f.status) where.Status = { value: f.status };
  // Plain contains: SQLite's LIKE already folds ASCII case, which is exactly
  // what the app's own search relies on. No `mode` — unsupported on sqlite.
  if (f.company) where.Company = { label: { contains: f.company } };
  if (f.location) where.Location = { label: { contains: f.location } };
  if (f.applied !== undefined) where.applied = f.applied;
  if (f.tag) where.tags = { some: { label: { contains: f.tag } } };
  if (f.createdVia) where.createdVia = { contains: f.createdVia };
  if (f.origin) and.push(originClause(f.origin));

  // Dismissed discoveries are hidden in the app unless asked for by status,
  // so the same rule applies here.
  if (f.discoveryStatus) {
    where.discoveryStatus = f.discoveryStatus;
  } else {
    and.push({ OR: [{ discoveryStatus: null }, { discoveryStatus: { not: "dismissed" } }] });
  }

  // A score range must not reach a score the app hides: rows flagged
  // unanalyzed carry only a keyword pre-rank, which hideUnanalyzedScore
  // suppresses after the query. Excluding them here keeps the filter from
  // leaking the value by narrowing.
  if (f.matchScoreMin !== undefined || f.matchScoreMax !== undefined) {
    where.matchScore = {
      ...(f.matchScoreMin !== undefined ? { gte: f.matchScoreMin } : {}),
      ...(f.matchScoreMax !== undefined ? { lte: f.matchScoreMax } : {}),
    };
    and.push({
      OR: [{ matchData: null }, { NOT: { matchData: { contains: UNANALYZED_MARKER } } }],
    });
  }

  const range = (from?: Date, to?: Date) =>
    from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const created = range(f.createdFrom, f.createdTo);
  const applied = range(f.appliedFrom, f.appliedTo);
  const due = range(f.dueFrom, f.dueTo);
  if (created) where.createdAt = created;
  if (applied) where.appliedDate = applied;
  if (due) where.dueDate = due;

  return where;
}

// --- cursor ---------------------------------------------------------------

interface CursorPayload {
  v: string | null; // sort value on the page's last row; null inside the null run
  id: string; // that row's id — the tiebreaker
  s: JobSortField;
  o: JobSortOrder;
  f: string; // fingerprint of the filters the cursor was issued under
  n: number; // row number of the next page's first row, for the header
}

// Effective sort is part of the payload and compared directly, so it stays out
// of the fingerprint: an explicit default and an omitted one page the same way.
// limit and cursor are excluded too, so page size may change mid-walk.
export function fingerprint(f: JobReadFilters & { query?: string }): string {
  const entries: [string, unknown][] = [];
  const norm = (v: unknown) =>
    v instanceof Date ? v.getTime() : typeof v === "string" ? v.trim().toLowerCase() : v;
  const keys: (keyof (JobReadFilters & { query?: string }))[] = [
    "status", "company", "location", "applied", "tag", "createdVia", "origin",
    "discoveryStatus", "matchScoreMin", "matchScoreMax", "createdFrom", "createdTo",
    "appliedFrom", "appliedTo", "dueFrom", "dueTo", "query",
  ];
  for (const k of [...keys].sort()) {
    if (f[k] !== undefined) entries.push([k, norm(f[k])]);
  }
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex").slice(0, 8);
}

export function encodeCursor(c: CursorPayload): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(s: string): CursorPayload | null {
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (
      typeof c !== "object" || c === null ||
      typeof c.id !== "string" ||
      !(c.v === null || typeof c.v === "string") ||
      !MCP_JOB_SORT_FIELDS.includes(c.s) || !MCP_JOB_SORT_ORDERS.includes(c.o) ||
      typeof c.f !== "string" ||
      !(Number.isInteger(c.n) && c.n > 0)
    ) {
      return null;
    }
    return c as CursorPayload;
  } catch {
    return null;
  }
}

// SQLite sorts NULL low: descending puts the null run last, ascending puts it
// first. Each branch below continues from a cursor on either side of that
// boundary, so a null-dated row is returned exactly once. createdAt is never
// null and Prisma refuses a null filter on a non-nullable column, so that
// arm is left out for it — the null-cursor branches can't be reached there.
function keysetClause(column: (typeof SORT_COLUMN)[JobSortField], c: CursorPayload): Prisma.JobWhereInput {
  const v = c.v === null ? null : new Date(c.v);
  const nullable = column !== "createdAt";
  if (c.o === "desc") {
    if (v === null) return { AND: [{ [column]: null }, { id: { lt: c.id } }] };
    const or: Prisma.JobWhereInput[] = [{ [column]: { lt: v } }, { [column]: v, id: { lt: c.id } }];
    if (nullable) or.push({ [column]: null });
    return { OR: or };
  }
  return v === null
    ? { OR: [{ [column]: null, id: { gt: c.id } }, { [column]: { not: null } }] }
    : { OR: [{ [column]: { gt: v } }, { [column]: v, id: { gt: c.id } }] };
}

// --- query ----------------------------------------------------------------

const ROW_SELECT = {
  id: true,
  createdAt: true,
  appliedDate: true,
  dueDate: true,
  matchScore: true,
  matchData: true,
  createdVia: true,
  automationId: true,
  JobTitle: { select: { label: true } },
  Company: { select: { label: true } },
  Status: { select: { value: true } },
  Location: { select: { label: true } },
  JobSource: { select: { label: true } },
} satisfies Prisma.JobSelect;

export type JobRow = Prisma.JobGetPayload<{ select: typeof ROW_SELECT }>;

export type JobQueryResult =
  | { ok: true; rows: JobRow[]; total: number; nextCursor: string | null; from: number; sortBy: JobSortField; sortOrder: JobSortOrder }
  | { ok: false; error: string };

export async function runJobQuery(
  userId: string,
  input: JobReadInput & { query?: string },
  extraWhere?: Prisma.JobWhereInput,
): Promise<JobQueryResult> {
  const sortBy = input.sortBy ?? "created";
  const sortOrder = input.sortOrder ?? "desc";
  const limit = input.limit ?? APP_CONSTANTS.RECORDS_PER_PAGE;
  const column = SORT_COLUMN[sortBy];
  const fp = fingerprint(input);

  let cursor: CursorPayload | null = null;
  let from = 1;
  if (input.cursor) {
    cursor = decodeCursor(input.cursor);
    if (!cursor || cursor.s !== sortBy || cursor.o !== sortOrder || cursor.f !== fp) {
      // Never fall back to page one silently: an agent looping on a stale
      // cursor would re-read the first page forever.
      return {
        ok: false,
        error:
          "Cursor is invalid or was issued for different filters or sort. Re-run the query without a cursor to start again.",
      };
    }
    from = cursor.n;
  }

  const base = buildJobWhere(userId, input);
  if (extraWhere) (base.AND as Prisma.JobWhereInput[]).push(extraWhere);
  const pageWhere: Prisma.JobWhereInput = cursor
    ? { ...base, AND: [...(base.AND as Prisma.JobWhereInput[]), keysetClause(column, cursor)] }
    : base;

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where: pageWhere,
      select: ROW_SELECT,
      orderBy: [{ [column]: sortOrder }, { id: sortOrder }],
      take: limit + 1,
    }),
    prisma.job.count({ where: base }),
  ]);

  const page = rows.slice(0, limit).map(hideUnanalyzedScore) as JobRow[];
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    const v = last[column];
    nextCursor = encodeCursor({
      v: v ? new Date(v).toISOString() : null,
      id: last.id,
      s: sortBy,
      o: sortOrder,
      f: fp,
      n: from + limit,
    });
  }

  return { ok: true, rows: page, total, nextCursor, from, sortBy, sortOrder };
}

// --- rendering ------------------------------------------------------------

const FIELD_MAX = 80;

// Free text goes into a one-line, pipe-delimited row, so it must not carry
// newlines or pipes and must stay bounded.
export function sanitize(value: string | null | undefined): string {
  if (!value) return "-";
  const flat = value.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  if (!flat) return "-";
  return flat.length > FIELD_MAX ? `${flat.slice(0, FIELD_MAX - 1)}…` : flat;
}

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

export function formatJobRow(job: JobRow): string {
  const match = job.matchScore != null ? `${job.matchScore}%` : "-";
  return [
    job.id,
    `${sanitize(job.JobTitle.label)} @ ${sanitize(job.Company.label)}`,
    job.Status.value,
    `applied ${day(job.appliedDate)}`,
    `due ${day(job.dueDate)}`,
    sanitize(job.Location?.label),
    `via ${sanitize(job.JobSource?.label)}`,
    `match ${match}`,
    sanitize(originLabel(job)),
  ].join(" | ");
}

export function renderJobPage(result: Extract<JobQueryResult, { ok: true }>, toolName: string): string {
  if (result.total === 0 || result.rows.length === 0) return "No jobs match.";
  const to = result.from + result.rows.length - 1;
  const lines = [
    `${result.total} matched now, showing rows ${result.from}-${to}, sorted by ${result.sortBy} ${result.sortOrder}.`,
    ...result.rows.map(formatJobRow),
  ];
  if (result.nextCursor) {
    lines.push(`Next page: call ${toolName} again with the same arguments plus cursor "${result.nextCursor}".`);
  }
  return lines.join("\n");
}
