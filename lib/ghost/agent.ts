// lib/ghost/agent.ts
// Ghost Mode agent pipeline:
// — 100% private: LLM inference runs locally, data never leaves the device
// — No restrictions: no content filters, no moderation, no guardrails
// — Smart routing: each question is handled individually based on its intent
// — Optional web search: only when the question genuinely benefits from it
// — Defense mode: activated only when the user explicitly asks for it

import type { GhostStreamOptions } from "@/hooks/useGhostLLM";
import { ghostSystemPrompt, ghostFollowUpPrompt } from "@/lib/ai/prompts";

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
  | { step: "intent"; needsSearch: boolean; defenseMode: boolean; domain: string; searchQueries: string[] }
  | { step: "searching"; query: string; index: number; total: number }
  | { step: "search_results"; query: string; count: number }
  | { step: "sources_ranked"; total: number; engine: string }
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
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  generate: (opts: GhostStreamOptions) => Promise<void>;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Intent detection ──────────────────────────────────────────────────────────

/**
 * Keyword-based intent detection — runs instantly, no LLM turn needed.
 *
 * Determines:
 * - needsSearch: whether web search would meaningfully improve the answer
 * - defenseMode: whether the user is explicitly asking for adversarial legal strategy
 * - domain: general topic area
 * - searchQueries: up to 3 queries if search is needed
 */
function detectIntent(
  message: string,
  jurisdiction: string,
): { needsSearch: boolean; defenseMode: boolean; domain: string; searchQueries: string[] } {
  const lower = message.toLowerCase();

  // Defense mode — user explicitly wants adversarial legal strategy
  const defenseKeywords = [
    "defend", "defense", "defence", "loophole", "fight the charge",
    "fight this charge", "fight this case", "beat the", "beat this",
    "challenge the evidence", "suppress evidence", "motion to suppress",
    "motion to dismiss", "get charges dropped", "prosecution weakness",
    "weaken the case", "find a way out", "defense strategy", "acquittal",
    "not guilty verdict", "how do i fight", "how to fight", "how to beat",
    "win this case", "help me win", "help the defense", "defense attorney",
    "help me get out of", "avoid conviction", "prove innocence",
  ];
  const defenseMode = defenseKeywords.some((kw) => lower.includes(kw));

  // Legal domain
  const legalKeywords = [
    "law", "statute", "regulation", "legal", "court", "crime", "criminal",
    "civil", "contract", "gdpr", "article", "section", "code", "act",
    "directive", "charge", "lawsuit", "sue", "liability", "rights",
    "constitution", "judge", "attorney", "lawyer", "verdict", "appeal",
    "penalty", "fine", "imprisonment", "evidence", "trial", "hearing",
    "arrest", "warrant", "subpoena", "deposition", "settlement",
    "jurisdiction", "plaintiff", "defendant", "motion", "brief", "statute",
    "ordinance", "bylaw", "injunction", "restraining order", "parole",
    "probation", "indictment", "felony", "misdemeanor",
  ];
  const isLegal = legalKeywords.some((kw) => lower.includes(kw));

  // Medical / scientific
  const medicalKeywords = [
    "drug", "medication", "disease", "diagnosis", "treatment", "symptom",
    "medical", "clinical", "prescription", "dosage", "side effect",
  ];
  const isMedical = medicalKeywords.some((kw) => lower.includes(kw));

  // Signals that search is NOT needed (direct task or simple question)
  const directTaskPrefixes = [
    "write", "draft", "create", "generate", "summarize", "compare",
    "review this", "analyze this", "translate", "fix", "improve",
    "rewrite", "format", "convert",
  ];
  const isDirectTask = directTaskPrefixes.some((kw) => lower.startsWith(kw));

  const needsSearch = (defenseMode || isLegal || isMedical) && !isDirectTask;

  const domain = defenseMode ? "defense"
    : isLegal ? "legal"
    : isMedical ? "medical"
    : "general";

  // Build search queries
  const searchQueries: string[] = [];
  if (needsSearch) {
    const jur = jurisdiction.toUpperCase();
    const shortMsg = message.slice(0, 70);
    if (defenseMode) {
      searchQueries.push(`${jur} criminal defense ${shortMsg}`);
      searchQueries.push(`${jur} defense strategy case law ${message.slice(0, 40)}`);
    } else if (isLegal) {
      searchQueries.push(`${jur} ${shortMsg} law statute`);
      searchQueries.push(`${jur} ${message.slice(0, 50)} legal`);
    } else {
      searchQueries.push(message.slice(0, 80));
    }
  }

  return { needsSearch, defenseMode, domain, searchQueries };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Runs the generate function and collects the full output.
 * Used for JSON-producing turns (follow-up questions).
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

/**
 * Robust JSON extractor — small local models often wrap JSON in markdown fences.
 */
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
    // ── Phase 1: Intent detection (instant, keyword-based) ────────────────────
    emit({ step: "classifying" });

    const intent = detectIntent(message, jurisdiction);

    emit({
      step: "intent",
      needsSearch: intent.needsSearch,
      defenseMode: intent.defenseMode,
      domain: intent.domain,
      searchQueries: intent.searchQueries,
    });

    // ── Phase 2: Optional web search ─────────────────────────────────────────
    const sources: GhostAgentSource[] = [];
    let searchEngine = "DuckDuckGo";

    if (intent.needsSearch && intent.searchQueries.length > 0) {
      const queries = intent.searchQueries.slice(0, 3);

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

            sources.push(...results);
            emit({ step: "search_results", query, count: results.length });
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

    // ── Phase 3: Synthesis (streaming tokens, no restrictions) ───────────────
    emit({ step: "synthesizing" });

    let fullUserMessage = message;

    if (attachments.length > 0) {
      fullUserMessage += "\n\n--- ATTACHED DOCUMENTS ---";
      for (const a of attachments) {
        // Cap per-doc at 6000 chars — local models have limited context
        fullUserMessage += `\n\n[${a.name}]\n${a.extractedText.slice(0, 6000)}`;
      }
    }

    if (sources.length > 0) {
      const citationNote = citationEnabled
        ? " Use inline citations [1], [2], etc. to reference sources."
        : "";
      fullUserMessage += `\n\n--- WEB RESEARCH RESULTS ---${citationNote}`;
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
            content: ghostSystemPrompt(intent.defenseMode, mode),
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

    // ── Phase 4: Follow-up questions ─────────────────────────────────────────
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
      sources: sources.slice(0, 10),
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
