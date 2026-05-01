// lib/memory/export-import.ts
// Bridges the IndexedDB layer with the .verdictu file format.
// Serializes StoredTurn ↔ VerdictuTurn and builds complete export payloads.

import type { StoredTurn, WorkingStateSnapshot } from "./client-store";
import type { VerdictuFile, VerdictuTurn } from "@/types/verdictu";

export function storedTurnToVerdictu(t: StoredTurn): VerdictuTurn {
  return {
    userText: t.userText,
    userAttachments: t.userAttachments,
    userJurisdiction: t.userJurisdiction,
    userMode: t.userMode,
    assistantText: t.assistantText,
    sources: t.sources,
    laws: t.laws,
    searchQueries: t.searchQueries,
    timestamp: t.timestamp,
    elapsedMs: t.elapsedMs,
    isGhost: t.isGhost,
    isGhostOpen: t.isGhostOpen,
    ghostModelName: t.ghostModelName,
  };
}

export function verdictuTurnToStored(t: VerdictuTurn): StoredTurn {
  return {
    userText: t.userText,
    userAttachments: t.userAttachments,
    userJurisdiction: t.userJurisdiction,
    userMode: t.userMode,
    assistantText: t.assistantText,
    sources: t.sources,
    laws: t.laws,
    searchQueries: t.searchQueries ?? [],
    timestamp: t.timestamp,
    elapsedMs: t.elapsedMs,
    isGhost: t.isGhost ?? false,
    isGhostOpen: t.isGhostOpen ?? false,
    ghostModelName: t.ghostModelName,
  };
}

export function buildVerdictuFile(
  turns: StoredTurn[],
  opts: {
    title: string;
    jurisdiction: string;
    mode: string;
    citationEnabled: boolean;
    workingState?: WorkingStateSnapshot;
  },
): VerdictuFile {
  return {
    __verdictu_version: "1.0",
    exportedAt: Date.now(),
    title: opts.title,
    jurisdiction: opts.jurisdiction,
    mode: opts.mode,
    citationEnabled: opts.citationEnabled,
    workingState: opts.workingState,
    turns: turns.map(storedTurnToVerdictu),
  };
}
