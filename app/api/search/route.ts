import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { tavilySearch } from "@/lib/search/tavily";

export const runtime = "nodejs";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  domain?: string;
}

export async function POST(req: NextRequest) {
  const { query, maxResults = 8 } = await req.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Prefer Tavily when an API key is configured
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await tavilySearch(query.trim(), maxResults);
      return NextResponse.json({ results, engine: "tavily" });
    } catch {
      // Fall through to DuckDuckGo on Tavily failure
    }
  }

  const results = await searchDuckDuckGo(query.trim(), maxResults);
  return NextResponse.json({ results, engine: "duckduckgo" });
}

async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const url = `https://lite.duckduckgo.com/lite/?${params}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Mimic a real browser so DDG doesn't block the request
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned ${res.status}`);
  }

  const html = await res.text();
  return parseLiteResults(html, maxResults);
}

function parseLiteResults(html: string, maxResults: number): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  // DDG Lite renders results inside a table.
  // Each result block spans 3 <tr> rows:
  //   Row 1 — title + link  (<a class="result-link">)
  //   Row 2 — snippet       (<td class="result-snippet">)
  //   Row 3 — display URL   (<span class="link-text">)
  $("a.result-link").each((_, el) => {
    if (results.length >= maxResults) return false; // break

    const titleEl = $(el);
    const title = titleEl.text().trim();
    const rawHref = titleEl.attr("href") ?? "";

    // DDG Lite wraps the real URL inside a redirect:
    // //duckduckgo.com/l/?uddg=https%3A%2F%2F...
    const url = extractRealUrl(rawHref);
    if (!url) return; // skip ads / empty hrefs

    // The snippet sits in the next <tr> after the title row
    const snippetRow = titleEl.closest("tr").next();
    const snippet = snippetRow.find("td.result-snippet").text().trim();

    if (title && url) {
      results.push({ title, url, snippet });
    }
  });

  return results;
}

function extractRealUrl(href: string): string | null {
  try {
    // Absolute DDG redirect link
    if (href.includes("uddg=")) {
      const match = href.match(/uddg=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    // Already a plain URL
    if (href.startsWith("http")) return href;
    return null;
  } catch {
    return null;
  }
}
