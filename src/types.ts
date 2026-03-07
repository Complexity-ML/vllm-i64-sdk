/**
 * vllm-i64 SDK — Type definitions
 *
 * All interfaces for requests, responses, and API objects.
 *
 * INL - 2025
 */

// =========================================================================
// Chat
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
  min_p?: number;
  typical_p?: number;
  repetition_penalty?: number;
  min_tokens?: number;
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
  usage?: UsageInfo;
}

// =========================================================================
// Completions
// =========================================================================

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
  usage?: UsageInfo;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// =========================================================================
// Streaming
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
// Health & models
// =========================================================================

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  uptime_seconds: number;
  model_loaded: boolean;
  kv_cache_usage_pct?: number;
  gpu?: GpuInfo;
  [key: string]: unknown;
}

export interface GpuInfo {
  free_mb: number;
  total_mb: number;
  used_mb: number;
  utilization_pct: number;
}

export interface ModelInfo {
  id: string;
  object: "model";
  owned_by: string;
}

// =========================================================================
// Cache
// =========================================================================

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

export interface CachePurgeResult {
  status: string;
  purged_blocks: number;
}

// =========================================================================
// Monitoring
// =========================================================================

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

// =========================================================================
// Expert routing
// =========================================================================

export interface ExpertStats {
  num_experts: number;
  total_tokens: number;
  distribution: number[];
  counts: number[];
  imbalance: number;
}

// =========================================================================
// LoRA
// =========================================================================

export interface LoRAAdapter {
  id: number;
  name: string;
}

export interface LoRALoadParams {
  adapter_id: number;
  path: string;
  name?: string;
  scaling?: number;
}

export interface LoRALoadResult {
  status: string;
  adapter_id: number;
  name: string;
}

export interface LoRAUnloadResult {
  status: string;
  adapter_id: number;
}

export interface LoRAListResult {
  adapters: LoRAAdapter[];
}

// =========================================================================
// RAG
// =========================================================================

export interface RAGIndexParams {
  text?: string;
  file?: string;
}

export interface RAGIndexResult {
  status: string;
  chunks: number;
}

export interface RAGSearchResult {
  query: string;
  results: RAGResult[];
  count: number;
}

export interface RAGResult {
  text: string;
  score: number;
  [key: string]: unknown;
}

export interface RAGStatsResult {
  enabled: boolean;
  total_chunks: number;
  dimension: number;
}

// =========================================================================
// Search (Perplexity-style)
// =========================================================================

export interface SearchCompletionRequest {
  query: string;
  max_tokens?: number;
  temperature?: number;
  search_count?: number;
  user?: string;
  stream?: boolean;
}

export interface SearchSource {
  index: number;
  title: string;
  url: string;
  domain: string;
  favicon: string;
}

export interface SearchCompletionResponse {
  id: string;
  object: "search.completion";
  model: string;
  query: string;
  choices: {
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: "stop" | "length";
  }[];
  sources: SearchSource[];
  usage?: UsageInfo;
}

export interface SearchHistoryEntry {
  query: string;
  sources: SearchSource[];
  answer: string;
  timestamp: number;
}

export interface SearchHistoryResponse {
  history: SearchHistoryEntry[];
  count: number;
}

export interface SearchStatsResponse {
  enabled: boolean;
  num_partitions: number;
  total_keys: number;
  total_entries: number;
  max_per_key: number;
  persist_dir: string | null;
}
