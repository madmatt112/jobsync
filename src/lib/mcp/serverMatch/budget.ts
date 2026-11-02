import { APP_CONSTANTS } from "@/lib/constants";
import { mcpRateLimitMax } from "@/lib/mcp/rate-limit";

interface BudgetEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, BudgetEntry>();
const WINDOW = APP_CONSTANTS.MCP_RATE_LIMIT_WINDOW_MS;
const CLEANUP_THRESHOLD = 500;

export function takeServerMatchBudget(userId: string): {
  allowed: boolean;
  resetIn: number;
} {
  const now = Date.now();
  const max = mcpRateLimitMax();

  if (store.size > CLEANUP_THRESHOLD) {
    for (const [key, entry] of store) {
      if (now > entry.resetTime) store.delete(key);
    }
  }

  const entry = store.get(userId);

  if (!entry || now > entry.resetTime) {
    store.set(userId, { count: 1, resetTime: now + WINDOW });
    return { allowed: true, resetIn: WINDOW };
  }

  if (entry.count >= max) {
    return { allowed: false, resetIn: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true, resetIn: entry.resetTime - now };
}
