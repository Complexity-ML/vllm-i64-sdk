/**
 * vllm-i64 — TypeScript SDK
 *
 * Zero-dependency client for the vllm-i64 inference engine.
 *
 * @example
 * ```ts
 * import { I64Client } from "vllm-i64";
 *
 * const client = new I64Client("http://localhost:8000");
 *
 * // Chat
 * const res = await client.chat.create([{ role: "user", content: "Hello!" }]);
 *
 * // Stream
 * for await (const chunk of client.chat.stream([{ role: "user", content: "Hi" }])) {
 *   process.stdout.write(chunk);
 * }
 *
 * // Admin
 * await client.monitor.snapshot();
 * await client.cache.purge();
 * await client.lora.load({ adapter_id: 1, path: "/models/v2" });
 * ```
 *
 * INL - 2025
 */

import { HttpClient, type ClientOptions } from "./client.js";
import { AgentEndpoint } from "./endpoints/agent.js";
import { ChatEndpoint } from "./endpoints/chat.js";
import { CompletionsEndpoint } from "./endpoints/completions.js";
import { CacheEndpoint } from "./endpoints/cache.js";
import { LoRAEndpoint } from "./endpoints/lora.js";
import { MonitorEndpoint } from "./endpoints/monitor.js";
import { RAGEndpoint } from "./endpoints/rag.js";


export class I64Client {
  private http: HttpClient;

  /** Agent — orchestrated tool-use loop (sandbox + RAG) via external LLM. */
  readonly agent: AgentEndpoint;
  /** Chat completions (streaming + non-streaming, tool_calls). */
  readonly chat: ChatEndpoint;
  /** Text completions (streaming + batch). */
  readonly completions: CompletionsEndpoint;
  /** KV cache management (stats, purge). */
  readonly cache: CacheEndpoint;
  /** LoRA adapter management (load, unload, list). */
  readonly lora: LoRAEndpoint;
  /** Monitoring, health, metrics, expert routing. */
  readonly monitor: MonitorEndpoint;
  /** RAG — index, search, stats. */
  readonly rag: RAGEndpoint;


  /**
   * Create a vllm-i64 client.
   *
   * @param baseUrl - Server URL (default: http://localhost:8000)
   * @param options - API key and timeout
   */
  constructor(baseUrl: string = "http://localhost:8000", options: ClientOptions = {}) {
    this.http = new HttpClient(baseUrl, options);
    this.agent = new AgentEndpoint(this.http);
    this.chat = new ChatEndpoint(this.http);
    this.completions = new CompletionsEndpoint(this.http);
    this.cache = new CacheEndpoint(this.http);
    this.lora = new LoRAEndpoint(this.http);
    this.monitor = new MonitorEndpoint(this.http);
    this.rag = new RAGEndpoint(this.http);

  }

  /** Server base URL. */
  get baseUrl(): string {
    return this.http.baseUrl;
  }
}

// Re-export everything
export { HttpClient, type ClientOptions } from "./client.js";
export type * from "./types.js";
export { AgentEndpoint } from "./endpoints/agent.js";
export { ChatEndpoint } from "./endpoints/chat.js";
export { CompletionsEndpoint } from "./endpoints/completions.js";
export { CacheEndpoint } from "./endpoints/cache.js";
export { LoRAEndpoint } from "./endpoints/lora.js";
export { MonitorEndpoint } from "./endpoints/monitor.js";
export { RAGEndpoint } from "./endpoints/rag.js";


export default I64Client;
