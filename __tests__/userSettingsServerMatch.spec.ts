// Contract (task 4, server-side-match):
// - Req 3.2 — Pre: a stored settings row has ai { provider: "deepseek", model:
//   "deepseek-flash" } with no serverSideMatch. Call: updateServerSideMatch(true).
//   Observe: the upsert write's settings.ai deep-equals { provider: "deepseek",
//   model: "deepseek-flash", serverSideMatch: true }. Expected value source:
//   design.md C3 ("the merge keeps the stored provider and model") plus the
//   task's own exact-values line.
// - Req 3.1/3.2 (no stored row) — Pre: findUnique resolves null. Call:
//   updateServerSideMatch(true). Observe: the upsert write's settings.ai
//   deep-equals { provider: defaultUserSettings.ai.provider, model: undefined,
//   serverSideMatch: true }. Expected value source: defaultUserSettings
//   (src/models/userSettings.model.ts:22-30), unchanged by this task.
// - Req 3.3 (regression guard, green at base per the task text) — Pre: a
//   stored settings row has ai { provider: "deepseek", model: "deepseek-flash",
//   serverSideMatch: true }. Call: updateAiSettings({ provider: "openai", model:
//   "gpt-4o" }). Observe: the upsert write's settings.ai deep-equals { provider:
//   "openai", model: "gpt-4o", serverSideMatch: true }. Expected value source:
//   the existing merge at src/actions/userSettings.actions.ts:68-72, which
//   already spreads stored ai under the patch — this is a runtime object
//   spread, so it already carries an untyped extra key at base.
// - Req 3.1 (regression guard, green at base and after — defaultUserSettings
//   is restricted from changing) — Observe: defaultUserSettings.ai has no
//   serverSideMatch key, so an absent setting has nothing to read as on.

import { updateServerSideMatch, updateAiSettings } from "@/actions/userSettings.actions";
import { defaultUserSettings } from "@/models/userSettings.model";
import { AiProvider } from "@/models/ai.model";
import db from "@/lib/db";

vi.mock("@/lib/db", () => ({
  default: {
    userSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

const requireUser = vi.fn();
vi.mock("@/actions/shared", () => ({
  requireUser: (...args: unknown[]) => requireUser(...(args as [])),
}));

const mockDb = db as any;

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1" });
  mockDb.userSettings.upsert.mockResolvedValue({ settings: "{}" });
});

function writtenAi() {
  const call = mockDb.userSettings.upsert.mock.calls[0][0];
  const written = JSON.parse(call.update.settings);
  return written.ai;
}

describe("updateServerSideMatch", () => {
  it("persists the flag and keeps the stored provider and model (Req 3.2)", async () => {
    mockDb.userSettings.findUnique.mockResolvedValue({
      settings: JSON.stringify({
        ai: { provider: "deepseek", model: "deepseek-flash" },
        display: { theme: "system" },
      }),
    });

    await updateServerSideMatch(true);

    expect(writtenAi()).toStrictEqual({
      provider: "deepseek",
      model: "deepseek-flash",
      serverSideMatch: true,
    });
  });

  it("writes the default provider, no model and the flag with no stored row (Req 3.1, 3.2)", async () => {
    mockDb.userSettings.findUnique.mockResolvedValue(null);

    await updateServerSideMatch(true);

    expect(writtenAi()).toStrictEqual({
      provider: defaultUserSettings.ai.provider,
      model: undefined,
      serverSideMatch: true,
    });
  });
});

describe("updateAiSettings (Req 3.3 regression guard, green at base)", () => {
  it("keeps a stored serverSideMatch flag after a provider/model save", async () => {
    mockDb.userSettings.findUnique.mockResolvedValue({
      settings: JSON.stringify({
        ai: { provider: "deepseek", model: "deepseek-flash", serverSideMatch: true },
        display: { theme: "system" },
      }),
    });

    await updateAiSettings({ provider: AiProvider.OPENAI, model: "gpt-4o" });

    expect(writtenAi()).toStrictEqual({
      provider: "openai",
      model: "gpt-4o",
      serverSideMatch: true,
    });
  });
});

describe("defaultUserSettings (Req 3.1 regression guard, green at base and after)", () => {
  it("has no serverSideMatch key, so an absent setting has nothing to read as on", () => {
    expect(defaultUserSettings.ai).not.toHaveProperty("serverSideMatch");
  });
});
