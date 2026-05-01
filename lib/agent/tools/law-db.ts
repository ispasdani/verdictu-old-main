// lib/agent/tools/law-db.ts
// Handler for the search_law_database tool.
// Searches the Verdictu law articles table via Convex full-text search,
// returning exact statutory text with article numbers and citations.

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

type ArticleResult = {
  articleId: string;
  number: string;
  title: string | null;
  content: string;
  jurisdiction: string;
  status: string;
  lawTitle: string;
  lawShortTitle: string | null;
  officialNumber: string | null;
};

function formatArticleCitation(article: ArticleResult): string {
  const prefix = article.jurisdiction === "DE" ? "§" : "Art.";
  const articleRef = `${prefix} ${article.number}`;
  const lawRef = article.lawShortTitle ?? article.lawTitle;
  const officialRef = article.officialNumber ? ` (${article.officialNumber})` : "";
  const statusNote =
    article.status !== "in_force" ? ` [${article.status.toUpperCase()}]` : "";

  const header = article.title
    ? `[${articleRef} — ${article.title} | ${lawRef}${officialRef}${statusNote}]`
    : `[${articleRef} | ${lawRef}${officialRef}${statusNote}]`;

  // Truncate very long articles to keep context manageable
  const body =
    article.content.length > 1200
      ? article.content.slice(0, 1200) + "…"
      : article.content;

  return `${header}\n${body}`;
}

export async function searchLawDatabase(
  queryText: string,
  jurisdiction?: string,
): Promise<string> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return "Law database is not configured (NEXT_PUBLIC_CONVEX_URL missing).";
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const results = (await client.query(anyApi.documents.searchArticles, {
      queryText,
      jurisdiction: jurisdiction || undefined,
      limit: 5,
    })) as ArticleResult[];

    if (!results || results.length === 0) {
      return `No matching statutes found in the law database for "${queryText}"${jurisdiction ? ` (${jurisdiction})` : ""}. Try a broader query or use web_search.`;
    }

    const formatted = results.map(formatArticleCitation).join("\n\n---\n\n");
    return `Found ${results.length} matching article(s) in the Verdictu law database:\n\n${formatted}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Law database search failed: ${msg}. Fall back to web_search.`;
  }
}
