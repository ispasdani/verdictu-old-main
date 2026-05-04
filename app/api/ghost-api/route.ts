// app/api/ghost-api/route.ts
// Ghost Open Mode — agentic loop via OpenRouter using the server's API key.
// Users select any OpenRouter model; credits are deducted per query.

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { sseChunk } from "@/lib/agent/core/streaming";
import { agentSystemPrompt, followUpPrompt } from "@/lib/ai/prompts";
import { runOpenRouterLoop } from "@/lib/ghost/openrouter-loop";

export const runtime = "nodejs";
export const maxDuration = 180;

export interface GhostOpenRequestBody {
  message: string;
  modelId: string;
  jurisdiction?: string;
  mode?: "General" | "Compare" | "Draft";
  attachments?: Array<{ name: string; extractedText: string }>;
  citationEnabled?: boolean;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(req: NextRequest) {
  const body: GhostOpenRequestBody = await req.json();
  const {
    message,
    modelId,
    jurisdiction = "EU",
    mode = "General",
    attachments = [],
    citationEnabled = true,
    conversationHistory = [],
  } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (!modelId) {
    return Response.json({ error: "modelId is required" }, { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "Ghost Open is not available on this server." },
      { status: 503 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const systemPrompt = agentSystemPrompt(jurisdiction, mode, citationEnabled);

  const toolAttachments = attachments.map((a) => ({
    filename: a.name,
    text: a.extractedText,
  }));

  const initialMessages: Array<{ role: "user" | "assistant"; content: string }> =
    [...conversationHistory, { role: "user", content: message }];

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        emit({ step: "start", data: { jurisdiction, mode, ghost: true } });
        emit({ step: "classifying" });
        emit({ step: "intent", domain: "legal", needsSearch: false });

        let synthesizingEmitted = false;
        const result = await runOpenRouterLoop(
          {
            model: modelId,
            systemPrompt,
            toolCtx: { attachments: toolAttachments, jurisdiction, baseUrl },
            signal: req.signal,
          },
          initialMessages,
          (stepData) => emit(stepData),
          (token) => {
            if (!synthesizingEmitted) {
              emit({ step: "synthesizing" });
              synthesizingEmitted = true;
            }
            emit({ step: "delta", data: { text: token } });
          },
        );

        emit({ step: "follow_up_generating", data: {} });
        let followUpQuestions: string[] = [];
        try {
          const client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
              "HTTP-Referer": baseUrl,
              "X-Title": "Verdictu",
            },
          });
          const fuMsg = await client.chat.completions.create({
            model: modelId,
            max_tokens: 400,
            messages: [
              { role: "system", content: followUpPrompt(jurisdiction) },
              {
                role: "user",
                content: `QUESTION: ${message}\n\nANSWER SUMMARY: ${result.answer.slice(0, 1500)}`,
              },
            ],
          });
          const fuText = fuMsg.choices[0]?.message.content ?? "";
          const fuParsed = JSON.parse(fuText);
          if (Array.isArray(fuParsed.questions)) {
            followUpQuestions = fuParsed.questions as string[];
          }
        } catch {
          // Non-fatal
        }

        emit({
          step: "done",
          data: {
            sources: result.sources.map((s) => ({
              title: s.title,
              url: s.url,
              domain: s.domain,
              snippet: s.snippet,
            })),
            followUpQuestions,
            wordsInAnswer: result.answer.split(/\s+/).length,
            turns: result.turns,
          },
        });
      } catch (err) {
        emit({
          step: "error",
          data: {
            message:
              err instanceof Error
                ? err.message
                : "Ghost Open agent encountered an error",
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
