export const MATCH_PROVIDER_OPTIONS = { deepseek: { thinking: { type: "disabled" } } };

// The OpenRouter model and host that matched DeepSeek direct on the labelled
// jobs (evals/job-match-bakeoff). OpenRouter's no-training setting excludes
// DeepSeek's own endpoint, so this pins a host that passes it. The pin is valid
// only for this model: another model may have no deepinfra/fp8 endpoint.
export const OPENROUTER_MATCH_MODEL = "deepseek/deepseek-v4.1-flash-1017";

const OPENROUTER_MATCH_OPTIONS = {
  openrouter: {
    reasoning: { effort: "none" },
    provider: {
      only: ["deepinfra/fp8"],
      allow_fallbacks: false,
      data_collection: "deny",
    },
  },
};

export function matchProviderOptions(model: string) {
  return model === OPENROUTER_MATCH_MODEL
    ? OPENROUTER_MATCH_OPTIONS
    : MATCH_PROVIDER_OPTIONS;
}
