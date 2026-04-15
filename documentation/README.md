# Verdictu Agent Documentation

This folder documents every AI agent and mode in Verdictu — what each one does, how it works, and the exact steps it follows at runtime.

## Agents

| Document | Agent | Runtime |
|---|---|---|
| [standard-agent.md](standard-agent.md) | Standard Legal AI Agent | Cloud (Gemini / OpenAI / Anthropic) |
| [ghost-mode-agent.md](ghost-mode-agent.md) | Ghost Mode Agent | On-device WebLLM |
| [ghost-api-agent.md](ghost-api-agent.md) | Ghost API Agent | Cloud via OpenRouter |

## Modes

All three agents support the same three **operational modes**, each changing how the synthesis prompt is structured:

| Mode | Purpose |
|---|---|
| `General` | Comprehensive legal research and analysis |
| `Compare` | Side-by-side document comparison |
| `Draft` | Legal document drafting |

Mode is passed as a request parameter and selects a different system prompt variant inside `lib/ai/prompts.ts`.

## Shared Infrastructure

- **Prompt library:** `lib/ai/prompts.ts` — all system prompts for all agents
- **Search layer:** `lib/search/tavily.ts` + `/api/search` — Tavily (primary) / DuckDuckGo (fallback)
- **Jurisdiction context:** 10 jurisdictions — DK, DE, EU, UK, FR, SE, NL, US, RO
- **WebLLM hook:** `hooks/useGhostLLM.ts` — local model lifecycle for Ghost Mode
- **OpenRouter client:** `lib/ghost/openrouter.ts` — streaming client for Ghost API
