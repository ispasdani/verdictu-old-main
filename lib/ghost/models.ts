export type GhostModel = {
  id: string;
  name: string;
  shortName: string;
  provider: string;
  size: string;
  vram: string;
  description: string;
  tags: string[];
};

export const GHOST_MODELS: GhostModel[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    shortName: "SmolLM2 360M",
    provider: "HuggingFace",
    size: "~200MB",
    vram: "~512MB",
    description: "Fastest possible. Tiny model for simple Q&A.",
    tags: ["fastest", "tiny"],
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B",
    shortName: "Qwen2.5 1.5B",
    provider: "Alibaba",
    size: "~900MB",
    vram: "~1.5GB",
    description: "Great balance of speed and reasoning quality.",
    tags: ["fast", "balanced"],
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
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    shortName: "Gemma 2 2B",
    provider: "Google",
    size: "~1.3GB",
    vram: "~2.5GB",
    description: "Google's compact model — great quality for its size.",
    tags: ["google", "balanced"],
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini",
    shortName: "Phi 3.5 Mini",
    provider: "Microsoft",
    size: "~2.2GB",
    vram: "~4GB",
    description: "Strong reasoning & summarization from Microsoft.",
    tags: ["reasoning", "recommended"],
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen 3 4B",
    shortName: "Qwen3 4B",
    provider: "Alibaba",
    size: "~2.5GB",
    vram: "~4GB",
    description: "Best reasoning available in-browser. Most powerful.",
    tags: ["powerful", "recommended"],
  },
];

export const DEFAULT_GHOST_MODEL = GHOST_MODELS[3]; // Gemma 2 2B

export function findGhostModel(id: string): GhostModel | undefined {
  return GHOST_MODELS.find((m) => m.id === id);
}
