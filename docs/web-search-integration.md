# Web Search Integration — Verdictu

## Context

Verdictu is a legal AI agent built with Next.js + Convex, hosted on Vercel.
This document covers how to implement free web search without Tavily or any paid service.

---

## Why Not Puppeteer on Vercel?

- Chromium is ~300MB — Vercel Hobby limit is 50MB, Pro is 250MB
- Cold starts are slow with a headless browser
- **Solution:** Use `fetch` + `cheerio` to scrape DuckDuckGo Lite — no browser needed

---

## Approach: fetch + cheerio → DuckDuckGo Lite

DuckDuckGo has a plain HTML endpoint (`lite.duckduckgo.com/lite`) that returns
search results as a simple HTML table. No JavaScript rendering = no browser needed.
A regular `fetch` call works fine in a Next.js API route on Vercel.

### Stack
- `fetch` — built into Next.js/Node, makes the HTTP request
- `cheerio` — parses the HTML (~100KB, tiny package)
- Next.js API route at `/api/search` — callable from Convex actions or client

### Install
```bash
npm install cheerio
```

---

## Files Created

### `/app/api/search/route.ts`
The core search endpoint. POST with `{ query, maxResults }`, returns `{ results: [{title, url, snippet}] }`.

```ts
// Usage from client or another API route:
const res = await fetch("/api/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "denmark rent increase lejeloven", maxResults: 8 }),
});
const { results } = await res.json();
// results: [{ title: string, url: string, snippet: string }]
```

How it works internally:
1. Sends a POST to `https://lite.duckduckgo.com/lite/?q=...`
2. Cheerio parses `<a.result-link>` elements for titles + URLs
3. DDG's redirect wrapper is unwrapped to get real URLs
4. Adjacent `<tr>` is grabbed for snippet text
5. Returns clean `[{ title, url, snippet }]`

### `/app/(agent)/search-test/page.tsx`
A simple test UI at `/search-test` route — input box + Search button + result cards.
Use this to verify the endpoint works before wiring it into the real agent.

---

## Limits & Cost

| | Detail |
|---|---|
| **Cost** | $0 — no API key, no billing |
| **Rate limits** | No official limit. Normal user-triggered searches are fine. Aggressive polling (100s/min) risks temporary IP block. |
| **Results per query** | Up to ~30 (default capped at 8 via `maxResults`) |
| **Vercel function timeout** | DDG Lite responds in 300–800ms. Well within 10s (Hobby) / 60s (Pro) |
| **Vercel function size** | cheerio adds ~100KB — no issue |
| **Freshness** | Real-time — same index DuckDuckGo users see |

### Honest Limitations
- DDG could change their HTML structure → fix by updating cheerio selectors in `route.ts`
- No JS-rendered pages — only handles search result list, not SPA content pages
- Vercel outbound IPs are shared — if DDG ever blocks them, add a proxy or switch to Google CSE (100 free/day)

---

## Full AI Agent Pipeline (Next Step)

### Architecture

```
User question
    │
    ▼
[Claude] → generate 3-4 targeted search queries
    │
    ▼ (parallel)
[/api/search] × N queries → raw results [{title, url, snippet}]
    │
    ▼
[/api/fetch-page] × top 3 URLs → clean page text (optional)
    │
    ▼
[Claude] → synthesize legal answer from results + original question
    │
    ▼
{ answer, sources, followUpQuestions }
```

Two Claude calls per user question:
1. First call — plan the search queries based on the legal question + jurisdiction
2. Second call — synthesize a structured legal answer from the evidence found

### Setup Required

**1. Install Anthropic SDK:**
```bash
npm install @anthropic-ai/sdk
```

**2. Add to `.env.local`:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

### How It Wires Into the Chat Page

```
Chat page (app/(agent)/chat/[id]/page.tsx)
  → POST /api/agent { question, jurisdiction }
        → Claude: generate queries          [Step 3 — Search Query Generation]
        → /api/search × 3 (parallel)       [Step 4 — Web Search]
        → filter/rank results              [Step 5 — Filter & Rank Sources]
        → (optional) fetch page content    [Step 6 — Retrieve Content]
        → Claude: extract rules            [Step 7 — Extract Legal Rules]
        → Claude: apply to facts           [Step 8 — Apply Law to Facts]
        → Claude: synthesize answer        [Step 9 — Generate Answer]
  ← { steps[], answer, sources, followUpQuestions }
```

### Two Implementation Options

**Option A — Simple (recommended to start):**
- One `/api/agent` route, no streaming
- Chat page shows a spinner while it runs (~3–6s)
- Renders full result when done
- Easiest to implement and debug

**Option B — Streaming with step updates:**
- `/api/agent` streams back step completions via Server-Sent Events
- Chat page updates each step row in real-time as the agent progresses
- Matches the existing animated step UI but driven by real work
- Better UX, more complex to implement

---

## Free Web Search Alternatives Considered

| Tool | Free Tier | Self-Hostable | Notes |
|---|---|---|---|
| **DuckDuckGo Lite (chosen)** | ✅ Unlimited | ✅ (it's just fetch) | Best for Vercel, no infra |
| SearXNG | ✅ Unlimited | ✅ Docker | Best if self-hosting a server |
| Firecrawl | ✅ Limited | ✅ Open Source | Search + full extraction |
| Exa | ✅ 1,000/mo | ❌ | Semantic/embedding-based search |
| Google CSE | ✅ 100/day | ❌ | Reliable, needs API key |
| SerpAPI | ✅ 100/mo | ❌ | Multi-engine SERP data |

### Why DuckDuckGo Lite Was Chosen
- Zero infra — no Docker, no self-hosted server
- Works natively on Vercel serverless
- No API key or account required
- Scraper-friendly (no aggressive blocking like Google)
- Fast plain HTML response (no JS rendering)
