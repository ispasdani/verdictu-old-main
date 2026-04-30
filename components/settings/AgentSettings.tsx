"use client";

import React, { useRef } from "react";
import { Settings, Eye, EyeOff, ChevronDown, Download, Upload } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentConfigStore } from "@/store/agentConfigStore";
import { CLAUDE_MODELS } from "@/lib/agent/config";

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Radio option ─────────────────────────────────────────────────────────────

function RadioOption({
  checked,
  onSelect,
  label,
  description,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-start gap-2.5 w-full text-left"
      >
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border transition-colors">
          {checked && (
            <span className="h-2 w-2 rounded-full bg-foreground" />
          )}
        </span>
        <div>
          <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </button>
      {checked && children && <div className="pl-6 space-y-2">{children}</div>}
    </div>
  );
}

// ─── Checkbox option ──────────────────────────────────────────────────────────

function CheckOption({
  checked,
  onToggle,
  label,
  disabled,
  hint,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-2.5 w-full text-left disabled:opacity-40"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border transition-colors">
          {checked && (
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none">
              <path
                d="M1.5 5l2.5 2.5 4.5-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-sm text-foreground leading-tight">
          {label}
          {hint && (
            <span className="ml-1 text-xs text-muted-foreground">{hint}</span>
          )}
        </span>
      </button>
      {checked && children && <div className="pl-6">{children}</div>}
    </div>
  );
}

// ─── API key input with show/hide ─────────────────────────────────────────────

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-8 font-mono text-xs h-8"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

// ─── Model selector ───────────────────────────────────────────────────────────

function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = CLAUDE_MODELS.find((m) => m.id === value) ?? CLAUDE_MODELS[0];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
      >
        {CLAUDE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentSettings({ trigger }: { trigger: React.ReactNode }) {
  const provider = useAgentConfigStore((s) => s.provider);
  const claudeApiKey = useAgentConfigStore((s) => s.claudeApiKey ?? "");
  const claudeModel = useAgentConfigStore((s) => s.claudeModel);
  const storageMode = useAgentConfigStore((s) => s.storageMode);
  const useConvexRag = useAgentConfigStore((s) => s.useConvexRag);
  const tavilyKey = useAgentConfigStore((s) => s.tavilyKey ?? "");

  const setProvider = useAgentConfigStore((s) => s.setProvider);
  const setClaudeApiKey = useAgentConfigStore((s) => s.setClaudeApiKey);
  const setClaudeModel = useAgentConfigStore((s) => s.setClaudeModel);
  const setStorageMode = useAgentConfigStore((s) => s.setStorageMode);
  const setUseConvexRag = useAgentConfigStore((s) => s.setUseConvexRag);
  const setTavilyKey = useAgentConfigStore((s) => s.setTavilyKey);

  const importRef = useRef<HTMLInputElement>(null);

  const [useBYOTavily, setUseBYOTavily] = React.useState(!!tavilyKey);

  function handleExport() {
    const data = JSON.stringify({ exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verdictu-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    importRef.current?.click();
  }

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>

      <SheetContent side="left" className="w-80 sm:max-w-80 overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold">Agent Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Configure how Verdictu runs your legal agent.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-5 space-y-7">

          {/* ── Provider ── */}
          <Section title="Provider">
            <RadioOption
              checked={provider === "ghost_local"}
              onSelect={() => setProvider("ghost_local")}
              label="Ghost Local"
              description="On-device model, no internet required"
            />
            <RadioOption
              checked={provider === "ghost_open"}
              onSelect={() => setProvider("ghost_open")}
              label="Ghost Open"
              description="Your Claude API key — full agentic loop"
            >
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Claude API Key</label>
                <SecretInput
                  value={claudeApiKey}
                  onChange={setClaudeApiKey}
                  placeholder="sk-ant-..."
                />
                <label className="text-xs text-muted-foreground">Model</label>
                <ModelSelector value={claudeModel} onChange={setClaudeModel} />
              </div>
            </RadioOption>
          </Section>

          <div className="border-t border-border" />

          {/* ── Storage ── */}
          <Section title="Storage">
            <RadioOption
              checked={storageMode === "local_only"}
              onSelect={() => setStorageMode("local_only")}
              label="Local only"
              description="All data stays in your browser"
            />
            <RadioOption
              checked={storageMode === "convex"}
              onSelect={() => setStorageMode("convex")}
              label="Sync with Verdictu"
              description="Encrypted, cross-device"
            />
          </Section>

          <div className="border-t border-border" />

          {/* ── Research ── */}
          <Section title="Research">
            <CheckOption
              checked={useConvexRag}
              onToggle={() => setUseConvexRag(!useConvexRag)}
              disabled={storageMode !== "convex"}
              label="Use Verdictu law database"
              hint="(requires Sync)"
            />
            <CheckOption
              checked={useBYOTavily}
              onToggle={() => {
                const next = !useBYOTavily;
                setUseBYOTavily(next);
                if (!next) setTavilyKey("");
              }}
              label="Bring your own Tavily key"
            >
              <SecretInput
                value={tavilyKey}
                onChange={setTavilyKey}
                placeholder="tvly-..."
              />
            </CheckOption>
          </Section>

          <div className="border-t border-border" />

          {/* ── Privacy ── */}
          <Section title="Privacy">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/70 transition-colors"
            >
              <Download size={13} className="shrink-0" />
              Export all my data
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/70 transition-colors"
            >
              <Upload size={13} className="shrink-0" />
              Import conversation
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".verdictu,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Phase 3 will handle full import
                e.target.value = "";
              }}
            />
          </Section>

        </div>
      </SheetContent>
    </Sheet>
  );
}
