// Contract (design C4, Req 3.1, 3.4, 3.5, 4.1, 4.5, 4.6, 4.7, 8.2, 8.3, 8.4):
//
// 1. "skipMatch true returns kind skipped with SKIPPED_TEXT, reading no
//     settings and building no offer"
//    Pre:   skipMatch: true.
//    Call:  resolveMatchReply(jobId, userId, completeness, context, true).
//    Result: { kind: "skipped", text: SKIPPED_TEXT }; getUserAiSettings and
//            buildMatchOffer are never called.
//    Source: design.md C4 Order step 1 (Req 8.2, 8.3).
//
// 2. "skipMatch false or absent behaves as without it"
//    Pre:   settings read as off (getUserAiSettings returns serverSideMatch:
//           false), buildMatchOffer stubbed to a fixed note.
//    Call:  resolveMatchReply(..., false) and resolveMatchReply(..., undefined).
//    Result: both calls return the same value, equal to buildMatchOffer's
//            result by deep equality.
//    Source: design.md C4 Order step 1 only fires on === true (Req 8.4).
//
// 3. "a stored ai without the flag, a throwing read and the flag off each
//     return buildMatchOffer's result by deep equality and never enqueue"
//    Pre:   three settings scenarios: no serverSideMatch key, getUserAiSettings
//           throws, serverSideMatch: false.
//    Call:  resolveMatchReply(jobId, userId, completeness, context).
//    Result: each equals buildMatchOffer's return value by deep equality;
//            enqueueServerMatch is never called.
//    Source: design.md C4 Order step 2 / "readServerMatchSettings ... a throw
//            or a non-true flag reads as off" (Req 3.1, 3.5).
//
// 4. "getUserAiSettings is called with the given userId"
//    Pre:   settings read as off.
//    Call:  resolveMatchReply(jobId, "user-77", completeness, context).
//    Result: getUserAiSettings was called with "user-77".
//    Source: design.md C4 "readServerMatchSettings(userId) ... wraps
//            getUserAiSettings" (Req 3.4).
//
// 5. "a note offer passes through"
//    Pre:   settings on with a model, buildMatchOffer returns a note.
//    Call:  resolveMatchReply(jobId, userId, completeness, context).
//    Result: the same note is returned; enqueueServerMatch is never called.
//    Source: design.md C4 Order step 3 (Req 4.6).
//
// 6. "a directive with no model returns NO_MODEL_TEXT as a note"
//    Pre:   settings on, model undefined, buildMatchOffer returns a directive.
//    Call:  resolveMatchReply(jobId, userId, completeness, context).
//    Result: { kind: "note", text: NO_MODEL_TEXT }; enqueueServerMatch is
//            never called.
//    Source: design.md C4 Order step 4 (Req 4.7).
//
// 7. "a directive with a model enqueues once with the task fields and
//     returns QUEUED_TEXT"
//    Pre:   settings on with provider/model set, buildMatchOffer returns a
//           directive.
//    Call:  resolveMatchReply(jobId, userId, completeness, context).
//    Result: enqueueServerMatch called once with { jobId, userId, provider,
//            model }; return value is { kind: "queued", text: QUEUED_TEXT }.
//    Source: design.md C4 Order step 5 (Req 4.1).
//
// 8. "none of the three texts contains the forbidden reply phrases"
//    Pre:   none (constants).
//    Call:  read the exported QUEUED_TEXT, SKIPPED_TEXT, NO_MODEL_TEXT.
//    Result: none contains "SYSTEM PROMPT:" or "save_match_result".
//    Source: design.md C4 Texts (Req 4.5).

import {
  resolveMatchReply,
  QUEUED_TEXT,
  SKIPPED_TEXT,
  NO_MODEL_TEXT,
} from "@/lib/mcp/serverMatch/offer";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { buildMatchOffer } from "@/lib/mcp/tools/matchDirective";
import { enqueueServerMatch } from "@/lib/mcp/serverMatch/queue";
import { AiProvider } from "@/models/ai.model";

vi.mock("@/lib/scraper/automation-run/aiSettings", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/scraper/automation-run/aiSettings")
  >("@/lib/scraper/automation-run/aiSettings");
  return { ...actual, getUserAiSettings: vi.fn() };
});

vi.mock("@/lib/mcp/tools/matchDirective", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/mcp/tools/matchDirective")
  >("@/lib/mcp/tools/matchDirective");
  return { ...actual, buildMatchOffer: vi.fn() };
});

vi.mock("@/lib/mcp/serverMatch/queue", () => ({
  enqueueServerMatch: vi.fn(),
}));

const mockGetUserAiSettings = getUserAiSettings as unknown as ReturnType<
  typeof vi.fn
>;
const mockBuildMatchOffer = buildMatchOffer as unknown as ReturnType<
  typeof vi.fn
>;
const mockEnqueueServerMatch = enqueueServerMatch as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveMatchReply", () => {
  it("skipMatch true returns kind skipped with SKIPPED_TEXT, reading no settings and building no offer (Req 8.2, 8.3)", async () => {
    const result = await resolveMatchReply(
      "job-1",
      "user-1",
      "full",
      "add",
      true,
    );

    expect(result).toEqual({ kind: "skipped", text: SKIPPED_TEXT });
    expect(mockGetUserAiSettings).not.toHaveBeenCalled();
    expect(mockBuildMatchOffer).not.toHaveBeenCalled();
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("skipMatch false or absent behaves as without it (Req 8.4)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: undefined,
      serverSideMatch: false,
    });
    const offResult = { kind: "note" as const, text: "BASE NOTE" };
    mockBuildMatchOffer.mockResolvedValue(offResult);

    const withFalse = await resolveMatchReply(
      "job-1",
      "user-1",
      "full",
      "add",
      false,
    );
    const withAbsent = await resolveMatchReply(
      "job-1",
      "user-1",
      "full",
      "add",
    );

    expect(withFalse).toEqual(offResult);
    expect(withAbsent).toEqual(offResult);
  });

  it("a stored ai without the flag returns buildMatchOffer's result by deep equality and never enqueues (Req 3.1, 3.5)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });
    const offResult = { kind: "note" as const, text: "BASE NOTE" };
    mockBuildMatchOffer.mockResolvedValue(offResult);

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(result).toEqual(offResult);
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("a throwing settings read returns buildMatchOffer's result by deep equality and never enqueues (Req 3.1, 3.5)", async () => {
    mockGetUserAiSettings.mockRejectedValue(new Error("corrupt JSON"));
    const offResult = { kind: "directive" as const, text: "BASE DIRECTIVE" };
    mockBuildMatchOffer.mockResolvedValue(offResult);

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(result).toEqual(offResult);
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("the flag off returns buildMatchOffer's result by deep equality and never enqueues (Req 3.1, 3.5)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: false,
    });
    const offResult = { kind: "directive" as const, text: "BASE DIRECTIVE" };
    mockBuildMatchOffer.mockResolvedValue(offResult);

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(result).toEqual(offResult);
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("reads settings by the given userId (Req 3.4)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: undefined,
      serverSideMatch: false,
    });
    mockBuildMatchOffer.mockResolvedValue({ kind: "note", text: "N" });

    await resolveMatchReply("job-1", "user-77", "full", "add");

    expect(mockGetUserAiSettings).toHaveBeenCalledWith("user-77");
  });

  it("a note offer passes through and never enqueues (Req 4.6)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });
    const noteResult = { kind: "note" as const, text: "NOTE TEXT" };
    mockBuildMatchOffer.mockResolvedValue(noteResult);

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(result).toEqual(noteResult);
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("a directive with no model returns NO_MODEL_TEXT as a note and never enqueues (Req 4.7)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: undefined,
      serverSideMatch: true,
    });
    mockBuildMatchOffer.mockResolvedValue({
      kind: "directive",
      text: "DIRECTIVE TEXT",
    });

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(result).toEqual({ kind: "note", text: NO_MODEL_TEXT });
    expect(mockEnqueueServerMatch).not.toHaveBeenCalled();
  });

  it("a directive with a model enqueues once with the task fields and returns QUEUED_TEXT (Req 4.1)", async () => {
    mockGetUserAiSettings.mockResolvedValue({
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
      serverSideMatch: true,
    });
    mockBuildMatchOffer.mockResolvedValue({
      kind: "directive",
      text: "DIRECTIVE TEXT",
    });

    const result = await resolveMatchReply("job-1", "user-1", "full", "add");

    expect(mockEnqueueServerMatch).toHaveBeenCalledTimes(1);
    expect(mockEnqueueServerMatch).toHaveBeenCalledWith({
      jobId: "job-1",
      userId: "user-1",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });
    expect(result).toEqual({ kind: "queued", text: QUEUED_TEXT });
  });

  it("none of the three texts contains the forbidden reply phrases (Req 4.5)", () => {
    for (const text of [QUEUED_TEXT, SKIPPED_TEXT, NO_MODEL_TEXT]) {
      expect(text).not.toContain("SYSTEM PROMPT:");
      expect(text).not.toContain("save_match_result");
    }
  });
});
