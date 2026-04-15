// lib/chat/exportChat.ts
// Converts the current conversation into a .verdictu file and triggers a download.

import type { VerdictuFile, VerdictuTurn } from "@/types/verdictu";

/** Subset of CompletedTurn that the export utility needs. */
export interface ExportableTurn {
  userText: string;
  userAttachments: Array<{ name: string; extractedText: string }>;
  userJurisdiction: string;
  userMode: string;
  assistantText: string;
  sources: Array<{ title: string; url: string; domain?: string }>;
  laws: Array<{
    name: string;
    citation: string;
    relevance: "primary" | "secondary" | "supplementary";
    confidence: number;
    applies_because: string;
  }>;
  elapsedMs: number;
  isGhost?: boolean;
  isGhostOpen?: boolean;
  ghostModelName?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function generateTitle(turns: ExportableTurn[]): string {
  const firstQuestion = turns[0]?.userText ?? "conversation";
  return firstQuestion.slice(0, 60).trim() + (firstQuestion.length > 60 ? "…" : "");
}

export function exportChatToFile(
  turns: ExportableTurn[],
  options: {
    jurisdiction: string;
    mode: string;
    citationEnabled: boolean;
  },
): void {
  if (turns.length === 0) return;

  const title = generateTitle(turns);

  const file: VerdictuFile = {
    __verdictu_version: "1.0",
    exportedAt: Date.now(),
    title,
    jurisdiction: options.jurisdiction,
    mode: options.mode,
    citationEnabled: options.citationEnabled,
    turns: turns.map((t): VerdictuTurn => ({
      userText: t.userText,
      userAttachments: t.userAttachments,
      userJurisdiction: t.userJurisdiction,
      userMode: t.userMode,
      assistantText: t.assistantText,
      sources: t.sources,
      laws: t.laws,
      timestamp: Date.now(),
      elapsedMs: t.elapsedMs,
      isGhost: t.isGhost,
      isGhostOpen: t.isGhostOpen,
      ghostModelName: t.ghostModelName,
    })),
  };

  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}-${Date.now()}.verdictu`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
