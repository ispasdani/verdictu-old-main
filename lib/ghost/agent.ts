// lib/ghost/agent.ts
// Ghost Mode agent pipeline:
// — 100% private: LLM inference runs locally, data never leaves the device
// — No restrictions: no content filters, no moderation, no guardrails
// — Always-on defense: every response is built to find gaps, exceptions, and angles
//   that help the user — no keyword triggers needed, no mode switching
// — LLM-driven search: local model generates targeted search queries (Perplexity-style)
// — Phase 6: runGhostAgentAgentic() upgrades capable models to a true tool-use loop

import type { GhostStreamOptions } from "@/hooks/useGhostLLM";
import { ghostModePrompt, ghostFollowUpPrompt, alignmentCheckPrompt, ghostLocalAgentPrompt } from "@/lib/ai/prompts";
import type { PrecedentEntry } from "@/lib/memory/client-store";

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
  // Phase 6 — agentic mode events
  | { step: "thinking" }
  | { step: "tool_call"; tool: string; label: string }
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
  /** downloadSizeMB from GhostModel — used to scale context down for smaller models */
  modelSizeMB?: number;
  /** True for models that emit <think>…</think> blocks (DeepSeek R1, etc.).
   *  Triggers a dedicated profile: fewer sources + higher max_tokens to prevent
   *  the think block exhausting the budget before an answer is written. */
  isReasoningModel?: boolean;
  generate: (opts: GhostStreamOptions) => Promise<void>;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Phase 6: Agentic options (no generate callback — uses engine directly) ──

export interface GhostAgentAgenticOptions {
  message: string;
  jurisdiction: string;
  mode: "General" | "Compare" | "Draft";
  attachments: Array<{ name: string; extractedText: string }>;
  baseUrl: string;
  precedents?: PrecedentEntry[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  engine: import("./local-loop").WebLLMEngine;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Strips <think>...</think> reasoning blocks emitted by models like DeepSeek R1 / Qwen3.
function stripThinkingBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

// Stateful token-level filter that suppresses <think>...</think> content during streaming.
// If the model never closes the tag (or produces only think content), end() falls back to
// emitting the stripped full text so the response is never silently blank.
function makeThinkFilter(onToken: (t: string) => void) {
  let buf = "";
  let inThink = false;
  let hasEmitted = false;

  function emit(text: string) {
    if (!text) return;
    hasEmitted = true;
    onToken(text);
  }

  return {
    feed(token: string) {
      buf += token;
      let out = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!inThink) {
          const idx = buf.indexOf("<think>");
          if (idx === -1) {
            // Keep last 6 chars — they might be the start of "<think>"
            const safe = buf.slice(0, Math.max(0, buf.length - 6));
            out += safe;
            buf = buf.slice(safe.length);
            break;
          }
          out += buf.slice(0, idx);
          inThink = true;
          buf = buf.slice(idx + 7);
        } else {
          const idx = buf.indexOf("</think>");
          if (idx === -1) {
            // Discard but keep last 7 chars (partial closing tag)
            buf = buf.length > 7 ? buf.slice(buf.length - 7) : buf;
            break;
          }
          inThink = false;
          buf = buf.slice(idx + 8);
        }
      }
      emit(out);
    },
    // rawFull: the complete unfiltered response, used as fallback if nothing was emitted
    end(rawFull: string) {
      if (!inThink && buf) emit(buf);
      if (!hasEmitted && rawFull) {
        // Model hit max_tokens inside the think block without closing </think> or writing an answer.
        // Dumping the raw reasoning loop would show garbage — emit a user-friendly error instead.
        emit("The model ran out of tokens while reasoning and produced no answer. Try rephrasing your question or switching to a larger model.");
      }
      buf = "";
      inThink = false;
    },
  };
}

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
  return stripThinkingBlocks(result);
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

// ─── Model-size profile ────────────────────────────────────────────────────────
// Smaller models get fewer sources, shorter snippets, and a tighter token budget
// to prevent reasoning loops and context overflow.

interface ModelProfile {
  maxSources: number;
  snippetLen: number;
  maxTokens: number;
}

function getModelProfile(sizeMB = 99999, isReasoningModel = false): ModelProfile {
  // Base profile by download size
  let base: ModelProfile;
  if (sizeMB < 1500) base = { maxSources: 2, snippetLen: 80,  maxTokens: 800  }; // micro: 0.6B–1.5B
  else if (sizeMB < 3000) base = { maxSources: 3, snippetLen: 120, maxTokens: 1500 }; // small: 1.7B–3B
  else if (sizeMB < 5000) base = { maxSources: 4, snippetLen: 160, maxTokens: 2500 }; // medium: 4B–7B
  else base = { maxSources: 5, snippetLen: 200, maxTokens: 4000 };                    // large: 8B+

  if (!isReasoningModel) return base;

  // Reasoning models (DeepSeek R1, etc.) burn tokens on <think> blocks before the answer.
  // Cut sources to 2 so the context is small, and raise max_tokens to 4000 so the model
  // has budget left after the think block closes.
  return { maxSources: 2, snippetLen: base.snippetLen, maxTokens: 4000 };
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
        .slice(0, 1);
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

  // Fallback: two distinct queries covering eligibility/rights and restrictions/exceptions
  const jur = jurisdiction.toUpperCase();
  const topic = message.slice(0, 80);
  return {
    queries: [
      `${jur} ${topic} legal requirements rights eligibility`,
      `${jur} ${topic} exceptions restrictions conditions`,
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
  modelSizeMB,
  isReasoningModel,
  generate,
  onEvent,
}: GhostAgentOptions): Promise<void> {
  const emit = onEvent;
  const profile = getModelProfile(modelSizeMB, isReasoningModel);

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
            body: JSON.stringify({ query, maxResults: profile.maxSources }),
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
      // No raw URLs — URLs in context trigger repetition loops in small models.
      // Source count and snippet length are scaled by model size via getModelProfile().
      sources.slice(0, profile.maxSources).forEach((s, i) => {
        fullUserMessage += `\n\n[${i + 1}] ${s.title}\n${(s.snippet ?? "").slice(0, profile.snippetLen)}`;
      });
    }

    let fullAnswer = "";
    const thinkFilter = makeThinkFilter((token) => emit({ step: "delta", text: token }));
    await new Promise<void>((resolve, reject) => {
      generate({
        messages: [
          { role: "system", content: ghostModePrompt(jurisdiction, mode) },
          { role: "user", content: fullUserMessage },
        ],
        onToken: (token) => {
          fullAnswer += token;
          thinkFilter.feed(token);
        },
        onDone: () => {
          thinkFilter.end(fullAnswer);
          fullAnswer = stripThinkingBlocks(fullAnswer);
          resolve();
        },
        onError: (err) => reject(new Error(err)),
        maxTokens: profile.maxTokens,
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

// ─── Phase 6: True agentic Ghost Local loop ────────────────────────────────────
// Uses the on-device WebLLM engine with function calling instead of the
// linear pipeline above. Only called when the loaded model supportsToolUse.

export async function runGhostAgentAgentic({
  message,
  jurisdiction,
  mode,
  attachments,
  baseUrl,
  precedents,
  conversationHistory = [],
  engine,
  onEvent,
}: GhostAgentAgenticOptions): Promise<void> {
  const emit = onEvent;
  emit({ step: "classifying" });

  const systemPrompt = ghostLocalAgentPrompt(jurisdiction, mode);

  // Build user message — include attachment excerpts inline so the model
  // knows what documents are available before calling read_document
  let userContent = message;
  if (attachments.length > 0) {
    userContent += "\n\n--- ATTACHED DOCUMENTS ---";
    for (const a of attachments) {
      userContent += `\n\n[${a.name}] (use read_document("${a.name}", topic) for full content)\nPreview: ${a.extractedText.slice(0, 400)}`;
    }
  }

  const initialMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [
    ...conversationHistory,
    { role: "user", content: userContent },
  ];

  emit({ step: "synthesizing" });

  try {
    const { runLocalAgentLoop } = await import("./local-loop");
    await runLocalAgentLoop({
      systemPrompt,
      initialMessages,
      toolCtx: {
        attachments,
        jurisdiction: jurisdiction.toUpperCase(),
        baseUrl,
        precedents,
      },
      engine,
      onEvent: emit,
    });
  } catch (err) {
    emit({
      step: "error",
      message:
        err instanceof Error ? err.message : "Ghost agent encountered an error",
    });
  }
}
