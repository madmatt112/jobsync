import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AiSettings from "@/components/settings/AiSettings";

const getUserSettings = vi.fn();

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: () => getUserSettings(),
  updateAiSettings: vi.fn(),
}));

vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => ({ isOpen: false, refreshPreflight: vi.fn() }),
}));

vi.mock("@/utils/ai.utils", () => ({
  checkOllamaConnection: vi.fn().mockResolvedValue({ isConnected: true }),
}));

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

// jsdom implements none of these, and Radix Select calls all four
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const modelTrigger = () => screen.getByLabelText("Select Model");
const providerTrigger = () => screen.getByLabelText("Select AI provider");

async function pick(trigger: HTMLElement, optionName: string) {
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

function mockModels(ids: string[]) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ data: ids.map((id) => ({ id })) }),
    }),
  ) as unknown as typeof fetch;
}

describe("AiSettings model select", () => {
  beforeEach(() => {
    getUserSettings.mockResolvedValue({
      success: true,
      data: {
        userId: "u1",
        settings: { ai: { provider: "ollama", model: "llama3.1" }, display: {} },
      },
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ models: [{ name: "llama3.1" }] }),
      }),
    ) as unknown as typeof fetch;
  });

  it("prompts for a model after every provider switch, not just the first", async () => {
    render(<AiSettings />);
    await waitFor(() => expect(modelTrigger().textContent).toBe("llama3.1"));

    mockModels(["deepseek-chat"]);
    await pick(providerTrigger(), "DeepSeek");
    await waitFor(() => expect(modelTrigger().textContent).toBe("Select Model"));

    // Picking a model is what used to leave Radix holding a stale value
    await pick(modelTrigger(), "deepseek-chat");
    await waitFor(() => expect(modelTrigger().textContent).toBe("deepseek-chat"));

    mockModels(["gpt-4o"]);
    await pick(providerTrigger(), "OpenAI");
    await waitFor(() => expect(modelTrigger().textContent).toBe("Select Model"));
  });

  it("shows a spinner while the model list loads", async () => {
    render(<AiSettings />);
    await waitFor(() => expect(modelTrigger().textContent).toBe("llama3.1"));

    let release: (value: unknown) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise((resolve) => { release = resolve; }),
    ) as unknown as typeof fetch;

    await pick(providerTrigger(), "DeepSeek");

    await waitFor(() => expect(modelTrigger()).toBeDisabled());
    expect(modelTrigger().textContent).toContain("Loading models...");
    expect(modelTrigger().querySelector(".animate-spin")).toBeTruthy();

    release({ ok: true, json: async () => ({ data: [{ id: "deepseek-chat" }] }) });
    await waitFor(() => expect(modelTrigger().textContent).toBe("Select Model"));
  });

  // Contract: Req 2.2 — when the DeepSeek models fetch fails, the fallback
  // list offered in the model select is exactly ["deepseek-flash"], with
  // neither retired alias present.
  // Pre-condition: AiSettings rendered, provider switched to DeepSeek.
  // Test: fetch resolves ok: false, then open the model select.
  // Observable result: the rendered option list equals ["deepseek-flash"].
  // Source: requirements.md Req 2.2; design.md C2.
  it("falls back to deepseek-flash only when the DeepSeek models fetch fails", async () => {
    render(<AiSettings />);
    await waitFor(() => expect(modelTrigger().textContent).toBe("llama3.1"));

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: "boom" }),
      }),
    ) as unknown as typeof fetch;
    await pick(providerTrigger(), "DeepSeek");

    await waitFor(() => expect(modelTrigger()).not.toBeDisabled());
    fireEvent.keyDown(modelTrigger(), { key: "Enter" });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["deepseek-flash"]);
  });
});
