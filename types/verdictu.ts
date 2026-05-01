// types/verdictu.ts
// Shared types for the .verdictu local chat file format.
// This format is used for both export (download) and import (resume).

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface VerdictuSource {
  title: string;
  url: string;
  domain?: string;
}

export interface VerdictuLaw {
  name: string;
  citation: string;
  relevance: "primary" | "secondary" | "supplementary";
  confidence: number;
  applies_because: string;
}

// ─── Working state (compacted conversation summary) ───────────────────────────

export interface VerdictuWorkingState {
  parties: Array<{
    name: string;
    role: string;
    jurisdiction: string;
    key_facts: string[];
  }>;
  research: Record<string, string>;
  draft: { current_version: string; disputed_clauses: string[] } | null;
  decisions: string[];
  precedents_used: string[];
}

// ─── A single conversation turn (user Q + assistant A) ────────────────────────

export interface VerdictuTurn {
  userText: string;
  userAttachments: Array<{ name: string; extractedText: string }>;
  userJurisdiction: string;
  userMode: string;
  assistantText: string;
  sources: VerdictuSource[];
  laws: VerdictuLaw[];
  searchQueries?: string[];
  timestamp: number;
  elapsedMs: number;
  isGhost?: boolean;
  isGhostOpen?: boolean;
  ghostModelName?: string;
}

// ─── The full file ────────────────────────────────────────────────────────────

export interface VerdictuFile {
  /** Sentinel used to identify and version the format. */
  __verdictu_version: "1.0";
  exportedAt: number;
  /** Short title derived from the first user question. */
  title: string;
  /** Jurisdiction code from the last active turn (e.g. "eu", "dk"). */
  jurisdiction: string;
  /** Mode from the last active turn (e.g. "General"). */
  mode: string;
  citationEnabled: boolean;
  /** Compacted working state from the last history compaction, if any. */
  workingState?: VerdictuWorkingState;
  turns: VerdictuTurn[];
}
