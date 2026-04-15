// store/importedChatStore.ts
// Transient (non-persisted) store that holds a parsed .verdictu file
// between the import action (sidebar) and the chat page that hydrates from it.

import { create } from "zustand";
import type { VerdictuFile } from "@/types/verdictu";

interface ImportedChatState {
  pendingImport: VerdictuFile | null;
  /** Set the file to be consumed by the next chat page mount. */
  setPendingImport: (file: VerdictuFile) => void;
  /** Called by the chat page once it has consumed the import. */
  clearPendingImport: () => void;
}

export const useImportedChatStore = create<ImportedChatState>()((set) => ({
  pendingImport: null,
  setPendingImport: (file) => set({ pendingImport: file }),
  clearPendingImport: () => set({ pendingImport: null }),
}));
