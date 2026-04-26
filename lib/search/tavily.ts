// lib/search/tavily.ts
// Search integration: Tavily (primary) with DuckDuckGo fallback.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  domain?: string;
}

// ─── Tavily ───────────────────────────────────────────────────────────────────

export async function tavilySearch(
  query: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.content ?? ""),
    score: typeof r.score === "number" ? r.score : undefined,
    domain: extractDomain(String(r.url ?? "")),
  }));
}

// ─── DuckDuckGo fallback ──────────────────────────────────────────────────────

export async function duckDuckGoSearch(
  query: string,
  baseUrl: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: SearchResult) => ({
      ...r,
      domain: extractDomain(r.url),
    }));
  } catch {
    return [];
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
// Uses Tavily if TAVILY_API_KEY is set; falls back to DuckDuckGo.

export async function search(
  query: string,
  baseUrl: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  if (process.env.TAVILY_API_KEY) {
    return tavilySearch(query, maxResults);
  }
  return duckDuckGoSearch(query, baseUrl, maxResults);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
