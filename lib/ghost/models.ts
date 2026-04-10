export type GhostModel = {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  size: string;
  vram: string;
  description: string;
  tags: string[];
  /** Requires WebGPU shader-f16 extension — may fail on some GPUs/drivers */
  requiresShaderF16?: boolean;
};

export const GHOST_MODELS: GhostModel[] = [
  // ── Tiny / Ultra-light (loads on any device) ──────────────────────────────

  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    name: "Qwen 3 0.6B",
    shortName: "Qwen3 0.6B",
    provider: "Alibaba",
    size: "~400MB",
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
    vram: "~4GB",
    description: "Strongest browser-compatible reasoning model. Thinking mode for deep legal analysis.",
    tags: ["powerful", "reasoning", "defense"],
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    shortName: "Gemma 2 2B",
    provider: "Google",
    size: "~1.3GB",
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
    vram: "~1.9GB",
    description: "Chain-of-thought reasoning distilled from R1. Surprisingly efficient on VRAM.",
    tags: ["reasoning", "powerful"],
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 7B",
    shortName: "Qwen2.5 7B",
    provider: "Alibaba",
    size: "~4.5GB",
    vram: "~2.9GB",
    description: "Highly capable 7B with excellent instruction following.",
    tags: ["powerful"],
  },
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    name: "Qwen 3 8B",
    shortName: "Qwen3 8B",
    provider: "Alibaba",
    size: "~5GB",
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
    vram: "~4.6GB",
    description: "Meta's flagship 8B instruction model. Versatile and well-rounded.",
    tags: ["powerful"],
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC",
    name: "DeepSeek R1 Llama 8B",
    shortName: "R1 Llama 8B",
    provider: "DeepSeek",
    size: "~5.5GB",
    vram: "~5.9GB",
    description: "R1 reasoning distilled into Llama 8B. Best defense reasoning for users with a dedicated GPU.",
    tags: ["reasoning", "powerful", "defense"],
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B v0.3",
    shortName: "Mistral 7B",
    provider: "Mistral AI",
    size: "~4.6GB",
    vram: "~4.6GB",
    description: "Popular open-weight 7B. Great general-purpose performance.",
    tags: ["powerful"],
  },

  // ── Micro (requires shader-f16) ───────────────────────────────────────────

  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    shortName: "SmolLM2 360M",
    provider: "HuggingFace",
    size: "~200MB",
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
    vram: "~2GB",
    description: "Solid step up from 360M with better reasoning.",
    tags: ["fast"],
    requiresShaderF16: true,
  },
];

/** Default: Qwen3 1.7B — thinking mode, ~1GB download, loads reliably in-browser */
export const DEFAULT_GHOST_MODEL = GHOST_MODELS.find(
  (m) => m.id === "Qwen3-1.7B-q4f16_1-MLC",
)!;

export function findGhostModel(id: string): GhostModel | undefined {
  return GHOST_MODELS.find((m) => m.id === id);
}
