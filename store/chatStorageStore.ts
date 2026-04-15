// store/chatStorageStore.ts
// Persisted user preference for how chats are saved.
// "cloud" = save to Convex (future feature, prepared but not yet active)
// "local" = keep in-memory; user downloads a .verdictu file manually

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StorageMode = "cloud" | "local";

interface ChatStorageState {
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
}

export const useChatStorageStore = create<ChatStorageState>()(
  persist(
    (set) => ({
      storageMode: "local",
      setStorageMode: (storageMode) => set({ storageMode }),
    }),
    {
      name: "verdictu-storage-mode",
    },
  ),
);
