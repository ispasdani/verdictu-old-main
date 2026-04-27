import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatMode = "general" | "legal";

type ChatModeState = {
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
};

export const useChatModeStore = create<ChatModeState>()(
  persist(
    (set) => ({
      chatMode: "general",
      setChatMode: (chatMode) => set({ chatMode }),
    }),
    { name: "verdictu-chat-mode" },
  ),
);
