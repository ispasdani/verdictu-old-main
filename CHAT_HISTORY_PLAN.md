# Chat History & Persistence Implementation Plan

## Current State
- Each chat session is **ephemeral** — messages live only in React state
- Sending a follow-up question loses all previous context (no conversation history passed to the API)
- `chatHistories` table already exists in `convex/schema.ts` but has **no mutations or queries**
- Ghost mode settings are the only thing persisted (via zustand + localStorage)

## Goals
1. Keep full conversation context across follow-up messages (multi-turn)
2. Let users choose storage: **local** (download as `.md`/`.json`) or **cloud** (Convex)
3. Import a previous local chat and continue from where they left off
4. Show a chat history list in the sidebar for cloud-saved chats

---

## Architecture Overview

```
User sends message
       │
       ▼
ChatPage builds full messages[] array (all turns so far)
       │
       ├──► Passes messages[] to /api/agent → Claude sees full context
       │
       └──► Saves to Convex (if cloud mode) OR updates local state for export
```

---

## Step-by-Step Plan

---

### STEP 1 — Multi-Turn Message State in ChatPage
**File:** `app/(agent)/chat/[id]/page.tsx`

**Problem:** The agent currently only sends the current question. Follow-up messages don't include prior conversation history.

**Changes:**
- Add a `messages` state array holding all turns:
  ```typescript
  type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    metadata?: {
      mode: ChatMode;
      jurisdiction: string;
      citationEnabled: boolean;
      steps?: AgentStep[];
      sources?: Source[];
      laws?: LawItem[];
      followUpQuestions?: string[];
      elapsedMs?: number;
    };
    attachments?: { name: string; extractedText: string }[];
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  ```
- On each user submission, **append** the user turn to `messages`
- When agent finishes, **append** the assistant turn to `messages`
- Pass the messages array (just `{role, content}[]`) to the API so Claude has full context

**API Change:** `app/api/agent/route.ts`
- Accept a `conversationHistory` field in the request body
- Prepend prior turns to the Claude API messages array before the current question

---

### STEP 2 — Storage Preference Setting
**New file:** `store/chatStorageStore.ts`

A small zustand store (persisted to localStorage) that tracks the user's choice:

```typescript
type StorageMode = "cloud" | "local" | "none";

interface ChatStorageStore {
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
}
```

This preference is remembered across sessions.

---

### STEP 3 — Storage Preference UI (Settings Modal or Onboarding Prompt)
**Location:** First time a user completes a chat turn, show a one-time prompt:
> "Would you like to save your chat history? **Cloud** (synced across devices via your account) · **Local only** (saved on this device, never uploaded) · **Don't save**"

After first choice, the preference lives in the store. Users can change it in Settings.

**New component:** `components/settings/StoragePreferenceModal.tsx`
- Three options with clear descriptions
- Persists to `chatStorageStore`

---

### STEP 4 — Convex: Chat History Mutations & Queries
**New file:** `convex/chatHistories.ts`

```typescript
// Create a new chat
export const createChat = mutation({ ... })

// Append messages to an existing chat (called after each full turn)
export const appendMessages = mutation({ ... })

// Get a single chat by ID
export const getChat = query({ ... })

// List all chats for a user (for sidebar history list)
export const listChats = query({ ... })

// Delete a chat
export const deleteChat = mutation({ ... })

// Update title (auto-generated from first message)
export const updateTitle = mutation({ ... })
```

Schema is already in place in `convex/schema.ts` — just needs the functions.

**Note on chat IDs:** The current URL is `/chat/[id]` where `id` is likely a random client-side ID. We'll use the Convex document `_id` as the canonical ID. On new chat creation, create the Convex record first and redirect to `/chat/{convexId}`.

---

### STEP 5 — Wire Up Cloud Saving in ChatPage

**File:** `app/(agent)/chat/[id]/page.tsx`

- On page load for a known chat ID → call `getChat` query → hydrate `messages` state (this enables **resuming a cloud chat**)
- After user turn is appended → call `appendMessages` mutation with the user message
- After agent finishes → call `appendMessages` mutation with the assistant message
- On first assistant message → call `updateTitle` mutation with an auto-generated title (first 60 chars of user message, or ask Claude to summarize)

Use `useMutation` and `useQuery` from `convex/react`.

---

### STEP 6 — Local Storage: Export Chat
**New utility:** `lib/chat/exportChat.ts`

Two export formats:

**Markdown export:**
```markdown
# Chat: [Title]
Date: 2026-04-12
Jurisdiction: EU | Mode: General

---

**You:** What are the GDPR requirements for data retention?

**Verdictu:** [answer text]

*Sources: ...*
*Laws: ...*

---

**You:** Can you elaborate on Article 5?
...
```

**JSON export:**
```json
{
  "version": 1,
  "exportedAt": "2026-04-12T...",
  "title": "...",
  "mode": "General",
  "jurisdiction": "eu",
  "messages": [ ... ]
}
```

**UI:** Add a "Download chat" button (↓ icon) in the chat toolbar.

---

### STEP 7 — Import Chat from Local File
**New component:** `components/chat/ImportChatButton.tsx`

- A button that opens a file picker (accepts `.json` only for structured import)
- Parses the JSON, validates the schema (version, messages array)
- On success: loads the messages into state and redirects to a new `/chat/[newId]` with history pre-populated
- The imported chat can then continue as a new cloud or local session

**UI placement:** In the sidebar or on the empty chat/home screen.

---

### STEP 8 — Sidebar: Chat History List (Cloud Mode)
**File:** `components/agent-sections/agent-sidebar.tsx`

- When `storageMode === "cloud"`, show a list of past chats from `listChats` query
- Each item: title, date, mode badge, jurisdiction badge
- Click → navigate to `/chat/{id}` which hydrates from Convex
- Hover → show delete button
- Group by: Today / This Week / Older

---

### STEP 9 — Auto-Title Generation
When the first assistant response completes, generate a short title from the first user message (client-side, no extra API call needed):

```typescript
function generateTitle(userMessage: string): string {
  return userMessage.slice(0, 60).trim() + (userMessage.length > 60 ? "…" : "");
}
```

Optionally: make a lightweight call to Claude to produce a 5-word summary title (async, non-blocking).

---

## Implementation Order

| # | Step | Effort | Value |
|---|------|--------|-------|
| 1 | Multi-turn message state + API history | Medium | Critical — fixes broken follow-ups |
| 2 | `chatStorageStore` preference | Small | Required by steps 3, 5, 6 |
| 4 | Convex mutations/queries | Medium | Required by steps 5, 8 |
| 5 | Wire cloud saving in ChatPage | Medium | Core cloud feature |
| 3 | Storage preference UI | Small | UX — onboarding choice |
| 6 | Local export (Download chat) | Small | Local storage feature |
| 7 | Import chat button | Medium | Completes local storage loop |
| 8 | Sidebar chat history list | Medium | Discovery + navigation |
| 9 | Auto-title | Small | Polish |

---

## Files to Create

```
convex/chatHistories.ts              ← All Convex mutations/queries
store/chatStorageStore.ts            ← Storage mode preference (zustand)
lib/chat/exportChat.ts               ← Markdown + JSON export utilities
lib/chat/importChat.ts               ← JSON import + validation
components/settings/StoragePreferenceModal.tsx
components/chat/ImportChatButton.tsx
components/chat/ExportChatButton.tsx
```

## Files to Modify

```
app/(agent)/chat/[id]/page.tsx       ← Add messages state, cloud save/load, multi-turn
app/api/agent/route.ts               ← Accept + pass conversationHistory to Claude
components/agent-sections/agent-sidebar.tsx  ← Add chat history list (cloud)
convex/schema.ts                     ← (Likely no changes needed — schema exists)
```

---

## Schema Reference (already in convex/schema.ts)

```typescript
chatHistories: defineTable({
  userId: v.id("users"),
  organizationId: v.optional(v.id("organizations")),
  title: v.string(),
  mode: v.union(v.literal("General"), v.literal("Compare"), v.literal("Draft")),
  jurisdiction: v.optional(v.string()),
  citationEnabled: v.boolean(),
  messages: v.array(v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      extractedText: v.string(),
    }))),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

**Decision:** Store only `role` + `content` in Convex (**Option B**).

Reasoning: Steps, sources, and laws are presentational UI artifacts — Claude only needs `role + content` to correctly continue a conversation. Storing them would bloat every message record significantly. The `researchResults` table already exists for research data if we ever want to link back to sources. Schema extension can happen later if replay fidelity becomes a requirement.

The existing schema is therefore sufficient as-is — **no changes needed to `convex/schema.ts`**.

---

## Resolved Decisions

### 1. New chat creation timing
**Decision:** Create the Convex record lazily on first message send, then update message by message.

Flow:
1. User lands on `/chat/new` — no Convex record yet, just client state
2. User sends first message → `createChat` mutation fires, returns `convexId` → URL updates to `/chat/{convexId}`
3. After user turn: `appendMessages` called with user message
4. After agent finishes streaming: `appendMessages` called again with assistant message
5. `updatedAt` is patched on every `appendMessages` call

This avoids creating orphan records for users who open a chat but never send a message.

### 2. Ghost mode and cloud saving
**Decision:** Ghost mode chats are excluded from cloud saving entirely. Only local export (`.json` / `.md`) is offered when Ghost mode is active.

Reasoning: Ghost mode is explicitly privacy-first — the entire point is that nothing leaves the device. Cloud saving would contradict that contract.

Implementation note: In `ChatPage`, when `ghostModeStore.enabled || ghostModeStore.ghostOpenEnabled`, skip all Convex mutations and hide the cloud option in the storage preference UI. Show only the "Download chat" export button.

### 3. Convex metadata (steps, sources, laws)
**Decision:** Store only `role + content` per message — no metadata in Convex.

The existing schema is sufficient. If we later want to show sources for past messages, that is a separate feature tied to the `researchResults` table.
