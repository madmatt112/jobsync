import { APP_CONSTANTS } from "@/lib/constants";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// The operator can set the hourly budget per deployment without a rebuild —
// a bulk import wants more than the default. Read once at load; anything but
// a positive integer keeps the constant, so an unset variable changes nothing.
function configuredMax(): number {
  const raw = process.env.MCP_RATE_LIMIT_MAX;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : APP_CONSTANTS.MCP_RATE_LIMIT_MAX;
}

const MAX = configuredMax();
const WINDOW = APP_CONSTANTS.MCP_RATE_LIMIT_WINDOW_MS;
const CLEANUP_THRESHOLD = 500;

export function checkMcpRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();

  if (store.size > CLEANUP_THRESHOLD) {
    for (const [key, entry] of store) {
      if (now > entry.resetTime) store.delete(key);
    }
  }

  const entry = store.get(userId);

  if (!entry || now > entry.resetTime) {
    store.set(userId, { count: 1, resetTime: now + WINDOW });
    return { allowed: true, remaining: MAX - 1, resetIn: WINDOW };
  }

  if (entry.count >= MAX) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true, remaining: MAX - entry.count, resetIn: entry.resetTime - now };
}
