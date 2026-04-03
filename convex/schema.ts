import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Schema for Verdictu — Legal AI Agent
export default defineSchema({
  // Users table (managed by Clerk, mirrored here for app-specific data)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    name: v.string(),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("premium"),
      v.literal("business"),
    ),
    jurisdiction: v.optional(v.string()), // User's default jurisdiction (e.g. "dk", "eu")
    credits: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // Chat sessions — each chat is a conversation with the legal AI agent
  chatHistories: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    title: v.string(), // AI-generated or user-set title shown in sidebar
    mode: v.union(
      v.literal("General"),
      v.literal("Compare"),
      v.literal("Draft"),
    ), // Chat input mode
    jurisdiction: v.optional(v.string()), // Jurisdiction selected for this chat
    citationEnabled: v.boolean(), // Whether citations were enabled
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
        // Attached documents (extracted client-side, no file stored)
        attachments: v.optional(
          v.array(
            v.object({
              name: v.string(), // Original file name
              extractedText: v.string(), // Text extracted client-side
            }),
          ),
        ),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"]),

  // Research results — for Case Research feature and agent web search steps
  researchResults: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    chatHistoryId: v.optional(v.id("chatHistories")), // Link to chat session if triggered from one
    query: v.string(),
    summary: v.optional(v.string()), // AI-generated summary (may not be ready yet)
    sources: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        domain: v.optional(v.string()),
        type: v.optional(v.string()), // e.g. "Legislation", "Regulator", "Legal Publisher"
      }),
    ),
    jurisdiction: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_chatHistoryId", ["chatHistoryId"])
    .searchIndex("search_query", { searchField: "query" }),

  // Organizations — for workspace/team collaboration (Personal, Acme Law, etc.)
  organizations: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  // Organization members — role-based access per workspace
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"]),

  // ─── Laws Database ────────────────────────────────────────────────────────

  // Display and citation config per jurisdiction
  jurisdictions: defineTable({
    code: v.string(), // "RO", "DK", "DE", "EU", "UK", "US", "FR", "SE", "NL"
    name: v.string(), // "Romania", "European Union"
    type: v.union(
      v.literal("country"),
      v.literal("supranational"),
      v.literal("state"),
    ),
    legalSystem: v.union(
      v.literal("civil_law"), // RO, DE, FR, DK, SE, NL
      v.literal("common_law"), // UK, US
      v.literal("hybrid"),
      v.literal("supranational"), // EU
    ),
    languages: v.array(v.string()),
    displayConfig: v.object({
      // Labels per hierarchy depth — e.g. RO: ["Parte","Titlu","Capitol","Secțiune"]
      hierarchyLevels: v.array(v.string()),
      // Prefix before article number — "Art." (RO/EU/FR), "§" (DE/DK/US), "s." (UK)
      articlePrefix: v.string(),
      // Paragraph label in citations — "alin." (RO), "Abs." (DE), "para." (EU/UK)
      paragraphPrefix: v.string(),
      // Citation template with {shortTitle}, {number}, {paragraph} placeholders
      // RO: "Art. {number} alin. {paragraph} din {title}"
      // DE: "§ {number} Abs. {paragraph} {shortTitle}"
      // EU: "{shortTitle}, Art. {number}({paragraph})"
      // UK: "{title} {year}, s. {number}({paragraph})"
      citationFormat: v.string(),
      // UK/US: true ("Companies Act 2006"), DE/RO: false ("BGB", "Codul Penal")
      yearInTitle: v.boolean(),
    }),
  }).index("by_code", ["code"]),

  // One row per law/act/regulation/code
  laws: defineTable({
    jurisdiction: v.string(), // FK -> jurisdictions.code
    // Unified type across all jurisdictions — kept as string to avoid hardcoding
    // all country variants. RO: lege|oug|hg|constitutie, EU: regulation|directive|treaty
    // UK: statute|statutory_instrument, DE: gesetz|verordnung, US: statute|regulation
    type: v.string(),
    title: v.string(),
    shortTitle: v.optional(v.string()), // "Codul Penal", "GDPR", "BGB", "Companies Act"
    officialNumber: v.optional(v.string()), // "Legea nr. 286/2009", "2016/679/EU"
    publicationDate: v.optional(v.number()), // timestamp — date in official gazette
    effectiveDate: v.optional(v.number()), // timestamp — date entered into force
    lastAmendedDate: v.optional(v.number()), // timestamp — date of last consolidation
    status: v.union(
      v.literal("in_force"),
      v.literal("repealed"),
      v.literal("amended"), // in force but modified
      v.literal("pending"), // passed but not yet in force
    ),
    languages: v.array(v.string()), // ["ro"], ["de"], ["en","fr","de"] for EU
    sourceUrl: v.optional(v.string()),
    summary: v.optional(v.string()), // AI-generated or editorial
    topics: v.array(v.string()), // ["penal", "contract", "gdpr", "employment"]
    // Escape hatch for country-specific metadata
    // RO: { monitorul_oficial: "M. Of. nr. 510/2009", emitent: "Parlament" }
    // EU: { oj_series: "L", oj_number: "119", oj_page: 1 }
    // UK: { regnal_year: "54 & 55 Vict", chapter: 46 }
    meta: v.optional(v.any()),
  })
    .index("by_jurisdiction", ["jurisdiction"])
    .index("by_jurisdiction_status", ["jurisdiction", "status"])
    .index("by_jurisdiction_type", ["jurisdiction", "type"])
    .index("by_officialNumber", ["officialNumber"])
    .searchIndex("search_laws", {
      searchField: "title",
      filterFields: ["jurisdiction", "type", "status"],
    }),

  // Navigation hierarchy within a law (Part > Title > Chapter > Section)
  // Container nodes only — not content. Used for breadcrumb and tree navigation.
  structureNodes: defineTable({
    lawId: v.id("laws"),
    jurisdiction: v.string(), // denormalized for fast filtering
    parentId: v.optional(v.id("structureNodes")), // null = top-level
    order: v.number(), // sibling sort order
    // Level label matches jurisdictions.displayConfig.hierarchyLevels
    // RO: "parte"|"titlu"|"capitol"|"sectiune"
    // UK: "part"|"chapter"|"section"
    // EU: "title"|"chapter"
    level: v.string(),
    name: v.string(), // "Capitolul I - Infracțiuni contra vieții"
  })
    .index("by_law", ["lawId"])
    .index("by_law_parent", ["lawId", "parentId"])
    .index("by_jurisdiction", ["jurisdiction"]),

  // Atomic content unit — the level at which AI cites and users read
  articles: defineTable({
    lawId: v.id("laws"),
    structureNodeId: v.optional(v.id("structureNodes")), // chapter/section this belongs to
    jurisdiction: v.string(), // denormalized for fast filtering
    // String because numbering is irregular: RO "1^1", EU "17a", DE "433a"
    number: v.string(),
    title: v.optional(v.string()), // "Omorul" / "Lawfulness of processing"
    content: v.string(), // full plain text for display and fallback search
    // Structured paragraphs + sub-points for precise AI citations
    // Enables "Art. 188 alin. (1) lit. a)" or "Art. 6(1)(a)"
    structuredContent: v.array(
      v.object({
        paragraphNumber: v.string(), // "(1)", "Abs. 1", "para. 1"
        text: v.string(),
        subPoints: v.optional(
          v.array(
            v.object({
              letter: v.string(), // "a)", "b)", "i."
              text: v.string(),
              subSubPoints: v.optional(
                v.array(
                  v.object({
                    marker: v.string(),
                    text: v.string(),
                  }),
                ),
              ),
            }),
          ),
        ),
      }),
    ),
    // Multi-language versions — EU laws authoritative in all 24 languages
    translations: v.optional(
      v.array(
        v.object({
          language: v.string(),
          content: v.string(),
          structuredContent: v.optional(v.any()),
        }),
      ),
    ),
    status: v.union(
      v.literal("in_force"),
      v.literal("repealed"),
      v.literal("substituted"),
    ),
    // Vector embedding for semantic search / RAG (generated from content field)
    // 1536 dims = OpenAI text-embedding-3-small, 3072 = text-embedding-3-large
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
    }),

  // Cross-references between articles — separate table for bidirectional queries
  references: defineTable({
    sourceArticleId: v.id("articles"),
    targetArticleId: v.optional(v.id("articles")), // internal ref (within DB)
    targetExternal: v.optional(v.string()), // unstructured ref not yet in DB
    type: v.union(
      v.literal("cites"), // general citation / see also
      v.literal("amends"), // this article modifies the target
      v.literal("repeals"), // this article abrogates the target
      v.literal("implements"), // EU transposition
      v.literal("violates"), // jurisprudence context
    ),
    description: v.optional(v.string()),
  })
    .index("by_source", ["sourceArticleId"])
    .index("by_target", ["targetArticleId"]),

  // User-curated law collections for comparison and research sessions
  userLawCollections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    laws: v.array(
      v.object({
        lawId: v.id("laws"),
        pinnedArticleIds: v.optional(v.array(v.id("articles"))),
        notes: v.optional(v.string()),
      }),
    ),
    tags: v.array(v.string()),
    isShared: v.boolean(),
  }).index("by_userId", ["userId"]),
});
