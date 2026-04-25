// OPFS-backed CacheStorage shim for WebLLM model storage.
//
// The browser's Cache API has a per-origin quota (~1-2GB typical) that makes
// downloading large WebLLM models unreliable. OPFS (Origin Private File System)
// uses available disk space instead, removing the quota constraint entirely.
//
// This shim replaces window.caches with an OPFS-backed implementation that
// intercepts only the three WebLLM cache buckets. All other cache names are
// forwarded to the original CacheStorage so Next.js / PWA caches are unaffected.

// ─── Constants ────────────────────────────────────────────────────────────────

const OPFS_ROOT = "webllm-cache";

// Exactly the three buckets WebLLM opens — everything else passes through.
const WEBLLM_NAMES = new Set(["webllm/config", "webllm/model", "webllm/wasm"]);

// ─── Utilities ────────────────────────────────────────────────────────────────

function getUrl(req: RequestInfo | URL): string {
  if (typeof req === "string") return req;
  if (req instanceof URL) return req.href;
  return (req as Request).url;
}

// 64-bit FNV-1a hash → 16-char hex filename.
// Collision probability for ~100 files per cache bucket is negligible.
function urlToFilename(url: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc4ac5665;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

// "webllm/model" → "webllm%2Fmodel" — safe OPFS directory name
function encodeDir(name: string): string {
  return name.replace(/\//g, "%2F");
}

// ─── OPFS directory helpers ───────────────────────────────────────────────────

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_ROOT, { create: true });
}

async function getCacheDir(
  cacheName: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const root = await getOpfsRoot();
  return root.getDirectoryHandle(encodeDir(cacheName), { create });
}

// ─── Entry metadata ───────────────────────────────────────────────────────────

interface EntryMeta {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// ─── OPFSCache — implements the Cache interface backed by OPFS ────────────────

class OPFSCache {
  constructor(private readonly name: string) {}

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const url = getUrl(request);
    const hash = urlToFilename(url);
    const dir = await getCacheDir(this.name, true);

    const body = await response.arrayBuffer();
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k] = v; });
    const meta: EntryMeta = {
      url,
      status: response.status,
      statusText: response.statusText,
      headers,
    };

    // Write body first, then meta.
    // Meta presence is the atomic "commit" marker — if the tab closes between
    // the two writes, the missing meta causes match() to return undefined, which
    // makes WebLLM re-download the shard cleanly on the next session.
    const bodyHandle = await dir.getFileHandle(`${hash}.bin`, { create: true });
    const bodyWriter = await bodyHandle.createWritable();
    await bodyWriter.write(body);
    await bodyWriter.close();

    const metaHandle = await dir.getFileHandle(`${hash}.meta`, { create: true });
    const metaWriter = await metaHandle.createWritable();
    await metaWriter.write(JSON.stringify(meta));
    await metaWriter.close();
  }

  async add(request: RequestInfo | URL): Promise<void> {
    const url = getUrl(request);
    const res = await fetch(url);
    if (!res.ok) throw new TypeError(`Response status ${res.status} is not ok`);
    await this.put(request, res);
  }

  // Sequential, not parallel — avoids loading all 62 model shards into memory at once.
  async addAll(requests: RequestInfo[]): Promise<void> {
    for (const r of requests) {
      await this.add(r);
    }
  }

  async match(
    request: RequestInfo | URL,
    _options?: CacheQueryOptions,
  ): Promise<Response | undefined> {
    const url = getUrl(request);
    const hash = urlToFilename(url);

    try {
      const dir = await getCacheDir(this.name, false);

      const metaHandle = await dir.getFileHandle(`${hash}.meta`);
      const metaText = await (await metaHandle.getFile()).text();
      const meta: EntryMeta = JSON.parse(metaText);

      // Guard against hash collision (astronomically unlikely but defensive)
      if (meta.url !== url) return undefined;

      const bodyHandle = await dir.getFileHandle(`${hash}.bin`);
      const body = await (await bodyHandle.getFile()).arrayBuffer();

      return new Response(body, {
        status: meta.status,
        statusText: meta.statusText,
        headers: meta.headers,
      });
    } catch {
      return undefined;
    }
  }

  async matchAll(
    _request?: RequestInfo | URL,
    _options?: CacheQueryOptions,
  ): Promise<ReadonlyArray<Response>> {
    return [];
  }

  async keys(
    _request?: RequestInfo | URL,
    _options?: CacheQueryOptions,
  ): Promise<ReadonlyArray<Request>> {
    try {
      const dir = await getCacheDir(this.name, false);
      const result: Request[] = [];
      for await (const [name, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        if (!name.endsWith(".meta") || handle.kind !== "file") continue;
        try {
          const text = await (handle as FileSystemFileHandle).getFile().then((f) => f.text());
          const meta: EntryMeta = JSON.parse(text);
          result.push(new Request(meta.url));
        } catch {
          // Skip corrupted entries
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  async delete(
    request: RequestInfo | URL,
    _options?: CacheQueryOptions,
  ): Promise<boolean> {
    const url = getUrl(request);
    const hash = urlToFilename(url);
    try {
      const dir = await getCacheDir(this.name, false);
      await Promise.all([
        dir.removeEntry(`${hash}.bin`).catch(() => {}),
        dir.removeEntry(`${hash}.meta`).catch(() => {}),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── OPFSCacheStorage — selective proxy ───────────────────────────────────────
// WebLLM names  →  OPFS-backed OPFSCache
// Everything else  →  original browser CacheStorage (Next.js / PWA unaffected)

class OPFSCacheStorage {
  private readonly instances = new Map<string, OPFSCache>();

  constructor(private readonly original: CacheStorage) {}

  async open(cacheName: string): Promise<Cache> {
    if (!WEBLLM_NAMES.has(cacheName)) return this.original.open(cacheName);
    if (!this.instances.has(cacheName)) {
      this.instances.set(cacheName, new OPFSCache(cacheName));
    }
    return this.instances.get(cacheName)! as unknown as Cache;
  }

  async has(cacheName: string): Promise<boolean> {
    if (!WEBLLM_NAMES.has(cacheName)) return this.original.has(cacheName);
    try {
      const root = await getOpfsRoot();
      await root.getDirectoryHandle(encodeDir(cacheName), { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async delete(cacheName: string): Promise<boolean> {
    if (!WEBLLM_NAMES.has(cacheName)) return this.original.delete(cacheName);
    try {
      const root = await getOpfsRoot();
      await root.removeEntry(encodeDir(cacheName), { recursive: true });
      this.instances.delete(cacheName);
      return true;
    } catch {
      return false;
    }
  }

  async keys(): Promise<string[]> {
    const opfsKeys: string[] = [];
    try {
      const root = await getOpfsRoot();
      for await (const [name] of (root as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        opfsKeys.push(decodeURIComponent(name));
      }
    } catch { /* ignore */ }
    const origKeys = await this.original.keys().catch(() => [] as string[]);
    return [...opfsKeys, ...origKeys];
  }

  async match(
    request: RequestInfo | URL,
    options?: MultiCacheQueryOptions,
  ): Promise<Response | undefined> {
    for (const cache of this.instances.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return this.original.match(request, options).catch(() => undefined);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isOPFSSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof (navigator.storage as { getDirectory?: unknown })?.getDirectory === "function" &&
    typeof FileSystemDirectoryHandle !== "undefined"
  );
}

// Saved so we can forward non-WebLLM names after install
let _originalCaches: CacheStorage | null = null;
let _shimInstalled = false;

/**
 * Replaces window.caches with the OPFS-backed shim.
 * Safe to call multiple times — installs only once per page load.
 * Returns true if OPFS is active after this call, false if the browser
 * doesn't support OPFS (caller should fall back to Cache API).
 */
export async function installOPFSCacheShim(): Promise<boolean> {
  if (_shimInstalled) return true;
  if (!isOPFSSupported()) return false;

  try {
    // Verify OPFS is actually writable (may be blocked in sandboxed iframes)
    const root = await navigator.storage.getDirectory();
    await root.getDirectoryHandle(OPFS_ROOT, { create: true });

    _originalCaches = window.caches;

    Object.defineProperty(window, "caches", {
      value: new OPFSCacheStorage(_originalCaches!) as unknown as CacheStorage,
      configurable: true,
      writable: true,
    });
    _shimInstalled = true;

    // Purge any stale WebLLM data from the old Cache API bucket to reclaim quota.
    // This runs once, at shim install time.
    await Promise.all(
      [...WEBLLM_NAMES].map((name) => _originalCaches!.delete(name).catch(() => {})),
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes the OPFS root directory that holds all WebLLM model data.
 * Called from clearCache as a safety net alongside caches.delete().
 */
export async function clearOPFSCache(): Promise<void> {
  if (!isOPFSSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_ROOT, { recursive: true }).catch(() => {});
  } catch { /* ignore */ }
}
