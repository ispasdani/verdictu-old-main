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
});
