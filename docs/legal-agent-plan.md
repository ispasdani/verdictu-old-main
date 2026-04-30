# Verdictu Legal Agent — Implementation Plan

> Goal: Compete with Harvey and Legora. Full agentic legal intelligence with Ghost privacy modes as the primary differentiator.

---

## The Dispatch Matrix

Every phase respects this. User settings drive which path runs.

```
User presses send
        ↓
┌─ Ghost Local? ──────────────────────────────────────────────┐
│  WebLLM model in browser                                     │
│  Simplified tool loop (browser-side)                         │
│  Memory: IndexedDB only                                      │
│  Search: proxy route (no logging) or user's Tavily key       │
│  Storage: nothing persisted server-side                      │
└──────────────────────────────────────────────────────────────┘
        ↓
┌─ Ghost Open (Claude key)? ───────────────────────────────────┐
│  Full agentic loop on server, stateless                      │
│  Model: claude-3-7-sonnet or claude-sonnet-4-6 (user's key)  │
│  Extended thinking + full tool use                           │
│  Memory: client sends context, server writes nothing         │
│  ┌─ Convex opted in? ───────────────────────────────────────┐│
│  │  + RAG over law articles (public data — privacy fine)    ││
│  │  + Persistent precedent store in Convex                  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**General mode** uses the same dispatch but routes to a simpler non-legal loop (no law identification, no jurisdiction search).

The `AgentConfig` type drives every dispatch decision:

```typescript
type AgentConfig = {
  provider: "ghost_local" | "ghost_open"
  claudeApiKey?: string
  claudeModel: string
  storageMode: "local_only" | "convex"
  useConvexRag: boolean
  tavilyKey?: string
}
```

---

## Build Order

| Phase | Delivers | Effort | Status |
|---|---|---|---|
| 7 — Settings & Config | Dispatch matrix foundation | Small | ⬜ |
| 1 — Agentic Loop | Tool use + extended thinking + visible steps | Large | ⬜ |
| 2 — Context Management | Compaction + chunking + prompt caching | Medium | ⬜ |
| 3 — Client Memory | IndexedDB + export/import + local precedents | Medium | ⬜ |
| 4 — Sub-agents | Parallel research + company research | Medium | ⬜ |
| 5 — Convex RAG | Law DB search + persistent precedents | Medium | ⬜ |
| 6 — Ghost Local Upgrade | WebLLM with tool use | Large | ⬜ |

Start with **Phase 7** (settings) because it defines the dispatch matrix every subsequent phase plugs into. Then **Phase 1** (agentic loop) because it is the foundation. Everything else is additive.

---

## Phase 7 — Settings & Configuration System

**Delivers:** A settings page where users configure their agent. The dispatch matrix is driven by this config.

### User-facing settings

```
Provider
  ○ Ghost Local (on-device, no internet required)
  ● Ghost Open (your Claude API key)
    Claude API Key: [sk-ant-...]
    Model: [claude-3-7-sonnet ▾]

Storage
  ○ Local only (all data stays in your browser)
  ● Sync with Verdictu (encrypted, cross-device)

Research
  [✓] Use Verdictu law database (requires Sync)
  [✓] Deep search (Tavily)
  [ ] Bring your own Tavily key: [tvly-...]

Privacy
  [Export all my data →]
  [Import conversation →]
```

### Files

- `store/agentConfigStore.ts` — persisted Zustand store for `AgentConfig`
- `components/settings/AgentSettings.tsx` — settings UI panel
- `lib/agent/config.ts` — `AgentConfig` type + config reader used by all routes

---

## Phase 1 — True Agentic Loop

**Delivers:** The agent thinks and decides what to do. No more hardcoded 4-step sequence. Extended thinking visible as "Thinking...". Each tool call shown as a step. Legora-parity on the core loop.

### What the user sees streaming

```
Thinking...
Reading COMPANY_A.txt for party details...
Searching web for "Swedish employment termination clause"...
Searching web for "UK employment termination clause"...    ← parallel
Thinking...
Searching web for "IP ownership joint venture EU"...
Thinking...
Synthesizing...
```

### Tools — Phase 1 set

| Tool | What it does | Available in |
|---|---|---|
| `web_search(query, jurisdiction?)` | Tavily search, optional jurisdiction filter | All modes |
| `read_document(name, topic)` | Retrieve relevant chunks from uploaded docs | All modes |
| `think(reasoning)` | Forces explicit reasoning step shown as Thinking... | All modes |

### Key technical decisions

- Extended thinking: `budget_tokens: 8000` (adjustable per plan tier)
- Max loop turns: 12 (prevents runaway agents)
- Parallel tool calls: Claude can request two `web_search` calls in one turn — execute both with `Promise.all()` and return both results
- Every tool call name maps to a human-readable SSE step label shown in the UI

### Files

- `lib/agent/core/loop.ts` — model-agnostic agentic loop runner
- `lib/agent/core/tools.ts` — tool definitions (Anthropic format) + handlers
- `lib/agent/core/streaming.ts` — maps tool calls to human-readable SSE step labels
- `app/api/agent/route.ts` — gutted and rebuilt on top of `loop.ts`
- `app/api/ghost-api/route.ts` — same, uses user's Claude key instead of Verdictu's

---

## Phase 2 — Context Management

**Delivers:** The agent handles long conversations and large documents without breaking. The user sees "Compacting history..." when it triggers. Documents are chunked, not truncated.

### Three problems solved

**A — Document chunking (replaces `slice(0, 8000)` truncation)**

Documents are chunked into ~600 token pieces on the server when received. The `read_document` tool does semantic retrieval — given a topic, returns only the relevant chunks. A 50-page contract is never fully in context at once.

**B — Conversation compaction**

When conversation history exceeds ~80k tokens, the server runs a compaction pass: summarizes resolved turns into a structured working state object, keeps the last 3 full turns verbatim, discards the rest. The compacted summary is sent back to the client as an SSE event. The client stores it and sends it instead of raw history on the next turn.

Working state structure:
```typescript
{
  parties: [{ name, role, jurisdiction, key_facts }],
  research: { term: finding },
  draft: { current_version, disputed_clauses },
  decisions: string[],
  precedents_used: string[]
}
```

**C — Prompt caching (cost reduction)**

Long documents and system prompts get `cache_control: { type: "ephemeral" }` markers. Turn 1 costs full price. Turns 2-N cost ~10%.

### Files

- `lib/agent/context/compaction.ts` — summarize turns into working state
- `lib/agent/context/chunker.ts` — document chunking + in-memory retrieval
- `lib/agent/context/cache-markers.ts` — Anthropic prompt cache insertion

---

## Phase 3 — Client-side Memory (IndexedDB)

**Delivers:** Zero server-side storage for privacy users. Export/import chat as `.verdictu` JSON. Precedent store in the browser.

### IndexedDB structure

```
IndexedDB (verdictu-db)
├── conversations/      ← all turns, by chat ID
├── documents/          ← uploaded contracts and PDFs (full text + chunks)
├── working-states/     ← compacted state per chat
└── precedents/         ← tagged contracts for future retrieval
```

### Export / Import

- Export: single `.verdictu` JSON file — all turns, attachments, working state, sources
- Import: drop a `.verdictu` file, conversation is restored exactly
- Format is open — users own their data completely

### Precedent retrieval (stateless users)

When user says "use the Company C/D contract", the agent calls `retrieve_precedent("Company C Company D")`. In stateless mode this runs a keyword search over the browser's IndexedDB precedent store and returns relevant clauses. No server involved.

### Files

- `lib/memory/client-store.ts` — IndexedDB wrapper (conversations, documents, working states)
- `lib/memory/precedent-search.ts` — keyword search over local precedents
- `lib/memory/export-import.ts` — serialize/deserialize full conversations as JSON
- UI: export button in chat header, import on new chat screen

---

## Phase 4 — Sub-agents & Parallel Jurisdiction Research

**Delivers:** "Launching legal research sub-agent..." step. Parallel work across jurisdictions. Feels like a team of lawyers.

### New tools added

| Tool | What it does |
|---|---|
| `spawn_legal_research(task, jurisdictions[])` | Sub-agent focused on one legal topic, searches all jurisdictions in parallel |
| `spawn_company_research(company_name)` | Looks up company info, shareholders, registration jurisdiction |
| `draft_document_section(type, context)` | Structured drafting — generates specific clauses |

### What the user sees

```
Launching legal research sub-agent (IP ownership)...
  [Research] Searching Swedish law for "IP ownership joint venture"...
  [Research] Searching UK law for "IP ownership joint venture"...
  [Research] Synthesizing...
Legal research complete.
Launching company research sub-agent (Company A)...
  [Company] Searching for Company A shareholders...
  [Company] Complete.
Thinking...
```

### How sub-agents work

A sub-agent is a second Claude call scoped to one task with its own tool set. It runs its own loop, returns a synthesized finding to the orchestrator. Independent sub-agents run in parallel via `Promise.all()`. Each sub-agent forwards its step events upstream with a `[SubAgent Name]` prefix.

### Files

- `lib/agent/subagents/legal-research.ts` — legal research sub-agent
- `lib/agent/subagents/company-research.ts` — company info sub-agent
- `lib/agent/subagents/runner.ts` — generic sub-agent executor with step forwarding

---

## Phase 5 — Convex RAG (opt-in)

**Delivers:** The agent searches the actual law article database. Persistent precedents across sessions and devices. Team precedent libraries.

Only activates when the user has opted into Convex storage. The `articles` table already has a vector index defined (`by_embedding`, 1536 dims). It just needs to be populated.

### New tool

- `search_law_database(query, jurisdiction)` — hits `articles.vectorIndex` in Convex, returns real statute text with article numbers and citations

### New Convex table

```typescript
documents: {
  userId: Id<"users">
  organizationId?: Id<"organizations">
  title: string
  type: "contract" | "memo" | "brief" | "precedent"
  content: string
  embedding: number[]          // 1536 dims
  parties: string[]
  jurisdiction: string
  tags: string[]
  createdAt: number
}
// .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536, filterFields: ["jurisdiction", "userId"] })
```

### Precedent retrieval (Convex users)

`retrieve_precedent` tool does a vector search over this table and returns the top 3 matching documents with the most relevant clauses extracted. Shared within an organization — the whole firm's precedent library is searchable.

### Files

- `convex/schema.ts` — add `documents` table
- `convex/documents.ts` — mutations and vector search queries
- `lib/agent/tools/law-db.ts` — `search_law_database` tool handler (calls Convex)
- `lib/agent/tools/precedent-convex.ts` — Convex-backed `retrieve_precedent` handler

---

## Phase 6 — Ghost Local Upgrade (WebLLM with tool use)

**Delivers:** True offline, on-device agentic legal work. Simpler capability than Ghost Open but absolute privacy.

### Model selection

| Model | Tool use | Legal quality | Hardware req |
|---|---|---|---|
| `Qwen2.5-7B-Instruct` | ✅ | Good | Mid-range GPU |
| `Llama-3.1-8B-Instruct` | ✅ | Good | Mid-range GPU |
| `Llama-3.3-70B-Instruct` | ✅ | Excellent | High-end GPU |

Recommended default: `Qwen2.5-7B-Instruct` (best reasoning at 7B for legal tasks).

### Ghost Local tool set (simplified)

| Tool | Available | Reason |
|---|---|---|
| `web_search` | ✅ Via proxy route | Browser fetches your no-log proxy |
| `read_document` | ✅ In-memory | Client-side chunking |
| `retrieve_precedent` | ✅ IndexedDB | Client-side |
| `draft_document_section` | ✅ | Model handles directly |
| `spawn_legal_research` | ❌ | Too heavy for 7B model |
| `search_law_database` | ❌ | Requires Convex |
| `spawn_company_research` | ❌ | Too heavy for 7B model |

Ghost Local is ~70% capability at 100% privacy. Position: "Research and drafting with no data leaving your device. For the most demanding work, switch to Ghost Open."

### Files

- `lib/ghost/local-loop.ts` — browser-side agentic loop for WebLLM
- `lib/ghost/local-tools.ts` — browser-executable tool handlers
- Update existing WebLLM integration to switch from simple completion to tool-use loop

---

## What you cannot do without persistence (honest limits)

| Feature | Requires | Workaround |
|---|---|---|
| Cross-device chat history | Convex | Export/import JSON |
| Team precedent library | Convex | Each user has local copy |
| RAG over law articles | Convex vector index | Web search covers it |
| Cross-session working memory | Convex or IndexedDB | IndexedDB (same device) |

---

## Competitive positioning

| | Harvey | Legora | **Verdictu Ghost Open** |
|---|---|---|---|
| Agentic research | ✅ | ✅ | ✅ (Phase 1-4) |
| Multi-jurisdiction | ✅ | ✅ | ✅ (Phase 4) |
| Contract drafting | ✅ | ✅ | ✅ (Phase 4) |
| Precedent retrieval | ✅ | ✅ | ✅ (Phase 3/5) |
| Zero data storage | ❌ | ❌ | ✅ |
| On-device model | ❌ | ❌ | ✅ (Phase 6) |
| Bring your own key | ❌ | ❌ | ✅ |
| Open data format | ❌ | ❌ | ✅ (export/import) |
