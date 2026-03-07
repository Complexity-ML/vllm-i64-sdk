/**
 * vllm-i64 — TypeScript SDK
 *
 * Zero-dependency client for the vllm-i64 inference engine.
 * Covers all endpoints: OpenAI-compatible + admin + monitoring.
 *
 * @example
 * ```ts
 * import { I64Client } from "vllm-i64";
 *
 * const client = new I64Client("http://localhost:8000");
 * const response = await client.chat([{ role: "user", content: "Hello!" }]);
 * console.log(response.choices[0].message.content);
 * ```
 *
 * INL - 2025
 */

// =========================================================================
// Types
// =========================================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: string | { type: string; function: { name: string } };
  stop?: string | string[];
  repetition_penalty?: number;
  logprobs?: boolean;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "tool_calls";
  logprobs?: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionRequest {
  model?: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface CompletionResponse {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    finish_reason: "stop" | "length";
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  uptime_seconds: number;
  model_loaded: boolean;
  kv_cache_usage_pct?: number;
  gpu?: {
    free_mb: number;
    total_mb: number;
    used_mb: number;
    utilization_pct: number;
  };
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  object: "model";
  owned_by: string;
}

export interface CacheStats {
  num_blocks: number;
  used_blocks: number;
  free_blocks: number;
  block_size: number;
  active_seqs: number;
  usage_pct: number;
  prefix_cached_blocks?: number;
  prefix_unique_hashes?: number;
  lru_evictions_total?: number;
  swapped_seqs?: number;
  [key: string]: unknown;
}

export interface MonitorSnapshot {
  timestamp: number;
  uptime_s: number;
  requests_served: number;
  active_requests: number;
  peak_batch_size: number;
  scheduler: Record<string, number>;
  engine: {
    total_steps: number;
    total_tokens_generated: number;
  };
  kv_cache?: CacheStats;
  perf?: {
    avg_step_ms: number;
    tok_per_s: number;
    forward_pct: number;
  };
  gpu?: {
    free_mb: number;
    total_mb: number;
    utilization_pct: number;
  };
  lora?: {
    loaded_adapters: number;
    adapters: string[];
  };
}

export interface ExpertStats {
  num_experts: number;
  total_tokens: number;
  distribution: number[];
  counts: number[];
  imbalance: number;
}

export interface LoRAAdapter {
  id: number;
  name: string;
}

export interface RAGResult {
  text: string;
  score: number;
  [key: string]: unknown;
}

export interface I64Error {
  error: {
    message: string;
    type: string;
  };
}

// =========================================================================
// SSE streaming
// =========================================================================

export interface StreamDelta {
  id: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

// =========================================================================
// Client
// =========================================================================

export class I64Client {
  readonly baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  /**
   * Create a vllm-i64 client.
   *
   * @param baseUrl - Server URL (default: http://localhost:8000)
   * @param options - API key and timeout
   */
  constructor(
    baseUrl: string = "http://localhost:8000",
    options: { apiKey?: string; timeoutMs?: number } = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeoutMs ?? 120_000;
  }

  // ---------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------

  private async _fetch(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

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

  private async _get<T>(path: string): Promise<T> {
    const res = await this._fetch(path);
    return res.json() as Promise<T>;
  }

  private async _post<T>(path: string, body: unknown): Promise<T> {
    const res = await this._fetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------
  // Chat completions
  // ---------------------------------------------------------------

  /**
   * Chat completion (non-streaming).
   *
   * @example
   * ```ts
   * const res = await client.chat([{ role: "user", content: "Hi" }]);
   * console.log(res.choices[0].message.content);
   * ```
   */
  async chat(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> = {},
  ): Promise<ChatCompletionResponse> {
    return this._post("/v1/chat/completions", {
      model: "default",
      messages,
      ...options,
      stream: false,
    });
  }

  /**
   * Chat completion with streaming (SSE).
   * Yields content strings as they arrive.
   *
   * @example
   * ```ts
   * for await (const chunk of client.chatStream([{ role: "user", content: "Hi" }])) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async *chatStream(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> = {},
  ): AsyncGenerator<string, void, undefined> {
    const res = await this._fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        messages,
        ...options,
        stream: true,
      }),
    });

    yield* this._readSSE(res);
  }

  /**
   * Stream raw SSE events (full delta objects).
   */
  async *chatStreamRaw(
    messages: ChatMessage[],
    options: Omit<ChatCompletionRequest, "messages" | "stream"> = {},
  ): AsyncGenerator<StreamDelta, void, undefined> {
    const res = await this._fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        messages,
        ...options,
        stream: true,
      }),
    });

    yield* this._readSSERaw(res);
  }

  // ---------------------------------------------------------------
  // Text completions
  // ---------------------------------------------------------------

  /**
   * Text completion (non-streaming).
   */
  async complete(
    prompt: string,
    options: Omit<CompletionRequest, "prompt" | "stream"> = {},
  ): Promise<CompletionResponse> {
    return this._post("/v1/completions", {
      model: "default",
      prompt,
      ...options,
      stream: false,
    });
  }

  /**
   * Text completion with streaming.
   */
  async *completeStream(
    prompt: string,
    options: Omit<CompletionRequest, "prompt" | "stream"> = {},
  ): AsyncGenerator<string, void, undefined> {
    const res = await this._fetch("/v1/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        prompt,
        ...options,
        stream: true,
      }),
    });

    yield* this._readSSE(res);
  }

  // ---------------------------------------------------------------
  // Health & models
  // ---------------------------------------------------------------

  /** Health check with engine stats. */
  async health(): Promise<HealthResponse> {
    return this._get("/health");
  }

  /** Check if server is reachable. */
  async isReady(): Promise<boolean> {
    try {
      const h = await this.health();
      return h.status === "ok" || h.status === "degraded";
    } catch {
      return false;
    }
  }

  /** List available models. */
  async models(): Promise<{ data: ModelInfo[] }> {
    return this._get("/v1/models");
  }

  // ---------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------

  /** Live monitoring snapshot (batch, KV, perf, GPU). */
  async monitor(): Promise<MonitorSnapshot> {
    return this._get("/v1/monitor");
  }

  /** Latency percentiles and request stats. */
  async metrics(): Promise<Record<string, unknown>> {
    return this._get("/v1/metrics");
  }

  // ---------------------------------------------------------------
  // KV Cache
  // ---------------------------------------------------------------

  /** Namespace for cache operations. */
  cache = {
    /** Get KV cache statistics. */
    stats: (): Promise<CacheStats> => this._get("/v1/cache/stats"),

    /** Purge prefix cache (admin). */
    purge: (): Promise<{ status: string; purged_blocks: number }> =>
      this._post("/v1/cache/purge", {}),
  };

  // ---------------------------------------------------------------
  // Expert routing
  // ---------------------------------------------------------------

  /** Get expert routing distribution (MoE models). */
  async experts(): Promise<ExpertStats> {
    return this._get("/v1/experts");
  }

  // ---------------------------------------------------------------
  // LoRA
  // ---------------------------------------------------------------

  /** Namespace for LoRA adapter operations. */
  lora = {
    /** Load a LoRA adapter. */
    load: (params: {
      adapter_id: number;
      path: string;
      name?: string;
      scaling?: number;
    }): Promise<{ status: string; adapter_id: number; name: string }> =>
      this._post("/v1/lora/load", params),

    /** Unload a LoRA adapter. */
    unload: (
      adapter_id: number,
    ): Promise<{ status: string; adapter_id: number }> =>
      this._post("/v1/lora/unload", { adapter_id }),

    /** List loaded adapters. */
    list: (): Promise<{ adapters: LoRAAdapter[] }> =>
      this._get("/v1/lora/list"),
  };

  // ---------------------------------------------------------------
  // RAG
  // ---------------------------------------------------------------

  /** Namespace for RAG operations. */
  rag = {
    /** Index text or a file. */
    index: (
      params: { text?: string; file?: string },
    ): Promise<{ status: string; chunks: number }> =>
      this._post("/v1/rag/index", params),

    /** Search indexed documents. */
    search: (
      query: string,
      k: number = 3,
    ): Promise<{ query: string; results: RAGResult[]; count: number }> =>
      this._post("/v1/rag/search", { query, k }),

    /** Get RAG index statistics. */
    stats: (): Promise<{
      enabled: boolean;
      total_chunks: number;
      dimension: number;
    }> => this._get("/v1/rag/stats"),
  };

  // ---------------------------------------------------------------
  // Batch & cancel
  // ---------------------------------------------------------------

  /**
   * Submit multiple prompts at once.
   */
  async batch(
    prompts: string[],
    options: { max_tokens?: number; temperature?: number } = {},
  ): Promise<{ results: CompletionResponse[] }> {
    return this._post("/v1/batch", { prompts, ...options });
  }

  /**
   * Cancel a running request.
   */
  async cancel(requestId: string): Promise<{ status: string }> {
    return this._post(`/v1/cancel/${requestId}`, {});
  }

  // ---------------------------------------------------------------
  // SSE parser
  // ---------------------------------------------------------------

  private async *_readSSE(
    res: Response,
  ): AsyncGenerator<string, void, undefined> {
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

  private async *_readSSERaw(
    res: Response,
  ): AsyncGenerator<StreamDelta, void, undefined> {
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

// Re-export default
export default I64Client;
