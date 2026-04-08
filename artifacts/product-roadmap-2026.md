# Verdictu — Product Roadmap 2026
**"Best-in-Market Legal AI Platform"**

> Current state: Working agent loop, Ghost Mode, Compare/Draft UI shells, multi-jurisdictional support. This document outlines the features needed to compete with and surpass Harvey, Clio Duo, LexisNexis AI, and Legalfly.

---

## Competitive Landscape (What We're Up Against)

| Platform | Strength | Weakness |
|---|---|---|
| Harvey AI | Big Law contracts, M&A | Opaque, $$$, no transparency |
| Clio Duo | Practice management integration | Not a research tool |
| LexisNexis AI | Massive case law DB | Outdated UX, expensive |
| Legalfly | EU compliance focus | Narrow scope |
| **Verdictu** | Multi-jurisdictional, Ghost Mode, citation-aware | Needs depth in features below |

---

## Priority Tiers

- **P0 — Critical (blocks monetization)**
- **P1 — High Impact (user retention & differentiation)**
- **P2 — Market Leadership (beats competition)**
- **P3 — Moat-building (hard to replicate)**

---

## P0 — Foundation (Complete the Core Product)

These ship before anything else because they're blocking actual usage.

### 1. Compare Mode Backend
**What:** Wire the existing Compare UI to a real document diff + conflict analysis pipeline.
- Accept 2+ documents (PDF/DOCX/text)
- Identify: conflicting clauses, missing provisions, risk exposure, jurisdiction mismatches
- Output: structured diff with severity ratings (Critical / Medium / Low)
- Stream results using the same SSE pipeline

**Why it wins:** Most legal AI tools do Q&A only. Document comparison at clause level is a major differentiator.

**Implementation:**
```
Upload doc A + doc B
↓
Extract text (already built)
↓
Chunk by clause/section
↓
LLM: For each pair of clauses, classify as Match / Conflict / Gap / Risk
↓
Stream structured results with law citations
```

---

### 2. Draft Mode Backend
**What:** Wire Draft UI to a document generation pipeline.
- User describes what they need (e.g. "NDA between two Romanian companies, 2-year term")
- System generates full draft with jurisdiction-appropriate clauses
- Export to DOCX (use `docx` npm package)
- Support clause-level regeneration ("make this indemnity clause stronger")

**Why it wins:** Lawyers spend 60% of time on first drafts. Removing that is the #1 time saver.

---

### 3. Credits System + Billing Flow
**What:** Connect Stripe to the credits schema that already exists in Convex.
- Deduct credits per query (already defined, never called)
- Block requests when credits = 0
- Stripe Checkout for credit top-ups and subscription upgrades
- Webhook to update `subscriptionTier` in Convex users table
- Show credit balance in UI

**Why it wins:** Enables monetization immediately.

---

### 4. Real Citations with Verified Source Links
**What:** Replace inline law chips with numbered footnotes that link to official sources.
- Parse `[Citation: Article X, Law Y]` patterns from LLM output
- Map to official URLs: EUR-Lex, legislation.gov.uk, legifrance.gouv.fr, etc.
- Render as `[1]` superscripts with expandable footnote panel
- Mark unverifiable citations with a warning indicator

**Why it wins:** Trust is everything in legal. Lawyers won't use a tool they can't verify.

---

## P1 — High-Impact Differentiators

### 5. AI Contract Intelligence (Risk Scoring)
**What:** Upload a contract, get a risk scorecard.
- One-click contract health report
- Scores: Liability Exposure / IP Risk / Termination Risk / Regulatory Compliance
- Highlight dangerous clauses in the document view (side-by-side)
- Suggest alternative language with legal reasoning

**Format output:**
```
Overall Risk: MEDIUM (64/100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 Unlimited liability clause (Art. 8.3) — Industry standard is capped at 12 months fees
🟡 No governing law specified — Defaults to jurisdiction of incorporation
🟢 IP assignment is clean and complete
```

**Why it beats Harvey:** Harvey requires a $50k/yr enterprise contract. This works self-serve.

---

### 6. Multi-Jurisdictional Compliance Checker
**What:** Check a single document against multiple jurisdictions simultaneously.
- User uploads a contract → selects 3 jurisdictions (e.g. Romania + Germany + EU)
- System runs parallel compliance checks
- Output: jurisdiction-by-jurisdiction compliance matrix
- Flag clauses that are valid in one country but illegal in another

**Use case:** A Romanian company signing a contract with a German partner — checks both GDPR (EU), Romanian Law 190/2018, and German BDSG at once.

**Why it wins:** No other tool does multi-jurisdiction parallel analysis in real-time.

---

### 7. Regulatory Change Monitoring & Alerts
**What:** Subscribe to laws that matter to you, get notified when they change.
- After a research session, prompt: "Monitor this regulation for changes?"
- Daily/weekly scan of official gazette feeds (EUR-Lex OJ, legislation.gov.uk updates)
- Email or in-app notification when a monitored law is amended
- Show: what changed, what it means for your saved documents

**Why it wins:** Lawyers need to stay current. This is passive value delivery — keeps users coming back without them needing to ask.

---

### 8. Clause Library (Jurisdiction-Aware)
**What:** A curated bank of pre-approved legal clauses.
- Browse by category: Confidentiality / Liability / IP / Termination / Dispute Resolution
- Filter by jurisdiction
- One-click insert into Draft mode
- Users can save their own approved clauses
- Firm-level shared clause library (team feature)

**Why it wins:** Law firms have internal playbooks. We can digitize and automate this.

---

### 9. Legal Memorandum Generator
**What:** Structured memo drafting from research results.
- After a General mode session, button: "Export as Legal Memo"
- Auto-populates standard memo structure: Issue / Rule / Analysis / Conclusion (IRAC)
- DOCX export with firm letterhead template support
- One-click regeneration of any section

**Why it wins:** The output of legal research is always a memo or opinion. This closes the loop.

---

### 10. Matter/Case Management
**What:** Organize chats, documents, and research by client matter.
- Create "Matters" (cases/projects) with client names
- All chats, uploads, and drafts attached to a matter
- Matter dashboard: timeline, documents, open questions, key findings
- Search across all matter content

**Why it wins:** Currently every chat is isolated. Lawyers work on cases for months. This creates stickiness.

---

## P2 — Market Leadership Features

### 11. AI-Powered Redlining
**What:** Upload a contract you received → get a redlined version with suggested edits.
- Track-changes style output (like Word's Review mode)
- Each suggested change has a legal reasoning tooltip
- Accept/reject individual suggestions
- Export as DOCX with tracked changes preserved

**Why it wins:** Contract negotiation is 80% of commercial lawyers' work. This automates the first pass.

---

### 12. Case Law & Precedent Search
**What:** Search real case law with semantic understanding.
- Connect to public APIs: ECLI (EU), CourtListener (US), BAILII (UK), jurisprudenta.ro (Romania)
- Semantic search: "cases where force majeure was rejected in commercial contracts"
- Return: case summary, key ratio, how courts have interpreted the relevant law
- Link to full case text

**Why it wins:** LexisNexis charges $1,000+/month for this. We can offer it cheaper with better UX.

---

### 13. Multi-Document Analysis (Portfolio Mode)
**What:** Upload 5–20 documents, ask questions across all of them.
- "Find all indemnity clauses across these 12 contracts"
- "Which contracts expire in the next 6 months?"
- "Identify inconsistencies in defined terms across the portfolio"
- Results in a table with links back to source documents

**Why it wins:** M&A due diligence and contract portfolio reviews are massive billable work. This automates it.

---

### 14. Client-Facing Portal
**What:** Share research results and document summaries with clients (non-lawyers).
- Generate a "Client Report" from any chat session (plain language summary)
- Shareable link with optional password protection
- Client can ask follow-up questions (limited, uses lawyer's credits)
- White-label: law firm's logo and colors

**Why it wins:** Clients want to understand what they're paying for. This builds trust and reduces lawyer-client calls.

---

### 15. Legal Timeline Builder
**What:** Visualize key dates and obligations from contracts/case files.
- Extract all dates, deadlines, obligations from uploaded documents
- Render as interactive timeline
- Add to Google Calendar / iCal with one click
- Alert when deadlines are approaching

**Why it wins:** Missing a deadline = malpractice. This is pure risk management value.

---

## P3 — Moat-Building (Hard to Replicate)

### 16. Proprietary Laws Database (RAG)
**What:** Populate the existing Convex laws schema with full text of key laws per jurisdiction.
- Start with: EU GDPR, Romanian Civil Code, German BGB, UK Companies Act, French Code Civil
- Structure: Article → Paragraph → Sub-paragraph with cross-references
- Vector embeddings for semantic retrieval (Convex vector search, already in schema)
- Hybrid RAG: web search + internal DB to get best of both worlds

**Why it's a moat:** Building a structured, machine-readable law DB is a 6–12 month project. Once done, no competitor can match search accuracy or speed.

**Jurisdiction priority:**
1. Romania (underserved, home market)
2. EU (GDPR, Consumer Protection, Corporate Law)
3. Germany (largest EU economy)
4. France
5. UK
6. US (Delaware, New York)

---

### 17. Firm-Level Team Workspaces
**What:** Full multi-user collaboration within a law firm.
- Shared matter folders
- Role-based access: Partner / Associate / Paralegal / Client
- Shared clause library and templates
- Activity log (who ran what query, when)
- Admin dashboard for usage analytics

**Why it's a moat:** Enterprise stickiness. Once a firm adopts, switching cost is very high.

---

### 18. Integrations Layer
**What:** Connect to tools lawyers already use.
- **iManage / NetDocuments:** import documents directly from DMS
- **Clio / PracticePanther:** sync matters and clients
- **Outlook / Gmail:** import email threads as context for research
- **Westlaw / LexisNexis:** use as fallback citation source

**Why it's a moat:** Embedded in existing workflows = daily use habit.

---

### 19. Judgment Prediction Engine
**What:** Based on the facts of a case + jurisdiction, estimate likely outcome.
- Input: case facts, applicable law, jurisdiction, court level
- Output: estimated win probability + key risk factors + comparable cases
- Powered by: fine-tuned model on historical case outcomes

**Why it's a moat:** No mainstream tool does this. High value for litigation strategy.
**Note:** Requires significant training data per jurisdiction. Start with Romania + EU.

---

### 20. Audit Trail & Compliance Logging
**What:** Full tamper-proof log of all AI-generated legal output.
- Required for law firm professional indemnity insurance
- Log: who asked what, which model answered, what sources were used, timestamp
- Export as PDF for file notes / regulatory audit
- GDPR-compliant data retention policies

**Why it's a moat:** Enterprise legal buyers require this. It's a sales requirement, not just a nice-to-have.

---

## Recommended Shipping Order

```
Month 1 (April 2026)
└── P0: Compare Mode Backend
└── P0: Draft Mode + DOCX Export
└── P0: Real Citations with Source Links

Month 2 (May 2026)
└── P0: Credits System + Stripe
└── P1: AI Contract Risk Scoring
└── P1: Legal Memo Generator

Month 3 (June 2026)
└── P1: Multi-Jurisdiction Compliance Checker
└── P1: Clause Library
└── P1: Matter Management

Month 4-5 (July–August 2026)
└── P2: AI Redlining
└── P2: Multi-Document Portfolio Mode
└── P1: Regulatory Change Monitoring

Month 6 (September 2026)
└── P2: Case Law Search (CourtListener + ECLI)
└── P2: Client Portal
└── P3: Laws Database v1 (Romania + GDPR)

Month 7-9 (Q4 2026)
└── P3: Team Workspaces (Enterprise tier)
└── P3: Integrations (Clio, iManage)
└── P3: Audit Trail
└── P3: Judgment Prediction (beta)
```

---

## Key Metrics to Track

| Metric | Target (6 months) |
|---|---|
| Weekly Active Users | 1,000+ |
| Queries per active user / week | 10+ |
| Compare/Draft mode adoption | 40% of sessions |
| Paid conversion rate | 8%+ |
| Churn rate | < 5% monthly |
| NPS | 50+ |

---

## Technical Debt to Address In Parallel

1. **Replace fake step timers** with real SSE events from server (currently faked with setTimeout)
2. **Migrate long-running AI calls to Convex HTTP Actions** (avoids Next.js 120s timeout for large docs)
3. **Add rate limiting** (per-user, per-IP) before any public launch
4. **Error boundaries** — agent failures should show graceful messages, not crash
5. **Token budget management** — large documents need chunking + summarization before synthesis

---

*Last updated: April 2026 | Owner: Product*
