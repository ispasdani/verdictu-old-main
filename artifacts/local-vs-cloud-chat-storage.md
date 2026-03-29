# Local vs Cloud Chat Storage
**Feature Plan: User-Controlled Chat Persistence**

---

## What the Feature Does

The user gets a choice at the start of a chat (or in settings):

- **Cloud (Convex)** — chat is saved to their account, accessible from any device, visible in the sidebar
- **Local (device)** — chat is never sent to Convex, downloaded as a `.verdictu` file to their laptop, importable back into the app later

Both paths use the **same underlying data format**, so export/import is lossless.

---

## The File Format

Use a custom `.verdictu` JSON file. It maps directly to the existing `chatHistories` Convex schema, with one extra field to identify it:

```typescript
// types/localChat.ts

export type LocalChatFile = {
  __verdictu_version: "1.0";       // For future format migrations
  exportedAt: number;              // Unix timestamp of export
  title: string;
  mode: "General" | "Compare" | "Draft";
  jurisdiction?: string;
  citationEnabled: boolean;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    attachments?: Array<{
      name: string;
      extractedText: string;       // Only text, never the raw file
    }>;
  }>;
  sources?: Array<{                // Optional: research results
    url: string;
    title: string;
    domain: string;
    snippet: string;
  }>;
};
```

> **Why a custom extension?** `.verdictu` makes it unambiguous — the user knows exactly what this file is for, and the OS associates it with the app. Under the hood it is plain JSON.

---

## Architecture

```
User starts a new chat
        ↓
[ Storage selector modal ]
┌─────────────────┬──────────────────────┐
│  ☁ Cloud Save  │  💾 Save Locally     │
│  (Convex)       │  (.verdictu file)    │
└─────────────────┴──────────────────────┘
        ↓                    ↓
Saves to Convex DB    Held in memory only
Appears in sidebar    Auto-downloaded on end
Syncs across devices  Stays on this device
        ↓                    ↓
        └──────── Both render identically in the chat UI ────────┘
```

---

## Implementation

### Step 1 — Storage Mode in Zustand Store

Add a `storageMode` field to the existing `chatComposerStore.ts`:

```typescript
// store/chatComposerStore.ts (addition)

type StorageMode = "cloud" | "local";

type ComposerState = {
  // ... existing fields ...
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
};
```

### Step 2 — Storage Selector UI

Show a modal or pill-toggle when the user starts a new chat:

```tsx
// components/agent-general/StorageSelector.tsx

export function StorageSelector() {
  const { storageMode, setStorageMode } = useChatComposerStore();

  return (
    <div className="flex gap-2 items-center text-sm text-muted-foreground">
      <button
        onClick={() => setStorageMode("cloud")}
        className={cn("flex items-center gap-1 px-3 py-1 rounded-full border",
          storageMode === "cloud" ? "border-primary text-primary" : "border-border")}
      >
        <Cloud size={14} /> Cloud
      </button>
      <button
        onClick={() => setStorageMode("local")}
        className={cn("flex items-center gap-1 px-3 py-1 rounded-full border",
          storageMode === "local" ? "border-primary text-primary" : "border-border")}
      >
        <HardDrive size={14} /> Local only
      </button>
    </div>
  );
}
```

Place it in the chat header or in `aiChatInput.tsx` near the mode selector.

### Step 3 — Export Utility

```typescript
// lib/exportChat.ts

import type { LocalChatFile } from "@/types/localChat";

export function exportChatToFile(chat: LocalChatFile): void {
  const json = JSON.stringify(chat, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  // Slugify the title for the filename
  const slug = chat.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  a.download = `${slug}-${Date.now()}.verdictu`;
  a.click();

  URL.revokeObjectURL(url);
}
```

**When to trigger the download:**
- Manually: via a "Download chat" button in the chat header (always available, even for cloud chats)
- Automatically: when the user ends a local-mode chat session (on tab close or explicit "End chat" button)

### Step 4 — Save to Convex (Cloud Path)

This requires adding Convex mutations (none exist yet):

```typescript
// convex/chatHistories.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    title: v.string(),
    mode: v.union(v.literal("General"), v.literal("Compare"), v.literal("Draft")),
    jurisdiction: v.optional(v.string()),
    citationEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return ctx.db.insert("chatHistories", {
      userId: user!._id,
      title: args.title,
      mode: args.mode,
      jurisdiction: args.jurisdiction,
      citationEnabled: args.citationEnabled,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const addMessage = mutation({
  args: {
    chatHistoryId: v.id("chatHistories"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      extractedText: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatHistoryId);
    if (!chat) throw new Error("Chat not found");

    await ctx.db.patch(args.chatHistoryId, {
      messages: [...chat.messages, {
        role: args.role,
        content: args.content,
        timestamp: Date.now(),
        attachments: args.attachments,
      }],
      updatedAt: Date.now(),
    });
  },
});

export const listByUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return ctx.db
      .query("chatHistories")
      .withIndex("by_userId", (q) => q.eq("userId", user!._id))
      .order("desc")
      .collect();
  },
});
```

### Step 5 — Import from File

Add an import button in the sidebar (next to "New chat"):

```tsx
// components/agent-sections/ImportChatButton.tsx

export function ImportChatButton() {
  const router = useRouter();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as LocalChatFile;
        validateLocalChatFile(data); // throws if invalid

        // Store in sessionStorage so the import page can pick it up
        sessionStorage.setItem("importedChat", JSON.stringify(data));
        router.push("/chat/import");
      } catch {
        toast.error("Invalid .verdictu file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <label className="cursor-pointer flex items-center gap-2 text-sm px-3 py-2 hover:bg-muted rounded">
      <Upload size={14} />
      Import chat
      <input
        type="file"
        accept=".verdictu,.json"
        className="hidden"
        onChange={handleImport}
      />
    </label>
  );
}
```

### Step 6 — Import View Page

```
app/(agent)/chat/import/page.tsx
```

This page:
1. Reads the `importedChat` from `sessionStorage`
2. Renders it using the same chat message components as a normal chat
3. Shows a banner: **"Imported chat — this is read-only. [Save to cloud]"**
4. The "Save to cloud" button calls the Convex `create` mutation + `addMessage` in a loop to persist it permanently

```tsx
// app/(agent)/chat/import/page.tsx

export default function ImportedChatPage() {
  const [chat, setChat] = useState<LocalChatFile | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("importedChat");
    if (raw) setChat(JSON.parse(raw));
  }, []);

  if (!chat) return <div>No imported chat found.</div>;

  return (
    <div>
      {/* Imported banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm flex items-center justify-between">
        <span>Viewing imported chat — not saved to your account</span>
        <SaveToCloudButton chat={chat} />
      </div>

      {/* Render messages using existing chat components */}
      <ChatMessages messages={chat.messages} />
    </div>
  );
}
```

### Step 7 — Validation

Always validate imported files before rendering:

```typescript
// lib/validateLocalChatFile.ts

export function validateLocalChatFile(data: unknown): asserts data is LocalChatFile {
  if (typeof data !== "object" || data === null) throw new Error("Not an object");

  const d = data as Record<string, unknown>;

  if (d.__verdictu_version !== "1.0") throw new Error("Unknown version");
  if (!Array.isArray(d.messages)) throw new Error("Missing messages");
  if (!["General", "Compare", "Draft"].includes(d.mode as string)) throw new Error("Invalid mode");

  for (const msg of d.messages as unknown[]) {
    const m = msg as Record<string, unknown>;
    if (!["user", "assistant"].includes(m.role as string)) throw new Error("Invalid role");
    if (typeof m.content !== "string") throw new Error("Invalid content");
  }
}
```

---

## User Experience Flow

### Starting a local chat
```
User types message → "Where to save?" modal appears (once per session)
  → Chooses "Local only"
  → Chat proceeds normally in-memory
  → On end: file downloads automatically as "my-question-1234567890.verdictu"
```

### Starting a cloud chat
```
User types message → "Where to save?" modal appears
  → Chooses "Cloud"
  → Convex chatHistory created immediately
  → Each message saved as it's sent
  → Appears in sidebar instantly
```

### Importing a saved chat
```
Sidebar → "Import chat" button → file picker (.verdictu)
  → Parsed and validated
  → Shown in read-only import view
  → User can optionally click "Save to my account" to persist to Convex
```

### Downloading a cloud chat
```
Any cloud chat → three-dot menu → "Download as file"
  → Same exportChatToFile() utility
  → Works as a backup or for sharing
```

---

## Privacy Implications (Worth Surfacing in the UI)

| | Cloud | Local |
|---|---|---|
| Stored on Verdictu servers | Yes | No |
| Accessible from other devices | Yes | No |
| Survives clearing browser data | Yes | Yes (it's a file) |
| Can be shared with someone | Via link (future) | Send the file |
| Deleted if account closed | Yes | No |
| GDPR right to erasure | Covered by account deletion | User controls the file |

Consider showing a one-liner under each option:
- Cloud: "Saved to your account · accessible on any device"
- Local: "Never leaves your device · downloaded as a file when done"

---

## What This Does NOT Require

- No IndexedDB or localStorage — the local path is purely in-memory during the session, then downloaded. This avoids storage quota issues and browser data clearing wiping chats.
- No service workers or PWA setup.
- No changes to the Convex schema — the existing `chatHistories` shape is already correct.
- No third-party libraries — just `FileReader`, `Blob`, and `URL.createObjectURL`.

---

## Files to Create / Modify

| Action | File |
|---|---|
| Create | `types/localChat.ts` |
| Create | `lib/exportChat.ts` |
| Create | `lib/validateLocalChatFile.ts` |
| Create | `convex/chatHistories.ts` |
| Create | `components/agent-general/StorageSelector.tsx` |
| Create | `components/agent-sections/ImportChatButton.tsx` |
| Create | `app/(agent)/chat/import/page.tsx` |
| Modify | `store/chatComposerStore.ts` — add `storageMode` field |
| Modify | `components/agent-sections/agent-sidebar.tsx` — add import button |
| Modify | `app/(agent)/chat/[id]/page.tsx` — branch on storage mode when saving messages |
