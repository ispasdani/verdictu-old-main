// lib/ghost/openrouter.ts
// OpenRouter API integration for Ghost API Mode.
// Uses the OpenAI-compatible API format — drop-in for any OpenAI SDK call.
//
// Model catalogue is split into:
//   - "reasoning"   : chain-of-thought, best for finding legal gaps
//   - "fast"        : lower latency, still highly capable
//   - "unrestricted": no system-prompt guardrails, no content policy filtering
//     (ideal for Ghost Mode's always-on defense stance — no refused questions)

export type GhostApiModelCategory = "reasoning" | "fast" | "unrestricted";

export type GhostApiModel = {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  category: GhostApiModelCategory;
  contextWindow: string;
  description: string;
  tags: string[];
  creditsPerQuery: number;
};

export const GHOST_API_MODELS: GhostApiModel[] = [
  // ── Reasoning ─────────────────────────────────────────────────────────────

  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    shortName: "DeepSeek R1",
    provider: "DeepSeek",
    category: "reasoning",
    contextWindow: "128k",
    description:
      "Best-in-class chain-of-thought reasoning. Finds legal gaps, exceptions, and angles systematically. Default Ghost API model.",
    tags: ["recommended", "reasoning", "defense"],
    creditsPerQuery: 1,
  },
  {
    id: "deepseek/deepseek-r1-0528",
    name: "DeepSeek R1 (May 2025)",
    shortName: "R1 0528",
    provider: "DeepSeek",
    category: "reasoning",
    contextWindow: "128k",
    description:
      "Latest DeepSeek R1 checkpoint with improved instruction following and reasoning stability.",
    tags: ["reasoning", "defense"],
    creditsPerQuery: 1,
  },
  {
    id: "qwen/qwq-32b",
    name: "QwQ 32B",
    shortName: "QwQ 32B",
    provider: "Alibaba",
    category: "reasoning",
    contextWindow: "32k",
    description:
      "Alibaba's dedicated reasoning model. Deep thinking mode with visible chain-of-thought — very thorough for legal analysis.",
    tags: ["reasoning"],
    creditsPerQuery: 1,
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    shortName: "Nemotron 70B",
    provider: "NVIDIA",
    category: "reasoning",
    contextWindow: "128k",
    description:
      "NVIDIA fine-tune of Llama 3.1 70B, trained specifically for instruction-following and reasoning accuracy.",
    tags: ["reasoning", "powerful"],
    creditsPerQuery: 1,
  },

  // ── Fast ──────────────────────────────────────────────────────────────────

  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    shortName: "Llama3.3 70B",
    provider: "Meta",
    category: "fast",
    contextWindow: "128k",
    description:
      "Meta's latest open flagship. Fast, capable, great general legal analysis.",
    tags: ["fast", "powerful"],
    creditsPerQuery: 1,
  },
  {
    id: "mistralai/mistral-large-2411",
    name: "Mistral Large (Nov 2024)",
    shortName: "Mistral Large",
    provider: "Mistral AI",
    category: "fast",
    contextWindow: "128k",
    description:
      "European model — GDPR-aligned, strong legal reasoning, fast responses. Great for EU-jurisdiction queries.",
    tags: ["fast", "eu"],
    creditsPerQuery: 1,
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    shortName: "Qwen2.5 72B",
    provider: "Alibaba",
    category: "fast",
    contextWindow: "128k",
    description:
      "Top-tier open-source 72B model. Excellent at following complex legal instructions.",
    tags: ["fast", "powerful"],
    creditsPerQuery: 1,
  },
  {
    id: "google/gemini-flash-1.5",
    name: "Gemini 1.5 Flash",
    shortName: "Gemini Flash",
    provider: "Google",
    category: "fast",
    contextWindow: "1M",
    description:
      "Extremely fast with a massive 1M token context window — ideal for analyzing long contracts or legislative texts.",
    tags: ["fast", "long-context"],
    creditsPerQuery: 1,
  },

  // ── Unrestricted ──────────────────────────────────────────────────────────
  // These models have no system-prompt guardrails or content policy filtering.
  // Perfect match for Ghost Mode's philosophy: always-on defense, no refused questions.

  {
    id: "nousresearch/hermes-3-llama-3.1-70b",
    name: "Nous Hermes 3 70B",
    shortName: "Hermes 3 70B",
    provider: "Nous Research",
    category: "unrestricted",
    contextWindow: "128k",
    description:
      "No content filters. Fine-tuned for complex reasoning without guardrails. Follows user intent faithfully — ideal for sensitive legal defense scenarios.",
    tags: ["unrestricted", "powerful"],
    creditsPerQuery: 1,
  },
  {
    id: "cognitivecomputations/dolphin3.0-r1-mistral-22b",
    name: "Dolphin 3.0 R1 22B",
    shortName: "Dolphin R1 22B",
    provider: "Cognitive Computations",
    category: "unrestricted",
    contextWindow: "32k",
    description:
      "Explicitly uncensored — no system prompt, no refusals. R1 reasoning distilled into Mistral 22B. No question is off limits.",
    tags: ["unrestricted", "reasoning"],
    creditsPerQuery: 1,
  },
  {
    id: "cognitivecomputations/dolphin-mixtral-8x7b",
    name: "Dolphin Mixtral 8x7B",
    shortName: "Dolphin MoE",
    provider: "Cognitive Computations",
    category: "unrestricted",
    contextWindow: "32k",
    description:
      "Classic uncensored Dolphin on Mixtral MoE backbone. Battle-tested, no content policy, strong reasoning.",
    tags: ["unrestricted"],
    creditsPerQuery: 1,
  },
  {
    id: "sao10k/l3.3-euryale-70b",
    name: "Euryale 70B v3",
    shortName: "Euryale 70B",
    provider: "Sao10k",
    category: "unrestricted",
    contextWindow: "128k",
    description:
      "Uncensored Llama 3.3 fine-tune. No guardrails, very high instruction adherence. Handles sensitive legal scenarios without deflection.",
    tags: ["unrestricted", "powerful"],
    creditsPerQuery: 1,
  },
  {
    id: "nousresearch/nous-capybara-7b",
    name: "Nous Capybara 7B",
    shortName: "Capybara 7B",
    provider: "Nous Research",
    category: "unrestricted",
    contextWindow: "32k",
    description:
      "Lightweight uncensored model. Fast responses with no content filtering — good for quick checks.",
    tags: ["unrestricted", "fast"],
    creditsPerQuery: 1,
  },
];

/** Default: DeepSeek R1 — best legal reasoning */
export const DEFAULT_GHOST_API_MODEL = GHOST_API_MODELS.find(
  (m) => m.id === "deepseek/deepseek-r1",
)!;

export function findGhostApiModel(id: string): GhostApiModel | undefined {
  return GHOST_API_MODELS.find((m) => m.id === id);
}

export const GHOST_API_MODEL_CATEGORIES: {
  id: GhostApiModelCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "reasoning",
    label: "Reasoning",
    description: "Chain-of-thought — finds legal gaps step-by-step",
  },
  {
    id: "fast",
    label: "Fast",
    description: "Lower latency, still highly capable",
  },
  {
    id: "unrestricted",
    label: "Unrestricted",
    description: "No content filters — no question refused",
  },
];

// ─── OpenRouter streaming ─────────────────────────────────────────────────────

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Streams a completion from OpenRouter.
 * Emits tokens via `onToken` as they arrive.
 * Calls `onDone` with token usage from the final [DONE] chunk.
 *
 * NOTE: This is the raw streaming primitive. The Ghost API route wraps this
 * with credit checks and usage logging once the backend is wired up.
 */
export async function streamOpenRouter({
  messages,
  model = DEFAULT_GHOST_API_MODEL.id,
  onToken,
  onDone,
  signal,
}: {
  messages: OpenRouterMessage[];
  model?: string;
  onToken: (token: string) => void;
  onDone: (usage: OpenRouterUsage) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://verdictu.com",
      "X-Title": "Verdictu Ghost API",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4000,
      temperature: 0.4,
      include_usage: true,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  if (!res.body) throw new Error("OpenRouter returned empty body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;

      try {
        const chunk = JSON.parse(raw);

        // Token deltas
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          onToken(delta);
        }

        // Usage — OpenRouter sends this in the last data chunk before [DONE]
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      } catch {
        // Malformed chunk — skip
      }
    }
  }

  onDone({ inputTokens, outputTokens });
}
