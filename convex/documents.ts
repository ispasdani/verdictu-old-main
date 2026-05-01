import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── Article search ───────────────────────────────────────────────────────────

// Full-text search over the law articles table.
// Returns up to `limit` articles with their parent law metadata for citations.
export const searchArticles = query({
  args: {
    queryText: v.string(),
    jurisdiction: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { queryText, jurisdiction, limit = 5 }) => {
    const results = await ctx.db
      .query("articles")
      .withSearchIndex("search_articles", (q) => {
        const base = q.search("content", queryText);
        return jurisdiction ? base.eq("jurisdiction", jurisdiction) : base;
      })
      .take(limit);

    return Promise.all(
      results.map(async (article) => {
        const law = await ctx.db.get(article.lawId);
        return {
          articleId: article._id,
          number: article.number,
          title: article.title ?? null,
          content: article.content,
          jurisdiction: article.jurisdiction,
          status: article.status,
          lawTitle: law?.title ?? "",
          lawShortTitle: law?.shortTitle ?? null,
          officialNumber: law?.officialNumber ?? null,
        };
      }),
    );
  },
});

// ─── Document search ──────────────────────────────────────────────────────────

// Full-text search over a user's stored precedent documents.
export const searchDocuments = query({
  args: {
    userId: v.id("users"),
    queryText: v.string(),
    jurisdiction: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, queryText, jurisdiction, limit = 3 }) => {
    const results = await ctx.db
      .query("documents")
      .withSearchIndex("search_documents", (q) => {
        const base = q.search("content", queryText).eq("userId", userId);
        return jurisdiction ? base.eq("jurisdiction", jurisdiction) : base;
      })
      .take(limit);

    return results.map((doc) => ({
      documentId: doc._id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      parties: doc.parties,
      jurisdiction: doc.jurisdiction,
      tags: doc.tags,
      createdAt: doc.createdAt,
    }));
  },
});

// List all documents for a user (optionally filtered by jurisdiction).
export const listDocuments = query({
  args: {
    userId: v.id("users"),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, { userId, jurisdiction }) => {
    const all = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return jurisdiction
      ? all.filter((d) => d.jurisdiction === jurisdiction)
      : all;
  },
});

// ─── Document mutations ───────────────────────────────────────────────────────

// Save a document or precedent to the Convex store (Sync mode users only).
export const saveDocument = mutation({
  args: {
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    title: v.string(),
    type: v.union(
      v.literal("contract"),
      v.literal("memo"),
      v.literal("brief"),
      v.literal("precedent"),
    ),
    content: v.string(),
    embedding: v.optional(v.array(v.number())),
    parties: v.array(v.string()),
    jurisdiction: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("documents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("documents"), userId: v.id("users") },
  handler: async (ctx, { documentId, userId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId) return;
    await ctx.db.delete(documentId);
  },
});
