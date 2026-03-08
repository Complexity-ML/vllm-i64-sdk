/**
 * Agent observability endpoint — live event stream from vllm-i64.
 *
 * Connects to /v1/agent/events (SSE) to receive real-time events
 * from sandbox executions, RAG searches, and completions.
 * Used by the complexity-website agent viewer and VSCode extensions.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";

export interface AgentEvent {
  type: "sandbox" | "rag_search" | "rag_index" | "completion" | "error";
  session_id: string;
  timestamp: number;
  event_id: string;
  data: Record<string, unknown>;
}

export interface AgentHistory {
  events: AgentEvent[];
  count: number;
  subscribers: number;
}

export class AgentEndpoint {
  constructor(private http: HttpClient) {}

  /**
   * Connect to the live event stream (SSE).
   *
   * @example
   * ```ts
   * const ac = new AbortController();
   * for await (const event of client.agent.events({ sessionId: "abc123" }, ac.signal)) {
   *   console.log(event.type, event.data);
   * }
   * ```
   */
  async *events(
    options: { sessionId?: string; history?: number } = {},
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent, void, undefined> {
    const params = new URLSearchParams();
    if (options.sessionId) params.set("session_id", options.sessionId);
    if (options.history !== undefined) params.set("history", String(options.history));

    const qs = params.toString();
    const path = `/v1/agent/events${qs ? `?${qs}` : ""}`;

    const res = await this.http.fetch(path, {}, signal);
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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

          try {
            yield JSON.parse(payload) as AgentEvent;
          } catch {
            // skip malformed
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get recent event history (JSON, not streaming).
   *
   * @example
   * ```ts
   * const history = await client.agent.history({ sessionId: "abc123", limit: 20 });
   * console.log(history.events);
   * ```
   */
  async history(
    options: { sessionId?: string; limit?: number } = {},
  ): Promise<AgentHistory> {
    const params = new URLSearchParams();
    if (options.sessionId) params.set("session_id", options.sessionId);
    if (options.limit !== undefined) params.set("limit", String(options.limit));

    const qs = params.toString();
    const path = `/v1/agent/history${qs ? `?${qs}` : ""}`;

    return this.http.get<AgentHistory>(path);
  }
}
