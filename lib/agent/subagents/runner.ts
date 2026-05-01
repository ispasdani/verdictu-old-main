import Anthropic from "@anthropic-ai/sdk";
import {
  SUB_AGENT_TOOL_DEFINITIONS,
  executeSubAgentTool,
  type ToolContext,
} from "@/lib/agent/core/tools";
import type { SearchResult } from "@/lib/search/tavily";

export type SubAgentStepEmitter = (data: object) => void;

export interface SubAgentConfig {
  apiKey: string;
  model: string;
  /** Display name used as prefix in forwarded step labels, e.g. "Research" → "[Research]" */
  name: string;
  task: string;
  systemPrompt: string;
  toolCtx: ToolContext;
  maxTurns?: number;
  signal?: AbortSignal;
}

export interface SubAgentResult {
  answer: string;
  sources: SearchResult[];
}

export async function runSubAgent(
  config: SubAgentConfig,
  onParentStep: SubAgentStepEmitter,
): Promise<SubAgentResult> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const prefix = `[${config.name}]`;
  const maxTurns = config.maxTurns ?? 8;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: config.task },
  ];
  const allSources: SearchResult[] = [];
  let fullAnswer = "";
  let turns = 0;

  while (turns < maxTurns) {
    turns++;

    const response = await client.messages.create(
      {
        model: config.model,
        max_tokens: 4096,
        system: config.systemPrompt,
        tools: SUB_AGENT_TOOL_DEFINITIONS,
        messages,
      },
      { signal: config.signal },
    );

    if (response.stop_reason === "end_turn") {
      // Emit synthesizing step if we actually did research (more than first turn)
      if (turns > 1) {
        onParentStep({
          step: "tool_call",
          data: {
            tool: "synthesize",
            label: `${prefix} Synthesizing...`,
            subAgent: config.name,
          },
        });
      }
      fullAnswer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      for (const block of toolUseBlocks) {
        const label = subAgentStepLabel(
          block.name,
          block.input as Record<string, unknown>,
        );
        onParentStep({
          step: "tool_call",
          data: {
            tool: block.name,
            label: `${prefix} ${label}`,
            subAgent: config.name,
          },
        });
      }

      const pairs = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          block,
          result: await executeSubAgentTool(
            block.name as "web_search" | "think",
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

    // max_tokens or stop_sequence — extract whatever text is available
    fullAnswer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    break;
  }

  const seen = new Set<string>();
  const sources = allSources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return { answer: fullAnswer, sources };
}

function subAgentStepLabel(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (toolName === "web_search") {
    const query = String(input.query ?? "");
    const jur = String(input.jurisdiction ?? "");
    if (query && jur) return `Searching ${jur} law for "${query}"...`;
    if (query) return `Searching for "${query}"...`;
    return "Searching...";
  }
  if (toolName === "think") return "Thinking...";
  return `Running ${toolName}...`;
}
