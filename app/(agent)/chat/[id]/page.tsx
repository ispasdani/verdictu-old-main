"use client";

import { useEffect } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";

export default function Chat() {
  const text = useChatComposerStore((s) => s.text);
  const mode = useChatComposerStore((s) => s.mode);
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const citationEnabled = useChatComposerStore((s) => s.citationEnabled);
  const attachments = useChatComposerStore((s) => s.attachments);

  useEffect(() => {
    console.log("Chat payload:", {
      text,
      mode,
      jurisdiction,
      citationEnabled,
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        extractedText: a.extractedText,
        lastAction: a.lastAction,
      })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div>Chat</div>;
}
