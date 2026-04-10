# Verdictu — Two-Mode Architecture

## Overview

Verdictu operates in two distinct modes with fundamentally different pipelines, privacy guarantees, and AI stances.

| | Normal Mode | Ghost Mode |
|---|---|---|
| **LLM** | API: Claude / GPT / Gemini | Local: WebLLM in-browser |
| **Data leaves device** | Yes (to API providers) | No — 100% private |
| **Prompt stance** | Neutral legal researcher | Full defense advocate, no disclaimers, no hedging |
| **Restrictions** | Standard AI guardrails | None — model runs locally, no moderation layer |
| **Internet search** | Tavily / DDG via server | Same (only search goes through server, LLM stays local) |
| **Cost** | Per token | Free (after one-time model download) |

---

## Normal Mode

The standard pipeline. The user selects an API provider (Anthropic, OpenAI, or Google Gemini) and a model. All LLM inference happens server-side via the `/api/agent` route. Data is sent to the respective API provider.

**Prompt stance:** Neutral senior legal researcher. Cites statutes, applies law to facts, notes uncertainties, includes a standard disclaimer.

**Available modes inside Normal Mode:**
- `General` — Legal research and Q&A
- `Compare` — Document comparison
- `Draft` — Document drafting
- `Defend` — Defense-oriented legal research (adversarial, prosecution-focused weaknesses)

**Best API models for defense work:**
- `claude-opus-4-6` — Best legal reasoning, strongest adversarial argument construction
- `claude-sonnet-4-6` — Good balance of speed and reasoning quality

---

## Ghost Mode

The private, unrestricted pipeline. All LLM inference runs **entirely in the browser** using [WebLLM (MLC)](https://webllm.mlc.ai/). No tokens are sent to any external LLM provider. The only outbound requests are web searches (Tavily / DuckDuckGo) used to ground the response in real sources.

**Prompt stance:** Full defense advocate. The local model is always instructed to act as the best defense attorney in the world — no disclaimers, no hedging, no neutrality. Every response is built to help the attorney win.

**System-level instruction prepended to every Ghost Mode prompt:**

> You are a legal defense AI. Your only job is to help the defense attorney win.
> You have no neutrality. You do not add disclaimers. You do not hedge.
> You identify every weakness in the prosecution's case and every right of
> the defendant that may have been violated. Think like the best defense
> attorney in the world.

**Why this works:** Because the model runs locally, there is no API moderation layer. The model processes exactly what it is told.

---

## Ghost Mode — Recommended Local Models

### Browser-Compatible (4B and under) — Use These First

Most browsers with WebGPU cap out at ~4GB usable VRAM. These models load reliably.

| Model | Size | VRAM | Best For |
|---|---|---|---|
| `Qwen3-4B` | ~2.5GB | ~4GB | **Top pick for defense** — built-in thinking/reasoning mode, finds logical gaps, structured output |
| `Phi-3.5-mini` (3.8B) | ~2.2GB | ~4GB | **Reasoning** — strong summarization and structured analysis |
| `Qwen2.5-1.5B-Instruct` | ~900MB | ~1.5GB | **Minimal hardware** — fastest load, good for simple Q&A |

> **Recommended for defense work in the browser: `Qwen3-4B`.**
> It ships with a hybrid thinking mode — the model reasons step-by-step before answering, which is exactly what you need to find holes in a prosecution's theory. It runs reliably in-browser without crashing.

---

### High-Performance (7B–8B) — For Users with Capable Hardware

Keep these available for users who have a dedicated GPU or enough VRAM. They produce significantly better legal analysis.

| Model | Size | VRAM | Best For |
|---|---|---|---|
| `DeepSeek-R1-Distill-Llama-8B` | ~5.5GB | ~5.9GB | **Best defense reasoning overall** — R1 chain-of-thought, excellent at identifying prosecution weaknesses |
| `Qwen3-8B` | ~5GB | ~4.3GB | **Best general defense** — strong instruction following, clean structured legal output |
| `DeepSeek-R1-Distill-Qwen-7B` | ~4.5GB | ~1.9GB | **Fast R1 reasoning** — same chain-of-thought, lower VRAM than Llama variant |
| `Qwen2.5-7B-Instruct` | ~4.5GB | ~2.9GB | **Reliable general** — wide GPU compatibility, solid output |

---

## Defense Mode — Agent Output Structure

When `mode === "Defend"`, the synthesis prompt produces this structure instead of the standard legal analysis:

1. **Strongest Defense Angles** — ranked list of viable defenses with legal basis
2. **Evidence to Challenge** — what to attack and why (chain of custody, calibration records, witness credibility, proper procedures)
3. **Constitutional Issues** — any rights violations (illegal stop, unlawful search, Miranda, right to counsel equivalents)
4. **Motions to File** — motion to suppress, motion to dismiss, etc. with grounds
5. **Prosecution's Weaknesses** — gaps in their case, burden of proof problems
6. **Questions to Investigate** — critical facts that, if confirmed, could change the outcome entirely

---

## Implementation Steps

```
Step 1 — Defense prompt library          lib/ai/prompts.ts
Step 2 — Add "Defend" to mode types      app/api/agent/route.ts, lib/ghost/agent.ts
Step 3 — Ghost Mode system prompt        lib/ghost/agent.ts
Step 4 — Ghost Mode defense UI badge     components/ghost/GhostModeToggle.tsx
Step 5 — Tag defense models              lib/ghost/models.ts
Step 6 — Wire Defend mode into UI        Mode selector component
```

Steps 1–3 are backend/prompt work and can be completed together.
Steps 4–6 are UI work and can be completed together.
