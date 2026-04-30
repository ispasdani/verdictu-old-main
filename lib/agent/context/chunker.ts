// ~600 token chunks (4 chars ≈ 1 token)
const CHUNK_SIZE = 2400;
const CHUNK_OVERLAP = 300;
const MAX_CHUNKS_RETURNED = 4;

function chunkDocument(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function scoreChunk(chunk: string, topicTokens: string[]): number {
  const lower = chunk.toLowerCase();
  return topicTokens.reduce((score, token) => {
    const matches = lower.split(token).length - 1;
    return score + matches;
  }, 0);
}

// Returns the most relevant chunks of a document for a given topic.
// Always includes the first chunk (definitions/parties), then fills up with
// highest-scoring chunks ranked by keyword overlap with `topic`.
export function retrieveRelevantChunks(text: string, topic: string): string {
  const chunks = chunkDocument(text);

  if (chunks.length <= MAX_CHUNKS_RETURNED) {
    return text.slice(0, CHUNK_SIZE * MAX_CHUNKS_RETURNED);
  }

  const topicTokens = topic
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  const scored = chunks.map((chunk, index) => ({
    index,
    text: chunk,
    score: scoreChunk(chunk, topicTokens),
  }));

  // Always keep first chunk; fill remaining slots with top-scored
  const [first, ...rest] = scored;
  const top = rest
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CHUNKS_RETURNED - 1);

  const selected = [first, ...top].sort((a, b) => a.index - b.index);
  return selected.map((c) => c.text).join("\n\n[...]\n\n");
}
