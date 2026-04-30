import { search, tavilySearch, type SearchResult } from "@/lib/search/tavily";
import { retrieveRelevantChunks } from "@/lib/agent/context/chunker";

export type ToolName = "web_search" | "read_document" | "think";

export const TOOL_DEFINITIONS = [
  {
    name: "web_search" as const,
    description:
      "Search the web for statutes, regulations, case law, and legal commentary. Use precise legal terms and include the jurisdiction. Run multiple searches from different angles to find the rule and its exceptions.",
    input_schema: {
      type: "object" as const,
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
  {
    name: "read_document" as const,
    description:
      "Read an attached document (contract, brief, PDF) to find specific clauses, definitions, or obligations.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The exact filename of the document to read",
        },
        topic: {
          type: "string",
          description: "What specific information to look for in the document",
        },
      },
      required: ["name", "topic"],
    },
  },
  {
    name: "think" as const,
    description:
      "Think through a complex legal question step by step before answering. Use this to reason about applicable laws, exceptions, and the best analysis strategy.",
    input_schema: {
      type: "object" as const,
      properties: {
        reasoning: {
          type: "string",
          description: "Your step-by-step legal reasoning",
        },
      },
      required: ["reasoning"],
    },
  },
];

export type ToolContext = {
  attachments: Array<{ filename: string; text: string }>;
  jurisdiction: string;
  baseUrl: string;
  tavilyKey?: string;
};

export type ToolResult = {
  content: string;
  sources?: SearchResult[];
};

export async function executeTool(
  name: ToolName,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (name === "think") {
    return { content: "Reasoning complete." };
  }

  if (name === "read_document") {
    const docName = String(input.name ?? "");
    const topic = String(input.topic ?? "");
    const doc = ctx.attachments.find(
      (a) => a.filename.toLowerCase() === docName.toLowerCase(),
    );
    if (!doc) {
      const available = ctx.attachments.map((a) => a.filename).join(", ") || "none";
      return { content: `Document "${docName}" not found. Available: ${available}` };
    }
    const excerpt = retrieveRelevantChunks(doc.text, topic);
    return { content: `[${doc.filename}]\n${excerpt}` };
  }

  if (name === "web_search") {
    const query = String(input.query ?? "");
    const jur = String(input.jurisdiction ?? "");
    const finalQuery =
      jur && !query.toLowerCase().includes(jur.toLowerCase())
        ? `${query} ${jur}`
        : query;

    try {
      const results: SearchResult[] = ctx.tavilyKey
        ? await tavilySearch(finalQuery, 8, ctx.tavilyKey)
        : await search(finalQuery, ctx.baseUrl, 8);

      if (results.length === 0) {
        return { content: "No results found. Try a different query." };
      }

      const content = results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet.slice(0, 500)}`)
        .join("\n\n");

      return { content, sources: results };
    } catch {
      return { content: "Search failed. Try a more specific query." };
    }
  }

  return { content: `Unknown tool: ${name}` };
}
