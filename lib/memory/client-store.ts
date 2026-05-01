// lib/memory/client-store.ts
// Client-side persistence via IndexedDB.
// All data stays in the browser — nothing is sent to the server.

export interface StoredTurn {
  userText: string;
  userAttachments: { name: string; extractedText: string }[];
  userJurisdiction: string;
  userMode: string;
  assistantText: string;
  sources: { title: string; url: string; domain?: string }[];
  laws: Array<{
    name: string;
    citation: string;
    relevance: "primary" | "secondary" | "supplementary";
    confidence: number;
    applies_because: string;
  }>;
  searchQueries: string[];
  elapsedMs: number;
  isGhost: boolean;
  isGhostOpen: boolean;
  ghostModelName?: string;
  timestamp: number;
}

export interface WorkingStateSnapshot {
  parties: Array<{
    name: string;
    role: string;
    jurisdiction: string;
    key_facts: string[];
  }>;
  research: Record<string, string>;
  draft: { current_version: string; disputed_clauses: string[] } | null;
  decisions: string[];
  precedents_used: string[];
}

export interface StoredConversation {
  chatId: string;
  title: string;
  turns: StoredTurn[];
  updatedAt: number;
  workingState?: WorkingStateSnapshot;
}

export interface ConversationMeta {
  chatId: string;
  title: string;
  updatedAt: number;
  turnCount: number;
}

export interface PrecedentEntry {
  id: string;
  title: string;
  parties: string[];
  jurisdiction: string;
  tags: string[];
  assistantText: string;
  userText: string;
  sources: { title: string; url: string }[];
  savedAt: number;
}

// ─── DB lifecycle ─────────────────────────────────────────────────────────────

const DB_NAME = "verdictu-db";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("conversations")) {
        db.createObjectStore("conversations", { keyPath: "chatId" });
      }
      if (!db.objectStoreNames.contains("precedents")) {
        const ps = db.createObjectStore("precedents", { keyPath: "id" });
        ps.createIndex("savedAt", "savedAt");
      }
    };

    request.onsuccess = () => {
      _db = request.result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
}

function idbReq<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function saveConversation(
  chatId: string,
  turns: StoredTurn[],
  title: string,
  workingState?: WorkingStateSnapshot,
): Promise<void> {
  const db = await openDB();
  const record: StoredConversation = {
    chatId,
    title,
    turns,
    updatedAt: Date.now(),
    workingState,
  };
  const t = db.transaction("conversations", "readwrite");
  await idbReq(t.objectStore("conversations").put(record));
}

export async function loadConversation(
  chatId: string,
): Promise<StoredConversation | null> {
  const db = await openDB();
  const t = db.transaction("conversations", "readonly");
  const result = await idbReq<StoredConversation | undefined>(
    t.objectStore("conversations").get(chatId),
  );
  return result ?? null;
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const db = await openDB();
  const t = db.transaction("conversations", "readonly");
  const all = await idbReq<StoredConversation[]>(
    t.objectStore("conversations").getAll(),
  );
  return all
    .map((c) => ({
      chatId: c.chatId,
      title: c.title,
      updatedAt: c.updatedAt,
      turnCount: c.turns.length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(chatId: string): Promise<void> {
  const db = await openDB();
  const t = db.transaction("conversations", "readwrite");
  await idbReq(t.objectStore("conversations").delete(chatId));
}

// ─── Precedents ───────────────────────────────────────────────────────────────

export async function addPrecedent(
  entry: Omit<PrecedentEntry, "id">,
): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openDB();
  const t = db.transaction("precedents", "readwrite");
  await idbReq(t.objectStore("precedents").add({ ...entry, id }));
  return id;
}

export async function listPrecedents(): Promise<PrecedentEntry[]> {
  const db = await openDB();
  const t = db.transaction("precedents", "readonly");
  const all = await idbReq<PrecedentEntry[]>(
    t.objectStore("precedents").getAll(),
  );
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deletePrecedent(id: string): Promise<void> {
  const db = await openDB();
  const t = db.transaction("precedents", "readwrite");
  await idbReq(t.objectStore("precedents").delete(id));
}
