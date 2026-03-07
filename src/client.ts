/**
 * vllm-i64 SDK — HTTP Client core
 *
 * Handles fetch, auth, timeouts, and SSE streaming.
 * Endpoint modules use this as their base.
 *
 * INL - 2025
 */

import type { StreamDelta } from "./types.js";

export interface ClientOptions {
  apiKey?: string;
  timeoutMs?: number;
}

export class HttpClient {
  readonly baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(baseUrl: string = "http://localhost:8000", options: ClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeoutMs ?? 120_000;
  }

  async fetch(path: string, init: RequestInit = {}, externalSignal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    // Forward external abort signal
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        let msg: string;
        try {
          msg = JSON.parse(body)?.error?.message ?? body;
        } catch {
          msg = body;
        }
        throw new Error(`vllm-i64 ${res.status}: ${msg}`);
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetch(path);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------
  // SSE streaming
  // ---------------------------------------------------------------

  async *readSSE(res: Response): AsyncGenerator<string, void, undefined> {
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
          if (payload === "[DONE]") return;

          try {
            const data = JSON.parse(payload);
            const content =
              data.choices?.[0]?.delta?.content ??
              data.choices?.[0]?.text ??
              "";
            if (content) yield content;
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *readSSERaw(res: Response): AsyncGenerator<StreamDelta, void, undefined> {
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
          if (payload === "[DONE]") return;

          try {
            yield JSON.parse(payload) as StreamDelta;
          } catch {
            // skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
