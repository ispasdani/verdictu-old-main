// app/api/ghost-api/route.ts
// Ghost API Mode — server-side equivalent of local Ghost Mode.
// Uses OpenRouter instead of in-browser WebLLM, enabling larger cloud models.
//
// ─── Backend integration status ───────────────────────────────────────────────
// ✅ OpenRouter streaming — ready (lib/ghost/openrouter.ts)
// ✅ Ghost agent pipeline — ready (lib/ghost/agent.ts via runGhostAgentApi below)
// ❌ Clerk auth check     — not wired yet (TODO: Phase 1)
// ❌ Convex credit check  — not wired yet (TODO: Phase 1)
// ❌ Convex credit deduct — not wired yet (TODO: Phase 1)
// ❌ Convex usage logging — not wired yet (TODO: Phase 2)
//
// Once the backend is wired, follow the Architecture section in
// docs/ghost-api-billing-plan.md for the exact integration order.

import { NextRequest } from "next/server";
import { ghostModePrompt, ghostFollowUpPrompt } from "@/lib/ai/prompts";
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
  attachments?: Array<{ name: string; extractedText: string }>;
  modelId?: string;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

const enc = new TextEncoder();
function sseChunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Search need detection (mirrors lib/ghost/agent.ts) ──────────────────────

function detectSearchNeed(message: string, jurisdiction: string) {
  const lower = message.toLowerCase();

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
  ];
  const directTaskPrefixes = [
    "write", "draft", "create", "generate", "summarize", "review this",
    "analyze this", "translate", "fix", "improve", "rewrite", "format", "convert",
  ];

  const needsResearch = researchTopics.some((kw) => lower.includes(kw));
  const isDirectTask = directTaskPrefixes.some((kw) => lower.startsWith(kw));
  const needsSearch = needsResearch && !isDirectTask;

  const domain = lower.match(/\b(criminal|crime|arrest|charge|felony|misdemeanor|prison|jail)\b/)
    ? "criminal"
    : lower.match(/\b(civil|contract|lawsuit|sue|liability|settlement)\b/)
      ? "civil"
      : lower.match(/\b(medical|drug|medication|disease|treatment)\b/)
        ? "medical"
        : needsResearch ? "legal" : "general";

  const searchQueries: string[] = [];
  if (needsSearch) {
    const jur = jurisdiction.toUpperCase();
    searchQueries.push(`${jur} ${message.slice(0, 60)} exception exemption scope`);
    searchQueries.push(`${jur} ${message.slice(0, 50)} legal gap`);
    if (lower.match(/\b(reset|days|border|exit|return|period|deadline|clock)\b/)) {
      searchQueries.push(`${jur} ${message.slice(0, 45)} period reset exception border`);
    }
    if (lower.match(/\b(eu|european|foreign|national|citizen|resident|plates|vehicle|car)\b/)) {
      searchQueries.push(`${jur} ${message.slice(0, 40)} EU regulation foreign national rights`);
    }
  }

  return { needsSearch, domain, searchQueries };
}

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body: GhostApiRequestBody = await req.json();
  const {
    message,
    jurisdiction = "EU",
    mode = "General",
    citationEnabled = true,
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
  // Uncomment and implement once Clerk + Convex are wired:
  //
  // const { userId } = await auth();
  // if (!userId) return new Response("Unauthorized", { status: 401 });
  //
  // const balance = await convex.query(api.users.getCreditBalance, { clerkId: userId });
  // if (balance < 1) {
  //   return new Response(JSON.stringify({ error: "insufficient_credits" }), {
  //     status: 402,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // }
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
        // ── Phase 1: Search need detection ─────────────────────────────────
        emit({ step: "classifying" });

        const { needsSearch, domain, searchQueries } = detectSearchNeed(message, jurisdiction);
        emit({ step: "intent", needsSearch, domain, searchQueries });

        // ── Phase 2: Optional web search ───────────────────────────────────
        const sources: GhostAgentSource[] = [];

        if (needsSearch && searchQueries.length > 0) {
          const queries = searchQueries.slice(0, 4);

          for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            emit({ step: "searching", query, index: i + 1, total: queries.length });

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
              emit({ step: "search_results", query, count: mapped.length });
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

        // ── Phase 3: Synthesis via OpenRouter ──────────────────────────────
        emit({ step: "synthesizing", model: model.id });

        let fullUserMessage = message;

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
        let usageTokens = { inputTokens: 0, outputTokens: 0 };

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
          onDone: (usage) => {
            usageTokens = usage;
          },
          signal: req.signal,
        });

        // ── TODO (Phase 1): Deduct credit after successful response ─────────
        // await convex.mutation(api.users.deductCredits, { userId: convexUserId, amount: 1 });
        // await convex.mutation(api.usage.logGhostApiQuery, {
        //   userId: convexUserId,
        //   model: model.id,
        //   inputTokens: usageTokens.inputTokens,
        //   outputTokens: usageTokens.outputTokens,
        //   creditsCost: 1,
        //   queryCostUsd: (usageTokens.inputTokens / 1_000_000) * 0.55
        //                + (usageTokens.outputTokens / 1_000_000) * 2.19,
        //   jurisdiction,
        //   createdAt: Date.now(),
        // });
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
          sources: sources.slice(0, 10),
          followUpQuestions,
          wordsInAnswer: fullAnswer.split(/\s+/).length,
          // TODO: add credits_remaining once Convex is wired
          // creditsRemaining: balance - 1,
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
