# Ghost API Mode — Implementation Plan & Billing Design

## What We're Building

An optional "Ghost API" mode that gives users the full power of a large cloud model (DeepSeek-R1 via OpenRouter) while keeping the same always-on defense stance as Ghost Mode. Users pay for it through a credit system — they buy credits, each Ghost API query costs credits, when they run out they top up. Exactly like Lovable.dev.

Local WebLLM (Ghost Mode) stays free and private. Ghost API Mode is the paid upgrade for users who want better quality without the hardware requirement.

---

## Current State (What Already Exists)

The billing infrastructure is already scaffolded but never wired up:

| What | Location | Status |
|------|----------|--------|
| `credits` field on users | `convex/schema.ts:16` | ✅ Exists |
| `subscriptionTier` field | `convex/schema.ts:17` | ✅ Exists |
| `deductCredits` mutation | `convex/users.ts:134` | ✅ Implemented, never called |
| `addCredits` mutation | `convex/users.ts:166` | ✅ Implemented, never called |
| `getCreditBalance` query | `convex/users.ts:194` | ✅ Implemented, never called |
| `checkFreeTierLimits` query | `convex/users.ts:270` | ✅ Implemented, never called |
| Token counts from API | `lib/ai/providers.ts:104` | ✅ Captured, never used |
| Auth on `/api/agent` | `app/api/agent/route.ts` | ❌ None — open endpoint |
| Payment processor | anywhere | ❌ None |

We don't need to build the credit system from scratch — we need to wire it up and add payments.

---

## The Credit Model

### How Credits Work

**1 credit = 1 Ghost API query.**

Simple for users to understand. No token math, no complexity. When you run a Ghost API query, 1 credit is deducted regardless of model, query length, or response length. We absorb the variance.

Why flat-rate per query:
- Users understand it immediately ("I have 47 credits left")
- No unpleasant surprises (unlike AWS token billing)
- Lovable.dev uses this model and users love it
- We price the credit to cover P95 cost + margin, which is fine

### Credit Costs (Internal)

Using DeepSeek-R1 via OpenRouter as the default model:

| | Rate | Typical per query |
|--|------|-------------------|
| Input tokens | ~$0.55/M | ~2000 tokens → $0.0011 |
| Output tokens | ~$2.19/M | ~3500 tokens → $0.0077 |
| **Total cost** | | **~$0.009 per query** |
| **At 3× margin** | | **~€0.025–0.03 per query** |

A credit pack sold at **€10 for 300 credits** = €0.033/credit → good margin at $0.009 cost.

### Credit Packs (What Users Buy)

| Pack | Price | Credits | Per credit |
|------|-------|---------|------------|
| Starter | €5 | 150 | €0.033 |
| Standard | €10 | 350 | €0.029 |
| Power | €25 | 1,000 | €0.025 |
| Enterprise | €100 | 5,000 | €0.020 |

Credits have a **12-month expiry** (already promised in the pricing FAQ).

### Monthly Subscription Includes Credits

| Plan | Monthly | Included Ghost API credits |
|------|---------|---------------------------|
| Free | €0 | 0 (local Ghost Mode only) |
| Basic | €9/mo | 30 credits/month |
| Pro | €29/mo | 150 credits/month |
| Business | Custom | Custom |

Unused subscription credits reset monthly (or roll over — TBD business decision). Purchased top-up credits expire after 12 months.

---

## Architecture

```
User clicks "Ghost API" query
        │
        ▼
/api/ghost-api (Next.js route)
        │
        ├─ 1. Verify Clerk JWT → get clerkId
        ├─ 2. Convex: getCreditBalance(clerkId)
        ├─ 3. If credits < 1 → return 402 with upgrade URL
        ├─ 4. Convex: reserveCredit(clerkId) — optimistic lock
        │
        ▼
  OpenRouter API (DeepSeek-R1)
  ghostModePrompt() — same as local Ghost Mode
  SSE streaming back to client
        │
        ▼
  On completion:
        ├─ 5. Convex: deductCredits(clerkId, 1)
        ├─ 6. Convex: logUsage(clerkId, tokens, model, cost)
        └─ 7. Stream "done" event with credits_remaining
```

The Ghost Mode pipeline in `lib/ghost/agent.ts` stays entirely unchanged — we just add a parallel route that uses OpenRouter instead of the local engine.

---

## Implementation Steps

### Step 1 — OpenRouter API Integration

**New file: `lib/ghost/openrouter.ts`**

OpenRouter uses the OpenAI-compatible API format. Dead simple integration:

```typescript
// lib/ghost/openrouter.ts
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const GHOST_API_MODELS = [
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    description: "Best reasoning — chain-of-thought, finds legal gaps systematically",
    creditsPerQuery: 1,
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    description: "Fast, capable, open-source. Good general defense analysis.",
    creditsPerQuery: 1,
  },
  {
    id: "mistralai/mistral-large",
    name: "Mistral Large",
    description: "European model — GDPR-aligned, strong legal reasoning.",
    creditsPerQuery: 1,
  },
];

export async function streamOpenRouter({
  messages,
  model = "deepseek/deepseek-r1",
  onToken,
  onDone,
  signal,
}: {
  messages: { role: string; content: string }[];
  model?: string;
  onToken: (token: string) => void;
  onDone: (usage: { inputTokens: number; outputTokens: number }) => void;
  signal?: AbortSignal;
}) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://verdictu.com",
      "X-Title": "Verdictu Ghost API",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4000,
      temperature: 0.4,
    }),
    signal,
  });

  // Parse SSE stream, emit tokens, collect usage
  // ... standard SSE reader logic (same pattern as /api/agent)
  // Return { inputTokens, outputTokens } from the [DONE] chunk
}
```

**Env var to add:** `OPENROUTER_API_KEY` in `.env.local` and production env.

---

### Step 2 — Ghost API Route

**New file: `app/api/ghost-api/route.ts`**

This route is the server-side equivalent of what the local Ghost Mode does in the browser. It reuses the same agent logic but calls OpenRouter instead of WebLLM.

```typescript
// app/api/ghost-api/route.ts
// Accepts same body as Ghost Mode agent
// Adds: auth check, credit check, credit deduction, usage logging
// Returns: same SSE event stream as the normal agent

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  // 1. Auth — get Clerk user
  const { userId } = await auth(); // Clerk auth helper
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // 2. Check credits via Convex
  const balance = await convex.query(api.users.getCreditBalance, { clerkId: userId });
  if (balance < 1) {
    return new Response(JSON.stringify({ error: "insufficient_credits" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Run the ghost agent pipeline with OpenRouter instead of local LLM
  //    Same ghostModePrompt(), same search, same SSE events
  //    ...

  // 4. On completion: deduct 1 credit, log usage
  await convex.mutation(api.users.deductCredits, { userId: convexUserId, amount: 1 });
  await convex.mutation(api.usage.logGhostApiQuery, { ... });
}
```

**Important:** Credit is deducted AFTER a successful response, not before. If OpenRouter fails, the user doesn't lose a credit.

---

### Step 3 — Convex: Usage Logging Table

**Add to `convex/schema.ts`:**

```typescript
ghostApiUsage: defineTable({
  userId: v.id("users"),
  model: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  creditsCost: v.number(),      // always 1 for now
  queryCostUsd: v.number(),     // actual OpenRouter cost in USD (for margin tracking)
  jurisdiction: v.string(),
  createdAt: v.number(),
}).index("by_user", ["userId", "createdAt"]),

creditTransactions: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("purchase"),      // user bought a pack
    v.literal("subscription"),  // monthly grant from plan
    v.literal("usage"),         // Ghost API query
    v.literal("refund"),
    v.literal("promo"),
  ),
  amount: v.number(),           // positive = added, negative = deducted
  balanceAfter: v.number(),
  stripePaymentIntentId: v.optional(v.string()),
  expiresAt: v.optional(v.number()),  // for purchased credits (12-month expiry)
  createdAt: v.number(),
}).index("by_user", ["userId", "createdAt"]),
```

---

### Step 4 — Stripe Integration

**Library:** `stripe` npm package (already common in Next.js stacks)

**Flow:**

```
User clicks "Buy Credits" → picks a pack
        │
        ▼
POST /api/billing/checkout
  → Create Stripe Checkout Session (one-time payment)
  → Return checkout URL
        │
        ▼
User completes payment on Stripe hosted page
        │
        ▼
Stripe webhook → POST /api/billing/webhook
  → Verify signature
  → Read metadata: { clerkId, creditAmount, packName }
  → Convex: addCredits(clerkId, creditAmount)
  → Convex: logCreditTransaction(purchase, +creditAmount)
        │
        ▼
User sees updated balance in UI
```

**New routes:**
- `app/api/billing/checkout/route.ts` — creates Stripe Checkout Session
- `app/api/billing/webhook/route.ts` — handles `payment_intent.succeeded`

**Env vars to add:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Stripe products to create (one-time, not subscriptions):**
```
Price ID: price_starter_150    → €5,  metadata: { credits: 150 }
Price ID: price_standard_350   → €10, metadata: { credits: 350 }
Price ID: price_power_1000     → €25, metadata: { credits: 1000 }
Price ID: price_enterprise_5k  → €100, metadata: { credits: 5000 }
```

---

### Step 5 — Ghost Mode UI: Toggle Between Local and API

**Update `components/ghost/GhostModeToggle.tsx`**

Add a second toggle row inside the Ghost Mode panel:

```
[Ghost] ●  [Qwen3 1.7B ▾]          ← current local model selector

         ⚡ Use Ghost API instead
         Powered by DeepSeek R1 · 1 credit per query · 47 credits remaining
         [Buy more credits]
```

The toggle switches `ghostMode: "local" | "api"` in the ghost store.

**Update `store/ghostModeStore.ts`:**
```typescript
ghostApiEnabled: boolean         // whether to use API instead of local
selectedApiModel: string         // which OpenRouter model
```

---

### Step 6 — Credit Balance Display & Buy Flow

**New component: `components/ghost/GhostCredits.tsx`**

Shows in the Ghost Mode panel when API mode is selected:
- Current balance (live from Convex)
- "Buy more" button → opens credit pack modal
- Warning when balance is low (< 10 credits)
- Error state when balance is 0

**New page: `app/(marketing)/credits/page.tsx`** (or modal)

Credit pack selection UI with Stripe Checkout redirect.

---

### Step 7 — Wire Credit Check into the Chat Page

**Update `app/(agent)/chat/[id]/page.tsx`**

When Ghost API mode is active, before starting the run:
1. Check credit balance from store (cached from Convex)
2. If 0 → show "Buy credits" prompt instead of running
3. After `done` event → decrement local credit count optimistically
4. Refresh actual balance from Convex after completion

---

### Step 8 — Protect the Normal Agent Route (Optional, Later)

**Update `app/api/agent/route.ts`**

The existing cloud agent route is completely open — no auth, no credit checks. This should eventually be gated too (per the pricing plan: free tier = 50 queries/month). This is lower priority than getting Ghost API working but should be on the roadmap.

```typescript
// Future: check subscriptionTier and free tier limits
const limits = await convex.query(api.users.checkFreeTierLimits, { clerkId });
if (tier === "free" && limits.chatQueries >= 50) {
  return Response.json({ error: "free_limit_reached" }, { status: 402 });
}
```

---

## Build Order (Recommended)

```
Phase 1 — OpenRouter works, credits are deducted (no payment yet)
  Step 1: lib/ghost/openrouter.ts
  Step 2: app/api/ghost-api/route.ts
  Step 5: UI toggle (local vs. API)
  Test: manually add credits to a user in Convex dashboard, verify deduction

Phase 2 — Users can buy credits
  Step 3: Convex schema additions (ghostApiUsage, creditTransactions)
  Step 4: Stripe checkout + webhook
  Step 6: Credit balance UI + buy flow
  Test: full purchase flow in Stripe test mode

Phase 3 — Polish and enforcement
  Step 7: Credit check before run, optimistic UI update
  Step 8: Gate the normal agent route for free tier
```

---

## Environment Variables Needed

```bash
# Already exists
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
TAVILY_API_KEY=

# New
OPENROUTER_API_KEY=        # from openrouter.ai → Keys
STRIPE_SECRET_KEY=          # from Stripe dashboard → API Keys
STRIPE_WEBHOOK_SECRET=      # from Stripe dashboard → Webhooks
STRIPE_PRICE_STARTER=       # price_xxx from Stripe
STRIPE_PRICE_STANDARD=
STRIPE_PRICE_POWER=
STRIPE_PRICE_ENTERPRISE=
```

---

## Key Decisions Still Open

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Default API model | DeepSeek R1, Llama 3.1 70B, Mistral Large | DeepSeek R1 — best reasoning for legal gap-finding |
| Credit expiry | 12 months / never | 12 months (already promised in FAQ) |
| Unused subscription credits | Reset monthly / roll over | Reset monthly (standard SaaS, simpler) |
| Deduct on start or on completion | Start / Completion | Completion — user doesn't lose credit if API fails |
| Free tier Ghost API | 0 / 3 trial credits | 3 free credits on signup (lowers barrier to try) |
| Model switching for users | Fixed to R1 / let them pick | Let them pick (OpenRouter makes this easy) |

---

## What Does NOT Change

- `lib/ghost/agent.ts` — unchanged, reused as-is for Ghost API with a different `generate` function
- `lib/ghost/models.ts` — local WebLLM models stay exactly as they are
- `lib/ai/prompts.ts` — `ghostModePrompt()` is reused exactly
- `hooks/useGhostLLM.ts` — local WebLLM engine unchanged
- The local Ghost Mode remains 100% free, 100% private

The Ghost API is purely additive — a second path through the same prompts and logic, backed by a cloud model instead of the local engine.
