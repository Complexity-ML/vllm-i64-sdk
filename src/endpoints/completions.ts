/**
 * Text completions endpoint.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type { CompletionRequest, CompletionResponse } from "../types.js";

export class CompletionsEndpoint {
  constructor(private http: HttpClient) {}

  /** Text completion (non-streaming). */
  async create(
    prompt: string,
    options: Omit<CompletionRequest, "prompt" | "stream"> = {},
  ): Promise<CompletionResponse> {
    return this.http.post("/v1/completions", {
      model: "default",
      prompt,
      ...options,
      stream: false,
    });
  }

  /** Streaming text completion — yields text chunks. */
  async *stream(
    prompt: string,
    options: Omit<CompletionRequest, "prompt" | "stream"> = {},
  ): AsyncGenerator<string, void, undefined> {
    const res = await this.http.fetch("/v1/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        prompt,
        ...options,
        stream: true,
      }),
    });
    yield* this.http.readSSE(res);
  }

  /** Submit multiple prompts at once. */
  async batch(
    prompts: string[],
    options: { max_tokens?: number; temperature?: number } = {},
  ): Promise<{ results: CompletionResponse[] }> {
    return this.http.post("/v1/batch", { prompts, ...options });
  }
}
