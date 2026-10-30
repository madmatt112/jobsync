// promptfoo custom provider for any OpenAI-compatible chat endpoint.
//
// promptfoo's built-in openai provider reported about 0.5 s for a DeepSeek
// call that takes about 10 s, so this provider times each call itself. It also
// keeps the numbers the report needs for cost: cache-hit input tokens
// (DeepSeek) and the billed cost (OpenRouter, from usage.cost).
//
// config: baseUrl, apiKeyEnvar, model, and `body` (extra request fields such
// as temperature, max_tokens or thinking).
const RETRY_STATUS = new Set([402, 408, 429, 500, 502, 503, 504]);

export default class ChatProvider {
  constructor(options) {
    this.config = options.config;
    this.providerId = options.id;
    this.label = options.label;
  }

  id() {
    return this.label ?? `bakeoff:${this.config.model}`;
  }

  async callApi(prompt) {
    const { baseUrl, apiKeyEnvar, model, body = {} } = this.config;
    const key = process.env[apiKeyEnvar];
    if (!key) return { error: `${apiKeyEnvar} is not set` };

    const request = { model, messages: JSON.parse(prompt), ...body };
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * attempt));
      const started = Date.now();
      let res;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(300_000),
        });
      } catch (err) {
        lastError = String(err);
        continue;
      }
      const text = await res.text();
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
        if (RETRY_STATUS.has(res.status)) continue;
        return { error: lastError };
      }
      const data = JSON.parse(text);
      const usage = data.usage ?? {};
      const choice = data.choices?.[0];
      return {
        output: choice?.message?.content ?? '',
        tokenUsage: {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
          numRequests: 1,
        },
        metadata: {
          bakeoff: {
            latencyMs,
            servedModel: data.model,
            finishReason: choice?.finish_reason,
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
            cacheHitTokens:
              usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0,
            billedCost: typeof usage.cost === 'number' ? usage.cost : null,
          },
        },
      };
    }
    return { error: lastError };
  }
}
