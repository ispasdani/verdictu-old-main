"use client";

// hooks/useChatHistory.ts
// Returns the list of saved conversations from IndexedDB, refreshed on mount
// and whenever the pathname changes (new chat saved).

import { useEffect, useState } from "react";
import { listConversations, type ConversationMeta } from "@/lib/memory/client-store";

export function useChatHistory() {
  const [chats, setChats] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    listConversations()
      .then(setChats)
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { chats, loading, refresh };
}
