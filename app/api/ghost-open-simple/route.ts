import { NextRequest } from "next/server";
import OpenAI from "openai";

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
    modelId,
    conversationHistory = [],
  }: {
    message: string;
    modelId: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!modelId) {
    return new Response(JSON.stringify({ error: "modelId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Ghost Open is not available on this server." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": baseUrl,
      "X-Title": "Verdictu",
    },
  });

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        emit({ step: "thinking", data: {} });

        const stream = await client.chat.completions.create({
          model: modelId,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: message },
          ],
          stream: true,
        });

        const start = Date.now();

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            emit({ step: "delta", data: { text } });
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
