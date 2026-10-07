import { describe, it, expect } from "vitest";
import { JOB_MATCH_SYSTEM_PROMPT } from "@/lib/ai/prompts/job-match/system";

/**
 * Contract (design C5 / requirement 8.3 — three additions after the Deal
 * Breakers line of src/lib/ai/prompts/job-match/system.ts:49-50):
 *
 * - Pre-condition: the module exports JOB_MATCH_SYSTEM_PROMPT, today a
 *   string that ends its Deal Breakers section without any of the three
 *   additions below.
 * - Test: read JOB_MATCH_SYSTEM_PROMPT directly (the seam named in the
 *   task: "File: src/lib/ai/prompts/job-match/system.ts").
 * - Observable result / expected value source, per addition:
 *   (a) eligibility check — contains "work authorization" and "security
 *       clearance" (design C5 illustrative wording (a); requirement 8.3
 *       "an eligibility check over location/residency, work
 *       authorization, language and clearance").
 *   (b) no-invention rule — contains "Do not invent" (design C5
 *       illustrative wording (b); requirement 8.3 "the rule not to
 *       invent employers, skills, titles, dates or credentials").
 *   (c) conditional thin-description rule — contains "provisional"
 *       (design C5 illustrative wording (c); requirement 8.3 "only a
 *       thin description makes the score provisional").
 *
 * Not red at base (left out, named for the implementer brief instead,
 * retro P12): the SCORES line (:28), the seven "## " section headings,
 * and the R9 AC5 absence checks (no "rate limit exceeded", "duplicate
 * detected", "job created", no leading "not attempted", no batch-prefix
 * line) all already hold in the unmodified prompt and would pass before
 * any implementation exists.
 */
describe("JOB_MATCH_SYSTEM_PROMPT", () => {
  it("adds the eligibility check over work authorization and security clearance", () => {
    expect(JOB_MATCH_SYSTEM_PROMPT).toContain("work authorization");
    expect(JOB_MATCH_SYSTEM_PROMPT).toContain("security clearance");
  });

  it("adds the rule against inventing employers, skills, titles, dates or credentials", () => {
    expect(JOB_MATCH_SYSTEM_PROMPT).toContain("Do not invent");
  });

  it("adds the conditional thin-description rule that calls the score provisional", () => {
    expect(JOB_MATCH_SYSTEM_PROMPT).toContain("provisional");
  });
});
