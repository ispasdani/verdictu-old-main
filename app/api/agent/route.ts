import { NextRequest, NextResponse } from "next/server";
import {
  complete,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  resolveModel,
  type AIProvider,
} from "@/lib/ai/providers";
import type { SearchResult } from "@/app/api/search/route";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Attachment {
  filename: string;
  text: string;
}

interface AgentRequestBody {
  message: string;
  jurisdiction: string;
  mode?: "General" | "Compare" | "Draft";
  attachments?: Attachment[];
  citationEnabled?: boolean;
  provider?: AIProvider;
  model?: string;
}

// ---------------------------------------------------------------------------
// Jurisdiction context
// ---------------------------------------------------------------------------

const JURISDICTION_CONTEXT: Record<string, string> = {
  DK: "Danish law (Retsplejeloven, GDPR as implemented in DK). Cite Danish legislation and court practice (Højesteret, Landsretterne).",
  DE: "German law (BGB, HGB, GG). Cite German statutes and BGH case law.",
  EU: "EU law (Treaties, Regulations, Directives). Cite EUR-Lex sources.",
  UK: "English and Welsh law post-Brexit. Cite UK statutes and case law (UKSC, EWCA).",
  FR: "French law (Code civil, Code de commerce). Cite French legislation and Cour de cassation.",
  SE: "Swedish law (Rättsfall från Högsta domstolen). Cite Swedish statutes.",
  NL: "Dutch law (BW, WvSr). Cite Dutch legislation and Hoge Raad.",
  US: "US federal and state law. Cite relevant federal statutes, CFR, and landmark case law.",
};

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildQuerySystemPrompt(jurisdiction: string): string {
  const ctx =
    JURISDICTION_CONTEXT[jurisdiction] ??
    "general international law principles";
  return `You are a legal research assistant specializing in ${ctx}.
Your task: generate 3–5 focused web search queries to answer the user's legal question.
Return ONLY a valid JSON array of strings, no other text. Example: ["query 1","query 2","query 3"]`;
}

function buildLegalSystemPrompt(
  jurisdiction: string,
  mode: string,
  citationEnabled?: boolean,
): string {
  const ctx =
    JURISDICTION_CONTEXT[jurisdiction] ??
    "general international law principles";

  let prompt = `You are a legal research assistant specializing in ${ctx}.

Always:
- Cite specific articles, sections, and case references
- Distinguish clearly between established law and legal opinion
- Flag when an answer may require a licensed local attorney
- Structure answers: Summary → Legal basis → Analysis → Practical implications
- Add a disclaimer that this is not formal legal advice`;

  if (citationEnabled) {
    prompt +=
      "\n\nReturn inline citations as [1], [2], etc. At the end of your response, list them as:\n[1] Title — URL";
  }

  if (mode === "Compare") {
    prompt +=
      "\n\nYou are comparing two documents. Identify conflicts, gaps, and risk areas. Structure: Document Overview → Conflicts → Gaps → Risk Assessment (HIGH/MEDIUM/LOW) → Recommendations.";
  } else if (mode === "Draft") {
    prompt +=
      "\n\nYou are drafting a legal document. Use formal legal language appropriate for the jurisdiction.";
  }

  return prompt;
}

function buildUserMessage(
  question: string,
  sources: SearchResult[],
  attachments?: Attachment[],
): string {
  let content = question;

  if (attachments?.length) {
    content += "\n\n--- ATTACHED DOCUMENTS ---";
    for (const a of attachments) {
      content += `\n\n[${a.filename}]\n${a.text.slice(0, 8000)}`;
    }
  }

  if (sources.length) {
    content += "\n\n--- WEB SEARCH RESULTS ---";
    sources.forEach((s, i) => {
      content += `\n\n[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`;
    });
  }

  return content;
}

// ---------------------------------------------------------------------------
// Internal search helper
// ---------------------------------------------------------------------------

async function runSearch(query: string): Promise<SearchResult[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults: 5 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body: AgentRequestBody = await req.json();
  const {
    message,
    jurisdiction = "EU",
    mode = "General",
    attachments,
    citationEnabled,
    provider = DEFAULT_PROVIDER,
    model: requestedModel,
  } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const model = resolveModel(provider, requestedModel);

  // Step 1 — generate search queries
  let queries: string[] = [];
  try {
    const queryResult = await complete(provider, model, {
      systemPrompt: buildQuerySystemPrompt(jurisdiction),
      userMessage: message,
      maxTokens: 400,
      jsonMode: true,
    });
    queries = JSON.parse(queryResult.text);
    if (!Array.isArray(queries)) queries = [];
  } catch {
    // Continue without search if query generation fails
    queries = [];
  }

  // Step 2 — run searches in parallel
  const searchResults = queries.length
    ? (await Promise.all(queries.map(runSearch))).flat()
    : [];

  // Deduplicate by URL
  const seen = new Set<string>();
  const sources = searchResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Step 3 — synthesize legal answer
  const answerResult = await complete(provider, model, {
    systemPrompt: buildLegalSystemPrompt(jurisdiction, mode, citationEnabled),
    userMessage: buildUserMessage(message, sources, attachments),
    maxTokens: 2000,
  });

  return NextResponse.json({
    answer: answerResult.text,
    sources,
    provider,
    model,
    usage: {
      inputTokens: answerResult.inputTokens,
      outputTokens: answerResult.outputTokens,
    },
  });
}
