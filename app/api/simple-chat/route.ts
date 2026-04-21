import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const enc = new TextEncoder();
function sseChunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

const SYSTEM_PROMPT = `You are a helpful, knowledgeable, and versatile AI assistant. You can help with anything: writing, coding, analysis, research, brainstorming, math, creative work, explanations, and more. Be clear, concise, and friendly. Format your responses with markdown when it improves readability.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    message,
    conversationHistory = [],
  }: {
    message: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        emit({ step: "thinking", data: {} });

        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            ...conversationHistory.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user" as const, content: message },
          ],
        });

        const start = Date.now();

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emit({ step: "delta", data: { text: event.delta.text } });
          }
        }

        emit({ step: "done", data: { elapsedMs: Date.now() - start } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit({ step: "error", data: { message: msg } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
