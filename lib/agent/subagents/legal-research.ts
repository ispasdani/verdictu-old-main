import {
  runSubAgent,
  type SubAgentResult,
  type SubAgentStepEmitter,
} from "./runner";
import type { ToolContext } from "@/lib/agent/core/tools";

const SYSTEM_PROMPT = `You are a specialist legal researcher. Your task is to find the governing rules on a specific legal topic across assigned jurisdictions.

For each jurisdiction:
1. Search for the primary statute, regulation, or directive governing the topic
2. Identify key exceptions, carve-outs, and superior law constraints
3. Note enforcement reality vs statutory text where they differ

After researching all jurisdictions, synthesize your findings:
- Identify similarities and shared principles
- Surface conflicts and incompatibilities
- Present a clear comparative table where useful
- Flag practical implications for the user's situation

Be precise — cite article numbers, directive names, and case law where found.`;

export async function runLegalResearchSubAgent(
  task: string,
  jurisdictions: string[],
  toolCtx: ToolContext,
  apiKey: string,
  model: string,
  onStep: SubAgentStepEmitter,
  signal?: AbortSignal,
): Promise<SubAgentResult> {
  const jurList = jurisdictions.join(", ");
  const fullTask = `Research the following legal topic across these jurisdictions: ${jurList}\n\nTopic: ${task}\n\nSearch each jurisdiction thoroughly, then synthesize your findings into a comparative analysis.`;

  return runSubAgent(
    {
      apiKey,
      model,
      name: "Research",
      task: fullTask,
      systemPrompt: SYSTEM_PROMPT,
      toolCtx,
      maxTurns: 10,
      signal,
    },
    onStep,
  );
}
