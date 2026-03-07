"use client";

import { useState } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export default function SearchTestPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setLatencyMs(null);

    const t0 = Date.now();
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults: 8 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }

      setResults(data.results);
      setLatencyMs(Date.now() - t0);
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[98vh] w-[98.5%] bg-white rounded-lg shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <SidebarTrigger />
        <div>
          <h1 className="text-sm font-semibold text-gray-800">
            Web Search Test
          </h1>
          <p className="text-xs text-gray-400">
            /api/search → DuckDuckGo Lite → cheerio
          </p>
        </div>
      </div>

      {/* Search form */}
      <div className="px-6 py-5 border-b border-gray-100">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. denmark rent increase lejeloven"
            className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-indigo-400 focus:bg-white transition-colors placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats bar */}
        {results.length > 0 && latencyMs !== null && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-400">
              {results.length} results in{" "}
              <span className="font-medium text-gray-600">{latencyMs}ms</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 font-medium">
              Free · No API key
            </span>
          </div>
        )}

        {/* Result cards */}
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-700 hover:underline line-clamp-1"
                  >
                    {r.title}
                  </a>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {r.url}
                  </p>
                  {r.snippet && (
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">
                      {r.snippet}
                    </p>
                  )}
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {!loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Search size={28} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              Type a query above and press Search
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Results come directly from DuckDuckGo Lite — no API key needed
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
