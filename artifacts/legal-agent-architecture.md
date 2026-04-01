# Legal Agent Architecture
**How the AI legal research agent works end-to-end**

---

## Workflow

```
User Input
    │
    ▼
┌─────────────────────────────┐
│  STEP 1: INTAKE             │
│  Classify the input:        │
│  • Specific law citation     │
│  • General legal question    │
│  • Document to analyze       │
│  Extract: jurisdiction +    │
│  legal domain + entities    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  STEP 2: LAW IDENTIFICATION │  ← Claude with extended thinking
│  "What statutes/articles    │
│   cover this question?"     │
│  Output: list of laws with  │
│  confidence + relevance     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  STEP 3: RESEARCH           │  ← Tool loop (1–3 turns)
│                             │
│  [deep_search OFF]          │
│  → LLM knowledge only       │
│  → Internal law DB (future) │
│                             │
│  [deep_search ON]           │
│  → Web search per law found │
│  → Fetch statute text       │
│  → Search recent case law   │
│  (tools run concurrently)   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  STEP 4: SYNTHESIS          │
│  Combine: laws + results +  │
│  documents + jurisdiction   │
│  Mode: General/Compare/Draft│
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  STEP 5: ANSWER             │
│  Structured output:         │
│  Summary → Legal basis →    │
│  Analysis → Implications    │
│  + Citations if enabled     │
│  + Disclaimer               │
└─────────────────────────────┘
             │
             ▼
    Save to Convex + Stream to UI
```

---

## Deep Search Toggle

| Mode | Sources | Speed | Cost |
|---|---|---|---|
| **Standard** | LLM training knowledge | ~3s | Low |
| **Deep Search** | LLM + live web (DuckDuckGo → Tavily) | ~20–40s | Higher |

- Standard mode is sufficient for common legal questions in supported jurisdictions
- Deep Search is opt-in — user toggles it in the UI before submitting
- DuckDuckGo (`/api/search`) is used in Phase 1; Tavily replaces it in Phase 6
- No external API needed to start — the existing search route already works

---

## Infrastructure Architecture

```
Client UI  ←── SSE stream ───  Next.js /api/agent route
                                         │
                                  proxies events from
                                         │
                                  Convex HTTP Action
                                  (runLegalAgent)
                                         │
                            ┌────────────┴──────────┐
                            │   Claude Tool Loop     │
                            │   Turn 1: identify     │
                            │   Turn 2: research     │
                            │   Turn 3: synthesize   │
                            └────────────┬──────────┘
                                         │
                                  writes to Convex DB
                                  (chatHistories)
```

- **Convex HTTP Action** handles long-running compute (no serverless timeout)
- **Writes directly to Convex DB** after each turn — no extra mutation needed
- **Next.js route** is a thin SSE proxy — no business logic
- **Client subscribes** to `chatHistories` via Convex real-time query

---

## The 5 Agent Tools

Claude decides which tools to call and in what order — the same pattern Claude Code uses to decide between `Bash`, `Read`, `Edit`, etc.

| Tool | When it runs | Concurrency |
|---|---|---|
| `identify_applicable_laws` | Turn 1, always | Serial |
| `search_web` | Turn 2, deep_search=true only | Concurrent (per query) |
| `read_document` | Turn 1–2, if attachments present | Concurrent |
| `compare_documents` | Compare mode only | Serial |
| `draft_document` | Draft mode only | Serial |

---

## Agent Loop (inspired by Claude Code's query.ts)

```
Turn 1
  Claude thinks → calls identify_applicable_laws (+ read_document if needed)
  → receives: list of relevant statutes/articles with confidence scores

Turn 2
  Claude thinks → calls search_web (if deep_search) with targeted queries
  → receives: statute text, case law snippets, commentary
  → may call search_web again for follow-up gaps

Turn 3 (max)
  Claude synthesizes all tool results
  → produces final structured answer
  → no more tool calls
  → save + stream to client
```

Max turns: 3 (prevents runaway costs; covers ~95% of legal queries)

---

## Key Design Decisions

### Why Convex Action (not Next.js API Route)?
- Legal queries take 20–40s — Vercel serverless times out at 10–60s
- Convex actions run up to ~2 minutes
- Results write directly to DB in the same execution context
- Client gets real-time updates via Convex subscriptions (no polling)

### Why a Tool Loop (not a fixed 2-call chain)?
- Claude decides what it needs — more flexible than hardcoded steps
- Research depth adapts to question complexity
- Mirrors how Claude Code works: Claude picks tools, gets results, reasons again
- Supports deep_search=false (skip web tools entirely) without code changes

### Why Extended Thinking on Law Identification?
- Legal classification requires careful reasoning across jurisdictions
- Thinking tokens are cheap relative to hallucination risk
- Confidence scores from reasoning help rank which laws matter most

### Internal Law Database (future)
- Phase 1: LLM training knowledge only
- Phase 2: Convex table with law summaries + vector embeddings for semantic search
- This becomes the "Standard" mode backend — fast, offline, no web dependency

---

## Streaming Events to Client

Events emitted during agent execution (SSE):

```json
{ "step": "intake",       "data": { "jurisdiction": "DK", "domain": "contract" } }
{ "step": "identifying",  "data": { "laws": ["Aftaleloven §30", "GDPR Art. 13"] } }
{ "step": "searching",    "data": { "query": "Aftaleloven §30 text", "count": 3 } }
{ "step": "synthesizing", "data": {} }
{ "step": "delta",        "data": { "text": "Based on §30 of..." } }
{ "step": "done",         "data": { "sources": [...], "usage": {...} } }
```

These map directly to the 11-step UI workflow animation — replacing the fake timers.

---

## Environment Variables Required

```bash
# AI providers
GEMINI_API_KEY=          # default provider (gemini-2.0-flash-lite)
OPENAI_API_KEY=          # optional fallback
ANTHROPIC_API_KEY=       # optional fallback

# For internal search calls
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Future
TAVILY_API_KEY=          # Phase 6 — replaces DuckDuckGo
```

---

## Implementation Order

```
Phase 1 (current)
  ✅ Install AI SDKs (anthropic, openai, google-generative-ai)
  ✅ Provider abstraction (lib/ai/providers.ts)
  ✅ Basic agent route (app/api/agent/route.ts)
  → Define Convex HTTP action (convex/agent.ts)
  → Build tool loop (identify → research → synthesize)
  → Wire deep_search toggle in UI
  → Replace fake step timers with real SSE events

Phase 2
  → Jurisdiction-aware system prompts (already designed)
  → Document context attachment
  → Real citations with footnote rendering
  → Internal law DB (Convex table + embeddings)

Phase 3
  → Full streaming token-by-token
  → Real step progression tied to actual work

Phase 4+
  → Compare mode backend
  → Draft mode backend
  → Credits deduction
  → Tavily search upgrade
```
