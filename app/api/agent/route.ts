// app/api/agent/route.ts
// Verdictu Legal AI Agent — SSE streaming endpoint.
//
// Turn 1: Law identification (fast, JSON)
// Turn 2: Deep search via Tavily/DDG (concurrent per query, always on)
// Turn 3: Streaming synthesis (tokens streamed to client)
// Turn 4: Follow-up questions (fast, JSON)

import { NextRequest } from "next/server";
import {
  complete,
  DEFAULT_PROVIDER,
  resolveModel,
  type AIProvider,
} from "@/lib/ai/providers";
import { search } from "@/lib/search/tavily";
import {
  lawIdentificationPrompt,
  synthesisPrompt,
  followUpPrompt,
  alignmentCheckPrompt,
} from "@/lib/ai/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  filename: string;
  text: string;
}

export interface AgentRequestBody {
  message: string;
  jurisdiction: string;
  mode?: "General" | "Compare" | "Draft";
  attachments?: Attachment[];
  citationEnabled?: boolean;
  deepSearchEnabled?: boolean;
  provider?: AIProvider;
  model?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface LawItem {
  name: string;
  citation: string;
  relevance: "primary" | "secondary" | "supplementary";
  confidence: number;
  applies_because: string;
}

interface LawIdentificationResult {
  laws: LawItem[];
  searchQueries: string[];
  legalDomain: string;
  jurisdictionConfirmed: string;
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

const enc = new TextEncoder();
function sseChunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Streaming synthesis ──────────────────────────────────────────────────────

async function* streamSynthesis(
  provider: AIProvider,
  model: string,
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): AsyncIterable<string> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } else if (provider === "gemini") {
    // Gemini: prepend history as context prefix (no native multi-turn in this SDK call)
    const historyPrefix = history.length > 0
      ? history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n") + "\n\n"
      : "";
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 4000 },
    });
    const result = await genModel.generateContentStream(historyPrefix + userMessage);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } else {
    // OpenAI streaming
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await client.chat.completions.create({
      model,
      max_tokens: 4000,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body: AgentRequestBody = await req.json();
  const {
    message,
    jurisdiction = "EU",
    mode = "General",
    attachments,
    citationEnabled = true,
    deepSearchEnabled = true,
    provider = DEFAULT_PROVIDER,
    model: requestedModel,
    conversationHistory = [],
  } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = resolveModel(provider, requestedModel);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        // ── Turn 1: Intake ─────────────────────────────────────────────────
        emit({
          step: "intake",
          data: { jurisdiction, mode, preview: message.slice(0, 120) },
        });

        // ── Turn 1: Law Identification ─────────────────────────────────────
        emit({
          step: "identifying",
          data: { message: "Identifying applicable laws and regulations…" },
        });

        let lawResult: LawIdentificationResult = {
          laws: [],
          searchQueries: [],
          legalDomain: "general",
          jurisdictionConfirmed: jurisdiction,
        };

        try {
          const lawRes = await complete(provider, model, {
            systemPrompt: lawIdentificationPrompt(jurisdiction),
            userMessage: message,
            maxTokens: 1200,
            jsonMode: true,
          });
          const parsed = JSON.parse(lawRes.text);
          lawResult = {
            laws: Array.isArray(parsed.laws) ? parsed.laws : [],
            searchQueries: Array.isArray(parsed.searchQueries)
              ? parsed.searchQueries
              : [],
            legalDomain: parsed.legalDomain ?? "general",
            jurisdictionConfirmed:
              parsed.jurisdictionConfirmed ?? jurisdiction,
          };
        } catch {
          // Non-fatal — continue with empty laws
        }

        emit({
          step: "laws_found",
          data: {
            laws: lawResult.laws,
            domain: lawResult.legalDomain,
            jurisdiction: lawResult.jurisdictionConfirmed,
            count: lawResult.laws.length,
          },
        });

        // ── Turn 2: Deep Search ────────────────────────────────────────────
        const queries =
          lawResult.searchQueries.length > 0
            ? lawResult.searchQueries.slice(0, 5)
            : [`${jurisdiction} ${message.slice(0, 80)} law statute`];

        const allSources: Array<{
          title: string;
          url: string;
          snippet: string;
          domain?: string;
          score?: number;
        }> = [];

        if (deepSearchEnabled) {
          emit({
            step: "search_queries",
            data: { queries },
          });

          for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            emit({
              step: "searching",
              data: { query, index: i + 1, total: queries.length },
            });

            try {
              const results = await search(query, baseUrl, 5);
              allSources.push(...results);
              emit({
                step: "search_results",
                data: {
                  query,
                  count: results.length,
                  sources: results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    domain: r.domain,
                    snippet: r.snippet,
                  })),
                },
              });
            } catch {
              // One failed query is non-fatal
            }
          }
        }

        // Deduplicate by URL
        const seen = new Set<string>();
        const sources = allSources.filter((r) => {
          if (!r.url || seen.has(r.url)) return false;
          seen.add(r.url);
          return true;
        });

        emit({
          step: "sources_ranked",
          data: {
            total: sources.length,
            searchEngine: process.env.TAVILY_API_KEY ? "Tavily" : "DuckDuckGo",
          },
        });

        // ── Turn 2.5: Alignment Check ──────────────────────────────────────
        emit({ step: "aligning", data: {} });

        let correctionNote = "";
        try {
          const alignmentUserMessage =
            `ORIGINAL QUESTION: ${message}\n\n` +
            `IDENTIFIED LEGAL DOMAIN: ${lawResult.legalDomain}\n` +
            `JURISDICTION: ${lawResult.jurisdictionConfirmed}\n` +
            `IDENTIFIED LAWS:\n${
              lawResult.laws.length > 0
                ? lawResult.laws
                    .map((l) => `• ${l.citation} — ${l.applies_because}`)
                    .join("\n")
                : "(none identified)"
            }`;

          const alignRes = await complete(provider, model, {
            systemPrompt: alignmentCheckPrompt(),
            userMessage: alignmentUserMessage,
            maxTokens: 300,
            jsonMode: true,
          });
          const alignParsed = JSON.parse(alignRes.text);

          if (alignParsed.aligned === false && alignParsed.correctionNote) {
            correctionNote = alignParsed.correctionNote;
          }

          emit({
            step: "alignment_result",
            data: {
              aligned: alignParsed.aligned !== false,
              originalIntent: alignParsed.originalIntent ?? "",
              corrected: !!correctionNote,
            },
          });
        } catch {
          // Non-fatal — proceed without correction
          emit({ step: "alignment_result", data: { aligned: true, corrected: false } });
        }

        // ── Turn 3: Synthesis (streaming) ─────────────────────────────────
        emit({
          step: "synthesizing",
          data: { message: "Composing legal analysis…" },
        });

        // Build the full user message with all context
        let fullUserMessage = message;

        if (correctionNote) {
          fullUserMessage =
            `⚠️ ALIGNMENT CORRECTION: ${correctionNote}\n\n` + fullUserMessage;
        }

        if (attachments?.length) {
          fullUserMessage += "\n\n--- ATTACHED DOCUMENTS ---";
          for (const a of attachments) {
            fullUserMessage += `\n\n[${a.filename}]\n${a.text.slice(0, 8000)}`;
          }
        }

        if (lawResult.laws.length > 0) {
          fullUserMessage += "\n\n--- IDENTIFIED APPLICABLE LAWS ---";
          for (const law of lawResult.laws) {
            fullUserMessage += `\n• ${law.citation} (${law.relevance}, confidence ${Math.round(law.confidence * 100)}%) — ${law.applies_because}`;
          }
        }

        if (sources.length > 0) {
          fullUserMessage += "\n\n--- WEB RESEARCH RESULTS (Deep Search) ---";
          sources.slice(0, 10).forEach((s, i) => {
            fullUserMessage += `\n\n[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet.slice(0, 800)}`;
          });
        }

        let fullAnswer = "";
        for await (const token of streamSynthesis(
          provider,
          model,
          synthesisPrompt(jurisdiction, mode, citationEnabled),
          fullUserMessage,
          conversationHistory,
        )) {
          fullAnswer += token;
          emit({ step: "delta", data: { text: token } });
        }

        // ── Turn 4: Follow-up questions ────────────────────────────────────
        emit({ step: "follow_up_generating", data: {} });

        let followUpQuestions: string[] = [];
        try {
          const fuRes = await complete(provider, model, {
            systemPrompt: followUpPrompt(jurisdiction),
            userMessage: `QUESTION: ${message}\n\nANSWER SUMMARY: ${fullAnswer.slice(0, 1500)}`,
            maxTokens: 400,
            jsonMode: true,
          });
          const fuParsed = JSON.parse(fuRes.text);
          followUpQuestions = Array.isArray(fuParsed.questions)
            ? fuParsed.questions
            : [];
        } catch {
          // Non-fatal
        }

        emit({
          step: "done",
          data: {
            sources: sources.map((s) => ({
              title: s.title,
              url: s.url,
              domain: s.domain,
              snippet: s.snippet,
            })),
            laws: lawResult.laws,
            followUpQuestions,
            wordsInAnswer: fullAnswer.split(/\s+/).length,
          },
        });
      } catch (err) {
        emit({
          step: "error",
          data: {
            message:
              err instanceof Error ? err.message : "Agent encountered an error",
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
