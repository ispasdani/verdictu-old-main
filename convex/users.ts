import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Query to get a user by their clerkId
export const getUserById = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();
    return user; // Returns null if not found
  },
});

// Query to get a user by their email
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    return user; // Returns null if not found
  },
});

// Mutation to create a new user (triggered by Clerk webhook)
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    name: v.string(),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("premium"),
      v.literal("business"),
    ),
    jurisdiction: v.optional(v.string()),
    credits: v.number(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      throw new ConvexError("User with this clerkId already exists");
    }

    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      imageUrl: args.imageUrl,
      name: args.name,
      subscriptionTier: args.subscriptionTier,
      jurisdiction: args.jurisdiction || "",
      credits: args.credits,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Mutation to update an existing user
export const updateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    name: v.string(),
    subscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("premium"), v.literal("business")),
    ),
    jurisdiction: v.optional(v.string()),
    credits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const updatePayload: Record<string, any> = { updatedAt: Date.now() };

    if (args.email !== undefined) {
      updatePayload.email = args.email;
    }
    if (args.subscriptionTier !== undefined) {
      updatePayload.subscriptionTier = args.subscriptionTier;
    }
    if (args.jurisdiction !== undefined) {
      updatePayload.jurisdiction = args.jurisdiction;
    }
    if (args.credits !== undefined) {
      updatePayload.credits = args.credits;
    }
    if (args.imageUrl !== undefined) {
      updatePayload.imageUrl = args.imageUrl;
    }
    if (args.name !== undefined) {
      updatePayload.name = args.name;
    }

    await ctx.db.patch(user._id, updatePayload);
  },
});

// Mutation to delete a user by their clerkId
export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.delete(user._id);
  },
});

// Mutation to deduct credits from a user (e.g., for template purchases or premium analysis)
export const deductCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (args.amount < 0) {
      throw new ConvexError("Amount must be non-negative");
    }

    if (user.credits < args.amount) {
      throw new ConvexError("Insufficient credits");
    }

    const newCredits = user.credits - args.amount;

    await ctx.db.patch(args.userId, {
      credits: newCredits,
      updatedAt: Date.now(),
    });

    return newCredits;
  },
});

// Mutation to add credits to a user (e.g., for purchases, refunds, or promotions)
export const addCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (args.amount < 0) {
      throw new ConvexError("Amount must be non-negative");
    }

    const newCredits = user.credits + args.amount;

    await ctx.db.patch(args.userId, {
      credits: newCredits,
      updatedAt: Date.now(),
    });

    return newCredits;
  },
});

// Query to get user's current credit balance
export const getCreditBalance = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      return 0;
    }

    return user.credits;
  },
});

// Query to get user's subscription tier
export const getSubscriptionTier = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      return "free"; // Default to free if user not found
    }

    return user.subscriptionTier;
  },
});

// Query to get user's jurisdiction
export const getJurisdiction = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      return ""; // Return empty string if no jurisdiction set
    }

    return user.jurisdiction || "";
  },
});

// Mutation to update user's jurisdiction
export const updateJurisdiction = mutation({
  args: {
    clerkId: v.string(),
    jurisdiction: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(user._id, {
      jurisdiction: args.jurisdiction,
      updatedAt: Date.now(),
    });

    return args.jurisdiction;
  },
});

// Query to check if user has exceeded free tier limits
export const checkFreeTierLimits = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user || user.subscriptionTier !== "free") {
      return { chatQueries: 0, researchQueries: 0 };
    }

    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago

    // Count chat queries
    const chatQueriesCount = await ctx.db
      .query("chatHistories")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .filter((q) => q.gte(q.field("createdAt"), oneMonthAgo))
      .collect()
      .then((chats) => chats.length);

    // Count research queries
    const researchQueriesCount = await ctx.db
      .query("researchResults")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .filter((q) => q.gte(q.field("createdAt"), oneMonthAgo))
      .collect()
      .then((results) => results.length);

    return {
      chatQueries: chatQueriesCount,
      researchQueries: researchQueriesCount,
    };
  },
});
