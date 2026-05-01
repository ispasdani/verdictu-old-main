// lib/ghost/local-loop.ts
// Browser-side agentic loop for Ghost Local (WebLLM with function calling).
// Runs entirely in the browser — no Anthropic SDK or server-side code.

import { toolCallToStepLabel } from "@/lib/agent/core/streaming";
import {
  LOCAL_TOOL_DEFINITIONS,
  executeLocalTool,
  type LocalToolContext,
  type LocalToolName,
  type LocalSource,
} from "./local-tools";
import type { GhostAgentEvent } from "./agent";

// ─── WebLLM streaming types ───────────────────────────────────────────────────

interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: ToolCallDelta[];
    };
    finish_reason: "stop" | "tool_calls" | "length" | null;
  }>;
}

interface AccumulatedToolCall {
  id: string;
  function: { name: string; arguments: string };
}

// Messages accepted by WebLLM's OpenAI-compatible API
type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AssistantToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface AssistantToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ─── Minimal WebLLM engine interface ─────────────────────────────────────────

export interface WebLLMEngine {
  chat: {
    completions: {
      // Streaming with tool use
      create(opts: {
        messages: ChatMessage[];
        tools?: typeof LOCAL_TOOL_DEFINITIONS;
        temperature?: number;
        max_tokens?: number;
        stream: true;
      }): Promise<AsyncIterable<StreamChunk>>;
      // Non-streaming (for draft_document_section)
      create(opts: {
        messages: ChatMessage[];
        temperature?: number;
        max_tokens?: number;
        stream?: false;
      }): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
}

// ─── Loop options ─────────────────────────────────────────────────────────────

export interface LocalLoopOptions {
  systemPrompt: string;
  initialMessages: ChatMessage[];
  toolCtx: Omit<LocalToolContext, "draftViaEngine">;
  engine: WebLLMEngine;
  maxTurns?: number;
  onEvent: (event: GhostAgentEvent) => void;
}

// ─── Agentic loop ─────────────────────────────────────────────────────────────

export async function runLocalAgentLoop({
  systemPrompt,
  initialMessages,
  toolCtx,
  engine,
  maxTurns = 12,
  onEvent,
}: LocalLoopOptions): Promise<void> {
  const emit = onEvent;
  const allSources: LocalSource[] = [];
  const seenUrls = new Set<string>();

  // Provide a draftViaEngine callback so executeLocalTool can make a
  // non-streaming call for the draft_document_section tool
  const draftViaEngine = async (
    systemP: string,
    userP: string,
  ): Promise<string> => {
    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: systemP },
        { role: "user", content: userP },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      stream: false,
    });
    return response.choices[0]?.message?.content ?? "";
  };

  const fullCtx: LocalToolContext = { ...toolCtx, draftViaEngine };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...initialMessages,
  ];

  let turns = 0;

  while (turns < maxTurns) {
    turns++;

    const toolCallsByIndex = new Map<number, AccumulatedToolCall>();
    let finishReason: string | null = null;

    const stream = await engine.chat.completions.create({
      messages,
      tools: LOCAL_TOOL_DEFINITIONS,
      temperature: 0.4,
      max_tokens: 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const { delta } = choice;

      // Stream text tokens to the UI
      if (delta.content) {
        emit({ step: "delta", text: delta.content });
      }

      // Accumulate tool call argument fragments across chunks
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallsByIndex.get(tc.index) ?? {
            id: "",
            function: { name: "", arguments: "" },
          };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name = tc.function.name;
          if (tc.function?.arguments)
            existing.function.arguments += tc.function.arguments;
          toolCallsByIndex.set(tc.index, existing);
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    // Model produced a final answer (already streamed via delta events)
    if (finishReason === "stop" || finishReason === "length") {
      break;
    }

    // Model wants to call tools
    if (finishReason === "tool_calls" && toolCallsByIndex.size > 0) {
      const toolCalls = [...toolCallsByIndex.values()].filter(
        (tc) => tc.function.name,
      );

      // Emit human-readable step labels before executing
      for (const tc of toolCalls) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          /* malformed JSON — use empty input */
        }

        if (tc.function.name === "think") {
          emit({ step: "thinking" });
        } else {
          const label = toolCallToStepLabel(tc.function.name, parsedInput);
          emit({ step: "tool_call", tool: tc.function.name, label });
        }
      }

      // Append the assistant turn with tool_calls to history
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          type: "function" as const,
          function: tc.function,
        })),
      });

      // Execute tool calls sequentially (WebGPU context limits parallelism)
      const toolResults: ChatMessage[] = [];
      for (const tc of toolCalls) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          /* use empty input */
        }

        const callId =
          tc.id || `call_${Math.random().toString(36).slice(2, 10)}`;

        const result = await executeLocalTool(
          tc.function.name as LocalToolName,
          parsedInput,
          fullCtx,
        );

        if (result.sources) {
          for (const s of result.sources) {
            if (s.url && !seenUrls.has(s.url)) {
              seenUrls.add(s.url);
              allSources.push(s);
            }
          }
        }

        toolResults.push({
          role: "tool",
          tool_call_id: callId,
          content: result.content,
        });
      }

      messages.push(...toolResults);
      continue;
    }

    // Unexpected finish reason — stop cleanly
    break;
  }

  emit({
    step: "done",
    sources: allSources,
    followUpQuestions: [],
    wordsInAnswer: 0,
  });
}
