"use client";

import { useCallback, useRef } from "react";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { findGhostModel, getSuggestedSmallerModel } from "@/lib/ghost/models";
import { installOPFSCacheShim, clearOPFSCache } from "@/lib/ghost/opfsCache";

// WebLLM is dynamically imported to keep it out of the server bundle
type MLCEngine = {
  chat: {
    completions: {
      create: (opts: {
        messages: { role: string; content: string }[];
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      }) => Promise<AsyncIterable<{ choices: { delta: { content?: string } }[] }>>;
    };
  };
  unload: () => Promise<void>;
};

// WebLLM uses exactly these three cache buckets
const WEBLLM_CACHES = ["webllm/config", "webllm/model", "webllm/wasm"] as const;

/**
 * Wipes all WebLLM cache buckets using the native Cache API.
 * More reliable than deleteModelAllInfoInCache which only removes
 * individual entries and can leave stale data that causes Cache.add() to fail.
 */
async function purgeWebLLMCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  await Promise.all(WEBLLM_CACHES.map((name) => caches.delete(name).catch(() => {})));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

// Singleton engine ref shared across all hook instances
let globalEngine: MLCEngine | null = null;
let globalEngineModelId: string | null = null;
// Mutex: prevents concurrent loadModel calls from trampling each other.
// A concurrent call waits for the in-flight load to finish before proceeding,
// which avoids calling unload() while WebGPU mapAsync operations are still pending.
let globalLoadingPromise: Promise<void> | null = null;

export type GhostStreamOptions = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  /** Max tokens to generate. Defaults to 2000. Pass higher for deep analysis turns. */
  maxTokens?: number;
};

export function useGhostLLM() {
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const setModelStatus = useGhostModeStore((s) => s.setModelStatus);
  const setLoadProgress = useGhostModeStore((s) => s.setLoadProgress);
  const setSuggestedModelId = useGhostModeStore((s) => s.setSuggestedModelId);
  const abortRef = useRef<boolean>(false);

  // Parse percent from WebLLM progress text like "[2/7] Loading model weights, 47%"
  const parsePercent = (text: string): number => {
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const loadModel = useCallback(async (modelId: string) => {
    if (globalEngine && globalEngineModelId === modelId) {
      setModelStatus("ready");
      return;
    }

    // If another load is already in progress, wait for it to finish first.
    // This prevents calling unload() while WebGPU mapAsync operations are pending.
    if (globalLoadingPromise) {
      await globalLoadingPromise;
      if (globalEngine && globalEngineModelId === modelId) {
        setModelStatus("ready");
        return;
      }
    }

    setModelStatus("loading");
    setLoadProgress("Initializing…", 0);
    setSuggestedModelId(null);

    let resolveMutex!: () => void;
    globalLoadingPromise = new Promise<void>((r) => { resolveMutex = r; });

    try {
      const { CreateMLCEngine, hasModelInCache } = await import("@mlc-ai/web-llm");

      // ── Install OPFS cache shim ───────────────────────────────────────────
      // Redirects WebLLM's Cache API writes to OPFS, where quota = available
      // disk space. This is the primary fix for the ~1-2GB Cache API limit that
      // causes mid-download failures on large models. Safe to call on every load;
      // installs only once per page lifetime.
      const opfsActive = await installOPFSCacheShim();
      setLoadProgress(opfsActive ? "Initializing (disk storage)…" : "Initializing…", 0);

      if (!opfsActive) {
        // OPFS unavailable — fall back to Cache API. Try to raise its quota via
        // persist(), then abort early if it's still too small for the model.
        if (typeof navigator.storage?.persist === "function") {
          await navigator.storage.persist().catch(() => {});
        }
        const model = findGhostModel(modelId);
        if (model && typeof navigator.storage?.estimate === "function") {
          const { quota = 0, usage = 0 } = await navigator.storage.estimate();
          const available = quota - usage;
          const needed = model.downloadSizeMB * 1024 * 1024;
          if (available > 0 && available < needed) {
            const smaller = getSuggestedSmallerModel(modelId);
            setSuggestedModelId(smaller?.id ?? null);
            throw new Error(
              `Not enough browser storage for ${model.name}. Need ${model.size}, only ${formatBytes(available)} available.${smaller ? ` Try ${smaller.name} (${smaller.size}) instead.` : ""}`,
            );
          }
        }
      }

      // ── Handle existing engine state ──────────────────────────────────────
      if (globalEngine) {
        if (globalEngineModelId !== modelId) {
          await globalEngine.unload().catch(() => {});
          globalEngine = null;
          globalEngineModelId = null;
          setLoadProgress("Clearing previous model cache…", 0);
          await purgeWebLLMCaches();
        } else {
          await globalEngine.unload().catch(() => {});
          globalEngine = null;
          globalEngineModelId = null;
        }
      }

      // ── Download with one automatic retry ────────────────────────────────
      // On failure, wipe all WebLLM caches to reclaim quota, then try once more.
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          setLoadProgress("Clearing cache and retrying…", 0);
          await purgeWebLLMCaches();
        }

        try {
          const cached = await hasModelInCache(modelId).catch(() => false);
          if (cached && attempt === 0) {
            setLoadProgress("Loading from cache…", 10);
          }

          const engine = await CreateMLCEngine(modelId, {
            initProgressCallback: (progress: { text: string }) => {
              const pct = parsePercent(progress.text);
              setLoadProgress(progress.text, pct);
            },
          });

          globalEngine = engine as unknown as MLCEngine;
          globalEngineModelId = modelId;
          setModelStatus("ready");
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (lastErr) {
        const smaller = getSuggestedSmallerModel(modelId);
        setSuggestedModelId(smaller?.id ?? null);
        throw lastErr;
      }
    } catch (err) {
      setModelStatus("error");
      setLoadProgress(
        err instanceof Error ? err.message : "Failed to load model. WebGPU required.",
        0,
      );
    } finally {
      resolveMutex();
      globalLoadingPromise = null;
    }
  }, [setModelStatus, setLoadProgress, setSuggestedModelId]);

  // No auto-load — user must explicitly click "Load" in the Ghost controls.

  const generate = useCallback(
    async ({ messages, onToken, onDone, onError, maxTokens = 2000 }: GhostStreamOptions) => {
      if (!globalEngine) {
        onError("Ghost mode engine not loaded. Please wait for the model to finish loading.");
        return;
      }

      abortRef.current = false;

      try {
        const stream = await globalEngine.chat.completions.create({
          messages,
          temperature: 0.4,
          max_tokens: maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          if (abortRef.current) break;
          const token = chunk.choices[0]?.delta?.content ?? "";
          if (token) onToken(token);
        }
        onDone();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Generation failed");
      }
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Manual escape hatch — wipes all WebLLM caches and resets state
  const clearCache = useCallback(async () => {
    if (globalEngine) {
      await globalEngine.unload().catch(() => {});
      globalEngine = null;
      globalEngineModelId = null;
    }
    // purgeWebLLMCaches calls caches.delete() — with the OPFS shim installed
    // this correctly removes OPFS directories. clearOPFSCache is a direct
    // OPFS wipe as a safety net for the case where the shim wasn't active.
    await purgeWebLLMCaches();
    await clearOPFSCache();
    setModelStatus("idle");
    setLoadProgress("", 0);
  }, [setModelStatus, setLoadProgress]);

  const isReady = modelStatus === "ready" && globalEngine !== null;

  return { loadModel, generate, abort, clearCache, isReady, modelStatus };
}
