import Anthropic from "@anthropic-ai/sdk";
import { search, tavilySearch, type SearchResult } from "@/lib/search/tavily";
import { retrieveRelevantChunks } from "@/lib/agent/context/chunker";
import {
  searchPrecedents,
  formatPrecedentForAgent,
} from "@/lib/memory/precedent-search";
import type { PrecedentEntry } from "@/lib/memory/client-store";

export type ToolName =
  | "web_search"
  | "read_document"
  | "think"
  | "retrieve_precedent"
  | "spawn_legal_research"
  | "spawn_company_research"
  | "draft_document_section";

// Full tool set — used by the orchestrator loop
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
  {
    name: "retrieve_precedent" as const,
    description:
      "Search the user's saved precedent library for a past contract, legal analysis, or prior work matching the query. Returns relevant clauses and prior findings. Use this when the user mentions 'the Company A/B contract', 'our standard NDA', or 'like last time'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — include party names, contract type, or legal topic (e.g. 'Company A employment agreement', 'GDPR data processing addendum')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "spawn_legal_research" as const,
    description:
      "Launch a legal research sub-agent focused on one specific legal topic. The sub-agent searches all specified jurisdictions and synthesizes a comparative analysis. Use this for deep multi-jurisdiction research (IP ownership, termination rights, liability caps, data protection obligations, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string",
          description:
            "The specific legal question to research (e.g. 'IP ownership in joint venture agreements under work-for-hire doctrine')",
        },
        jurisdictions: {
          type: "array" as const,
          items: { type: "string" },
          description:
            "Jurisdictions to research in parallel (e.g. ['SE', 'UK', 'EU', 'DE'])",
        },
      },
      required: ["task", "jurisdictions"],
    },
  },
  {
    name: "spawn_company_research" as const,
    description:
      "Launch a company research sub-agent to find publicly available information about a specific company — registration, jurisdiction of incorporation, shareholders, directors, and regulatory filings.",
    input_schema: {
      type: "object" as const,
      properties: {
        company_name: {
          type: "string",
          description: "The full legal name of the company to research",
        },
      },
      required: ["company_name"],
    },
  },
  {
    name: "draft_document_section" as const,
    description:
      "Draft a specific clause or section for a legal document. Generates precise, enforceable contract language for termination clauses, IP ownership provisions, liability caps, governing law clauses, data processing addenda, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Type of clause to draft (e.g. 'termination clause', 'IP ownership clause', 'liability cap', 'governing law')",
        },
        context: {
          type: "string",
          description:
            "Relevant context: parties, jurisdiction, key obligations, constraints, and any requirements the clause must satisfy",
        },
      },
      required: ["type", "context"],
    },
  },
];

// Subset for sub-agents — web_search and think only, no recursive spawning
export const SUB_AGENT_TOOL_DEFINITIONS = [
  {
    name: "web_search" as const,
    description:
      "Search the web for statutes, regulations, case law, and legal commentary. Use precise legal terms and include the jurisdiction.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — include statute names, article numbers, or case law terms",
        },
        jurisdiction: {
          type: "string",
          description: "Optional jurisdiction filter (e.g. SE, UK, EU, DE)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "think" as const,
    description: "Think through a legal question step by step before answering.",
    input_schema: {
      type: "object" as const,
      properties: {
        reasoning: {
          type: "string",
          description: "Your step-by-step reasoning",
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
  precedents?: PrecedentEntry[];
  // Injected by loop.ts before tool execution — needed by sub-agents and draft tool
  apiKey?: string;
  model?: string;
  onSubAgentStep?: (data: object) => void;
};

export type ToolResult = {
  content: string;
  sources?: SearchResult[];
};

// Handles web_search and think only — used by sub-agents (avoids circular import)
export async function executeSubAgentTool(
  name: "web_search" | "think",
  input: Record<string, unknown>,
  ctx: Pick<ToolContext, "jurisdiction" | "baseUrl" | "tavilyKey">,
): Promise<ToolResult> {
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
      const results: SearchResult[] = ctx.tavilyKey
        ? await tavilySearch(finalQuery, 8, ctx.tavilyKey)
        : await search(finalQuery, ctx.baseUrl, 8);

      if (results.length === 0) {
        return { content: "No results found. Try a different query." };
      }

      const content = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet.slice(0, 500)}`,
        )
        .join("\n\n");

      return { content, sources: results };
    } catch {
      return { content: "Search failed. Try a more specific query." };
    }
  }

  return { content: `Unknown tool: ${name}` };
}

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
      const available =
        ctx.attachments.map((a) => a.filename).join(", ") || "none";
      return {
        content: `Document "${docName}" not found. Available: ${available}`,
      };
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
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet.slice(0, 500)}`,
        )
        .join("\n\n");

      return { content, sources: results };
    } catch {
      return { content: "Search failed. Try a more specific query." };
    }
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

  if (name === "spawn_legal_research") {
    const task = String(input.task ?? "");
    const jurisdictions = Array.isArray(input.jurisdictions)
      ? (input.jurisdictions as unknown[]).map(String)
      : [ctx.jurisdiction];

    if (!ctx.apiKey || !ctx.model) {
      return {
        content:
          "Sub-agent unavailable: missing API configuration. Research the topic directly using web_search.",
      };
    }

    const onStep = ctx.onSubAgentStep ?? (() => {});
    const { runLegalResearchSubAgent } = await import(
      "@/lib/agent/subagents/legal-research"
    );
    const result = await runLegalResearchSubAgent(
      task,
      jurisdictions,
      ctx,
      ctx.apiKey,
      ctx.model,
      onStep,
    );
    return {
      content: result.answer,
      sources: result.sources.length > 0 ? result.sources : undefined,
    };
  }

  if (name === "spawn_company_research") {
    const companyName = String(input.company_name ?? "");
    if (!companyName) {
      return { content: "company_name is required." };
    }
    if (!ctx.apiKey || !ctx.model) {
      return {
        content:
          "Sub-agent unavailable: missing API configuration. Research the company directly using web_search.",
      };
    }

    const onStep = ctx.onSubAgentStep ?? (() => {});
    const { runCompanyResearchSubAgent } = await import(
      "@/lib/agent/subagents/company-research"
    );
    const result = await runCompanyResearchSubAgent(
      companyName,
      ctx,
      ctx.apiKey,
      ctx.model,
      onStep,
    );
    return {
      content: result.answer,
      sources: result.sources.length > 0 ? result.sources : undefined,
    };
  }

  if (name === "draft_document_section") {
    const sectionType = String(input.type ?? "clause");
    const context = String(input.context ?? "");

    if (!ctx.apiKey || !ctx.model) {
      return {
        content:
          "Drafting service unavailable: missing API configuration.",
      };
    }

    const client = new Anthropic({ apiKey: ctx.apiKey });
    const msg = await client.messages.create({
      model: ctx.model,
      max_tokens: 2000,
      system:
        "You are a specialist legal drafter. Generate precise, enforceable contract language. Output ONLY the clause text — no introduction, explanation, or commentary. The text must be immediately usable in a contract.",
      messages: [
        {
          role: "user",
          content: `Draft a ${sectionType} with the following context:\n\n${context}`,
        },
      ],
    });
    const text =
      msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text ?? "";
    return { content: text };
  }

  return { content: `Unknown tool: ${name}` };
}
