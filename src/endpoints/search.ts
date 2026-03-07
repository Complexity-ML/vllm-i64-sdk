/**
 * Search endpoints — Perplexity-style search-augmented generation.
 *
 * Token-routed isolation: partition = sha256(api_key ∥ user_id) mod N
 * No data leak possible. No shared cache. No session tokens.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  SearchCompletionRequest,
  SearchCompletionResponse,
  SearchSource,
  SearchHistoryEntry,
  SearchHistoryResponse,
  SearchStatsResponse,
} from "../types.js";

export class SearchEndpoint {
  constructor(private http: HttpClient) {}

  /**
   * Search-augmented generation: query → web search → cited answer.
   *
   * @example
   * ```ts
   * const res = await client.search.create({ query: "What is MoE?" });
   * console.log(res.choices[0].message.content);
   * for (const src of res.sources) {
   *   console.log(`[${src.index}] ${src.title} — ${src.url}`);
   * }
   * ```
   */
  async create(params: SearchCompletionRequest): Promise<SearchCompletionResponse> {
    return this.http.post("/v1/search/completions", { ...params, stream: false });
  }

  /**
   * Stream search completion — yields text chunks.
   * Sources are sent as the final SSE event.
   *
   * @example
   * ```ts
   * const { stream, sources } = await client.search.stream({ query: "token routing" });
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk);
   * }
   * console.log("\nSources:", await sources);
   * ```
   */
  async stream(
    params: SearchCompletionRequest,
    signal?: AbortSignal,
  ): Promise<{ stream: AsyncGenerator<string>; sources: Promise<SearchSource[]> }> {
    const res = await this.http.fetch(
      "/v1/search/completions",
      { method: "POST", body: JSON.stringify({ ...params, stream: true }) },
      signal,
    );

    let resolveSourcesFn: (sources: SearchSource[]) => void;
    const sourcesPromise = new Promise<SearchSource[]>((resolve) => {
      resolveSourcesFn = resolve;
    });

    const self = this;
    async function* readStream(): AsyncGenerator<string> {
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let foundSources = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") return;

            try {
              const data = JSON.parse(payload);

              // Sources event (final)
              if (data.sources) {
                foundSources = true;
                resolveSourcesFn(data.sources);
                continue;
              }

              const content = data.choices?.[0]?.delta?.content ?? "";
              if (content) yield content;
            } catch {
              // skip malformed
            }
          }
        }
      } finally {
        reader.releaseLock();
        if (!foundSources) resolveSourcesFn([]);
      }
    }

    return { stream: readStream(), sources: sourcesPromise };
  }

  /**
   * Get search history for the authenticated user.
   * History is partitioned by api_key + user — no cross-user access.
   */
  async history(user?: string, limit: number = 50): Promise<SearchHistoryResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (user) params.set("user", user);
    return this.http.get(`/v1/search/history?${params}`);
  }

  /**
   * Clear search history for the authenticated user.
   * Only clears the caller's own partition.
   */
  async clearHistory(user?: string): Promise<{ status: string; removed: number }> {
    const params = user ? `?user=${encodeURIComponent(user)}` : "";
    const res = await this.http.fetch(`/v1/search/history${params}`, { method: "DELETE" });
    return res.json();
  }

  /** Search history statistics (admin). */
  async stats(): Promise<SearchStatsResponse> {
    return this.http.get("/v1/search/stats");
  }
}
