// app/api/agent/route.ts
// Verdictu Legal Agent — true agentic loop (Phase 1).
// Uses Verdictu's server-side ANTHROPIC_API_KEY.
// Claude decides which tools to call and in what order; no hardcoded steps.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgentLoop } from "@/lib/agent/core/loop";
import { sseChunk } from "@/lib/agent/core/streaming";
import { agentSystemPrompt, followUpPrompt } from "@/lib/ai/prompts";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/agent/config";
import { needsCompaction, compactHistory, type WorkingState } from "@/lib/agent/context/compaction";

export const runtime = "nodejs";
export const maxDuration = 180;

interface Attachment {
  filename: string;
  text: string;
}

export interface AgentRequestBody {
  message: string;
  jurisdiction?: string;
  mode?: "General" | "Compare" | "Draft";
  attachments?: Attachment[];
  citationEnabled?: boolean;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  claudeModel?: string;
  workingState?: WorkingState;
}

export async function POST(req: NextRequest) {
  const body: AgentRequestBody = await req.json();
  const {
    message,
    jurisdiction = "EU",
    mode = "General",
    attachments = [],
    citationEnabled = true,
    conversationHistory = [],
    claudeModel = DEFAULT_CLAUDE_MODEL,
  } = body;

  if (!message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
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
        emit({ step: "start", data: { jurisdiction, mode } });

        // Compact history if it has grown too large
        let loopMessages = initialMessages;
        let workingState: WorkingState | undefined;
        if (needsCompaction(initialMessages)) {
          emit({ step: "compacting", data: {} });
          const compacted = await compactHistory(initialMessages, apiKey, claudeModel);
          loopMessages = compacted.messages;
          workingState = compacted.workingState;
        }

        const result = await runAgentLoop(
          {
            apiKey,
            model: claudeModel,
            systemPrompt,
            toolCtx: { attachments, jurisdiction, baseUrl },
          },
          loopMessages,
          (stepData) => emit(stepData),
          (token) => emit({ step: "delta", data: { text: token } }),
          req.signal,
        );

        // Follow-up questions — lightweight post-loop call
        emit({ step: "follow_up_generating", data: {} });
        let followUpQuestions: string[] = [];
        try {
          const client = new Anthropic({ apiKey });
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
            workingState,
          },
        });
      } catch (err) {
        emit({
          step: "error",
          data: {
            message: err instanceof Error ? err.message : "Agent encountered an error",
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
