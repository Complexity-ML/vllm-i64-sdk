/**
 * KV cache management endpoints.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type { CacheStats, CachePurgeResult } from "../types.js";

export class CacheEndpoint {
  constructor(private http: HttpClient) {}

  /** Get KV cache statistics. */
  async stats(): Promise<CacheStats> {
    return this.http.get("/v1/cache/stats");
  }

  /** Purge prefix cache (admin). */
  async purge(): Promise<CachePurgeResult> {
    return this.http.post("/v1/cache/purge", {});
  }
}
