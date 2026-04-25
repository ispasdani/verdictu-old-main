# Agent Validation Improvements

The agent already has solid bones (alignment check, JSON fallback extraction, dedup). Here are the highest-value validation steps to add, in pipeline order.

---

## Step A — Source Authority Filter
*After Turn 2, before synthesis*

AI scores each fetched source on authority (government/official > legal journal > news > blog), recency, and jurisdiction relevance. Low-scoring sources get dropped or deprioritized before synthesis. This prevents the LLM from citing a random forum post as equal to EUR-Lex.

---

## Step B — Contradiction Detection
*Alongside or after Authority Filter*

Run an AI pass over the filtered sources asking: "do any sources directly contradict each other on this legal point?" If yes, emit a `contradictions_found` event and let the synthesis prompt explicitly address the conflict rather than silently picking one side.

---

## Step C — Grounding / Hallucination Check
*After Turn 3, before `done`*

After synthesis streams, send: *"Here is the AI response and here are the source snippets. Flag every legal claim or citation in the response that is NOT directly supported by any source snippet."* Returns a `grounding_report` — flagged claims get surfaced to the user as `⚠️ unverified` inline or as a disclaimer section.

---

## Step D — Confidence Score
*Light — fits inside Turn 4 or alongside it*

Ask the AI to return a 1–10 confidence score with a one-sentence rationale (e.g., *"7/10 — two authoritative sources confirm the rule, but no source addresses the specific exception you asked about"*). Surface this in the UI near the answer.

---

## Priority Recommendation

**Step C (Grounding Check)** has the highest trust impact for a legal tool — hallucinated citations are a liability.

**Step A (Source Authority Filter)** has the highest answer quality impact and is cheap to implement.

Do those two first.

### Pipeline Order After Changes

```
intake → identifying → laws_found
→ searching (x N) → search_results → sources_ranked
→ [NEW] authority_filter → sources_filtered
→ [NEW] contradiction_check → contradictions_found?
→ aligning → alignment_result
→ synthesizing → delta (streaming)
→ [NEW] grounding_check → grounding_report
→ follow_up_generating
→ [NEW] confidence_score
→ done
```

### Files to Modify

| File | Change |
|------|--------|
| `app/api/agent/route.ts` | Add new pipeline steps |
| `lib/ai/prompts.ts` | Add prompts for authority filter, contradiction check, grounding check, confidence score |
