import OpenAI from "openai";
import type { SearchResult } from "@/lib/search/tavily";
import {
  TOOL_DEFINITIONS,
  executeTool,
  type ToolContext,
  type ToolName,
} from "@/lib/agent/core/tools";
import { toolCallToStepLabel } from "@/lib/agent/core/streaming";

export type StepEmitter = (data: object) => void;
export type TokenEmitter = (token: string) => void;

export interface OpenRouterLoopConfig {
  model: string;
  systemPrompt: string;
  maxTurns?: number;
  toolCtx: ToolContext;
  signal?: AbortSignal;
}

export interface LoopResult {
  answer: string;
  sources: SearchResult[];
  turns: number;
}

// Convert Anthropic-format tool definitions to OpenAI function calling format
const OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = TOOL_DEFINITIONS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema as Record<string, unknown>,
  },
}));

export async function runOpenRouterLoop(
  config: OpenRouterLoopConfig,
  initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
  onStep: StepEmitter,
  onToken: TokenEmitter,
): Promise<LoopResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://verdictu.com",
      "X-Title": "Verdictu",
    },
  });

  const maxTurns = config.maxTurns ?? 12;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: config.systemPrompt },
    ...initialMessages,
  ];

  const enrichedCtx: ToolContext = {
    ...config.toolCtx,
    onSubAgentStep: onStep,
  };

  const allSources: SearchResult[] = [];
  let fullAnswer = "";
  let turns = 0;

  while (turns < maxTurns) {
    turns++;

    const stream = await client.chat.completions.create(
      {
        model: config.model,
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: "auto",
        stream: true,
        max_tokens: 8192,
        temperature: 0.3,
      },
      { signal: config.signal },
    );

    let currentContent = "";
    const toolCallsAcc = new Map<
      number,
      { id: string; name: string; argsStr: string }
    >();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) finishReason = choice.finish_reason;

      if (choice.delta.content) {
        currentContent += choice.delta.content;
        fullAnswer += choice.delta.content;
        onToken(choice.delta.content);
      }

      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallsAcc.has(idx)) {
            toolCallsAcc.set(idx, {
              id: tc.id ?? `call_${idx}`,
              name: tc.function?.name ?? "",
              argsStr: "",
            });
          }
          const acc = toolCallsAcc.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.argsStr += tc.function.arguments;
        }
      }
    }

    if (toolCallsAcc.size === 0 || finishReason === "stop") {
      if (currentContent) {
        messages.push({ role: "assistant", content: currentContent });
      }
      break;
    }

    type FnToolCall = {
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    };

    const toolCalls: FnToolCall[] = Array.from(toolCallsAcc.values()).map(
      (acc) => ({
        id: acc.id,
        type: "function" as const,
        function: { name: acc.name, arguments: acc.argsStr },
      }),
    );

    for (const tc of toolCalls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        // ignore malformed args
      }
      onStep({
        step: "tool_call",
        data: {
          tool: tc.function.name,
          label: toolCallToStepLabel(tc.function.name, input),
        },
      });
    }

    messages.push({
      role: "assistant",
      content: currentContent || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool_calls: toolCalls as any,
    });

    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          // ignore
        }
        const result = await executeTool(
          tc.function.name as ToolName,
          input,
          enrichedCtx,
        );
        if (result.sources) allSources.push(...result.sources);
        return { id: tc.id, content: result.content };
      }),
    );

    for (const r of results) {
      messages.push({
        role: "tool",
        tool_call_id: r.id,
        content: r.content,
      });
    }
  }

  const seen = new Set<string>();
  const sources = allSources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return { answer: fullAnswer, sources, turns };
}
