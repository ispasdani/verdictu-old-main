export type GhostModel = {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  size: string;
  /** Approximate download size in megabytes — used for storage quota checks */
  downloadSizeMB: number;
  vram: string;
  description: string;
  tags: string[];
  /** Requires WebGPU shader-f16 extension — may fail on some GPUs/drivers */
  requiresShaderF16?: boolean;
  /**
   * Phase 6 — model supports OpenAI-compatible function calling via WebLLM.
   * When true, the Ghost Local pipeline uses the true agentic loop (local-loop.ts)
   * with web_search, read_document, retrieve_precedent, and draft_document_section tools.
   * Smaller models (< 3B) are excluded — reliable tool use requires sufficient capacity.
   */
  supportsToolUse?: boolean;
  /**
   * Model produces <think>...</think> chain-of-thought blocks before its answer.
   * The token budget for these models is adjusted: fewer sources, higher max_tokens
   * so the think block doesn't exhaust the budget before the answer is written.
   */
  isReasoningModel?: boolean;
};

export const GHOST_MODELS: GhostModel[] = [
  // ── Tiny / Ultra-light (loads on any device) ──────────────────────────────

  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    name: "Qwen 3 0.6B",
    shortName: "Qwen3 0.6B",
    provider: "Alibaba",
    size: "~400MB",
    downloadSizeMB: 400,
    vram: "~1GB",
    description: "Smallest Qwen3 with thinking mode. Loads instantly on any device.",
    tags: ["fastest", "tiny"],
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B",
    shortName: "Qwen2.5 1.5B",
    provider: "Alibaba",
    size: "~900MB",
    downloadSizeMB: 900,
    vram: "~1.5GB",
    description: "Proven and reliable. Best fallback for low-end GPUs.",
    tags: ["fast", "balanced"],
  },

  // ── Small (browser-safe, < 2GB download) ─────────────────────────────────

  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    name: "Qwen 3 1.7B",
    shortName: "Qwen3 1.7B",
    provider: "Alibaba",
    size: "~1GB",
    downloadSizeMB: 1024,
    vram: "~2GB",
    description: "Best small model for defense work. Thinking mode enabled — reasons step-by-step before answering.",
    tags: ["fast", "reasoning", "recommended", "defense"],
  },

  // ── Medium (4B — browser-compatible with enough VRAM) ────────────────────

  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 3B",
    shortName: "Qwen2.5 3B",
    provider: "Alibaba",
    size: "~2GB",
    downloadSizeMB: 2048,
    vram: "~3GB",
    description: "Reliable 3B with strong instruction following. Good middle ground.",
    tags: ["balanced", "recommended"],
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen 3 4B",
    shortName: "Qwen3 4B",
    provider: "Alibaba",
    size: "~2.5GB",
    downloadSizeMB: 2560,
    vram: "~4GB",
    description: "Strongest browser-compatible reasoning model. Thinking mode for deep legal analysis.",
    tags: ["powerful", "reasoning", "recommended", "defense"],
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    shortName: "Gemma 2 2B",
    provider: "Google",
    size: "~1.3GB",
    downloadSizeMB: 1331,
    vram: "~2.5GB",
    description: "Google's compact model — great quality for its size.",
    tags: ["balanced"],
    requiresShaderF16: true,
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini",
    shortName: "Phi 3.5 Mini",
    provider: "Microsoft",
    size: "~2.2GB",
    downloadSizeMB: 2253,
    vram: "~4GB",
    description: "Strong reasoning & summarization from Microsoft.",
    tags: ["reasoning"],
    requiresShaderF16: true,
  },

  // ── Large (7B–8B — requires a dedicated GPU) ─────────────────────────────

  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    name: "DeepSeek R1 7B",
    shortName: "DeepSeek R1 7B",
    provider: "DeepSeek",
    size: "~4.5GB",
    downloadSizeMB: 4608,
    vram: "~1.9GB",
    description: "Chain-of-thought reasoning distilled from R1. Surprisingly efficient on VRAM.",
    tags: ["reasoning", "powerful"],
    isReasoningModel: true,
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 7B",
    shortName: "Qwen2.5 7B",
    provider: "Alibaba",
    size: "~4.5GB",
    downloadSizeMB: 4608,
    vram: "~2.9GB",
    description: "Highly capable 7B with excellent instruction following. Recommended for Ghost Local agentic mode.",
    tags: ["powerful", "recommended"],
  },
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    name: "Qwen 3 8B",
    shortName: "Qwen3 8B",
    provider: "Alibaba",
    size: "~5GB",
    downloadSizeMB: 5120,
    vram: "~4.3GB",
    description: "Latest Qwen3 8B with thinking mode. Strongest local model overall.",
    tags: ["powerful"],
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
    name: "Llama 3.1 8B",
    shortName: "Llama3.1 8B",
    provider: "Meta",
    size: "~4.9GB",
    downloadSizeMB: 5018,
    vram: "~4.6GB",
    description: "Meta's flagship 8B instruction model. Versatile and well-rounded.",
    tags: ["powerful"],
  },
  {
    id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    name: "Hermes 3 Llama 3.1 8B",
    shortName: "Hermes3 8B",
    provider: "Nous Research",
    size: "~4.9GB",
    downloadSizeMB: 5018,
    vram: "~4.6GB",
    description: "Exceptional function calling and agentic capabilities. The recommended model for True Agentic Ghost Local mode.",
    tags: ["powerful", "agentic", "recommended"],
    supportsToolUse: true,
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
    name: "DeepSeek R1 Llama 8B",
    shortName: "R1 Llama 8B",
    provider: "DeepSeek",
    size: "~5.5GB",
    downloadSizeMB: 5632,
    vram: "~5.9GB",
    description: "R1 reasoning distilled into Llama 8B. Best defense reasoning for users with a dedicated GPU.",
    tags: ["reasoning", "powerful", "defense"],
    isReasoningModel: true,
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B v0.3",
    shortName: "Mistral 7B",
    provider: "Mistral AI",
    size: "~4.6GB",
    downloadSizeMB: 4710,
    vram: "~4.6GB",
    description: "Popular open-weight 7B. Great general-purpose performance.",
    tags: ["powerful"],
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    name: "Gemma 2 9B",
    shortName: "Gemma 2 9B",
    provider: "Google",
    size: "~5.2GB",
    downloadSizeMB: 5221,
    vram: "~5.5GB",
    description: "Google's 9B model. Excellent performance and reasoning capabilities.",
    tags: ["powerful"],
  },

  // ── Massive (14B+ — requires high-end GPU or Mac with 32GB+ RAM) ─────────────

  {
    id: "gemma-2-27b-it-q4f16_1-MLC",
    name: "Gemma 2 27B",
    shortName: "Gemma 2 27B",
    provider: "Google",
    size: "~15.3GB",
    downloadSizeMB: 15338,
    vram: "~16.5GB",
    description: "Google's flagship 27B model. Unmatched local performance but requires significant resources.",
    tags: ["powerful", "heavy"],
  },

  // ── Micro (requires shader-f16) ───────────────────────────────────────────

  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    shortName: "SmolLM2 360M",
    provider: "HuggingFace",
    size: "~200MB",
    downloadSizeMB: 200,
    vram: "~512MB",
    description: "Fastest possible. Tiny model for simple Q&A.",
    tags: ["fastest", "tiny"],
    requiresShaderF16: true,
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B",
    shortName: "SmolLM2 1.7B",
    provider: "HuggingFace",
    size: "~1GB",
    downloadSizeMB: 1024,
    vram: "~2GB",
    description: "Solid step up from 360M with better reasoning.",
    tags: ["fast"],
    requiresShaderF16: true,
  },
];

/** Default: Qwen3 4B — thinking mode, ~2.5GB download, best reasoning for legal analysis */
export const DEFAULT_GHOST_MODEL = GHOST_MODELS.find(
  (m) => m.id === "Qwen3-4B-q4f16_1-MLC",
)!;

export function findGhostModel(id: string): GhostModel | undefined {
  return GHOST_MODELS.find((m) => m.id === id);
}

/**
 * Returns the best (largest) model smaller than the given one that doesn't
 * require shader-f16. Used to suggest a fallback when storage is insufficient.
 */
export function getSuggestedSmallerModel(id: string): GhostModel | undefined {
  const current = findGhostModel(id);
  if (!current) return undefined;
  return GHOST_MODELS.filter(
    (m) => m.id !== id && !m.requiresShaderF16 && m.downloadSizeMB < current.downloadSizeMB,
  ).sort((a, b) => b.downloadSizeMB - a.downloadSizeMB)[0];
}
