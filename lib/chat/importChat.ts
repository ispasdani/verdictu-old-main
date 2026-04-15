// lib/chat/importChat.ts
// Parse and validate a .verdictu file uploaded by the user.

import type { VerdictuFile, VerdictuTurn } from "@/types/verdictu";

const VALID_RELEVANCE = new Set(["primary", "secondary", "supplementary"]);

function assertString(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  return v;
}

function assertNumber(v: unknown, field: string): number {
  if (typeof v !== "number") throw new Error(`${field} must be a number`);
  return v;
}

function assertArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${field} must be an array`);
  return v;
}

function validateTurn(raw: unknown, idx: number): VerdictuTurn {
  if (typeof raw !== "object" || raw === null)
    throw new Error(`turns[${idx}] must be an object`);
  const t = raw as Record<string, unknown>;

  const userText = assertString(t.userText, `turns[${idx}].userText`);
  const userJurisdiction = assertString(t.userJurisdiction, `turns[${idx}].userJurisdiction`);
  const userMode = assertString(t.userMode, `turns[${idx}].userMode`);
  const assistantText = assertString(t.assistantText, `turns[${idx}].assistantText`);
  const timestamp = assertNumber(t.timestamp, `turns[${idx}].timestamp`);
  const elapsedMs = assertNumber(t.elapsedMs, `turns[${idx}].elapsedMs`);

  const rawAtts = assertArray(t.userAttachments ?? [], `turns[${idx}].userAttachments`);
  const userAttachments = rawAtts.map((a, ai) => {
    if (typeof a !== "object" || a === null)
      throw new Error(`turns[${idx}].userAttachments[${ai}] must be an object`);
    const att = a as Record<string, unknown>;
    return {
      name: assertString(att.name, `turns[${idx}].userAttachments[${ai}].name`),
      extractedText: assertString(att.extractedText, `turns[${idx}].userAttachments[${ai}].extractedText`),
    };
  });

  const rawSources = assertArray(t.sources ?? [], `turns[${idx}].sources`);
  const sources = rawSources.map((s, si) => {
    if (typeof s !== "object" || s === null)
      throw new Error(`turns[${idx}].sources[${si}] must be an object`);
    const src = s as Record<string, unknown>;
    return {
      title: assertString(src.title, `turns[${idx}].sources[${si}].title`),
      url: assertString(src.url, `turns[${idx}].sources[${si}].url`),
      domain: typeof src.domain === "string" ? src.domain : undefined,
    };
  });

  const rawLaws = assertArray(t.laws ?? [], `turns[${idx}].laws`);
  const laws = rawLaws.map((l, li) => {
    if (typeof l !== "object" || l === null)
      throw new Error(`turns[${idx}].laws[${li}] must be an object`);
    const law = l as Record<string, unknown>;
    const relevance = assertString(law.relevance, `turns[${idx}].laws[${li}].relevance`);
    if (!VALID_RELEVANCE.has(relevance))
      throw new Error(`turns[${idx}].laws[${li}].relevance is invalid`);
    return {
      name: assertString(law.name, `turns[${idx}].laws[${li}].name`),
      citation: assertString(law.citation, `turns[${idx}].laws[${li}].citation`),
      relevance: relevance as "primary" | "secondary" | "supplementary",
      confidence: assertNumber(law.confidence, `turns[${idx}].laws[${li}].confidence`),
      applies_because: assertString(law.applies_because, `turns[${idx}].laws[${li}].applies_because`),
    };
  });

  return {
    userText,
    userAttachments,
    userJurisdiction,
    userMode,
    assistantText,
    sources,
    laws,
    timestamp,
    elapsedMs,
    isGhost: typeof t.isGhost === "boolean" ? t.isGhost : false,
    isGhostOpen: typeof t.isGhostOpen === "boolean" ? t.isGhostOpen : false,
    ghostModelName: typeof t.ghostModelName === "string" ? t.ghostModelName : undefined,
  };
}

/** Parses and validates a .verdictu file. Throws a descriptive error on invalid input. */
export function parseVerdictuFile(raw: unknown): VerdictuFile {
  if (typeof raw !== "object" || raw === null)
    throw new Error("File must contain a JSON object");

  const d = raw as Record<string, unknown>;

  if (d.__verdictu_version !== "1.0")
    throw new Error(`Unknown format version "${d.__verdictu_version}". Only "1.0" is supported.`);

  const turns = assertArray(d.turns, "turns").map(validateTurn);

  return {
    __verdictu_version: "1.0",
    exportedAt: assertNumber(d.exportedAt, "exportedAt"),
    title: assertString(d.title, "title"),
    jurisdiction: assertString(d.jurisdiction, "jurisdiction"),
    mode: assertString(d.mode, "mode"),
    citationEnabled: typeof d.citationEnabled === "boolean" ? d.citationEnabled : true,
    turns,
  };
}

/** Reads a File and returns the parsed VerdictuFile. Rejects on parse/validation errors. */
export function readVerdictuFile(file: File): Promise<VerdictuFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(parseVerdictuFile(json));
      } catch (err) {
        reject(new Error(err instanceof Error ? err.message : "Invalid .verdictu file"));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}
