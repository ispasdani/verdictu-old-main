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
    default:
      return `Running ${toolName}...`;
  }
}
