"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { findGhostModel } from "@/lib/ghost/models";

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

// Singleton engine ref shared across all hook instances
let globalEngine: MLCEngine | null = null;
let globalEngineModelId: string | null = null;

export type GhostStreamOptions = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
};

export function useGhostLLM() {
  const enabled = useGhostModeStore((s) => s.enabled);
  const selectedModelId = useGhostModeStore((s) => s.selectedModelId);
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const setModelStatus = useGhostModeStore((s) => s.setModelStatus);
  const setLoadProgress = useGhostModeStore((s) => s.setLoadProgress);
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

    setModelStatus("loading");
    setLoadProgress("Initializing…", 0);

    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      // Unload previous engine if different model
      if (globalEngine && globalEngineModelId !== modelId) {
        await globalEngine.unload();
        globalEngine = null;
        globalEngineModelId = null;
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
    } catch (err) {
      setModelStatus("error");
      setLoadProgress(
        err instanceof Error ? err.message : "Failed to load model. WebGPU required.",
        0,
      );
    }
  }, [setModelStatus, setLoadProgress]);

  // Auto-load when ghost mode is enabled
  useEffect(() => {
    if (!enabled) return;
    const model = findGhostModel(selectedModelId);
    if (!model) return;
    loadModel(selectedModelId);
  }, [enabled, selectedModelId, loadModel]);

  const generate = useCallback(
    async ({ messages, onToken, onDone, onError }: GhostStreamOptions) => {
      if (!globalEngine) {
        onError("Ghost mode engine not loaded. Please wait for the model to finish loading.");
        return;
      }

      abortRef.current = false;

      try {
        const stream = await globalEngine.chat.completions.create({
          messages,
          temperature: 0.4,
          max_tokens: 1500,
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

  const isReady = modelStatus === "ready" && globalEngine !== null;

  return { loadModel, generate, abort, isReady, modelStatus };
}
