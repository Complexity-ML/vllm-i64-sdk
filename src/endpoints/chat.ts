/**
 * Chat completions endpoint.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamDelta,
} from "../types.js";

export class ChatEndpoint {
  constructor(private http: HttpClient) {}

  /**
   * Chat completion (non-streaming).
   *
   * @example
   * ```ts
   * const res = await client.chat.create([{ role: "user", content: "Hi" }]);
   * console.log(res.choices[0].message.content);
   * ```
   */
  async create(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> = {},
  ): Promise<ChatCompletionResponse> {
    return this.http.post("/v1/chat/completions", {
      model: "default",
      messages,
      ...options,
      stream: false,
    });
  }

  /**
   * Streaming chat — yields content strings.
   *
   * @example
   * ```ts
   * for await (const chunk of client.chat.stream([{ role: "user", content: "Hi" }])) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async *stream(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> & { signal?: AbortSignal } = {},
  ): AsyncGenerator<string, void, undefined> {
    const { signal, ...rest } = options;
    const res = await this.http.fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        messages,
        ...rest,
        stream: true,
      }),
    }, signal);
    yield* this.http.readSSE(res);
  }

  /**
   * Streaming chat — yields raw SSE delta objects.
   */
  async *streamRaw(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> & { signal?: AbortSignal } = {},
  ): AsyncGenerator<StreamDelta, void, undefined> {
    const { signal, ...rest } = options;
    const res = await this.http.fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        messages,
        ...rest,
        stream: true,
      }),
    }, signal);
    yield* this.http.readSSERaw(res);
  }
}
