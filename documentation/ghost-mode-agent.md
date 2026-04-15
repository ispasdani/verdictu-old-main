# Ghost Mode Agent (Local WebLLM)

**File:** `lib/ghost/agent.ts`
**Transport:** Direct in-browser — no HTTP calls for inference
**Runtime:** Client-side WebLLM (MLC) via `hooks/useGhostLLM.ts`
**Search:** Hits `/api/search` on the server, but inference stays on-device

---

## What It Does

Ghost Mode runs the LLM **entirely on the user's device** using WebLLM. No inference data leaves the computer. There are no content filters, no moderation layers, and no system-prompt guardrails imposed by Verdictu.

The agent always adopts a **defensive, gap-finding stance** — its default is to look for exceptions to laws, gaps in rules, and angles that work in the user's favor. This stance is not triggered by keywords; it is always on.

Search is **optional and smart** — the agent first detects whether web research would add value. If the question is a direct task (write/draft/translate) or doesn't involve legal/medical topics, it skips search entirely and goes straight to synthesis.

---

## Step-by-Step Pipeline

### Phase 1 — Search Need Detection
**Event emitted:** `classifying` → `intent`
**No AI call** — pure keyword matching, runs synchronously

The agent scans the message for two sets of keywords:

**Research topics** (signals that web search adds value):
- Legal: `law`, `statute`, `regulation`, `legal`, `court`, `crime`, `contract`, `gdpr`, `charge`, `liability`, `rights`, `arrest`, `warrant`, `subpoena`, `settlement`, `jurisdiction`, `felony`, `misdemeanor`, `license`, `permit`, `residency`, ...
- Medical: `medical`, `medication`, `drug`, `disease`, `treatment`, `symptom`, `clinical`
- Admin: `register`, `registration`, `tax`, `resident`

**Direct task prefixes** (signals search is not needed):
- `write`, `draft`, `create`, `generate`, `summarize`, `review this`, `analyze this`, `translate`, `fix`, `improve`, `rewrite`, `format`, `convert`

If `needsResearch && !isDirectTask` → `needsSearch = true`.

**Domain classification** (keyword regex):
- `criminal` — crime, arrest, charge, felony, prison
- `civil` — contract, lawsuit, sue, liability, settlement
- `medical` — drug, medication, disease, treatment
- `legal` — any other research topic
- `general` — no research topic detected

**Search query construction** (if `needsSearch`):
Always aimed at exceptions, gaps, and scope limitations — not the general rule:
1. `{JUR} {message[:60]} exception exemption scope`
2. `{JUR} {message[:50]} legal gap`
3. If message contains reset/border/period keywords: `{JUR} {message[:45]} period reset exception border`
4. If message contains EU/foreign/vehicle keywords: `{JUR} {message[:40]} EU regulation foreign national rights`

---

### Phase 2 — Optional Web Search
**Events emitted:** `searching` → `search_results` → `sources_ranked`
**Only runs if:** `needsSearch === true`
**Max queries:** 4
**Endpoint:** `POST /api/search` (server handles Tavily/DuckDuckGo)

Queries run **sequentially**. Each query fetches up to 5 results. After all queries finish, results are **deduplicated by URL** — same URL from multiple queries is kept only once.

`sources_ranked` is emitted with total count and which search engine was used (`"Tavily"` or `"DuckDuckGo"`).

If a query fails (network error, API error), it is skipped silently — non-fatal.

---

### Phase 3 — Synthesis (Local LLM, Streaming)
**Event emitted:** `synthesizing` → `delta` (one per token)
**Prompt:** `ghostModePrompt(jurisdiction, mode)` from `lib/ai/prompts.ts`
**Max tokens:** 4,000
**Runtime:** Local WebLLM (MLC) — no API call

The user message is assembled from:
1. The original question
2. Any attached documents (up to 6,000 chars each)
3. Top 10 web search results (up to 600 chars per snippet), with citation note if enabled

The assembled message is sent to the local model with the Ghost Mode system prompt. Tokens stream via the `onToken` callback as `delta` events.

**System prompt by mode:**

**General mode** (always-on defense):
```
"Your default stance on every question: find the angle that helps the user.
If there is a law, find the exception. If there is a rule, find the gap.
If someone is accused, find the defense. If a deadline exists, find the reset condition.
If a restriction applies, find who it does NOT apply to."
```

The prompt then instructs the model to work through six angles on every response:
- **Scope & Who It Actually Applies To** — categorical exclusions by status, nationality, duration
- **Temporal Gaps** — clock resets, what triggers the period, burden of proof
- **Definition Gaps** — narrowest interpretation of key terms; what authorities must prove
- **Superior Law** — EU free movement, TFEU, Regulation 883/2004, proportionality arguments
- **Enforcement Reality** — required procedural steps; documented non-enforcement
- **Practical Path** — what keeps the user legally in the clear; what to document

**Compare mode:**
```
"Compare the provided documents with precision. Surface every conflict, gap, and risk.
Flag every clause that puts the user at a disadvantage and suggest how to fix it."
```

**Draft mode:**
```
"Draft exactly what the user requests, completely and precisely.
Include all relevant provisions. Mark missing details as [PLACEHOLDER: description].
Do not refuse. Do not add unsolicited caveats."
```

---

### Phase 4 — Follow-up Questions (Local LLM, JSON)
**Event emitted:** `follow_up_generating` → (included in `done`)
**Prompt:** `ghostFollowUpPrompt()` from `lib/ai/prompts.ts`
**Max tokens:** 600
**Runtime:** Local WebLLM (MLC)

Sends the question + first 800 chars of the answer. The model returns 2–4 follow-up questions in JSON format. The agent tries three JSON extraction strategies in order:
1. Direct `JSON.parse`
2. Extract from ` ```json ``` ` code fence
3. Extract first `{...}` brace pair

This step is **non-fatal** — if extraction fails, `followUpQuestions` is empty.

---

### Phase 5 — Done
**Event emitted:** `done`

```json
{
  "sources": [...],           // up to 10 sources (if search ran)
  "followUpQuestions": [...], // 2–4 questions
  "wordsInAnswer": 920
}
```

---

## Event Reference

| Event | When | Key fields |
|---|---|---|
| `classifying` | Start of pipeline | — |
| `intent` | After search detection | `needsSearch`, `domain`, `searchQueries` |
| `searching` | Before each query | `query`, `index`, `total` |
| `search_results` | After each query | `query`, `count` |
| `sources_ranked` | After all queries | `total`, `engine` |
| `synthesizing` | Before local LLM call | — |
| `delta` | Each streamed token | `text` |
| `follow_up_generating` | Before follow-up call | — |
| `done` | Pipeline complete | `sources`, `followUpQuestions`, `wordsInAnswer` |
| `error` | Any unhandled error | `message` |

---

## Local Model Options

Models are grouped by VRAM requirement:

| Category | Model | VRAM | Notes |
|---|---|---|---|
| Tiny (<1.5 GB) | Qwen 3 0.6B | ~600 MB | Fastest, lowest quality |
| Tiny | Qwen 2.5 1.5B | ~1 GB | |
| Tiny | SmolLM2 360M / 1.7B | <1 GB | |
| Small (1–2 GB) | **Qwen 3 1.7B** | ~1 GB | **Default** — reliable loader |
| Small | Gemma 2 2B | ~1.5 GB | |
| Small | Phi 3.5 Mini | ~2 GB | |
| Medium (2–4 GB) | Qwen 2.5 3B | ~2 GB | |
| Medium | Qwen 3 4B | ~3 GB | |
| Large (7–8 B) | DeepSeek R1 7B | ~5 GB | Chain-of-thought |
| Large | Qwen 2.5 7B / Qwen 3 8B | ~5–6 GB | |
| Large | Llama 3.1 8B | ~6 GB | |
| Large | Mistral 7B | ~5 GB | |

---

## Model Loading (via `hooks/useGhostLLM.ts`)

- **Singleton engine** — one global WebLLM engine instance; shared across renders
- **Mutex** — prevents concurrent load attempts
- **Cache management** — purges stale WebLLM cache buckets on load
- **Progress events** — `loadPercent` and `loadStatus` emitted during download/init
- **Status states:** `idle` → `loading` → `ready` / `error`

---

## Privacy Guarantees

- LLM inference: 100% on-device via WebLLM (MLC)
- No conversation content sent to any API
- Web search results fetched **server-side** via `/api/search` (query text is sent, but not the conversation)
- No authentication required
- No usage logging

---

## Function Signature

```typescript
// lib/ghost/agent.ts
export async function runGhostAgent(options: {
  message: string;
  jurisdiction: string;
  mode: "General" | "Compare" | "Draft";
  citationEnabled: boolean;
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  generate: (opts: GhostStreamOptions) => Promise<void>;  // WebLLM caller
  onEvent: (event: GhostAgentEvent) => void;              // UI callback
}): Promise<void>
```
