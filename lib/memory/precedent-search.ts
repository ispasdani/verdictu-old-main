// lib/memory/precedent-search.ts
// Keyword search over the local precedent store.
// Runs entirely in the browser against IndexedDB data.

import type { PrecedentEntry } from "./client-store";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function scoreEntry(entry: PrecedentEntry, queryTokens: Set<string>): number {
  if (queryTokens.size === 0) return 0;
  const haystack = [
    entry.title,
    entry.userText,
    ...entry.parties,
    ...entry.tags,
    entry.jurisdiction,
  ].join(" ");

  const haystackTokens = tokenize(haystack);
  let hits = 0;
  for (const t of queryTokens) {
    if (haystackTokens.has(t)) hits++;
  }
  return hits / queryTokens.size;
}

export function searchPrecedents(
  query: string,
  precedents: PrecedentEntry[],
  topK = 3,
): PrecedentEntry[] {
  const queryTokens = tokenize(query);
  // No query tokens — return newest entries
  if (queryTokens.size === 0) return precedents.slice(0, topK);

  return precedents
    .map((p) => ({ entry: p, score: scoreEntry(p, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ entry }) => entry);
}

export function formatPrecedentForAgent(entry: PrecedentEntry): string {
  const partiesLine =
    entry.parties.length > 0 ? `Parties: ${entry.parties.join(", ")}\n` : "";
  const tagsLine =
    entry.tags.length > 0 ? `Tags: ${entry.tags.join(", ")}\n` : "";
  const body = entry.assistantText.slice(0, 3000);
  const truncated = entry.assistantText.length > 3000 ? "\n[... truncated ...]" : "";

  return `[PRECEDENT: ${entry.title}]
Jurisdiction: ${entry.jurisdiction}
${partiesLine}${tagsLine}
Original question: ${entry.userText}

Analysis:
${body}${truncated}`;
}
