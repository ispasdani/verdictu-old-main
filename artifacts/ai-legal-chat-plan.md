# AI Legal Chat — Implementation Plan
**From Mockup to Production**

> **Current state:** The UI is fully built — chat input, 3 modes (General/Compare/Draft), 11-step workflow animation, jurisdiction selector, document extraction, and DuckDuckGo search. **Nothing connects to a real LLM.** This plan closes that gap end-to-end.

---

## What Is Hardcoded Right Now

| Location | What's Fake | Evidence |
|---|---|---|
| `/app/(agent)/chat/[id]/page.tsx` | 11-step workflow with hardcoded timing/animations | No API calls, steps are purely CSS/timer driven |
| `/app/api/search/route.ts` | Search works but is never called from the chat flow | Exists as a standalone endpoint, not wired to any agent |
| `/json/*.json` | Articles, features, success stories, news | Static files imported directly |
| Chat responses | No responses at all | LLM SDK not installed |
| Citations, Compare, Draft modes | UI buttons exist, zero logic behind them | No backend mutations or API routes |
| Credits system | `credits` field exists in schema, `deductCredits` mutation defined | Never called |

---

## Phase 1 — Core LLM Integration (Make It Work)

### 1.1 Install the Anthropic SDK

```bash
npm install @anthropic-ai/sdk
```

Add to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 1.2 Create `/app/api/agent/route.ts`

This is the single most critical missing file. It receives the user message + context and returns a real answer.

**Two-call pattern** (already documented in `/docs/web-search-integration.md`):

```
Call 1: Claude generates 3–5 search queries based on jurisdiction + user question
        ↓
Run /api/search for each query in parallel (DuckDuckGo Lite, already built)
        ↓
Call 2: Claude synthesizes a legal answer from the question + search results
```

**Minimal implementation:**

```typescript
// POST /api/agent
// Body: { message, jurisdiction, mode, attachments?, citationEnabled }

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { message, jurisdiction, mode, attachments, citationEnabled } = await req.json();

  // Call 1: Generate search queries
  const queryResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 300,
    system: `You are a legal research assistant. Generate 3 search queries to answer the user's legal question.
             Jurisdiction: ${jurisdiction}. Return a JSON array of strings only.`,
    messages: [{ role: "user", content: message }],
  });

  const queries: string[] = JSON.parse(queryResponse.content[0].text);

  // Search (reuse existing /api/search)
  const results = await Promise.all(
    queries.map((q) =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/search`, {
        method: "POST",
        body: JSON.stringify({ query: q, maxResults: 5 }),
      }).then((r) => r.json())
    )
  );

  const sources = results.flat();

  // Call 2: Synthesize answer
  const systemPrompt = buildLegalSystemPrompt(jurisdiction, mode, citationEnabled);

  const answerResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: buildUserMessage(message, sources, attachments),
      },
    ],
  });

  return Response.json({
    answer: answerResponse.content[0].text,
    sources,
    usage: answerResponse.usage,
  });
}
```

### 1.3 Wire the Chat Page to the Real API

In `/app/(agent)/chat/[id]/page.tsx`, replace the hardcoded step timers with real API calls:

```typescript
// Replace: setTimeout(() => setStep(x), 2000)
// With: actual fetch calls that advance steps as work completes

const sendMessage = async (input) => {
  setStep("analyzing");   // step 2: show "Task Analysis" as active

  // Steps 1–4 advance instantly (jurisdiction lock, task analysis, strategy, queries)
  // Step 5 triggers when search starts
  // Step 11 triggers when Claude's answer streams in

  const res = await fetch("/api/agent", {
    method: "POST",
    body: JSON.stringify(input),
  });

  const { answer, sources } = await res.json();

  // Save to Convex chatHistories
  await saveChatMessage({ chatId, role: "assistant", content: answer, sources });
};
```

### 1.4 Save Real Messages to Convex

Add Convex mutations for chat messages (schema already has `chatHistories` with a `messages` array):

```typescript
// convex/chatHistories.ts

export const addMessage = mutation({
  args: {
    chatHistoryId: v.id("chatHistories"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sources: v.optional(v.array(/* source shape */)),
  },
  handler: async (ctx, args) => {
    // Push to the messages array in the chatHistory document
  },
});
```

---

## Phase 2 — Jurisdiction-Aware Legal Quality

The jurisdiction selector exists in the UI but is ignored by the backend. This is where legal accuracy lives.

### 2.1 System Prompt Per Jurisdiction

Build a `buildLegalSystemPrompt(jurisdiction, mode)` function:

```typescript
const JURISDICTION_CONTEXT = {
  DK: "Danish law (Retsplejeloven, GDPR as implemented in DK). Cite Danish legislation and court practice (Højesteret, Landsretterne).",
  DE: "German law (BGB, HGB, GG). Cite German statutes and BGH case law.",
  EU: "EU law (Treaties, Regulations, Directives). Cite EUR-Lex sources.",
  UK: "English and Welsh law post-Brexit. Cite UK statutes and case law (UKSC, EWCA).",
  FR: "French law (Code civil, Code de commerce). Cite French legislation and Cour de cassation.",
  SE: "Swedish law (Rättsfall från Högsta domstolen). Cite Swedish statutes.",
  NL: "Dutch law (BW, WvSr). Cite Dutch legislation and Hoge Raad.",
};

function buildLegalSystemPrompt(jurisdiction: string, mode: string): string {
  const base = `You are a legal research assistant specializing in ${JURISDICTION_CONTEXT[jurisdiction] ?? "general international law"}.

Always:
- Cite specific articles, sections, and case references
- Distinguish clearly between established law and legal opinion
- Flag when an answer may require a licensed local attorney
- Structure answers: Summary → Legal basis → Analysis → Practical implications`;

  if (mode === "Compare") {
    return base + "\n\nYou are comparing two documents. Identify conflicts, gaps, and risk areas between them.";
  }
  if (mode === "Draft") {
    return base + "\n\nYou are drafting a legal document. Use formal legal language appropriate for the jurisdiction.";
  }
  return base;
}
```

### 2.2 Attach Document Context to Prompts

The UI already extracts text from uploaded files (PDF, DOCX, TXT) client-side. That text is in the Zustand store. Pass it into the API call:

```typescript
// In aiChatInput.tsx, when submitting:
const attachmentTexts = attachments.map((a) => ({
  filename: a.file.name,
  text: a.extractedText, // already extracted
}));

// In the API, include in the user message:
function buildUserMessage(question, sources, attachments) {
  let content = question;

  if (attachments?.length) {
    content += "\n\n--- ATTACHED DOCUMENTS ---\n";
    attachments.forEach((a) => {
      content += `\n[${a.filename}]\n${a.text.slice(0, 8000)}\n`; // token budget
    });
  }

  if (sources?.length) {
    content += "\n\n--- SEARCH RESULTS ---\n";
    sources.forEach((s) => {
      content += `\n[${s.title}] (${s.url})\n${s.snippet}\n`;
    });
  }

  return content;
}
```

---

## Phase 3 — Streaming (Better UX)

Right now a 2-call LLM chain takes 10–20 seconds with no feedback. Replace the fake animation with real streaming.

### 3.1 Server-Sent Events from `/api/agent`

```typescript
// Stream the response using Anthropic's streaming API
const stream = await client.messages.stream({
  model: "claude-opus-4-6",
  max_tokens: 2000,
  system: systemPrompt,
  messages: [...],
});

const encoder = new TextEncoder();
const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta.text })}\n\n`));
      }
    }
    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    controller.close();
  },
});

return new Response(readable, {
  headers: { "Content-Type": "text/event-stream" },
});
```

### 3.2 Stream Steps From the Server

Emit step-progress events before the final answer so the 11-step UI reflects real work:

```
data: {"step": "search_queries", "queries": ["What is...", "How does..."]}
data: {"step": "web_search", "count": 12}
data: {"step": "synthesizing"}
data: {"delta": "Based on Article 13..."} (streaming text)
data: [DONE]
```

This makes the animated workflow component display real step names, timings, and metadata — not fake timers.

---

## Phase 4 — Compare Mode (Document vs. Document)

Compare mode exists in the UI but has no backend. The user uploads two documents and expects a diff/conflict analysis.

### 4.1 API Extension

```typescript
// POST /api/agent with mode: "Compare"
// Body: { mode: "Compare", documentA: { filename, text }, documentB: { filename, text }, jurisdiction }

const comparison = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 3000,
  system: `You are a legal document comparison specialist. ${JURISDICTION_CONTEXT[jurisdiction]}

  Return a structured analysis:
  1. Document Overview (each document's purpose and key terms)
  2. Conflicts (clauses that directly contradict each other)
  3. Gaps (obligations in one document absent from the other)
  4. Risk Assessment (HIGH/MEDIUM/LOW with explanation)
  5. Recommendations`,
  messages: [{
    role: "user",
    content: `Document A: ${documentA.filename}\n${documentA.text}\n\nDocument B: ${documentB.filename}\n${documentB.text}`,
  }],
});
```

---

## Phase 5 — Draft Mode (Document Generation)

### 5.1 API Extension

```typescript
// POST /api/agent with mode: "Draft"
// Body: { mode: "Draft", description, jurisdiction, documentType }

// Add a classification step first: what type of document is being requested?
// Then generate with jurisdiction-appropriate structure and clauses.
```

### 5.2 Export to DOCX

Use the `mammoth` library (already installed) in reverse — or add `docx` npm package — to export the generated document as a downloadable `.docx` file.

```bash
npm install docx
```

---

## Phase 6 — Better Search (Upgrade from DuckDuckGo)

DuckDuckGo Lite scraping is fragile (rate limits, bot detection, HTML changes). Replace with real APIs when budget allows.

| Option | Cost | Quality | Jurisdiction Depth |
|---|---|---|---|
| DuckDuckGo Lite (current) | Free | Low | General web |
| **Tavily API** | $0.001/search | High | Good |
| **Perplexity API** | $0.005/req | Very High | Good |
| **EUR-Lex API** | Free | Very High | EU law only |
| **Lovdata API (NO)** | Subscription | Very High | Nordic law |
| **Westlaw/LexisNexis** | Expensive | Authoritative | All jurisdictions |

**Recommended immediate upgrade:** Tavily. Drop-in replacement for the current `/api/search` endpoint, structured results, no scraping fragility.

```bash
npm install @tavily/core
```

---

## Phase 7 — Citations (Real, Not UI-Only)

The UI has a "Citations" toggle. It should:

1. Instruct Claude to return citations in a structured format (JSON with `[1]` inline markers)
2. Render citations as numbered footnotes below the answer
3. Save sources to `researchResults` table in Convex (schema already exists)

```typescript
// If citationEnabled, add to system prompt:
"Return citations as [1], [2], etc. inline. At the end, list: [1] Title - URL"

// Parse the response to extract citation block
// Store in convex researchResults table with chatHistoryId
```

---

## Phase 8 — Credits & Rate Limiting

The `credits` field and `deductCredits` mutation already exist in Convex. Wire them up:

```typescript
// In /api/agent:
// 1. Check user credits before calling Claude
// 2. Deduct credits after a successful response
// 3. Return 402 if insufficient credits

// Pricing model:
// Free tier: 10 queries/month
// Premium: 100 queries/month
// Business: Unlimited
// Cost per query: ~$0.02–0.05 (Claude + search)
```

---

## Recommended Implementation Order

```
Week 1 — Make it real (highest impact)
  ✅ Install @anthropic-ai/sdk
  ✅ Build /api/agent with 2-call pattern
  ✅ Wire chat page to call /api/agent
  ✅ Save messages to Convex chatHistories
  ✅ Jurisdiction-aware system prompts

Week 2 — Quality & UX
  ✅ Streaming responses with SSE
  ✅ Real step progression (not fake timers)
  ✅ Attach document text to prompts
  ✅ Real citations with footnote rendering

Week 3 — Feature completeness
  ✅ Compare mode backend
  ✅ Draft mode backend
  ✅ Credits deduction
  ✅ Upgrade search to Tavily

Week 4 — Production hardening
  ✅ Error handling and retries
  ✅ Token budget management (long docs)
  ✅ Rate limiting per user
  ✅ Logging and observability
```

---

## Environment Variables Needed

```bash
# Already in .env.local
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...
CLERK_SECRET_KEY=...

# To add
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...        # Optional, replaces DuckDuckGo
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For internal fetch calls
```

---

## Risk Areas

| Risk | Mitigation |
|---|---|
| Claude hallucinating case law | Always ground in search results; add disclaimer in system prompt |
| DuckDuckGo rate limiting | Move to Tavily in Week 3 |
| Large documents exceeding context | Chunk documents, use sliding window or embeddings |
| Users treating output as legal advice | Add prominent disclaimer in UI and system prompt |
| Token costs scaling with usage | Implement credits system (already in schema) |
| GDPR compliance (EU users) | Store only extracted text, not files; Convex is EU-hosted (eu-west-1) |
