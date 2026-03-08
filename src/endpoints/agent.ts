/**
 * Agent endpoint — orchestrated tool-use loop via proxy.
 *
 * Sends messages to an external LLM (Claude, GPT, etc.) through
 * the complexity proxy. The server executes tools (sandbox, RAG)
 * and loops until the LLM produces a final text answer.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  ChatMessage,
  AgentRequest,
  AgentResponse,
  AgentStep,
} from "../types.js";

export interface AgentRunOptions {
  model: string;
  provider?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** Called after each tool-use step completes. */
  onStep?: (step: AgentStep) => void;
}

export class AgentEndpoint {
  constructor(private http: HttpClient) {}

  /**
   * Run the agent loop — the server handles tool execution.
   *
   * @example
   * ```ts
   * const result = await client.agent.run(
   *   [{ role: "user", content: "Write a Python script that computes fibonacci(30)" }],
   *   { model: "claude-sonnet-4-20250514" },
   * );
   * console.log(result.response);
   * console.log(`Steps: ${result.steps.length}`);
   * ```
   */
  async run(
    messages: ChatMessage[],
    options: AgentRunOptions,
  ): Promise<AgentResponse> {
    const body: AgentRequest = {
      model: options.model,
      messages,
      provider: options.provider,
      temperature: options.temperature,
      top_p: options.top_p,
      max_tokens: options.max_tokens,
    };

    const res = await this.http.post<AgentResponse>("/api/proxy/agent", body);

    if (options.onStep) {
      for (const step of res.steps) {
        options.onStep(step);
      }
    }

    return res;
  }
}
