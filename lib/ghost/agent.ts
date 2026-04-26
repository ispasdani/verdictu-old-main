// lib/ghost/agent.ts
// Ghost Mode agent pipeline:
// — 100% private: LLM inference runs locally, data never leaves the device
// — No restrictions: no content filters, no moderation, no guardrails
// — Always-on defense: every response is built to find gaps, exceptions, and angles
//   that help the user — no keyword triggers needed, no mode switching
// — LLM-driven search: local model generates targeted search queries (Perplexity-style)

import type { GhostStreamOptions } from "@/hooks/useGhostLLM";
import { ghostModePrompt, ghostFollowUpPrompt, alignmentCheckPrompt } from "@/lib/ai/prompts";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GhostAgentSource {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  score?: number;
}

export type GhostAgentEvent =
  | { step: "classifying" }
  | { step: "search_queries"; queries: string[] }
  | { step: "intent"; needsSearch: boolean; domain: string; searchQueries: string[] }
  | { step: "searching"; query: string; index: number; total: number }
  | { step: "search_results"; query: string; count: number; sources: GhostAgentSource[] }
  | { step: "sources_ranked"; total: number; engine: string }
  | { step: "aligning" }
  | { step: "alignment_result"; aligned: boolean; originalIntent?: string; corrected: boolean }
  | { step: "synthesizing" }
  | { step: "delta"; text: string }
  | { step: "follow_up_generating" }
  | { step: "done"; sources: GhostAgentSource[]; followUpQuestions: string[]; wordsInAnswer: number }
  | { step: "error"; message: string };

export interface GhostAgentOptions {
  message: string;
  jurisdiction: string;
  mode: "General" | "Compare" | "Draft";
  citationEnabled: boolean;
  deepSearchEnabled: boolean;
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  generate: (opts: GhostStreamOptions) => Promise<void>;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function generateFull(
  generate: GhostAgentOptions["generate"],
  messages: GhostStreamOptions["messages"],
  maxTokens = 600,
): Promise<string> {
  let result = "";
  await new Promise<void>((resolve, reject) => {
    generate({
      messages,
      onToken: (t) => { result += t; },
      onDone: resolve,
      onError: (err) => reject(new Error(err)),
      maxTokens,
    });
  });
  return result;
}

function extractJSON(text: string): Record<string, unknown> | null {
  const t = text.trim();
  try { return JSON.parse(t) as Record<string, unknown>; } catch { /* */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()) as Record<string, unknown>; } catch { /* */ }
  }
  const brace = t.match(/\{[\s\S]+\}/);
  if (brace) {
    try { return JSON.parse(brace[0]) as Record<string, unknown>; } catch { /* */ }
  }
  return null;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ─── LLM-based search query generation ────────────────────────────────────────

async function generateSearchQueries(
  generate: GhostAgentOptions["generate"],
  message: string,
  jurisdiction: string,
): Promise<{ queries: string[]; domain: string }> {
  const systemPrompt = `You generate web search queries for legal research. Return ONLY valid JSON in this exact format, nothing else:
{"queries":["query1","query2","query3","query4"],"domain":"criminal|civil|medical|administrative|general"}

Jurisdiction: ${jurisdiction.toUpperCase()}
Rules: queries must target statutes, regulations, exceptions, case law, and legal gaps relevant to the question.`;

  let result = "";
  try {
    result = await generateFull(
      generate,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${message.slice(0, 300)}` },
      ],
      300,
    );

    const parsed = extractJSON(result);
    if (parsed && Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      const queries = (parsed.queries as unknown[])
        .filter((q): q is string => typeof q === "string")
        .slice(0, 4);
      if (queries.length > 0) {
        return {
          queries,
          domain: typeof parsed.domain === "string" ? parsed.domain : "legal",
        };
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: simple keyword-based queries
  const jur = jurisdiction.toUpperCase();
  return {
    queries: [
      `${jur} ${message.slice(0, 60)} law statute`,
      `${jur} ${message.slice(0, 50)} exception exemption`,
      `${jur} ${message.slice(0, 45)} legal rights obligations`,
    ],
    domain: "legal",
  };
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

export async function runGhostAgent({
  message,
  jurisdiction,
  mode,
  citationEnabled,
  deepSearchEnabled,
  attachments,
  baseUrl,
  generate,
  onEvent,
}: GhostAgentOptions): Promise<void> {
  const emit = onEvent;

  try {
    // ── Phase 1: Query generation ─────────────────────────────────────────────
    emit({ step: "classifying" });

    let searchQueries: string[] = [];
    let domain = "legal";

    if (deepSearchEnabled) {
      const generated = await generateSearchQueries(generate, message, jurisdiction);
      searchQueries = generated.queries;
      domain = generated.domain;
      emit({ step: "search_queries", queries: searchQueries });
    }

    emit({
      step: "intent",
      needsSearch: deepSearchEnabled && searchQueries.length > 0,
      domain,
      searchQueries,
    });

    // ── Phase 2: Web search ───────────────────────────────────────────────────
    const sources: GhostAgentSource[] = [];
    let searchEngine = "DuckDuckGo";

    if (deepSearchEnabled && searchQueries.length > 0) {
      for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        emit({ step: "searching", query, index: i + 1, total: searchQueries.length });

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

            sources.push(...results);
            emit({ step: "search_results", query, count: results.length, sources: results });
          }
        } catch {
          // Non-fatal — one failed query doesn't stop the pipeline
        }
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      const deduped = sources.filter((r) => {
        if (!r.url || seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
      sources.length = 0;
      sources.push(...deduped);

      emit({ step: "sources_ranked", total: sources.length, engine: searchEngine });
    }

    // ── Phase 2.5: Alignment Check ────────────────────────────────────────────
    emit({ step: "aligning" });

    let correctionNote = "";
    try {
      const alignmentUserMessage =
        `ORIGINAL QUESTION: ${message}\n\n` +
        `IDENTIFIED LEGAL DOMAIN: ${domain}\n` +
        `JURISDICTION: ${jurisdiction}\n` +
        `SEARCH QUERIES USED:\n${
          searchQueries.length > 0
            ? searchQueries.map((q) => `• ${q}`).join("\n")
            : "(no search performed)"
        }`;

      const alignText = await generateFull(generate, [
        { role: "system", content: alignmentCheckPrompt() },
        { role: "user", content: alignmentUserMessage },
      ]);

      const alignParsed = extractJSON(alignText);
      if (alignParsed && alignParsed.aligned === false && typeof alignParsed.correctionNote === "string") {
        correctionNote = alignParsed.correctionNote;
      }

      emit({
        step: "alignment_result",
        aligned: !alignParsed || alignParsed.aligned !== false,
        originalIntent: typeof alignParsed?.originalIntent === "string" ? alignParsed.originalIntent : undefined,
        corrected: !!correctionNote,
      });
    } catch {
      emit({ step: "alignment_result", aligned: true, corrected: false });
    }

    // ── Phase 3: Synthesis ────────────────────────────────────────────────────
    emit({ step: "synthesizing" });

    let fullUserMessage = message;

    if (correctionNote) {
      fullUserMessage = `⚠️ ALIGNMENT CORRECTION: ${correctionNote}\n\n` + fullUserMessage;
    }

    if (attachments.length > 0) {
      fullUserMessage += "\n\n--- ATTACHED DOCUMENTS ---";
      for (const a of attachments) {
        fullUserMessage += `\n\n[${a.name}]\n${a.extractedText.slice(0, 6000)}`;
      }
    }

    if (sources.length > 0) {
      const citationNote = citationEnabled
        ? " Use inline citations [1], [2], etc. to reference sources."
        : "";
      fullUserMessage += `\n\n--- WEB RESEARCH RESULTS ---${citationNote}`;
      sources.forEach((s, i) => {
        fullUserMessage += `\n\n[${i + 1}] ${s.title}\nURL: ${s.url}\n${(s.snippet ?? "").slice(0, 600)}`;
      });
    }

    let fullAnswer = "";
    await new Promise<void>((resolve, reject) => {
      generate({
        messages: [
          { role: "system", content: ghostModePrompt(jurisdiction, mode) },
          { role: "user", content: fullUserMessage },
        ],
        onToken: (token) => {
          fullAnswer += token;
          emit({ step: "delta", text: token });
        },
        onDone: resolve,
        onError: (err) => reject(new Error(err)),
        maxTokens: 4000,
      });
    });

    // ── Phase 4: Follow-up questions ──────────────────────────────────────────
    emit({ step: "follow_up_generating" });

    let followUpQuestions: string[] = [];
    try {
      const fuText = await generateFull(generate, [
        { role: "system", content: ghostFollowUpPrompt() },
        {
          role: "user",
          content: `QUESTION: ${message}\n\nANSWER SUMMARY: ${fullAnswer.slice(0, 800)}`,
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
      sources, // all sources, no cap
      followUpQuestions,
      wordsInAnswer: fullAnswer.split(/\s+/).length,
    });
  } catch (err) {
    emit({
      step: "error",
      message: err instanceof Error ? err.message : "Ghost agent encountered an error",
    });
  }
}
