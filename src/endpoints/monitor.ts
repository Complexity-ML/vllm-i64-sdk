/**
 * Monitoring, health, and expert routing endpoints.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  HealthResponse,
  ModelInfo,
  MonitorSnapshot,
  ExpertStats,
} from "../types.js";

export class MonitorEndpoint {
  constructor(private http: HttpClient) {}

  /** Health check with engine stats. */
  async health(): Promise<HealthResponse> {
    return this.http.get("/health");
  }

  /** Check if server is reachable and ready. */
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
    return this.http.get("/v1/models");
  }

  /** Live monitoring snapshot (batch, KV, perf, GPU). */
  async snapshot(): Promise<MonitorSnapshot> {
    return this.http.get("/v1/monitor");
  }

  /** Latency percentiles and request stats. */
  async metrics(): Promise<Record<string, unknown>> {
    return this.http.get("/v1/metrics");
  }

  /** Expert routing distribution (MoE models). */
  async experts(): Promise<ExpertStats> {
    return this.http.get("/v1/experts");
  }

  /** Cancel a running request. */
  async cancel(requestId: string): Promise<{ status: string }> {
    return this.http.post(`/v1/cancel/${requestId}`, {});
  }
}
