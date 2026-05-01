// lib/ghost/local-tools.ts
// Browser-executable tool handlers for Ghost Local agentic mode.
// All tools run in the browser — no server-side code, no Anthropic SDK.

import { retrieveRelevantChunks } from "@/lib/agent/context/chunker";
import {
  searchPrecedents,
  formatPrecedentForAgent,
} from "@/lib/memory/precedent-search";
import type { PrecedentEntry } from "@/lib/memory/client-store";

// ─── Tool definitions (OpenAI function-calling format) ────────────────────────

export const LOCAL_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "think",
      description:
        "Think through a complex legal question step by step before answering. Use this to reason about applicable laws, exceptions, and the best analysis strategy.",
      parameters: {
        type: "object",
        properties: {
          reasoning: {
            type: "string",
            description: "Your step-by-step legal reasoning",
          },
        },
        required: ["reasoning"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the web for statutes, regulations, case law, and legal commentary. Use precise legal terms and include the jurisdiction. Run multiple searches from different angles to find the rule and its exceptions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query — be specific, include statute names, article numbers, or case law terms",
          },
          jurisdiction: {
            type: "string",
            description:
              "Optional jurisdiction to append to the query (e.g. EU, DE, UK, SE, RO)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_document",
      description:
        "Read an attached document (contract, brief, PDF) to find specific clauses, definitions, or obligations.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The exact filename of the document to read",
          },
          topic: {
            type: "string",
            description:
              "What specific information to look for in the document",
          },
        },
        required: ["name", "topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "retrieve_precedent",
      description:
        "Search the user's saved precedent library for a past contract, legal analysis, or prior work matching the query. Use when the user mentions 'the Company A/B contract', 'our standard NDA', or 'like last time'.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — include party names, contract type, or legal topic (e.g. 'Company A employment agreement')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_document_section",
      description:
        "Draft a specific clause or section for a legal document. Generates precise, enforceable contract language for termination clauses, IP ownership provisions, liability caps, governing law clauses, data processing addenda, etc.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "Type of clause to draft (e.g. 'termination clause', 'IP ownership clause', 'liability cap', 'governing law')",
          },
          context: {
            type: "string",
            description:
              "Relevant context: parties, jurisdiction, key obligations, constraints, and requirements the clause must satisfy",
          },
        },
        required: ["type", "context"],
      },
    },
  },
];

export type LocalToolName =
  | "think"
  | "web_search"
  | "read_document"
  | "retrieve_precedent"
  | "draft_document_section";

export type LocalSource = {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
};

export type LocalToolResult = {
  content: string;
  sources?: LocalSource[];
};

export type LocalToolContext = {
  attachments: Array<{ name: string; extractedText: string }>;
  jurisdiction: string;
  baseUrl: string;
  precedents?: PrecedentEntry[];
  // Injected by the loop — makes a non-streaming call to the local engine for drafting
  draftViaEngine: (systemPrompt: string, userPrompt: string) => Promise<string>;
};

// ─── Tool execution ─────────────────────────────────────────────────────────

export async function executeLocalTool(
  name: LocalToolName,
  input: Record<string, unknown>,
  ctx: LocalToolContext,
): Promise<LocalToolResult> {
  if (name === "think") {
    return { content: "Reasoning complete." };
  }

  if (name === "web_search") {
    const query = String(input.query ?? "");
    const jur = String(input.jurisdiction ?? "");
    const finalQuery =
      jur && !query.toLowerCase().includes(jur.toLowerCase())
        ? `${query} ${jur}`
        : query;

    try {
      const res = await fetch(`${ctx.baseUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, maxResults: 8 }),
      });

      if (!res.ok) {
        return { content: "Search failed. Try a different query." };
      }

      const data = (await res.json()) as { results?: LocalSource[] };
      const results = data.results ?? [];

      if (results.length === 0) {
        return { content: "No results found. Try a different query." };
      }

      const content = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.snippet ?? "").slice(0, 500)}`,
        )
        .join("\n\n");

      return { content, sources: results };
    } catch {
      return { content: "Search failed. Try a more specific query." };
    }
  }

  if (name === "read_document") {
    const docName = String(input.name ?? "");
    const topic = String(input.topic ?? "");
    const doc = ctx.attachments.find(
      (a) => a.name.toLowerCase() === docName.toLowerCase(),
    );
    if (!doc) {
      const available =
        ctx.attachments.map((a) => a.name).join(", ") || "none";
      return {
        content: `Document "${docName}" not found. Available: ${available}`,
      };
    }
    const excerpt = retrieveRelevantChunks(doc.extractedText, topic);
    return { content: `[${doc.name}]\n${excerpt}` };
  }

  if (name === "retrieve_precedent") {
    const query = String(input.query ?? "");
    const all = ctx.precedents ?? [];
    if (all.length === 0) {
      return {
        content:
          "No precedents found in your library. Save a conversation as a precedent first to use this feature.",
      };
    }
    const matches = searchPrecedents(query, all, 3);
    if (matches.length === 0) {
      return {
        content: `No precedents matched "${query}". Try a different query or check your saved precedents.`,
      };
    }
    const content = matches.map(formatPrecedentForAgent).join("\n\n---\n\n");
    return { content };
  }

  if (name === "draft_document_section") {
    const sectionType = String(input.type ?? "clause");
    const context = String(input.context ?? "");
    try {
      const text = await ctx.draftViaEngine(
        "You are a specialist legal drafter. Generate precise, enforceable contract language. Output ONLY the clause text — no introduction, explanation, or commentary. The text must be immediately usable in a contract.",
        `Draft a ${sectionType} with the following context:\n\n${context}`,
      );
      return { content: text || "Draft generation failed." };
    } catch {
      return {
        content:
          "Draft generation failed. Try describing the clause with more detail.",
      };
    }
  }

  return { content: `Unknown tool: ${name}` };
}
