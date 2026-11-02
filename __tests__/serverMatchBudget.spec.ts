// Contract (design C8, Req 6.2, 6.3, 6.5):
//
// 1. "allows exactly mcpRateLimitMax() takes per window, then refuses"
//    Pre:   fresh userId, fake timers, no env override.
//    Call:  takeServerMatchBudget(userId) x mcpRateLimitMax(), then once more.
//    Result: the first mcpRateLimitMax() calls return allowed:true; the next
//            returns allowed:false with resetIn > 0.
//    Source: design.md C8 — "max is mcpRateLimitMax()"; Req 6.3.
//
// 2. "resets after the window elapses"
//    Pre:   userId has exhausted its budget.
//    Call:  advance fake timers by MCP_RATE_LIMIT_WINDOW_MS + 1, then take.
//    Result: allowed:true.
//    Source: design.md C8 — "window is APP_CONSTANTS.MCP_RATE_LIMIT_WINDOW_MS".
//
// 3. "follows the MCP_RATE_LIMIT_MAX env override"
//    Pre:   process.env.MCP_RATE_LIMIT_MAX = "100" before any take.
//    Call:  takeServerMatchBudget(userId) x 100.
//    Result: all 100 calls return allowed:true.
//    Source: Req 6.3; design.md C8 — "max is mcpRateLimitMax() read at check time".
//
// 4. "does not count against checkRateLimit's default or chat buckets"
//    Pre:   fresh userId, never seen by checkRateLimit.
//    Call:  takeServerMatchBudget(userId) x 50, then checkRateLimit(userId).
//    Result: checkRateLimit(userId) reports the same shape as a never-touched
//            fresh user: { allowed: true, remaining: RATE_LIMITS.MAX_REQUESTS - 1,
//            resetIn: RATE_LIMITS.WINDOW_MS }.
//    Source: Req 6.2, 6.5; RATE_LIMITS from src/lib/ai/config.ts (checkRateLimit's
//            own collaborator, not mocked).

import { takeServerMatchBudget } from "@/lib/mcp/serverMatch/budget";
import { mcpRateLimitMax } from "@/lib/mcp/rate-limit";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { RATE_LIMITS } from "@/lib/ai/config";
import { APP_CONSTANTS } from "@/lib/constants";

describe("takeServerMatchBudget", () => {
  const ORIGINAL_ENV = process.env.MCP_RATE_LIMIT_MAX;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.MCP_RATE_LIMIT_MAX;
    } else {
      process.env.MCP_RATE_LIMIT_MAX = ORIGINAL_ENV;
    }
  });

  it("allows exactly mcpRateLimitMax() takes per window, then refuses with resetIn above 0", () => {
    const userId = "server-match-user-1";
    const max = mcpRateLimitMax();

    for (let i = 0; i < max; i++) {
      expect(takeServerMatchBudget(userId).allowed).toBe(true);
    }

    const refused = takeServerMatchBudget(userId);
    expect(refused.allowed).toBe(false);
    expect(refused.resetIn).toBeGreaterThan(0);
  });

  it("allows a take again after the window elapses", () => {
    const userId = "server-match-user-2";
    const max = mcpRateLimitMax();

    for (let i = 0; i < max; i++) {
      takeServerMatchBudget(userId);
    }
    expect(takeServerMatchBudget(userId).allowed).toBe(false);

    vi.advanceTimersByTime(APP_CONSTANTS.MCP_RATE_LIMIT_WINDOW_MS + 1);

    expect(takeServerMatchBudget(userId).allowed).toBe(true);
  });

  it("allows 100 takes when MCP_RATE_LIMIT_MAX is set to '100' in process.env", () => {
    process.env.MCP_RATE_LIMIT_MAX = "100";
    const userId = "server-match-user-3";

    for (let i = 0; i < 100; i++) {
      expect(takeServerMatchBudget(userId).allowed).toBe(true);
    }
  });

  it("leaves checkRateLimit(userId) reporting the same remaining as a fresh user after 50 takes", () => {
    const userId = "server-match-user-4";

    for (let i = 0; i < 50; i++) {
      takeServerMatchBudget(userId);
    }

    const result = checkRateLimit(userId);
    expect(result).toEqual({
      allowed: true,
      remaining: RATE_LIMITS.MAX_REQUESTS - 1,
      resetIn: RATE_LIMITS.WINDOW_MS,
    });
  });
});
