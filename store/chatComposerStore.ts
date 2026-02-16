import { create } from "zustand";

export type UploadStatus = "idle" | "uploading" | "done" | "error";
export type AttachmentAction =
  | "use_as_source"
  | "summarize"
  | "extract_citations";

export type AttachmentItem = {
  id: string;
  file: File;
  name: string;
  status: UploadStatus;
  progress: number; // 0..100
  error?: string;
  lastAction?: AttachmentAction;
};

type ComposerState = {
  text: string;
  attachments: AttachmentItem[];
  globalError: string | null;
  isDragOver: boolean;

  // actions
  setText: (text: string) => void;
  setIsDragOver: (v: boolean) => void;
  setGlobalError: (v: string | null) => void;

  addAttachments: (items: AttachmentItem[]) => void;
  updateAttachment: (id: string, patch: Partial<AttachmentItem>) => void;
  removeAttachment: (id: string) => void;
  renameAttachment: (id: string, name: string) => void;

  // helpers (optional)
  clearAll: () => void;
};

export const useChatComposerStore = create<ComposerState>((set) => ({
  text: "",
  attachments: [],
  globalError: null,
  isDragOver: false,

  setText: (text) => set({ text }),
  setIsDragOver: (isDragOver) => set({ isDragOver }),
  setGlobalError: (globalError) => set({ globalError }),

  addAttachments: (items) =>
    set((s) => ({
      attachments: [...s.attachments, ...items],
    })),

  updateAttachment: (id, patch) =>
    set((s) => ({
      attachments: s.attachments.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    })),

  removeAttachment: (id) =>
    set((s) => ({
      attachments: s.attachments.filter((a) => a.id !== id),
    })),

  renameAttachment: (id, name) =>
    set((s) => ({
      attachments: s.attachments.map((a) => (a.id === id ? { ...a, name } : a)),
    })),

  clearAll: () =>
    set({ text: "", attachments: [], globalError: null, isDragOver: false }),
}));
