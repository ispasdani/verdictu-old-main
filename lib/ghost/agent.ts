// lib/ghost/agent.ts
// Ghost Mode agent pipeline:
// — 100% private: LLM inference runs locally, data never leaves the device
// — No restrictions: no content filters, no moderation, no guardrails
// — Always-on defense: every response is built to find gaps, exceptions, and angles
//   that help the user — no keyword triggers needed, no mode switching
// — Smart search: detects when web research adds value; skips it when not needed

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
  | { step: "intent"; needsSearch: boolean; domain: string; searchQueries: string[] }
  | { step: "searching"; query: string; index: number; total: number }
  | { step: "search_results"; query: string; count: number }
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
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  generate: (opts: GhostStreamOptions) => Promise<void>;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Search need detection ────────────────────────────────────────────────────

/**
 * Determines whether web search would add value for this question.
 * This is the ONLY classification that happens — the defense/loophole stance
 * is always-on in Ghost Mode, regardless of what the user asks.
 */
function detectSearchNeed(
  message: string,
  jurisdiction: string,
): { needsSearch: boolean; domain: string; searchQueries: string[] } {
  const lower = message.toLowerCase();

  // Topics that benefit from web research
  const researchTopics = [
    "law", "statute", "regulation", "legal", "court", "crime", "criminal",
    "civil", "contract", "gdpr", "article", "section", "code", "act",
    "directive", "charge", "lawsuit", "sue", "liability", "rights",
    "constitution", "judge", "attorney", "lawyer", "verdict", "appeal",
    "penalty", "fine", "imprisonment", "evidence", "trial", "hearing",
    "arrest", "warrant", "subpoena", "settlement", "jurisdiction",
    "plaintiff", "defendant", "motion", "ordinance", "bylaw",
    "injunction", "parole", "probation", "indictment", "felony",
    "misdemeanor", "register", "registration", "license", "permit",
    "tax", "resident", "residency", "medical", "medication", "drug",
    "disease", "treatment", "symptom", "clinical",
  ];
  const needsResearch = researchTopics.some((kw) => lower.includes(kw));

  // Direct tasks (write/draft/explain something in hand) don't need search
  const directTaskPrefixes = [
    "write", "draft", "create", "generate", "summarize", "review this",
    "analyze this", "translate", "fix", "improve", "rewrite", "format", "convert",
  ];
  const isDirectTask = directTaskPrefixes.some((kw) => lower.startsWith(kw));

  const needsSearch = needsResearch && !isDirectTask;

  const domain = lower.match(/\b(criminal|crime|arrest|charge|felony|misdemeanor|prison|jail)\b/)
    ? "criminal"
    : lower.match(/\b(civil|contract|lawsuit|sue|liability|settlement)\b/)
      ? "civil"
      : lower.match(/\b(medical|drug|medication|disease|treatment)\b/)
        ? "medical"
        : needsResearch ? "legal" : "general";

  // Search queries always target exceptions, scope limitations, and gaps —
  // not just the general rule, because we want to find the angles that help.
  const searchQueries: string[] = [];
  if (needsSearch) {
    const jur = jurisdiction.toUpperCase();
    const shortMsg = message.slice(0, 60);
    searchQueries.push(`${jur} ${shortMsg} exception exemption scope`);
    searchQueries.push(`${jur} ${message.slice(0, 50)} legal gap`);
    // Extra query for temporal / border reset questions
    if (lower.match(/\b(reset|days|border|exit|return|period|deadline|clock)\b/)) {
      searchQueries.push(`${jur} ${message.slice(0, 45)} period reset exception border`);
    }
    // Extra query for EU rights / superior law conflicts
    if (lower.match(/\b(eu|european|foreign|national|citizen|resident|plates|vehicle|car)\b/)) {
      searchQueries.push(`${jur} ${message.slice(0, 40)} EU regulation foreign national rights`);
    }
    if (searchQueries.length < 2) {
      searchQueries.push(`${jur} ${message.slice(0, 50)} legal`);
    }
  }

  return { needsSearch, domain, searchQueries };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
      maxTokens: 600, // JSON turns stay small
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
    // ── Phase 1: Search need detection ───────────────────────────────────────
    emit({ step: "classifying" });

    const { needsSearch, domain, searchQueries } = detectSearchNeed(message, jurisdiction);

    emit({ step: "intent", needsSearch, domain, searchQueries });

    // ── Phase 2: Optional web search ─────────────────────────────────────────
    const sources: GhostAgentSource[] = [];
    let searchEngine = "DuckDuckGo";

    if (needsSearch && searchQueries.length > 0) {
      const queries = searchQueries.slice(0, 4);

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
          // Non-fatal
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

    // ── Phase 2.5: Alignment Check ───────────────────────────────────────────
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
      // Non-fatal — proceed without correction
      emit({ step: "alignment_result", aligned: true, corrected: false });
    }

    // ── Phase 3: Synthesis — always-on Ghost Mode stance ─────────────────────
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
      sources.slice(0, 10).forEach((s, i) => {
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
