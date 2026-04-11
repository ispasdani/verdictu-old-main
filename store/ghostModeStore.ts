import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_GHOST_MODEL } from "@/lib/ghost/models";
import { DEFAULT_GHOST_API_MODEL } from "@/lib/ghost/openrouter";

export type GhostModelStatus = "idle" | "loading" | "ready" | "error";

type GhostModeState = {
  // ── Ghost (local WebLLM) ──────────────────────────────────────────────────
  enabled: boolean;
  selectedModelId: string;

  // ── Ghost Open (OpenRouter cloud) ─────────────────────────────────────────
  // Completely independent mode — mutually exclusive with enabled.
  ghostOpenEnabled: boolean;
  selectedApiModelId: string;

  // ── Runtime state (not persisted) ─────────────────────────────────────────
  modelStatus: GhostModelStatus;
  loadProgress: string;
  loadPercent: number; // 0–100

  // ── Actions ───────────────────────────────────────────────────────────────
  setEnabled: (v: boolean) => void;
  setSelectedModelId: (id: string) => void;
  setModelStatus: (s: GhostModelStatus) => void;
  setLoadProgress: (text: string, percent?: number) => void;

  setGhostOpenEnabled: (v: boolean) => void;
  setSelectedApiModelId: (id: string) => void;
};

export const useGhostModeStore = create<GhostModeState>()(
  persist(
    (set) => ({
      // Ghost local
      enabled: false,
      selectedModelId: DEFAULT_GHOST_MODEL.id,

      // Ghost Open
      ghostOpenEnabled: false,
      selectedApiModelId: DEFAULT_GHOST_API_MODEL.id,

      // Runtime
      modelStatus: "idle",
      loadProgress: "",
      loadPercent: 0,

      // Enabling Ghost turns off Ghost Open
      setEnabled: (enabled) =>
        set({ enabled, ...(enabled ? { ghostOpenEnabled: false } : {}) }),

      setSelectedModelId: (selectedModelId) =>
        set({ selectedModelId, modelStatus: "idle", loadProgress: "", loadPercent: 0 }),

      setModelStatus: (modelStatus) => set({ modelStatus }),
      setLoadProgress: (loadProgress, loadPercent = 0) =>
        set({ loadProgress, loadPercent }),

      // Enabling Ghost Open turns off Ghost
      setGhostOpenEnabled: (ghostOpenEnabled) =>
        set({ ghostOpenEnabled, ...(ghostOpenEnabled ? { enabled: false } : {}) }),

      setSelectedApiModelId: (selectedApiModelId) => set({ selectedApiModelId }),
    }),
    {
      name: "verdictu-ghost-mode",
      partialize: (s) => ({
        enabled: s.enabled,
        selectedModelId: s.selectedModelId,
        ghostOpenEnabled: s.ghostOpenEnabled,
        selectedApiModelId: s.selectedApiModelId,
      }),
    },
  ),
);
