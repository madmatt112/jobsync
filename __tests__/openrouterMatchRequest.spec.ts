// Contract: a match sent through OpenRouter on the tested model carries reasoning
// off and the host pin in the request body itself. The options are provider-keyed,
// so a provider that does not read them would drop them with no error.
import { generateText } from "ai";
import { PROVIDER_FACTORIES } from "@/lib/ai/provider-registry.server";
import {
  MATCH_PROVIDER_OPTIONS,
  OPENROUTER_MATCH_MODEL,
  matchProviderOptions,
} from "@/lib/ai/matchProviderOptions";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();

async function sentRequest(model: string) {
  await generateText({
    model: PROVIDER_FACTORIES.openrouter("test-key", model),
    prompt: "match this job",
    temperature: 0.3,
    providerOptions: matchProviderOptions(model),
  });
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), body: JSON.parse(init.body) };
}

describe("OpenRouter match request", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "gen-1",
            created: 1,
            model: "stub",
            choices: [
              {
                index: 0,
                finish_reason: "stop",
                message: { role: "assistant", content: "ok" },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends reasoning off and the host pin for the tested model", async () => {
    const { url, body } = await sentRequest(OPENROUTER_MATCH_MODEL);

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body.model).toBe(OPENROUTER_MATCH_MODEL);
    expect(body.reasoning).toEqual({ effort: "none" });
    expect(body.provider).toEqual({
      only: ["deepinfra/fp8"],
      allow_fallbacks: false,
      data_collection: "deny",
    });
  });

  it("sends no host pin for another OpenRouter model", async () => {
    const { body } = await sentRequest("anthropic/claude-3.5-sonnet");

    expect(body.provider).toBeUndefined();
    expect(body.reasoning).toBeUndefined();
  });

  it("keeps DeepSeek thinking off for every other model", () => {
    expect(matchProviderOptions("deepseek-flash")).toBe(MATCH_PROVIDER_OPTIONS);
  });
});
