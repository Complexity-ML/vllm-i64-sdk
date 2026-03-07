/**
 * RAG (Retrieval-Augmented Generation) endpoints.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  RAGIndexParams,
  RAGIndexResult,
  RAGSearchResult,
  RAGStatsResult,
} from "../types.js";

export class RAGEndpoint {
  constructor(private http: HttpClient) {}

  /** Index text or a file. */
  async index(params: RAGIndexParams): Promise<RAGIndexResult> {
    return this.http.post("/v1/rag/index", params);
  }

  /** Search indexed documents. */
  async search(query: string, k: number = 3): Promise<RAGSearchResult> {
    return this.http.post("/v1/rag/search", { query, k });
  }

  /** Get RAG index statistics. */
  async stats(): Promise<RAGStatsResult> {
    return this.http.get("/v1/rag/stats");
  }
}
