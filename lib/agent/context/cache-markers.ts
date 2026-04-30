import type Anthropic from "@anthropic-ai/sdk";

type TextBlockParam = Anthropic.TextBlockParam;
type MessageParam = Anthropic.MessageParam;

// Wrap the system prompt as a cached array block.
// Turns 2-N will hit the cache (~10% of full cost for the system portion).
export function toCachedSystem(text: string): TextBlockParam[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

// Add a cache breakpoint to the last stable user message in history.
// "Stable" means everything except the current turn (which always changes).
// Anthropic caches up to the marked position on subsequent turns.
export function withCacheBreakpoints(messages: MessageParam[]): MessageParam[] {
  if (messages.length < 2) return messages;

  const result = [...messages];

  // Walk backwards from second-to-last to find the last user message to mark
  for (let i = messages.length - 2; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;

    if (typeof msg.content === "string") {
      result[i] = {
        ...msg,
        content: [
          {
            type: "text",
            text: msg.content,
            cache_control: { type: "ephemeral" },
          } as TextBlockParam,
        ],
      };
    } else if (Array.isArray(msg.content) && msg.content.length > 0) {
      const content = [...msg.content];
      const last = content[content.length - 1];
      content[content.length - 1] = {
        ...last,
        cache_control: { type: "ephemeral" },
      } as TextBlockParam;
      result[i] = { ...msg, content };
    }

    break;
  }

  return result;
}
