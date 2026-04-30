// app/api/ghost-api/route.ts
// Ghost Open Mode — agentic loop using the user's own Claude API key.
// No data stored server-side; the key is used only to forward the request to Anthropic.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgentLoop } from "@/lib/agent/core/loop";
import { sseChunk } from "@/lib/agent/core/streaming";
import { agentSystemPrompt, followUpPrompt } from "@/lib/ai/prompts";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/agent/config";

export const runtime = "nodejs";
export const maxDuration = 180;

export interface GhostOpenRequestBody {
  message: string;
  claudeApiKey: string;
  claudeModel?: string;
  jurisdiction?: string;
  mode?: "General" | "Compare" | "Draft";
  attachments?: Array<{ filename: string; text: string }>;
  citationEnabled?: boolean;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(req: NextRequest) {
  const body: GhostOpenRequestBody = await req.json();
  const {
    message,
    claudeApiKey,
    claudeModel = DEFAULT_CLAUDE_MODEL,
    jurisdiction = "EU",
    mode = "General",
    attachments = [],
    citationEnabled = true,
    conversationHistory = [],
  } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (!claudeApiKey?.startsWith("sk-ant-")) {
    return Response.json(
      { error: "A valid Claude API key (sk-ant-...) is required for Ghost Open mode. Configure it in Agent Settings." },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const systemPrompt = agentSystemPrompt(jurisdiction, mode, citationEnabled);

  const initialMessages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        emit({ step: "start", data: { jurisdiction, mode, ghost: true } });

        const result = await runAgentLoop(
          {
            apiKey: claudeApiKey,
            model: claudeModel,
            systemPrompt,
            toolCtx: { attachments, jurisdiction, baseUrl },
          },
          initialMessages,
          (stepData) => emit(stepData),
          (token) => emit({ step: "delta", data: { text: token } }),
          req.signal,
        );

        // Follow-up questions
        emit({ step: "follow_up_generating", data: {} });
        let followUpQuestions: string[] = [];
        try {
          const client = new Anthropic({ apiKey: claudeApiKey });
          const fuMsg = await client.messages.create({
            model: claudeModel,
            max_tokens: 400,
            system: followUpPrompt(jurisdiction),
            messages: [
              {
                role: "user",
                content: `QUESTION: ${message}\n\nANSWER SUMMARY: ${result.answer.slice(0, 1500)}`,
              },
            ],
          }, { signal: req.signal });
          const fuText = fuMsg.content.find((b) => b.type === "text")?.text ?? "";
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
            message: err instanceof Error ? err.message : "Ghost Open agent encountered an error",
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
