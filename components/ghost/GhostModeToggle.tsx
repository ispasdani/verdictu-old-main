"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Ghost, Cpu, AlertTriangle, CheckCircle2, Loader2, Zap, TriangleAlert } from "lucide-react";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { GHOST_MODELS, findGhostModel } from "@/lib/ghost/models";

// ─── Status indicator dot ────────────────────────────────────────────────────

function StatusDot() {
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const enabled = useGhostModeStore((s) => s.enabled);

  if (!enabled) return null;

  if (modelStatus === "loading") {
    return (
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
    );
  }
  if (modelStatus === "ready") {
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />;
  }
  if (modelStatus === "error") {
    return <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />;
}

// ─── Loading progress bar ────────────────────────────────────────────────────

function GhostLoadingBar() {
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const loadProgress = useGhostModeStore((s) => s.loadProgress);
  const loadPercent = useGhostModeStore((s) => s.loadPercent);
  const enabled = useGhostModeStore((s) => s.enabled);

  if (!enabled || modelStatus === "idle" || modelStatus === "ready") return null;

  if (modelStatus === "error") {
    const isShaderF16 =
      loadProgress.toLowerCase().includes("shader-f16") ||
      loadProgress.toLowerCase().includes("required_features") ||
      loadProgress.toLowerCase().includes("failed to fetch");

    return (
      <div className="space-y-1.5 px-0.5">
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-red-50 border border-red-100 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-medium leading-snug block">
              {isShaderF16 ? "GPU does not support shader-f16" : "Model failed to load"}
            </span>
            <span className="text-red-500/80 leading-snug block">
              {isShaderF16
                ? "This model requires the WebGPU shader-f16 extension. Switch to Qwen 2.5 1.5B or Qwen 3 4B — they work on all GPUs."
                : loadProgress || "WebGPU required (Chrome/Edge 113+). Check your internet connection and try again."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="space-y-1.5 px-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/80 truncate flex-1 pr-2">
          {loadProgress || "Initializing…"}
        </span>
        {loadPercent > 0 && (
          <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">
            {loadPercent}%
          </span>
        )}
      </div>
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground/60 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(3, loadPercent)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Model picker dropdown ───────────────────────────────────────────────────

function GhostModelSelector() {
  const selectedModelId = useGhostModeStore((s) => s.selectedModelId);
  const setSelectedModelId = useGhostModeStore((s) => s.setSelectedModelId);
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = findGhostModel(selectedModelId) ?? GHOST_MODELS[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary transition-colors text-xs"
      >
        <Cpu size={11} className="text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground/70 max-w-25 truncate">
          {selected.shortName}
        </span>
        {modelStatus === "loading" && (
          <Loader2 size={10} className="text-amber-400 animate-spin shrink-0" />
        )}
        {modelStatus === "ready" && (
          <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
        )}
        <ChevronDown size={10} className="text-muted-foreground/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-72 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-1.5">
              <Ghost size={12} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground/70">Ghost Models</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">Runs offline · No data leaves your device</span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {GHOST_MODELS.map((model) => {
              const isSelected = model.id === selectedModelId;
              const isRecommended = model.tags.includes("recommended");
              const isGoogle = model.tags.includes("google");
              const needsF16 = model.requiresShaderF16 === true;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-accent transition-colors ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  {/* Selected indicator */}
                  <div className="mt-1 shrink-0 w-3">
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{model.name}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground">{model.provider}</span>
                      {isRecommended && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                          <Zap size={8} />
                          Best
                        </span>
                      )}
                      {isGoogle && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          Google
                        </span>
                      )}
                      {needsF16 && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-100"
                          title="Requires WebGPU shader-f16 — may not work on all GPUs"
                        >
                          <TriangleAlert size={8} />
                          shader-f16
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/50">
                        Download {model.size}
                      </span>
                      <span className="text-[10px] text-muted-foreground/30">·</span>
                      <span className="text-[10px] text-muted-foreground/50">
                        VRAM {model.vram}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-border bg-secondary/20">
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Requires Chrome or Edge 113+ with WebGPU. Models marked{" "}
              <span className="text-amber-500 font-medium">shader-f16</span>{" "}
              need a discrete GPU. Cached after first download.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Ghost Mode Toggle ──────────────────────────────────────────────────

export function GhostModeToggle() {
  const enabled = useGhostModeStore((s) => s.enabled);
  const setEnabled = useGhostModeStore((s) => s.setEnabled);
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const loadProgress = useGhostModeStore((s) => s.loadProgress);
  const loadPercent = useGhostModeStore((s) => s.loadPercent);

  const isLoading = modelStatus === "loading";

  return (
    <div className="flex flex-col gap-2">
      {/* Loading progress — shown inline above toolbar when loading */}
      {enabled && isLoading && (
        <div className="px-3">
          <GhostLoadingBar />
        </div>
      )}
      {enabled && modelStatus === "error" && (
        <div className="px-3">
          <GhostLoadingBar />
        </div>
      )}

      {/* Toggle row */}
      <div className="flex items-center gap-2.5">
        {/* Ghost toggle button */}
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all text-xs font-medium ${
            enabled
              ? "bg-foreground text-card border-foreground"
              : "bg-transparent border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground/70"
          }`}
          title={enabled ? "Disable Ghost Mode (local AI)" : "Enable Ghost Mode (local AI — private & offline)"}
        >
          <Ghost
            size={13}
            className={`transition-transform ${enabled ? "scale-110" : ""}`}
          />
          <span>Ghost</span>
          <StatusDot />
        </button>

        {/* Model selector — only visible when enabled */}
        {enabled && <GhostModelSelector />}
      </div>
    </div>
  );
}

// Re-export loading bar for use in the chat page
export { GhostLoadingBar };
