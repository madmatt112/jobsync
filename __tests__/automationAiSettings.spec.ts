// Contract: Req 2.1 — getDefaultModelForProvider(AiProvider.DEEPSEEK) returns
// "deepseek-flash", the new DeepseekModel enum's only member (design C2).
// Pre-condition: none.
// Test: call getDefaultModelForProvider(AiProvider.DEEPSEEK).
// Observable result: the returned string equals "deepseek-flash".
// Source: requirements.md Req 2.1.
import { getDefaultModelForProvider } from "@/lib/scraper/automation-run/aiSettings";
import { AiProvider } from "@/models/ai.model";

vi.mock("@/lib/db", () => ({ default: {} }));

describe("getDefaultModelForProvider DeepSeek default", () => {
  it("returns deepseek-flash for the DeepSeek provider (Req 2.1)", () => {
    expect(getDefaultModelForProvider(AiProvider.DEEPSEEK)).toBe("deepseek-flash");
  });
});
