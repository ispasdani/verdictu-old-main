# File Text Extraction — Implementation Notes

**Date:** 2026-02-17
**Context:** Implementing real file text extraction for the `AIChatInput` component to replace the simulated upload.

---

## Stack Constraints

- Next.js 16 (Turbopack default), React 19, TypeScript
- Pure Node.js — no Python backend
- Deployment target: **Vercel (serverless)**
- State management: Zustand (`chatComposerStore`)

---

## Architecture Decision

### Where does extraction happen?

| Format | Location | Reason |
|--------|----------|--------|
| TXT | Client-side (browser) | `File.text()` — zero deps, privacy-preserving |
| DOCX | Client-side (browser) | `mammoth` has a browser build |
| PDF | Client-side (browser) | `pdfjs-dist` works in browser |
| DOC (legacy binary) | Server-side (`/api/extract-doc`) | No viable pure-JS browser parser; `word-extractor` is Node-only |
| Images | Dropped entirely | App does not support image attachments |

**Privacy note:** Files stay client-side for TXT/DOCX/PDF — they never leave the browser during extraction. Only `.doc` files touch the server.

---

## Packages Installed

```bash
npm install mammoth pdfjs-dist@3.11.174 word-extractor
```

- `mammoth` — DOCX → plain text (has browser build)
- `pdfjs-dist@3.11.174` — PDF text extraction in browser (pinned to 3.x to avoid `.mjs` worker issues)
- `word-extractor` — legacy `.doc` binary parsing in Node.js

---

## Files Created / Modified

### New files

- [`lib/extractText.ts`](../lib/extractText.ts) — client-side extraction for TXT, DOCX, PDF
- [`app/api/extract-doc/route.ts`](../app/api/extract-doc/route.ts) — server-side API route for `.doc` files using `word-extractor`
- [`stubs/canvas.js`](../stubs/canvas.js) — empty stub to silence pdfjs-dist's `require("canvas")` in its Node.js build

### Modified files

- [`store/chatComposerStore.ts`](../store/chatComposerStore.ts) — added `extractedText?: string` to `AttachmentItem`
- [`components/marketing-general/aiChatInput.tsx`](../components/marketing-general/aiChatInput.tsx) — removed image support, replaced `simulateUpload` with `extractTextFromFile`
- [`next.config.ts`](../next.config.ts) — added `canvas` alias for both Turbopack and webpack

---

## Key Implementation Details

### `extractTextFromFile` (in `aiChatInput.tsx`)

Fires automatically when a file is attached (no button press needed).

```ts
const extractTextFromFile = async (id: string, file: File) => {
  // .doc → POST /api/extract-doc
  // everything else → lib/extractText.ts (client-side)
  // on success → updateAttachment with { status: "done", extractedText: text }
  // on error   → updateAttachment with { status: "error", error: message }
};
```

The `console.log` at line 114 logs:
- `chars` — full character count of extracted text
- `preview` — first 300 chars only (so the console doesn't get flooded)

The **full text** is stored in `att.extractedText` in the Zustand store.

### DOC route (`/api/extract-doc/route.ts`)

- Receives file via `multipart/form-data`
- Writes to `/tmp/<uuid>.doc` (Vercel gives 500MB ephemeral `/tmp`)
- Extracts via `word-extractor`
- Cleans up `/tmp` in a `finally` block

### The `canvas` stub problem

`pdfjs-dist` ships a Node.js build that does `require("canvas")` for server-side rendering. Since we only extract text (never render), canvas is unused — but the build still fails without the stub.

- **Turbopack:** `turbopack.resolveAlias: { canvas: "./stubs/canvas.js" }` (needs a real file, can't use `false`)
- **Webpack:** `config.resolve.alias.canvas = false`

---

## Validation Rules (`validateFile`)

- Accepted types: PDF, DOCX, DOC, TXT
- Images removed entirely
- Empty files (`size === 0`) are rejected with a clear message — Windows creates 0-byte `.docx` stubs on right-click → New before Word opens them
- Max size: 20MB

---

## What's Next (when wiring up the AI call)

Read extracted text from the store when the user hits Send:

```ts
const attachments = useChatComposerStore((s) => s.attachments);

const context = attachments
  .filter((a) => a.status === "done" && a.extractedText)
  .map((a) => `### Source: ${a.name}\n\n${a.extractedText}`)
  .join("\n\n---\n\n");

// Prepend `context` to the user message before sending to Claude/GPT
```
