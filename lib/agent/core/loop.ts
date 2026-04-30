import Anthropic from "@anthropic-ai/sdk";
import type { SearchResult } from "@/lib/search/tavily";
import { TOOL_DEFINITIONS, executeTool, type ToolContext, type ToolName } from "./tools";
import { toolCallToStepLabel } from "./streaming";
import { toCachedSystem, withCacheBreakpoints } from "@/lib/agent/context/cache-markers";

export type StepEmitter = (data: object) => void;
export type TokenEmitter = (token: string) => void;

export interface LoopConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTurns?: number;
  thinkingBudget?: number;
  toolCtx: ToolContext;
}

export interface LoopResult {
  answer: string;
  sources: SearchResult[];
  turns: number;
}

const EXTENDED_THINKING_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-3-7-sonnet",
];

function supportsExtendedThinking(model: string): boolean {
  return EXTENDED_THINKING_MODELS.some((m) => model.includes(m));
}

export async function runAgentLoop(
  config: LoopConfig,
  initialMessages: Anthropic.MessageParam[],
  onStep: StepEmitter,
  onToken: TokenEmitter,
  signal?: AbortSignal,
): Promise<LoopResult> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const maxTurns = config.maxTurns ?? 12;
  const thinkingBudget = config.thinkingBudget ?? 8000;
  const useThinking = supportsExtendedThinking(config.model);

  const messages: Anthropic.MessageParam[] = [...initialMessages];
  const allSources: SearchResult[] = [];
  let fullAnswer = "";
  let turns = 0;

  while (turns < maxTurns) {
    turns++;

    // Track whether we've already emitted a "thinking" step this turn
    // to avoid spamming one per thinking block when Claude emits several
    let thinkingEmittedThisTurn = false;

    const streamParams: Anthropic.MessageCreateParamsStreaming = {
      model: config.model,
      max_tokens: useThinking ? thinkingBudget + 8192 : 8192,
      system: toCachedSystem(config.systemPrompt),
      tools: TOOL_DEFINITIONS,
      messages: withCacheBreakpoints(messages),
      stream: true,
      ...(useThinking
        ? { thinking: { type: "enabled", budget_tokens: thinkingBudget } }
        : {}),
    };

    const stream = client.messages.stream(streamParams, { signal });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "thinking" && !thinkingEmittedThisTurn) {
          onStep({ step: "thinking" });
          thinkingEmittedThisTurn = true;
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          fullAnswer += delta.text;
          onToken(delta.text);
        }
      }
    }

    const finalMsg = await stream.finalMessage();
    const stopReason = finalMsg.stop_reason;

    if (stopReason === "end_turn") {
      break;
    }

    if (stopReason === "tool_use") {
      // Append the full assistant turn (including thinking + tool_use blocks) to history
      messages.push({ role: "assistant", content: finalMsg.content });

      const toolUseBlocks = finalMsg.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      // Emit human-readable step labels for all tool calls in this turn
      for (const block of toolUseBlocks) {
        const label = toolCallToStepLabel(
          block.name,
          block.input as Record<string, unknown>,
        );
        onStep({ step: "tool_call", data: { tool: block.name, label } });
      }

      // Execute all tool calls in parallel
      const pairs = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          block,
          result: await executeTool(
            block.name as ToolName,
            block.input as Record<string, unknown>,
            config.toolCtx,
          ),
        })),
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = pairs.map(
        ({ block, result }) => {
          if (result.sources) allSources.push(...result.sources);
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: result.content,
          };
        },
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // max_tokens or stop_sequence — stop cleanly
    break;
  }

  // Deduplicate sources by URL
  const seen = new Set<string>();
  const sources = allSources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return { answer: fullAnswer, sources, turns };
}
