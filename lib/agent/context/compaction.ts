import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface WorkingState {
  parties: Array<{
    name: string;
    role: string;
    jurisdiction: string;
    key_facts: string[];
  }>;
  research: Record<string, string>;
  draft: {
    current_version: string;
    disputed_clauses: string[];
  } | null;
  decisions: string[];
  precedents_used: string[];
}

// ~80k tokens (4 chars/token)
const COMPACTION_THRESHOLD_CHARS = 320_000;
const KEEP_LAST_N_TURNS = 3;

function estimateChars(messages: MessageParam[]): number {
  return messages.reduce((acc, m) => {
    if (typeof m.content === "string") return acc + m.content.length;
    if (Array.isArray(m.content)) {
      return (
        acc +
        m.content.reduce((a, b) => {
          return a + ("text" in b && typeof b.text === "string" ? b.text.length : 0);
        }, 0)
      );
    }
    return acc;
  }, 0);
}

export function needsCompaction(messages: MessageParam[]): boolean {
  return estimateChars(messages) > COMPACTION_THRESHOLD_CHARS;
}

const COMPACTION_SYSTEM = `You are summarizing a legal AI conversation into a structured working state JSON object.
Extract all key information from the conversation history into this exact TypeScript shape:
{
  parties: Array<{ name: string; role: string; jurisdiction: string; key_facts: string[] }>;
  research: Record<string, string>; // topic -> key finding
  draft: { current_version: string; disputed_clauses: string[] } | null;
  decisions: string[];
  precedents_used: string[];
}
Return ONLY valid JSON. No explanation, no markdown fences.`;

export async function compactHistory(
  messages: MessageParam[],
  apiKey: string,
  model: string,
): Promise<{ messages: MessageParam[]; workingState: WorkingState }> {
  const keepFrom = Math.max(0, messages.length - KEEP_LAST_N_TURNS * 2);
  const toSummarize = messages.slice(0, keepFrom);
  const toKeep = messages.slice(keepFrom);

  const emptyState: WorkingState = {
    parties: [],
    research: {},
    draft: null,
    decisions: [],
    precedents_used: [],
  };

  if (toSummarize.length === 0) {
    return { messages, workingState: emptyState };
  }

  const historyText = toSummarize
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((b) => ("text" in b && typeof b.text === "string" ? b.text : ""))
                .join("\n")
            : "";
      return `[${m.role.toUpperCase()}]: ${text}`;
    })
    .join("\n\n")
    // Cap at 60k chars to stay within model limits
    .slice(0, 60_000);

  let workingState = emptyState;
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model,
      max_tokens: 2048,
      system: COMPACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Summarize this conversation history into the working state JSON:\n\n${historyText}`,
        },
      ],
    });
    const raw = resp.content.find((b) => b.type === "text")?.text ?? "";
    workingState = JSON.parse(raw);
  } catch {
    // Non-fatal: if summarization fails, drop old turns but keep empty state
  }

  const summaryMessage: MessageParam = {
    role: "user",
    content: `[CONVERSATION SUMMARY — earlier turns compacted]\n${JSON.stringify(workingState, null, 2)}\n\nThe above captures all resolved research and decisions. Continue the conversation from here.`,
  };

  return {
    messages: [summaryMessage, ...toKeep],
    workingState,
  };
}
