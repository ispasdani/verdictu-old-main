import {
  runSubAgent,
  type SubAgentResult,
  type SubAgentStepEmitter,
} from "./runner";
import type { ToolContext } from "@/lib/agent/core/tools";

const SYSTEM_PROMPT = `You are a corporate intelligence researcher. Find factual, publicly available information about a company.

Search for:
1. Full legal name, registration number, and jurisdiction of incorporation
2. Shareholders, beneficial owners, and parent company structure (if publicly available)
3. Directors and key officers
4. Jurisdiction of primary operations vs jurisdiction of incorporation
5. Any publicly known regulatory filings or legal proceedings

Return a structured summary. Cite your sources. If information is not publicly available, state this explicitly rather than speculating.`;

export async function runCompanyResearchSubAgent(
  companyName: string,
  toolCtx: ToolContext,
  apiKey: string,
  model: string,
  onStep: SubAgentStepEmitter,
  signal?: AbortSignal,
): Promise<SubAgentResult> {
  const task = `Research the company: "${companyName}"\n\nFind: full legal name and registration number, jurisdiction of incorporation, ownership and shareholder structure, directors and key officers, and any relevant legal or regulatory information.`;

  return runSubAgent(
    {
      apiKey,
      model,
      name: "Company",
      task,
      systemPrompt: SYSTEM_PROMPT,
      toolCtx,
      maxTurns: 6,
      signal,
    },
    onStep,
  );
}
