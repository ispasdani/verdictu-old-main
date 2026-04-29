"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Ghost,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Zap,
  TriangleAlert,
  Cloud,
  ShieldOff,
} from "lucide-react";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { useGhostLLM } from "@/hooks/useGhostLLM";
import { GHOST_MODELS, findGhostModel } from "@/lib/ghost/models";
import {
  GHOST_API_MODELS,
  GHOST_API_MODEL_CATEGORIES,
  findGhostApiModel,
  type GhostApiModelCategory,
} from "@/lib/ghost/openrouter";
import { GhostCredits } from "@/components/ghost/GhostCredits";

// ─── Status dot for local Ghost mode ────────────────────────────────────────

function StatusDot() {
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const enabled = useGhostModeStore((s) => s.enabled);
  if (!enabled) return null;
  if (modelStatus === "loading")
    return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />;
  if (modelStatus === "ready")
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />;
  if (modelStatus === "error")
    return <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />;
}

// ─── Local model loading / error bar ────────────────────────────────────────

function GhostLoadingBar({
  onRetry,
  onSwitchModel,
}: {
  onRetry?: () => void;
  onSwitchModel?: (id: string) => void;
}) {
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const loadProgress = useGhostModeStore((s) => s.loadProgress);
  const loadPercent = useGhostModeStore((s) => s.loadPercent);
  const enabled = useGhostModeStore((s) => s.enabled);
  const suggestedModelId = useGhostModeStore((s) => s.suggestedModelId);

  if (!enabled || modelStatus === "idle" || modelStatus === "ready") return null;

  if (modelStatus === "error") {
    const isShaderF16 =
      loadProgress.toLowerCase().includes("shader-f16") ||
      loadProgress.toLowerCase().includes("required_features");
    const isStorageError = loadProgress.toLowerCase().includes("not enough browser storage");
    const suggestedModel = suggestedModelId ? findGhostModel(suggestedModelId) : null;

    return (
      <div className="space-y-1.5 px-0.5">
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-red-50 border border-red-100 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <span className="font-medium leading-snug block">
              {isShaderF16
                ? "GPU does not support shader-f16"
                : isStorageError
                  ? "Not enough browser storage"
                  : "Model failed to load"}
            </span>
            <span className="text-red-500/80 leading-snug block">
              {isShaderF16
                ? "This model requires the WebGPU shader-f16 extension. Switch to Qwen 2.5 1.5B or Qwen 3 4B."
                : isStorageError
                  ? loadProgress
                  : loadProgress || "WebGPU required (Chrome/Edge 113+). Check your internet connection and try again."}
            </span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {suggestedModel && onSwitchModel && (
                <button
                  type="button"
                  onClick={() => onSwitchModel(suggestedModel.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-300 bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
                >
                  Switch to {suggestedModel.name} ({suggestedModel.size})
                </button>
              )}
              {!isShaderF16 && !isStorageError && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  Clear cache &amp; retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

// ─── Local model picker ──────────────────────────────────────────────────────

function GhostModelSelector() {
  const selectedModelId = useGhostModeStore((s) => s.selectedModelId);
  const setSelectedModelId = useGhostModeStore((s) => s.setSelectedModelId);
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = findGhostModel(selectedModelId) ?? GHOST_MODELS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false);
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
        <span className="font-medium text-foreground/70 max-w-25 truncate">{selected.shortName}</span>
        {modelStatus === "loading" && <Loader2 size={10} className="text-amber-400 animate-spin shrink-0" />}
        {modelStatus === "ready" && <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />}
        <ChevronDown size={10} className="text-muted-foreground/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-72 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-1.5">
              <Ghost size={12} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground/70">Ghost Models</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">Offline · No data leaves device</span>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {GHOST_MODELS.map((model, idx) => {
              const isSelected = model.id === selectedModelId;
              const isRecommended = model.tags.includes("recommended");
              const needsF16 = model.requiresShaderF16 === true;
              const prevModel = GHOST_MODELS[idx - 1];
              const showDivider = needsF16 && prevModel && !prevModel.requiresShaderF16;
              return (
                <React.Fragment key={model.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 px-3 py-1.5 mt-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] font-medium text-amber-500/70 uppercase tracking-wide flex items-center gap-1">
                        <TriangleAlert size={8} /> Requires shader-f16 GPU
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSelectedModelId(model.id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-accent transition-colors ${isSelected ? "bg-accent" : ""}`}
                  >
                    <div className="mt-1 shrink-0 w-3">
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{model.name}</span>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground">{model.provider}</span>
                        {isRecommended && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Zap size={8} /> Best
                          </span>
                        )}
                        {needsF16 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-100">
                            <TriangleAlert size={8} /> shader-f16
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{model.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/50">Download {model.size}</span>
                        <span className="text-[10px] text-muted-foreground/30">·</span>
                        <span className="text-[10px] text-muted-foreground/50">VRAM {model.vram}</span>
                      </div>
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-border bg-secondary/20">
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Requires Chrome or Edge 113+ with WebGPU. Models marked{" "}
              <span className="text-amber-500 font-medium">shader-f16</span> need a discrete GPU.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ghost Open model picker ─────────────────────────────────────────────────

const CATEGORY_ICONS: Record<GhostApiModelCategory, React.ReactNode> = {
  reasoning: <Cpu size={9} />,
  fast: <Zap size={9} />,
  unrestricted: <ShieldOff size={9} />,
};

const CATEGORY_COLORS: Record<GhostApiModelCategory, string> = {
  reasoning: "bg-indigo-50 text-indigo-600 border-indigo-100",
  fast: "bg-emerald-50 text-emerald-600 border-emerald-100",
  unrestricted: "bg-orange-50 text-orange-600 border-orange-100",
};

function GhostOpenModelSelector() {
  const selectedApiModelId = useGhostModeStore((s) => s.selectedApiModelId);
  const setSelectedApiModelId = useGhostModeStore((s) => s.setSelectedApiModelId);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GhostApiModelCategory>("reasoning");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = findGhostApiModel(selectedApiModelId) ?? GHOST_API_MODELS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredModels = GHOST_API_MODELS.filter((m) => m.category === activeCategory);

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary transition-colors text-xs"
      >
        <Cloud size={11} className="text-amber-400 shrink-0" />
        <span className="font-medium text-foreground/70 flex-1 truncate text-left">{selected.shortName}</span>
        <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium border ${CATEGORY_COLORS[selected.category]}`}>
          {CATEGORY_ICONS[selected.category]}
          {selected.category}
        </span>
        <ChevronDown size={10} className="text-muted-foreground/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-1.5">
              <Cloud size={12} className="text-amber-400" />
              <span className="text-xs font-semibold text-foreground/70">Ghost Open Models</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">via OpenRouter</span>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex border-b border-border">
            {GHOST_API_MODEL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "bg-accent text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9px] ${
                  activeCategory === cat.id ? CATEGORY_COLORS[cat.id] : "bg-transparent border-border text-muted-foreground"
                }`}>
                  {CATEGORY_ICONS[cat.id]}
                </span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="px-3 py-1.5 bg-secondary/20 border-b border-border">
            <p className="text-[10px] text-muted-foreground/60">
              {GHOST_API_MODEL_CATEGORIES.find((c) => c.id === activeCategory)?.description}
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filteredModels.map((model) => {
              const isSelected = model.id === selectedApiModelId;
              const isRecommended = model.tags.includes("recommended");
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => { setSelectedApiModelId(model.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-accent transition-colors ${isSelected ? "bg-accent" : ""}`}
                >
                  <div className="mt-1 shrink-0 w-3">
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{model.name}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground">{model.provider}</span>
                      {isRecommended && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                          <Zap size={8} /> Best
                        </span>
                      )}
                      {model.category === "unrestricted" && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-orange-50 text-orange-600 border border-orange-100">
                          <ShieldOff size={8} /> No filters
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{model.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/50">{model.contextWindow} context</span>
                      <span className="text-[10px] text-muted-foreground/30">·</span>
                      <span className="text-[10px] text-muted-foreground/50">1 credit/query</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-border bg-secondary/20">
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Queries sent to OpenRouter.{" "}
              <span className="text-orange-500 font-medium">Unrestricted</span> models have no content filters.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Ghost Mode Toggle ──────────────────────────────────────────────────
// Two independent rows:
//   Row 1 — Ghost (local WebLLM, private & offline)
//   Row 2 — Ghost Open (OpenRouter, cloud, no restrictions)
// Enabling one automatically disables the other.

export function GhostModeToggle() {
  const enabled = useGhostModeStore((s) => s.enabled);
  const setEnabled = useGhostModeStore((s) => s.setEnabled);
  const ghostOpenEnabled = useGhostModeStore((s) => s.ghostOpenEnabled);
  const setGhostOpenEnabled = useGhostModeStore((s) => s.setGhostOpenEnabled);
  const modelStatus = useGhostModeStore((s) => s.modelStatus);
  const selectedModelId = useGhostModeStore((s) => s.selectedModelId);
  const setSelectedModelId = useGhostModeStore((s) => s.setSelectedModelId);
  const { loadModel } = useGhostLLM();

  const selectedModel = findGhostModel(selectedModelId) ?? GHOST_MODELS[0];

  const handleRetry = React.useCallback(() => {
    loadModel(selectedModelId);
  }, [loadModel, selectedModelId]);

  const handleSwitchModel = React.useCallback((id: string) => {
    setSelectedModelId(id);
  }, [setSelectedModelId]);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Both toggle buttons inline ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all text-xs font-medium shrink-0 ${
            enabled
              ? "bg-foreground text-card border-foreground"
              : "bg-transparent border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground/70"
          }`}
          title={enabled ? "Disable Ghost Mode (local AI)" : "Enable Ghost Mode — private & offline, no content filters"}
        >
          <Ghost size={13} className={`transition-transform ${enabled ? "scale-110" : ""}`} />
          <span>Ghost</span>
          <StatusDot />
        </button>

        <button
          type="button"
          onClick={() => setGhostOpenEnabled(!ghostOpenEnabled)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all text-xs font-medium shrink-0 ${
            ghostOpenEnabled
              ? "bg-amber-400/15 text-amber-700 border-amber-300"
              : "bg-transparent border-border text-muted-foreground hover:border-amber-300/60 hover:text-foreground/70"
          }`}
          title={ghostOpenEnabled ? "Disable Ghost Open (cloud AI)" : "Enable Ghost Open — cloud models via OpenRouter, unrestricted"}
        >
          <Cloud size={13} className={`transition-transform ${ghostOpenEnabled ? "scale-110" : ""}`} />
          <span>Ghost Open</span>
          {ghostOpenEnabled && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
        </button>
      </div>

      {/* ── Ghost (local) options ── */}
      {enabled && (
        <div className="flex flex-col gap-2">
          {(modelStatus === "loading" || modelStatus === "error") && (
            <GhostLoadingBar
              onRetry={modelStatus === "error" ? handleRetry : undefined}
              onSwitchModel={handleSwitchModel}
            />
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <GhostModelSelector />
            {modelStatus === "idle" && (
              <button
                type="button"
                onClick={() => loadModel(selectedModelId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-foreground/25 bg-foreground/8 hover:bg-foreground/15 transition-colors text-xs font-medium text-foreground/80 shrink-0"
              >
                <Download size={11} />
                <span>Load</span>
                <span className="text-muted-foreground/55 text-[10px]">{selectedModel.size}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Ghost Open (OpenRouter) options ── */}
      {ghostOpenEnabled && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <GhostOpenModelSelector />
            <GhostCredits variant="badge" />
          </div>
          <div className="pl-1">
            <GhostCredits variant="widget" />
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export for use in chat page
export { GhostLoadingBar };
