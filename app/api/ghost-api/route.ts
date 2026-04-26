// app/api/ghost-api/route.ts
// Ghost API Mode — server-side equivalent of local Ghost Mode.
// Uses OpenRouter instead of in-browser WebLLM, enabling larger cloud models.
//
// ─── Backend integration status ───────────────────────────────────────────────
// ✅ OpenRouter streaming — ready (lib/ghost/openrouter.ts)
// ✅ Ghost agent pipeline — ready (lib/ghost/agent.ts via runGhostAgentApi below)
// ✅ LLM-driven search query generation — Perplexity-style
// ❌ Clerk auth check     — not wired yet (TODO: Phase 1)
// ❌ Convex credit check  — not wired yet (TODO: Phase 1)
// ❌ Convex credit deduct — not wired yet (TODO: Phase 1)
// ❌ Convex usage logging — not wired yet (TODO: Phase 2)

import { NextRequest } from "next/server";
import { ghostModePrompt, ghostFollowUpPrompt, alignmentCheckPrompt } from "@/lib/ai/prompts";
import { search } from "@/lib/search/tavily";
import { streamOpenRouter, findGhostApiModel, DEFAULT_GHOST_API_MODEL } from "@/lib/ghost/openrouter";
import type { GhostAgentSource } from "@/lib/ghost/agent";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhostApiRequestBody {
  message: string;
  jurisdiction: string;
  mode?: "General" | "Compare" | "Draft";
  citationEnabled?: boolean;
  deepSearchEnabled?: boolean;
  attachments?: Array<{ name: string; extractedText: string }>;
  modelId?: string;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

const enc = new TextEncoder();
function sseChunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function extractJSON(text: string): Record<string, unknown> | null {
  const t = text.trim();
  try { return JSON.parse(t) as Record<string, unknown>; } catch { /* */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()) as Record<string, unknown>; } catch { /* */ } }
  const brace = t.match(/\{[\s\S]+\}/);
  if (brace) { try { return JSON.parse(brace[0]) as Record<string, unknown>; } catch { /* */ } }
  return null;
}

// ─── LLM-based search query generation ───────────────────────────────────────

async function generateSearchQueries(
  message: string,
  jurisdiction: string,
  modelId: string,
  signal: AbortSignal,
): Promise<{ queries: string[]; domain: string }> {
  const systemPrompt = `You generate web search queries for legal research. Return ONLY valid JSON in this exact format, nothing else:
{"queries":["query1","query2","query3","query4"],"domain":"criminal|civil|medical|administrative|general"}

Jurisdiction: ${jurisdiction.toUpperCase()}
Rules: queries must target statutes, regulations, exceptions, case law, and legal gaps relevant to the question.`;

  let result = "";
  try {
    await streamOpenRouter({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${message.slice(0, 300)}` },
      ],
      model: modelId,
      onToken: (t) => { result += t; },
      onDone: () => {},
      signal,
    });

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body: GhostApiRequestBody = await req.json();
  const {
    message,
    jurisdiction = "EU",
    mode = "General",
    citationEnabled = true,
    deepSearchEnabled = true,
    attachments = [],
    modelId,
  } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── TODO (Phase 1): Auth & credit gate ─────────────────────────────────────
  // const { userId } = await auth();
  // if (!userId) return new Response("Unauthorized", { status: 401 });
  // const balance = await convex.query(api.users.getCreditBalance, { clerkId: userId });
  // if (balance < 1) { return new Response(..., { status: 402 }); }
  // ───────────────────────────────────────────────────────────────────────────

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const model = findGhostApiModel(modelId ?? "") ?? DEFAULT_GHOST_API_MODEL;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        // ── Phase 1: LLM query generation ──────────────────────────────────
        emit({ step: "classifying" });

        let searchQueries: string[] = [];
        let domain = "legal";

        if (deepSearchEnabled) {
          const generated = await generateSearchQueries(
            message,
            jurisdiction,
            model.id,
            req.signal,
          );
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

        // ── Phase 2: Web search ────────────────────────────────────────────
        const sources: GhostAgentSource[] = [];

        if (deepSearchEnabled && searchQueries.length > 0) {
          for (let i = 0; i < searchQueries.length; i++) {
            const query = searchQueries[i];
            emit({ step: "searching", query, index: i + 1, total: searchQueries.length });

            try {
              const results = await search(query, baseUrl, 5);
              const mapped: GhostAgentSource[] = results.map((r) => ({
                title: r.title ?? "",
                url: r.url ?? "",
                snippet: r.snippet ?? "",
                score: r.score,
                domain: r.domain ?? extractDomain(r.url ?? ""),
              }));
              sources.push(...mapped);
              emit({ step: "search_results", query, count: mapped.length, sources: mapped });
            } catch {
              // Non-fatal
            }
          }

          // Deduplicate
          const seen = new Set<string>();
          const deduped = sources.filter((r) => {
            if (!r.url || seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
          });
          sources.length = 0;
          sources.push(...deduped);

          emit({
            step: "sources_ranked",
            total: sources.length,
            engine: process.env.TAVILY_API_KEY ? "Tavily" : "DuckDuckGo",
          });
        }

        // ── Phase 2.5: Alignment Check ─────────────────────────────────────
        emit({ step: "aligning" });

        let correctionNote = "";
        try {
          const alignmentUserMessage =
            `ORIGINAL QUESTION: ${message}\n\n` +
            `IDENTIFIED LEGAL DOMAIN: ${domain}\n` +
            `JURISDICTION: ${jurisdiction}\n` +
            `SEARCH QUERIES USED:\n${
              searchQueries.length > 0
                ? searchQueries.map((q: string) => `• ${q}`).join("\n")
                : "(no search performed)"
            }`;

          let alignText = "";
          await streamOpenRouter({
            messages: [
              { role: "system", content: alignmentCheckPrompt() },
              { role: "user", content: alignmentUserMessage },
            ],
            model: model.id,
            onToken: (t) => { alignText += t; },
            onDone: () => {},
            signal: req.signal,
          });

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

        // ── Phase 3: Synthesis via OpenRouter ──────────────────────────────
        emit({ step: "synthesizing", model: model.id });

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

        await streamOpenRouter({
          messages: [
            { role: "system", content: ghostModePrompt(jurisdiction, mode) },
            { role: "user", content: fullUserMessage },
          ],
          model: model.id,
          onToken: (token) => {
            fullAnswer += token;
            emit({ step: "delta", text: token });
          },
          onDone: () => {},
          signal: req.signal,
        });

        // ── TODO (Phase 1): Deduct credit after successful response ─────────
        // await convex.mutation(api.users.deductCredits, { userId: convexUserId, amount: 1 });
        // ───────────────────────────────────────────────────────────────────

        // ── Phase 4: Follow-up questions ───────────────────────────────────
        emit({ step: "follow_up_generating" });

        let followUpQuestions: string[] = [];
        try {
          let fuText = "";
          await streamOpenRouter({
            messages: [
              { role: "system", content: ghostFollowUpPrompt() },
              {
                role: "user",
                content: `QUESTION: ${message}\n\nANSWER SUMMARY: ${fullAnswer.slice(0, 800)}`,
              },
            ],
            model: model.id,
            onToken: (t) => { fuText += t; },
            onDone: () => {},
            signal: req.signal,
          });

          const parsed = extractJSON(fuText);
          if (parsed && Array.isArray(parsed.questions)) {
            followUpQuestions = parsed.questions as string[];
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
          message: err instanceof Error ? err.message : "Ghost API encountered an error",
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
