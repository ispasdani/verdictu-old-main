export type AgentProvider = "ghost_local" | "ghost_open";
export type AgentStorageMode = "local_only" | "convex";

export type AgentConfig = {
  provider: AgentProvider;
  claudeApiKey?: string;
  claudeModel: string;
  storageMode: AgentStorageMode;
  useConvexRag: boolean;
  tavilyKey?: string;
};

export const CLAUDE_MODELS = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
] as const;

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  provider: "ghost_open",
  claudeModel: DEFAULT_CLAUDE_MODEL,
  storageMode: "local_only",
  useConvexRag: false,
};
