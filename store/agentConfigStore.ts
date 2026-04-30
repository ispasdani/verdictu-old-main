import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AgentConfig,
  type AgentProvider,
  type AgentStorageMode,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/agent/config";

type AgentConfigState = AgentConfig & {
  setProvider: (provider: AgentProvider) => void;
  setClaudeApiKey: (key: string) => void;
  setClaudeModel: (model: string) => void;
  setStorageMode: (mode: AgentStorageMode) => void;
  setUseConvexRag: (v: boolean) => void;
  setTavilyKey: (key: string) => void;
  getConfig: () => AgentConfig;
};

export const useAgentConfigStore = create<AgentConfigState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AGENT_CONFIG,

      setProvider: (provider) =>
        set({ provider }),

      setClaudeApiKey: (claudeApiKey) =>
        set({ claudeApiKey }),

      setClaudeModel: (claudeModel) =>
        set({ claudeModel }),

      setStorageMode: (storageMode) =>
        set({
          storageMode,
          // Convex RAG only makes sense with Convex storage
          useConvexRag: storageMode === "convex" ? get().useConvexRag : false,
        }),

      setUseConvexRag: (useConvexRag) =>
        set({ useConvexRag }),

      setTavilyKey: (tavilyKey) =>
        set({ tavilyKey }),

      getConfig: (): AgentConfig => {
        const s = get();
        return {
          provider: s.provider,
          claudeApiKey: s.claudeApiKey,
          claudeModel: s.claudeModel || DEFAULT_CLAUDE_MODEL,
          storageMode: s.storageMode,
          useConvexRag: s.useConvexRag,
          tavilyKey: s.tavilyKey,
        };
      },
    }),
    {
      name: "verdictu-agent-config",
      partialize: (s) => ({
        provider: s.provider,
        claudeApiKey: s.claudeApiKey,
        claudeModel: s.claudeModel,
        storageMode: s.storageMode,
        useConvexRag: s.useConvexRag,
        tavilyKey: s.tavilyKey,
      }),
    },
  ),
);
