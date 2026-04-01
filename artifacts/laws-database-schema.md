# Laws Database Schema Design

## Overview

A jurisdiction-aware law database for Verdictu that allows users to select jurisdictions, store laws from multiple countries, and compare/research them side by side.

**Core principle: Unified tables, jurisdiction config drives display.**

One schema for all countries. Country-specific differences (law types, hierarchy names, citation formats) live in data, not in separate tables. This is required for the cross-jurisdiction comparison feature — per-country tables would require application-level merging for every query.

---

## Why NOT per-country tables

The workflow is: **select jurisdiction → search → pick laws → AI compares**. Since queries always filter by jurisdiction first, a Convex index on `jurisdiction` is functionally identical to hitting a per-country table — no performance difference.

The decisive reason is **Convex doesn't support dynamic table names**. You can't pass a jurisdiction code and resolve the table at runtime. Per-country tables would require a separate query function per country:

```typescript
// ❌ Per-country: a new function every time you add a jurisdiction
export const getRomanianLaws = query(...)
export const getGermanLaws = query(...)

// ✓ Unified: one function handles all jurisdictions
export const getLaws = query(({ jurisdiction }) =>
  db.query("laws").withIndex("by_jurisdiction", q => q.eq("jurisdiction", jurisdiction))
)
```

Country-specific fields (gazette numbers, regnal years, OJ references) are handled by the `meta: v.any()` escape hatch on `laws` — no schema divergence needed.

| Approach | Pros | Cons |
|---|---|---|
| Per-country tables | Schema per country is explicit | Convex has no dynamic table names — requires one query function per country; no cross-jurisdiction search in one query; schema changes × N countries |
| **Unified tables** ✓ | One query function, one search index, jurisdiction index = the partition | Slightly more complex schema |

---

## Schema Overview (4 tables + 1 config table)

```
jurisdictions     — display config per country (how to render, cite, navigate)
laws              — one row per law/act/regulation/code
structureNodes    — navigation hierarchy (Part > Title > Chapter > Section)
articles          — atomic content unit with vector embeddings for RAG
references        — cross-references between articles (cites, amends, repeals)
userLawCollections — user-curated sets for comparison and research
```

The key separation (borrowed from Romanian legal structure): **navigation** (`structureNodes`) is separate from **content** (`articles`). An article knows which node it belongs to for breadcrumb rendering.

---

## Table: `jurisdictions`

```typescript
jurisdictions: defineTable({
  code: v.string(),              // "RO", "DK", "DE", "EU", "UK", "US", "FR", "SE", "NL"
  name: v.string(),              // "Romania", "European Union"
  type: v.union(
    v.literal("country"),
    v.literal("supranational"),
    v.literal("state"),          // US states, etc.
  ),
  legalSystem: v.union(
    v.literal("civil_law"),      // RO, DE, FR, DK, SE, NL
    v.literal("common_law"),     // UK, US
    v.literal("hybrid"),
    v.literal("supranational"),  // EU
  ),
  languages: v.array(v.string()),

  displayConfig: v.object({
    // Labels for each hierarchy depth level
    // RO: ["Parte", "Titlu", "Capitol", "Secțiune"]
    // UK: ["Part", "Chapter", "Section", "Subsection"]
    // DE: ["Abschnitt", "Unterabschnitt", "Paragraph", "Absatz"]
    // EU: ["Title", "Chapter", "Article", "Paragraph"]
    // US: ["Title", "Chapter", "Subchapter", "Section"]
    hierarchyLevels: v.array(v.string()),

    // Prefix used before article/section numbers
    // "Art." (RO/EU/FR), "§" (DE/DK/US), "s." (UK)
    articlePrefix: v.string(),

    // Paragraph label used in citations
    // "alin." (RO), "Abs." (DE), "para." (EU/UK), "()" (US)
    paragraphPrefix: v.string(),

    // Citation template — use placeholders {shortTitle}, {number}, {paragraph}
    // RO: "Art. {number} alin. {paragraph} din {title}"
    // DE: "§ {number} Abs. {paragraph} {shortTitle}"
    // EU: "{shortTitle}, Art. {number}({paragraph})"
    // UK: "{title} {year}, s. {number}({paragraph})"
    citationFormat: v.string(),

    // Whether year is part of the title display
    // UK/US: true ("Companies Act 2006"), DE/RO: false ("BGB", "Codul Penal")
    yearInTitle: v.boolean(),
  }),
})
.index("by_code", ["code"])
```

---

## Table: `laws`

One row per law/act/regulation/code. Law types are unified across all jurisdictions.

```typescript
laws: defineTable({
  jurisdiction: v.string(),      // FK -> jurisdictions.code

  // Unified law types across all jurisdictions:
  // RO:  lege | oug | hg | constitutie | ordin
  // UK:  statute | statutory_instrument
  // DE:  gesetz | verordnung | verfassung
  // EU:  regulation | directive | decision | treaty
  // US:  statute | regulation | constitution
  // FR:  loi | ordonnance | decret | code
  type: v.string(),

  title: v.string(),             // Full official title
  shortTitle: v.optional(v.string()),  // "Codul Penal", "GDPR", "BGB", "Companies Act"
  officialNumber: v.optional(v.string()),
  // RO: "Legea nr. 286/2009"
  // EU: "2016/679/EU"
  // UK: "2006 c. 46"
  // US: "Pub. L. 117-103"

  publicationDate: v.optional(v.number()),  // timestamp — date published in official gazette
  effectiveDate: v.optional(v.number()),    // timestamp — date entered into force
  lastAmendedDate: v.optional(v.number()),  // timestamp — date of last consolidation

  status: v.union(
    v.literal("in_force"),
    v.literal("repealed"),
    v.literal("amended"),        // In force but has been modified
    v.literal("pending"),        // Passed but not yet in force
  ),

  languages: v.array(v.string()),       // ["ro"], ["de"], ["en", "fr", "de"] for EU
  sourceUrl: v.optional(v.string()),
  // RO: monitoruloficial.ro / legislatie.just.ro
  // EU: eur-lex.europa.eu
  // UK: legislation.gov.uk
  // US: uscode.house.gov
  // DE: gesetze-im-internet.de
  // FR: legifrance.gouv.fr

  summary: v.optional(v.string()),      // AI-generated or editorial summary
  topics: v.array(v.string()),          // ["penal", "contract", "gdpr", "employment"]

  // Escape hatch for country-specific metadata that doesn't fit above
  meta: v.optional(v.any()),
  // RO: { monitorul_oficial: "M. Of. nr. 510/2009", emitent: "Parlament" }
  // EU: { oj_series: "L", oj_number: "119", oj_page: 1 }
  // UK: { regnal_year: "54 & 55 Vict", chapter: 46 }
  // US: { usc_title: 42 }
})
.index("by_jurisdiction", ["jurisdiction"])
.index("by_jurisdiction_status", ["jurisdiction", "status"])
.index("by_jurisdiction_type", ["jurisdiction", "type"])
.index("by_officialNumber", ["officialNumber"])
.searchIndex("search_laws", {
  searchField: "title",
  filterFields: ["jurisdiction", "type", "status", "topics"],
})
```

---

## Table: `structureNodes`

Navigation hierarchy within a law. Used for breadcrumb rendering and tree navigation.
Separate from article content — a node is a *container*, not a content unit.

```typescript
structureNodes: defineTable({
  lawId: v.id("laws"),
  jurisdiction: v.string(),              // denormalized for fast filtering

  parentId: v.optional(v.id("structureNodes")), // null = top-level node
  order: v.number(),                     // sibling sort order

  // Level label matches jurisdictions.displayConfig.hierarchyLevels
  // RO: "parte" | "titlu" | "capitol" | "sectiune"
  // UK: "part" | "chapter" | "section"
  // DE: "abschnitt" | "unterabschnitt"
  // EU: "title" | "chapter"
  level: v.string(),

  name: v.string(),
  // RO: "Capitolul I - Infracțiuni contra vieții"
  // UK: "Part 1 — General provisions"
  // DE: "Abschnitt 2 — Schuldverhältnisse aus Verträgen"
})
.index("by_law", ["lawId"])
.index("by_law_parent", ["lawId", "parentId"])
.index("by_jurisdiction", ["jurisdiction"])
```

---

## Table: `articles`

Atomic content unit — the level at which AI cites and users read.
Each article belongs to a `structureNode` for breadcrumb context.

```typescript
articles: defineTable({
  lawId: v.id("laws"),
  structureNodeId: v.optional(v.id("structureNodes")), // which chapter/section this belongs to
  jurisdiction: v.string(),              // denormalized for fast filtering

  number: v.string(),
  // String because numbering is irregular:
  // RO: "188", "1^1" (superscript variants)
  // EU: "6", "17a"
  // DE: "242", "433a"
  // UK: "172"

  title: v.optional(v.string()),
  // RO: "Omorul" / EU: "Lawfulness of processing" / UK: "Duty to promote success"

  content: v.string(),                   // Full plain text (for display and fallback search)

  // Structured breakdown of paragraphs and sub-points
  // Enables precise AI citations: "Art. 188 alin. (1)" or "Art. 6(1)(a)"
  structuredContent: v.array(v.object({
    paragraphNumber: v.string(),         // "(1)", "(2)" / "Abs. 1" / "para. 1"
    text: v.string(),
    subPoints: v.optional(v.array(v.object({
      letter: v.string(),                // "a)", "b)" / "i.", "ii."
      text: v.string(),
      subSubPoints: v.optional(v.array(v.object({  // Some systems go 3 levels deep
        marker: v.string(),
        text: v.string(),
      }))),
    }))),
  })),

  // Multi-language versions (EU laws are authoritative in all 24 languages)
  translations: v.optional(v.array(v.object({
    language: v.string(),
    content: v.string(),
    structuredContent: v.optional(v.any()),
  }))),

  // Amendment status of this specific article
  status: v.union(
    v.literal("in_force"),
    v.literal("repealed"),
    v.literal("substituted"),
  ),

  // Vector embedding for semantic search / RAG
  // Generated from `content` field using the configured embedding model
  // Dimensions: 1536 (OpenAI text-embedding-3-small) or 3072 (text-embedding-3-large)
  // or 768 (Google text-embedding-004)
  embedding: v.optional(v.array(v.number())),
})
.index("by_law", ["lawId"])
.index("by_law_number", ["lawId", "number"])
.index("by_structure_node", ["structureNodeId"])
.index("by_jurisdiction", ["jurisdiction"])
.searchIndex("search_articles", {
  searchField: "content",
  filterFields: ["jurisdiction", "lawId", "status"],
})
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  filterFields: ["jurisdiction", "lawId"],
})
```

---

## Table: `references`

Cross-references between articles. Kept as a separate table (not embedded) so they can be queried bidirectionally — find everything that cites a given article.

```typescript
references: defineTable({
  sourceArticleId: v.id("articles"),
  targetArticleId: v.optional(v.id("articles")),  // internal reference (within DB)
  targetExternal: v.optional(v.string()),          // unstructured external ref not yet in DB
  // e.g. "Art. 5 din Legea nr. 182/2002"

  type: v.union(
    v.literal("cites"),       // General citation / "see also"
    v.literal("amends"),      // This article modifies the target
    v.literal("repeals"),     // This article abrogates the target
    v.literal("implements"),  // This article implements a directive/regulation (EU transposition)
    v.literal("violates"),    // Used in case law / jurisprudence context
  ),

  description: v.optional(v.string()),  // Human-readable note on the relationship
})
.index("by_source", ["sourceArticleId"])
.index("by_target", ["targetArticleId"])
```

---

## Table: `userLawCollections`

User-curated collections for comparison and research sessions.

```typescript
userLawCollections: defineTable({
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  laws: v.array(v.object({
    lawId: v.id("laws"),
    pinnedArticleIds: v.optional(v.array(v.id("articles"))),
    notes: v.optional(v.string()),
  })),
  tags: v.array(v.string()),
  isShared: v.boolean(),
})
.index("by_userId", ["userId"])
```

---

## Key Design Decisions

| Decision | Reasoning |
|---|---|
| Unified tables (not per-country) | Cross-country comparison requires single-query access; Convex has no UNION |
| `structureNodes` separate from `articles` | Navigation (breadcrumb) and content are different concerns; keeps articles lean |
| `type: v.string()` on `laws` (not union) | Law type vocabulary differs per country — a union would need all variants from all jurisdictions hardcoded |
| `structuredContent` nested JSON on articles | Enables precise paragraph/sub-point citations (`Art. 188 alin. (1) lit. a)`) without extra table joins |
| `embedding` on articles (not laws) | RAG retrieval works at article granularity, not whole-law granularity |
| `references` as separate table | Bidirectional queries: "what cites this article?" requires indexing the target side |
| `meta: v.any()` escape hatch on `laws` | Country-specific gazette numbers, chapter references, etc. without schema bloat |
| Denormalized `jurisdiction` on articles/nodes | Avoids chained lookups through `laws` for jurisdiction-filtered searches |

---

## How Country Structures Map to This Schema

| Country | Law `type` examples | `structureNodes` levels | Article citation example |
|---|---|---|---|
| RO | `lege`, `oug`, `hg`, `constitutie` | Parte → Titlu → Capitol → Secțiune | `Art. 188 alin. (1) lit. a) Cod Penal` |
| UK | `statute`, `statutory_instrument` | Part → Chapter → Section | `Companies Act 2006, s. 172(1)` |
| DE | `gesetz`, `verordnung` | Abschnitt → Unterabschnitt | `§ 242 Abs. 1 BGB` |
| EU | `regulation`, `directive`, `treaty` | Title → Chapter | `GDPR, Art. 6(1)(a)` |
| US | `statute`, `regulation` | Title → Chapter → Subchapter | `42 U.S.C. § 1983(a)` |
| FR | `loi`, `code`, `ordonnance` | Livre → Titre → Chapitre | `Art. L. 1221-1 Code du travail` |
| DK | `lov`, `bekendtgørelse` | Kapitel | `§ 23, stk. 1, lov nr. 429` |

---

## Official Data Sources (for import pipeline)

| Jurisdiction | Source | Format |
|---|---|---|
| RO | [legislatie.just.ro](https://legislatie.just.ro) / [monitoruloficial.ro](https://www.monitoruloficial.ro) | HTML scrape |
| EU | [EUR-Lex](https://eur-lex.europa.eu) | XML (Formex 4), REST API |
| UK | [legislation.gov.uk](https://www.legislation.gov.uk) | XML, REST API |
| US | [uscode.house.gov](https://uscode.house.gov) | XML, bulk download |
| DE | [gesetze-im-internet.de](https://www.gesetze-im-internet.de) | XML |
| FR | [legifrance.gouv.fr](https://www.legifrance.gouv.fr) | REST API |
| DK | [retsinformation.dk](https://www.retsinformation.dk) | REST API |

---

## Relationship Diagram

```
jurisdictions (1)
    └── laws (N)                      [by jurisdiction]
            ├── structureNodes (N)    [navigation tree, self-referencing parentId]
            │       └── articles (N)  [belong to a structureNode]
            └── articles (N)          [also indexed directly by law]
                    └── references    [source/target between articles]

users
    └── userLawCollections            [pins laws + articles for comparison]
```
