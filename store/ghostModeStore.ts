import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_GHOST_MODEL, type GhostModel } from "@/lib/ghost/models";

export type GhostModelStatus = "idle" | "loading" | "ready" | "error";

type GhostModeState = {
  // Settings (persisted)
  enabled: boolean;
  selectedModelId: string;

  // Runtime (not persisted)
  modelStatus: GhostModelStatus;
  loadProgress: string;
  loadPercent: number; // 0–100

  // Actions
  setEnabled: (v: boolean) => void;
  setSelectedModelId: (id: string) => void;
  setModelStatus: (s: GhostModelStatus) => void;
  setLoadProgress: (text: string, percent?: number) => void;
};

export const useGhostModeStore = create<GhostModeState>()(
  persist(
    (set) => ({
      enabled: false,
      selectedModelId: DEFAULT_GHOST_MODEL.id,

      // Runtime defaults
      modelStatus: "idle",
      loadProgress: "",
      loadPercent: 0,

      setEnabled: (enabled) => set({ enabled }),
      setSelectedModelId: (selectedModelId) =>
        set({ selectedModelId, modelStatus: "idle", loadProgress: "", loadPercent: 0 }),
      setModelStatus: (modelStatus) => set({ modelStatus }),
      setLoadProgress: (loadProgress, loadPercent = 0) =>
        set({ loadProgress, loadPercent }),
    }),
    {
      name: "verdictu-ghost-mode",
      partialize: (s) => ({ enabled: s.enabled, selectedModelId: s.selectedModelId }),
    },
  ),
);
