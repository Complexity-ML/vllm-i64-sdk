/**
 * LoRA adapter management endpoints.
 *
 * INL - 2025
 */

import type { HttpClient } from "../client.js";
import type {
  LoRALoadParams,
  LoRALoadResult,
  LoRAUnloadResult,
  LoRAListResult,
} from "../types.js";

export class LoRAEndpoint {
  constructor(private http: HttpClient) {}

  /** Load a LoRA adapter (admin). */
  async load(params: LoRALoadParams): Promise<LoRALoadResult> {
    return this.http.post("/v1/lora/load", params);
  }

  /** Unload a LoRA adapter (admin). */
  async unload(adapter_id: number): Promise<LoRAUnloadResult> {
    return this.http.post("/v1/lora/unload", { adapter_id });
  }

  /** List loaded adapters. */
  async list(): Promise<LoRAListResult> {
    return this.http.get("/v1/lora/list");
  }
}
