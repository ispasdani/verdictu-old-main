# Laws Database Schema Design

## Overview

A jurisdiction-aware law database for Verdictu that allows users to select jurisdictions, store laws from multiple countries, and compare/research them side by side.

**Core principle: Jurisdiction config drives display, not schema shape.**

Rather than different tables per country, use a unified schema with a `displayConfig` per jurisdiction and a flexible `hierarchy` path on each section.

---

## Table: `jurisdictions`

Stores how each country's laws are structured and displayed.

```typescript
jurisdictions: defineTable({
  code: v.string(),              // "DK", "DE", "EU", "UK", "US", "FR"
  name: v.string(),              // "Denmark", "European Union"
  type: v.union(
    v.literal("country"),
    v.literal("supranational"),
    v.literal("state")
  ),
  legalSystem: v.union(
    v.literal("civil_law"),      // DE, FR, DK
    v.literal("common_law"),     // UK, US
    v.literal("hybrid"),
    v.literal("supranational")   // EU
  ),
  languages: v.array(v.string()),
  displayConfig: v.object({
    hierarchyLevels: v.array(v.string()),
    // UK: ["Act", "Part", "Chapter", "Section", "Subsection"]
    // DE: ["Gesetz", "Abschnitt", "Paragraph", "Absatz"]
    // EU: ["Regulation/Directive", "Chapter", "Article", "Paragraph"]
    // US: ["Title", "Chapter", "Subchapter", "Section", "Subsection"]

    sectionPrefix: v.string(),   // "§" (DE/DK), "Art." (EU/FR), "s." (UK), "§" (US)
    citationFormat: v.string(),  // template: "{shortTitle}, {prefix}{number}"
    // e.g. UK:  "Companies Act 2006, s. 172"
    // e.g. DE:  "§ 242 BGB"
    // e.g. EU:  "GDPR, Art. 6(1)(a)"
    // e.g. US:  "42 U.S.C. § 1983"

    yearInTitle: v.boolean(),    // UK/US: true ("Companies Act 2006"), DE: false ("BGB")
  }),
})
.index("by_code", ["code"])
```

---

## Table: `laws`

One row per law/act/regulation/code.

```typescript
laws: defineTable({
  jurisdiction: v.string(),      // FK -> jurisdictions.code
  type: v.union(
    v.literal("statute"),        // UK: Acts of Parliament
    v.literal("code"),           // DE: BGB, HGB / FR: Code civil
    v.literal("regulation"),     // EU Regulations (directly binding)
    v.literal("directive"),      // EU Directives
    v.literal("constitution"),
    v.literal("treaty"),
    v.literal("statutory_instrument"), // UK secondary legislation
    v.literal("ordinance"),
  ),
  title: v.string(),             // Full official title
  shortTitle: v.optional(v.string()),  // "GDPR", "BGB", "Companies Act"
  officialId: v.optional(v.string()),  // "2016/679/EU", "2006 c. 46"
  enactedDate: v.optional(v.number()), // timestamp
  effectiveDate: v.optional(v.number()),
  lastAmendedDate: v.optional(v.number()),
  status: v.union(
    v.literal("in_force"),
    v.literal("repealed"),
    v.literal("amended"),
    v.literal("proposed")
  ),
  languages: v.array(v.string()),      // ["en"], ["de"], ["en", "fr", "de"] for EU
  officialUrl: v.optional(v.string()), // Link to eur-lex, legislation.gov.uk, etc.
  summary: v.optional(v.string()),     // AI-generated or editorial
  topics: v.array(v.string()),         // ["contract", "gdpr", "employment", "company"]

  // Country-specific extra metadata as escape hatch
  meta: v.optional(v.any()),
  // UK: { regnal_year: "54 & 55 Vict", chapter: 46 }
  // US: { usc_title: 42, public_law: "117-103" }
  // EU: { ojl_number: "L 119", ojl_page: 1 }
})
.index("by_jurisdiction", ["jurisdiction"])
.index("by_jurisdiction_status", ["jurisdiction", "status"])
.index("by_jurisdiction_type", ["jurisdiction", "type"])
.searchIndex("search_laws", {
  searchField: "title",
  filterFields: ["jurisdiction", "type", "status", "topics"],
})
```

---

## Table: `lawSections`

Each section/article/paragraph within a law. Supports arbitrary depth via `parentId`.

```typescript
lawSections: defineTable({
  lawId: v.id("laws"),
  jurisdiction: v.string(),       // denormalized for fast filtering

  // Hierarchy position
  parentId: v.optional(v.id("lawSections")), // null = top-level
  depth: v.number(),              // 0 = top, 1 = child, etc.
  order: v.number(),              // sibling sort order
  path: v.string(),               // "1.2.3" - for breadcrumb & sorting

  // Section identity
  level: v.string(),              // "part" | "chapter" | "article" | "section" | "paragraph" | "subsection"
  number: v.string(),             // "6", "172", "242", "1(a)", "L.1221-1"
  title: v.optional(v.string()),  // Some sections have headings, many don't

  // Content
  content: v.string(),            // Full text of this section
  contentHtml: v.optional(v.string()), // Formatted version if available

  // Multi-language support (EU laws, bilingual countries)
  translations: v.optional(v.array(v.object({
    language: v.string(),
    content: v.string(),
  }))),

  // Cross-references to other sections (same or different law)
  crossRefs: v.optional(v.array(v.object({
    lawId: v.id("laws"),
    sectionId: v.optional(v.id("lawSections")),
    refType: v.string(),          // "amends", "repeals", "see_also", "implements"
    label: v.optional(v.string()),
  }))),

  // Amendment tracking
  amendedBy: v.optional(v.array(v.object({
    lawId: v.id("laws"),
    date: v.number(),
    description: v.string(),
  }))),

  status: v.union(
    v.literal("in_force"),
    v.literal("repealed"),
    v.literal("substituted")
  ),
})
.index("by_law", ["lawId"])
.index("by_law_path", ["lawId", "path"])
.index("by_parent", ["parentId"])
.index("by_jurisdiction", ["jurisdiction"])
.searchIndex("search_sections", {
  searchField: "content",
  filterFields: ["jurisdiction", "lawId", "level", "status"],
})
```

---

## Table: `userLawCollections`

User-curated collections for comparison and research.

```typescript
userLawCollections: defineTable({
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  laws: v.array(v.object({
    lawId: v.id("laws"),
    sectionIds: v.optional(v.array(v.id("lawSections"))), // pinned sections
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
| Single `lawSections` table with `parentId` + `path` | Handles any depth (UK has 5 levels, EU has 3, US has 6+) without schema changes |
| `path` string ("1.2.3") | Lets you query entire subtrees with a prefix search, and sort correctly |
| `displayConfig` on `jurisdictions` | Country-specific rendering logic lives in data, not code |
| `meta: v.any()` escape hatch on `laws` | Stores country-specific IDs (regnal years, OJ numbers) without schema bloat |
| `translations[]` on sections | EU laws are legally authoritative in all 24 languages |
| Denormalized `jurisdiction` on sections | Avoids joining through `laws` for jurisdiction-filtered searches |

---

## How Country Differences Map to This Schema

| Country | `type` | `hierarchyLevels` | Citation example |
|---|---|---|---|
| UK | `statute` | Act → Part → Chapter → Section → Subsection | `Companies Act 2006, s. 172` |
| DE | `code` | Gesetz → Abschnitt → § → Absatz | `§ 242 BGB` |
| EU | `regulation` / `directive` | Title → Chapter → Article → Paragraph | `GDPR, Art. 6(1)(a)` |
| US | `statute` | Title → Chapter → Section | `42 U.S.C. § 1983` |
| FR | `code` | Livre → Titre → Chapitre → Article | `Art. L. 1221-1 Code du travail` |
| DK | `statute` | Lov → Kapitel → § → Stk | `§ 23, stk. 1, lov nr. 429` |

---

## Official Data Sources (for import pipeline)

| Jurisdiction | Source | Format |
|---|---|---|
| EU | [EUR-Lex](https://eur-lex.europa.eu) | XML (Formex 4), REST API |
| UK | [legislation.gov.uk](https://www.legislation.gov.uk) | XML, REST API |
| US | [uscode.house.gov](https://uscode.house.gov) | XML, bulk download |
| DE | [gesetze-im-internet.de](https://www.gesetze-im-internet.de) | XML |
| FR | [legifrance.gouv.fr](https://www.legifrance.gouv.fr) | REST API |
| DK | [retsinformation.dk](https://www.retsinformation.dk) | REST API |
