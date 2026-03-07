# vllm-i64

TypeScript SDK for [vllm-i64](https://github.com/Complexity-ML/vllm-i64) — the integer-first inference engine for token-routed language models.

Zero dependencies. Node >= 18.

```bash
npm install vllm-i64
```

## Quick Start

```ts
import { I64Client } from "vllm-i64";

const client = new I64Client("http://localhost:8000");

// Chat completion
const res = await client.chat.create([
  { role: "user", content: "Write a fibonacci function in Python" }
]);
console.log(res.choices[0].message.content);
```

## Streaming

```ts
for await (const chunk of client.chat.stream([
  { role: "user", content: "Explain transformers" }
])) {
  process.stdout.write(chunk);
}
```

## Tool Calls (OpenAI-compatible)

```ts
const res = await client.chat.create(
  [{ role: "user", content: "What's the weather in Paris?" }],
  {
    tools: [{
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"]
        }
      }
    }]
  }
);

if (res.choices[0].message.tool_calls) {
  console.log(res.choices[0].message.tool_calls);
}
```

## Text Completions

```ts
const res = await client.completions.create("def fibonacci(n):", {
  max_tokens: 200,
  temperature: 0.2,
});
console.log(res.choices[0].text);

// Batch — multiple prompts at once
const batch = await client.completions.batch(
  ["Hello", "Bonjour", "Hola"],
  { max_tokens: 50 }
);
```

## Monitoring

```ts
// Live snapshot — batch size, KV cache, tok/s, GPU
const snap = await client.monitor.snapshot();
console.log(`${snap.engine.total_tokens_generated} tokens generated`);
console.log(`${snap.perf?.tok_per_s} tok/s`);
console.log(`KV cache: ${snap.kv_cache?.usage_pct}% used`);

// Health check
const health = await client.monitor.health();
console.log(health.status); // "ok" | "degraded"

// Expert routing distribution (MoE models)
const experts = await client.monitor.experts();
console.log(`${experts.num_experts} experts, imbalance: ${experts.imbalance}`);
```

## KV Cache Management

```ts
// Cache statistics
const stats = await client.cache.stats();
console.log(`${stats.used_blocks}/${stats.num_blocks} blocks used`);
console.log(`${stats.prefix_cached_blocks} prefix blocks cached`);

// Purge prefix cache (admin)
await client.cache.purge();
```

## LoRA Hot-Swap

```ts
// Load an adapter at runtime
await client.lora.load({
  adapter_id: 1,
  path: "/models/lora-python-v2",
  name: "python-specialist",
  scaling: 0.8,
});

// List loaded adapters
const { adapters } = await client.lora.list();
console.log(adapters); // [{ id: 1, name: "python-specialist" }]

// Swap to a different adapter
await client.lora.load({ adapter_id: 2, path: "/models/lora-chat-v3" });

// Unload when done
await client.lora.unload(1);
```

## RAG (Retrieval-Augmented Generation)

```ts
// Index documents
await client.rag.index({ text: "Paris is the capital of France." });
await client.rag.index({ file: "/data/docs/handbook.pdf" });

// Search
const results = await client.rag.search("capital of France", 3);
console.log(results.results[0].text);

// Stats
const ragStats = await client.rag.stats();
console.log(`${ragStats.total_chunks} chunks indexed`);
```

## Authentication

```ts
const client = new I64Client("http://localhost:8000", {
  apiKey: "sk-your-api-key",
  timeoutMs: 30_000,
});
```

## API Reference

| Namespace | Methods |
|---|---|
| `client.chat` | `create()`, `stream()`, `streamRaw()` |
| `client.completions` | `create()`, `stream()`, `batch()` |
| `client.cache` | `stats()`, `purge()` |
| `client.lora` | `load()`, `unload()`, `list()` |
| `client.monitor` | `health()`, `isReady()`, `models()`, `snapshot()`, `metrics()`, `experts()`, `cancel()` |
| `client.rag` | `index()`, `search()`, `stats()` |

## What is vllm-i64?

An integer-first inference engine for token-routed Mixture-of-Experts models. Key features:

- **Token routing**: `expert_id = token_id % num_experts` — deterministic, no learned router
- **Continuous batching**: mixed prefill + decode in every step
- **Paged KV cache**: with prefix caching, LRU eviction, FP8 compression
- **LoRA hot-swap**: load/unload adapters at runtime without restart
- **OpenAI-compatible API**: drop-in replacement for any OpenAI client

Built by [Complexity-ML](https://github.com/Complexity-ML) / INL.

## License

Apache-2.0
