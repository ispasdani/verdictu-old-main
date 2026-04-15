# Ghost API Agent (Cloud via OpenRouter)

**File:** `app/api/ghost-api/route.ts`
**Transport:** SSE (Server-Sent Events) over HTTP POST to `/api/ghost-api`
**Runtime:** Node.js (Next.js route, `maxDuration: 120s`)
**AI provider:** OpenRouter (requires `OPENROUTER_API_KEY`)

---

## What It Does

Ghost API Mode is the cloud equivalent of Ghost Mode. It uses the same always-on defensive stance and smart-search pipeline, but inference runs via **OpenRouter** instead of a local WebLLM model. This enables access to much larger models (up to 70B+ parameters) while keeping the same philosophy: find exceptions, gaps, and angles that help the user.

Currently the authentication and billing layer is **not wired** — the route accepts requests without auth checks. Clerk + Convex integration is planned but not yet implemented (see TODOs in the source).

---

## Step-by-Step Pipeline

### Phase 1 — Search Need Detection
**SSE events:** `classifying` → `intent`
**No AI call** — keyword matching only (same logic as Ghost Mode local agent)

Identical keyword detection to `lib/ghost/agent.ts`:
- Scans for ~50 research-topic keywords (legal, medical, admin)
- Detects direct-task prefixes (`write`, `draft`, `create`, etc.)
- `needsSearch = needsResearch && !isDirectTask`

Domain classified as: `criminal` / `civil` / `medical` / `legal` / `general`

**Search queries always target exceptions and gaps:**
1. `{JUR} {message[:60]} exception exemption scope`
2. `{JUR} {message[:50]} legal gap`
3. (If reset/border/period keywords present) `{JUR} {message[:45]} period reset exception border`
4. (If EU/foreign/vehicle keywords present) `{JUR} {message[:40]} EU regulation foreign national rights`

---

### Phase 2 — Optional Web Search
**SSE events:** `searching` → `search_results` → `sources_ranked`
**Only runs if:** `needsSearch === true`
**Max queries:** 4
**Provider:** Tavily API (`TAVILY_API_KEY` env var) or DuckDuckGo fallback

Unlike Ghost Mode local (which calls `/api/search`), this route calls `search()` directly from `lib/search/tavily.ts` since it already runs server-side.

Queries run **sequentially**. Each fetches up to 5 results. Results are deduplicated by URL after all queries complete.

`sources_ranked` emits total count and `"Tavily"` or `"DuckDuckGo"` based on which key is configured.

---

### Phase 3 — Synthesis via OpenRouter (Streaming)
**SSE events:** `synthesizing` → `delta` (one per token)
**Prompt:** `ghostModePrompt(jurisdiction, mode)` from `lib/ai/prompts.ts`
**Function:** `streamOpenRouter()` from `lib/ghost/openrouter.ts`

The user message is assembled from:
1. Original question
2. Attached documents (up to 6,000 chars each)
3. Top 10 search results (up to 600 chars per snippet), with citation note if enabled

`streamOpenRouter` is called with:
- `messages`: system prompt + assembled user message
- `model`: selected OpenRouter model ID
- `onToken`: callback that emits each token as a `delta` SSE event
- `onDone`: receives `{ inputTokens, outputTokens }` usage stats
- `signal`: the request's `AbortSignal` (handles client disconnect)

**System prompt is identical to Ghost Mode local** — same `ghostModePrompt()` function.

---

### Phase 4 — Follow-up Questions (OpenRouter, JSON)
**SSE event:** `follow_up_generating` → (included in `done`)
**Prompt:** `ghostFollowUpPrompt()` from `lib/ai/prompts.ts`
**Function:** Another `streamOpenRouter()` call, accumulating text

Sends the question + first 800 chars of the answer. Text is collected then parsed with a three-step extraction strategy:
1. Direct `JSON.parse`
2. Extract from ` ```json ``` ` code fence
3. Extract first `{...}` brace pair

Non-fatal — empty array if extraction fails.

---

### Phase 5 — Done
**SSE event:** `done`

```json
{
  "sources": [...],           // up to 10 sources
  "followUpQuestions": [...], // 2–4 questions
  "wordsInAnswer": 1200
}
```

Note: `creditsRemaining` field is planned but commented out pending Convex integration.

---

## Event Reference

| Event | When | Key fields |
|---|---|---|
| `classifying` | Start of pipeline | — |
| `intent` | After search detection | `needsSearch`, `domain`, `searchQueries` |
| `searching` | Before each query | `query`, `index`, `total` |
| `search_results` | After each query | `query`, `count` |
| `sources_ranked` | After all queries | `total`, `engine` |
| `synthesizing` | Before OpenRouter call | `model` (model ID) |
| `delta` | Each streamed token | `text` |
| `follow_up_generating` | Before follow-up call | — |
| `done` | Pipeline complete | `sources`, `followUpQuestions`, `wordsInAnswer` |
| `error` | Any unhandled error | `message` |

---

## Available Models (via OpenRouter)

Models are grouped by characteristic:

### Reasoning — best for finding legal gaps and exceptions
| Model | Context | Notes |
|---|---|---|
| **DeepSeek R1** (default) | 128k | Chain-of-thought reasoning |
| DeepSeek R1 (May 2025) | 128k | Latest checkpoint |
| QwQ 32B | 32k | Alibaba's reasoning model |
| Nemotron 70B | 128k | NVIDIA fine-tune of Llama 3.1 |

### Fast — lower latency responses
| Model | Context | Notes |
|---|---|---|
| Llama 3.3 70B | 128k | Meta's latest flagship |
| Mistral Large (Nov 2024) | 128k | EU-aligned, GDPR-aware |
| Qwen 2.5 72B | 128k | Alibaba open-source |
| Gemini 1.5 Flash | 1M | Massive context window |

### Unrestricted — no content filters
| Model | Context | Notes |
|---|---|---|
| Nous Hermes 3 70B | 128k | No system-prompt guardrails |
| Dolphin 3.0 R1 22B | 32k | Explicitly uncensored + R1 reasoning |
| Dolphin Mixtral 8x7B | 32k | Classic uncensored, MoE architecture |
| Euryale 70B v3 | 128k | Uncensored Llama 3.3 fine-tune |
| Nous Capybara 7B | 8k | Lightweight uncensored |

---

## Request Body

```typescript
{
  message: string;              // required
  jurisdiction: string;         // defaults to "EU"
  mode?: "General" | "Compare" | "Draft";  // defaults to "General"
  citationEnabled?: boolean;    // defaults to true
  attachments?: Array<{ name: string; extractedText: string }>;
  modelId?: string;             // OpenRouter model ID, defaults to DeepSeek R1
}
```

---

## Backend Integration Status

| Feature | Status |
|---|---|
| OpenRouter streaming | Ready |
| Ghost agent pipeline | Ready |
| Tavily/DDG search | Ready |
| Clerk authentication | Not wired (TODO Phase 1) |
| Convex credit check | Not wired (TODO Phase 1) |
| Convex credit deduction | Not wired (TODO Phase 1) |
| Convex usage logging | Not wired (TODO Phase 2) |

See `docs/ghost-api-billing-plan.md` for the planned integration order.

---

## Differences from Ghost Mode Local

| Aspect | Ghost Mode (Local) | Ghost API (Cloud) |
|---|---|---|
| Inference | On-device WebLLM | OpenRouter API |
| Privacy | 100% on-device | Query sent to OpenRouter |
| Model size | 0.6B–8B | Up to 70B+ |
| Max context | 4k–32k (varies) | Up to 1M (Gemini Flash) |
| Auth required | No | No (planned) |
| Cost | Free (local VRAM) | Per-query credits (planned) |
| Setup | Download model first | Instant (API key required) |
| Search | Calls `/api/search` | Calls `search()` directly |
