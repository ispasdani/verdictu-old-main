// lib/ghost/agent.ts
// Ghost Mode agent pipeline:
// Turn 1 — Law identification (local LLM → JSON)
// Turn 2 — Web search (server-side /api/search, Tavily or DDG)
// Turn 3 — Synthesis (local LLM, streaming)
// Turn 4 — Follow-up questions (local LLM → JSON)

import type { GhostStreamOptions } from "@/hooks/useGhostLLM";
import {
  lawIdentificationPrompt,
  synthesisPrompt,
  followUpPrompt,
} from "@/lib/ai/prompts";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GhostAgentLaw {
  name: string;
  citation: string;
  relevance: "primary" | "secondary" | "supplementary";
  confidence: number;
  applies_because: string;
}

export interface GhostAgentSource {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  score?: number;
}

export type GhostAgentEvent =
  | { step: "identifying" }
  | { step: "laws_found"; laws: GhostAgentLaw[]; domain: string; jurisdiction: string }
  | { step: "searching"; query: string; index: number; total: number }
  | { step: "search_results"; query: string; count: number }
  | { step: "sources_ranked"; total: number; engine: string }
  | { step: "synthesizing" }
  | { step: "delta"; text: string }
  | { step: "follow_up_generating" }
  | { step: "done"; sources: GhostAgentSource[]; laws: GhostAgentLaw[]; followUpQuestions: string[]; wordsInAnswer: number }
  | { step: "error"; message: string };

export interface GhostAgentOptions {
  message: string;
  jurisdiction: string;
  mode: "General" | "Compare" | "Draft";
  citationEnabled: boolean;
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  generate: (opts: GhostStreamOptions) => Promise<void>;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Robust JSON extractor — small local models often wrap JSON in markdown
 * fences or prefix it with prose. Try several extraction strategies.
 */
function extractJSON(text: string): Record<string, unknown> | null {
  const t = text.trim();

  // 1. Direct parse
  try { return JSON.parse(t) as Record<string, unknown>; } catch { /* */ }

  // 2. JSON inside a code fence ```json ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()) as Record<string, unknown>; } catch { /* */ }
  }

  // 3. First complete { ... } block in the text
  const brace = t.match(/\{[\s\S]+\}/);
  if (brace) {
    try { return JSON.parse(brace[0]) as Record<string, unknown>; } catch { /* */ }
  }

  return null;
}

/**
 * Runs the generate function and collects the full output text.
 * Used for JSON-producing turns (law identification, follow-ups).
 */
async function generateFull(
  generate: GhostAgentOptions["generate"],
  messages: GhostStreamOptions["messages"],
): Promise<string> {
  let result = "";
  await new Promise<void>((resolve, reject) => {
    generate({
      messages,
      onToken: (t) => { result += t; },
      onDone: resolve,
      onError: (err) => reject(new Error(err)),
    });
  });
  return result;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

export async function runGhostAgent({
  message,
  jurisdiction,
  mode,
  citationEnabled,
  attachments,
  baseUrl,
  generate,
  onEvent,
}: GhostAgentOptions): Promise<void> {
  const emit = onEvent;

  try {
    // ── Turn 1: Law Identification ────────────────────────────────────────────
    emit({ step: "identifying" });

    let laws: GhostAgentLaw[] = [];
    let searchQueries: string[] = [];
    let legalDomain = "general";
    let jurisdictionConfirmed = jurisdiction;

    try {
      const lawText = await generateFull(generate, [
        { role: "system", content: lawIdentificationPrompt(jurisdiction) },
        { role: "user", content: message },
      ]);

      const parsed = extractJSON(lawText);
      if (parsed) {
        laws = Array.isArray(parsed.laws) ? (parsed.laws as GhostAgentLaw[]) : [];
        searchQueries = Array.isArray(parsed.searchQueries)
          ? (parsed.searchQueries as string[])
          : [];
        legalDomain =
          typeof parsed.legalDomain === "string" ? parsed.legalDomain : "general";
        jurisdictionConfirmed =
          typeof parsed.jurisdictionConfirmed === "string"
            ? parsed.jurisdictionConfirmed
            : jurisdiction;
      }
    } catch {
      // Non-fatal — continue with no law context
    }

    emit({ step: "laws_found", laws, domain: legalDomain, jurisdiction: jurisdictionConfirmed });

    // ── Turn 2: Web Search ────────────────────────────────────────────────────
    // Limit to 4 queries — small models are slow, keep it snappy
    const queries =
      searchQueries.length > 0
        ? searchQueries.slice(0, 4)
        : [`${jurisdiction} ${message.slice(0, 80)} law`];

    const allSources: GhostAgentSource[] = [];
    let searchEngine = "DuckDuckGo";

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      emit({ step: "searching", query, index: i + 1, total: queries.length });

      try {
        const res = await fetch(`${baseUrl}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, maxResults: 5 }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.engine === "tavily") searchEngine = "Tavily";

          const results: GhostAgentSource[] = (data.results ?? []).map(
            (r: GhostAgentSource) => ({
              title: r.title ?? "",
              url: r.url ?? "",
              snippet: r.snippet ?? "",
              score: r.score,
              domain: r.domain ?? extractDomain(r.url ?? ""),
            }),
          );

          allSources.push(...results);
          emit({ step: "search_results", query, count: results.length });
        }
      } catch {
        // One failed query is non-fatal
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const sources = allSources.filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    emit({ step: "sources_ranked", total: sources.length, engine: searchEngine });

    // ── Turn 3: Synthesis (streaming tokens) ──────────────────────────────────
    emit({ step: "synthesizing" });

    // Build the full context message
    let fullUserMessage = message;

    if (attachments.length > 0) {
      fullUserMessage += "\n\n--- ATTACHED DOCUMENTS ---";
      for (const a of attachments) {
        // Cap per-doc at 6000 chars — local models have limited context
        fullUserMessage += `\n\n[${a.name}]\n${a.extractedText.slice(0, 6000)}`;
      }
    }

    if (laws.length > 0) {
      fullUserMessage += "\n\n--- IDENTIFIED APPLICABLE LAWS ---";
      for (const law of laws) {
        fullUserMessage += `\n• ${law.citation} (${law.relevance}, confidence ${Math.round(law.confidence * 100)}%) — ${law.applies_because}`;
      }
    }

    if (sources.length > 0) {
      // Cap at 8 sources, 500 chars each — local context window is small
      fullUserMessage += "\n\n--- WEB RESEARCH RESULTS ---";
      sources.slice(0, 8).forEach((s, i) => {
        fullUserMessage += `\n\n[${i + 1}] ${s.title}\nURL: ${s.url}\n${(s.snippet ?? "").slice(0, 500)}`;
      });
    }

    let fullAnswer = "";
    await new Promise<void>((resolve, reject) => {
      generate({
        messages: [
          {
            role: "system",
            content: synthesisPrompt(jurisdiction, mode, citationEnabled),
          },
          { role: "user", content: fullUserMessage },
        ],
        onToken: (token) => {
          fullAnswer += token;
          emit({ step: "delta", text: token });
        },
        onDone: resolve,
        onError: (err) => reject(new Error(err)),
      });
    });

    // ── Turn 4: Follow-up questions ───────────────────────────────────────────
    emit({ step: "follow_up_generating" });

    let followUpQuestions: string[] = [];
    try {
      const fuText = await generateFull(generate, [
        { role: "system", content: followUpPrompt(jurisdiction) },
        {
          role: "user",
          content: `QUESTION: ${message}\n\nANSWER SUMMARY: ${fullAnswer.slice(0, 1000)}`,
        },
      ]);

      const fuParsed = extractJSON(fuText);
      if (fuParsed && Array.isArray(fuParsed.questions)) {
        followUpQuestions = fuParsed.questions as string[];
      }
    } catch {
      // Non-fatal
    }

    emit({
      step: "done",
      sources: sources.slice(0, 10),
      laws,
      followUpQuestions,
      wordsInAnswer: fullAnswer.split(/\s+/).length,
    });
  } catch (err) {
    emit({
      step: "error",
      message:
        err instanceof Error ? err.message : "Ghost agent encountered an error",
    });
  }
}
