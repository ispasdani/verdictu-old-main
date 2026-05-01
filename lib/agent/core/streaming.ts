const enc = new TextEncoder();

export function sseChunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function toolCallToStepLabel(
  toolName: string,
  input: Record<string, unknown>,
): string {
  switch (toolName) {
    case "think":
      return "Thinking...";
    case "web_search": {
      const query = String(input.query ?? "");
      return query ? `Searching web for "${query}"...` : "Searching web...";
    }
    case "read_document": {
      const name = String(input.name ?? "document");
      const topic = String(input.topic ?? "");
      return topic ? `Reading ${name} for ${topic}...` : `Reading ${name}...`;
    }
    case "retrieve_precedent": {
      const query = String(input.query ?? "");
      return query ? `Looking up precedent for "${query}"...` : "Looking up precedents...";
    }
    case "spawn_legal_research": {
      const task = String(input.task ?? "");
      return task
        ? `Launching legal research sub-agent (${task})...`
        : "Launching legal research sub-agent...";
    }
    case "spawn_company_research": {
      const company = String(input.company_name ?? "");
      return company
        ? `Launching company research sub-agent (${company})...`
        : "Launching company research sub-agent...";
    }
    case "draft_document_section": {
      const type = String(input.type ?? "clause");
      return `Drafting ${type}...`;
    }
    default:
      return `Running ${toolName}...`;
  }
}
