// lib/agent/tools/precedent-convex.ts
// Convex-backed retrieve_precedent handler.
// Used when the user has opted into Convex storage (useConvexRag = true).
// Falls back to the local keyword search when disabled.

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

type DocumentResult = {
  documentId: string;
  title: string;
  type: string;
  content: string;
  parties: string[];
  jurisdiction: string;
  tags: string[];
  createdAt: number;
};

function formatDocumentForAgent(doc: DocumentResult): string {
  const partiesLine =
    doc.parties.length > 0 ? `Parties: ${doc.parties.join(", ")}` : null;
  const tagsLine = doc.tags.length > 0 ? `Tags: ${doc.tags.join(", ")}` : null;
  const meta = [partiesLine, tagsLine, `Jurisdiction: ${doc.jurisdiction}`]
    .filter(Boolean)
    .join("\n");

  const excerpt =
    doc.content.length > 3000
      ? doc.content.slice(0, 3000) + "…"
      : doc.content;

  return `[PRECEDENT: ${doc.title} (${doc.type})]\n${meta}\n\n${excerpt}`;
}

export async function retrievePrecedentFromConvex(
  query: string,
  userId: string,
  jurisdiction?: string,
): Promise<string> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return "Convex storage not configured. Falling back to local precedent search.";
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const results = (await client.query(anyApi.documents.searchDocuments, {
      userId,
      queryText: query,
      jurisdiction: jurisdiction || undefined,
      limit: 3,
    })) as DocumentResult[];

    if (!results || results.length === 0) {
      return `No precedents found in your Convex library for "${query}". Try a different query or save a document as a precedent first.`;
    }

    const formatted = results.map(formatDocumentForAgent).join("\n\n---\n\n");
    return `Found ${results.length} precedent(s) in your Verdictu library:\n\n${formatted}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Convex precedent search failed: ${msg}. Try local precedent search instead.`;
  }
}
