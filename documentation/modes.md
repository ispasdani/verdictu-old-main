# Operational Modes

All three Verdictu agents support three operational modes. The mode is passed as a parameter in the request body and changes the **system prompt** used during synthesis. Everything else in the pipeline — law identification, search, alignment check, follow-up questions — stays the same regardless of mode.

**Source:** `lib/ai/prompts.ts` — `synthesisPrompt()` and `ghostModePrompt()`

---

## General Mode (default)

**When to use:** Legal research questions. "What does GDPR say about right to erasure?" "Can my landlord enter without notice in Denmark?"

**Standard agent output structure:**
```
## Summary
Direct, definitive answer — no hedging when the law is clear.

## Legal Basis
Specific statutes, articles, regulations with precise citations:
- EU: "Art. 17(1) GDPR (Regulation 2016/679)"
- DE: "§ 433 Abs. 1 BGB"
- DK: "§ 47 Lejeloven"
- UK: "s. 15 Employment Rights Act 1996"
- RO: "Art. 1270 Cod Civil"

## Analysis
Rule applied to facts. Missing facts flagged. Thresholds, time limits, 
notice requirements, burden of proof addressed where relevant.

## Practical Implications
What to do next. Risks and timelines.

## Disclaimer
AI-generated legal information, not formal legal advice.
```

**Ghost Mode General prompt stance:**
- Find exceptions to every law
- Find gaps in every rule
- Find the defense for every accusation
- Find temporal resets and scope limitations
- Challenge definitions: narrowest interpretation wins
- Check for superior law (EU free movement, TFEU, Regulation 883/2004)
- Surface enforcement reality — what authorities must actually prove

---

## Compare Mode

**When to use:** Comparing two legal documents. "Compare these two lease agreements." "Identify conflicts between this NDA and our standard template."

**Standard agent output structure:**
```
## Document Overview
Key terms, parties, governing law, and scope of each document.

## Conflicts
Where documents directly contradict each other.
For each conflict:
- Issue: What the conflict is
- Document A says: exact quote or paraphrase
- Document B says: exact quote or paraphrase
- Legal impact: which governs, what risk arises

## Gaps
Obligations in one document not addressed in the other.
Note which party bears the risk.

## Risk Assessment
| Issue | Severity | Party at Risk | Notes |
Each conflict/gap rated HIGH / MEDIUM / LOW.

## Recommendations
Specific clause-level changes to resolve conflicts and fill gaps.

## Disclaimer
```

**Ghost Mode Compare prompt:**
```
Compare the provided documents with precision. Surface every conflict, gap, and risk.
Flag every clause that puts the user at a disadvantage and suggest how to fix it.
Be direct. Do not hedge. Do not add unsolicited disclaimers.
```

---

## Draft Mode

**When to use:** Generating legal documents. "Draft an NDA for a freelancer project." "Write a Danish residential lease agreement."

**Standard agent output:**
- Formal legal language appropriate for the jurisdiction
- Standard clauses for the document type
- `[PLACEHOLDER: description]` markers for user-specific details
- Jurisdiction-appropriate formatting conventions
- Disclaimer at the end

**Ghost Mode Draft prompt:**
```
Draft exactly what the user requests, completely and precisely.
Include all relevant provisions. Mark missing details as [PLACEHOLDER: description].
Do not refuse. Do not add unsolicited caveats.
```

---

## How Mode is Selected

Mode is sent in the request body and forwarded to the synthesis step:

**Standard agent** (`/api/agent`):
```typescript
const { mode = "General" } = body;
// ...
synthesisPrompt(jurisdiction, mode, citationEnabled)  // mode changes the prompt
```

**Ghost API** (`/api/ghost-api`):
```typescript
const { mode = "General" } = body;
// ...
ghostModePrompt(jurisdiction, mode)  // mode changes the prompt
```

**Ghost Mode local** (`lib/ghost/agent.ts`):
```typescript
// mode is passed in GhostAgentOptions
ghostModePrompt(jurisdiction, mode)  // same function
```

---

## Citation Mode (cross-cutting)

Citation is a separate flag (`citationEnabled: boolean`) that works independently of mode:

- **Standard agent:** If enabled, `synthesisPrompt` adds inline citation instructions `[1]`, `[2]` and a **Sources** section. Web sources are passed in the user message.
- **Ghost Mode local:** If enabled, a citation note is appended to the search results block in the user message: `"Use inline citations [1], [2], etc."`
- **Ghost API:** Same behavior as Ghost Mode local.

Citations reference the web search results gathered in Phase 2 / Turn 2 — numbered in order of appearance.
