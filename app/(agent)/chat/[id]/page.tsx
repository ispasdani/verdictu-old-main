"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  Globe,
  BookOpen,
  Scale,
  Brain,
  FileText,
  HelpCircle,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Gavel,
  Layers,
  Ghost,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AIChatInput from "@/components/agent-general/aiChatInput";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { useGhostLLM } from "@/hooks/useGhostLLM";
import { findGhostModel } from "@/lib/ghost/models";

// ─── Spinner verbs ─────────────────────────────────────────────────────────────
// Cycles through these during long-running steps

const SPINNER_VERBS = [
  "Analyzing",
  "Searching",
  "Retrieving",
  "Processing",
  "Reasoning",
  "Synthesizing",
  "Reviewing",
  "Scanning",
  "Extracting",
  "Identifying",
  "Evaluating",
  "Cross-referencing",
];

// Braille spinner frames (like Claude Code)
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LawItem {
  name: string;
  citation: string;
  relevance: "primary" | "secondary" | "supplementary";
  confidence: number;
  applies_because: string;
}

interface Source {
  title: string;
  url: string;
  domain?: string;
}

interface AgentStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: "pending" | "running" | "completed";
  summary?: string;
  detail?: React.ReactNode;
}

interface AgentEvent {
  step: string;
  data: Record<string, unknown>;
}

// ─── Jurisdiction label ────────────────────────────────────────────────────────

function jurisdictionLabel(j: string): string {
  const map: Record<string, string> = {
    auto: "Auto-detected",
    dk: "Denmark",
    eu: "European Union",
    de: "Germany",
    uk: "United Kingdom",
    fr: "France",
    se: "Sweden",
    nl: "Netherlands",
    us: "United States",
    ro: "Romania",
  };
  return map[j.toLowerCase()] ?? j.toUpperCase();
}

// ─── Simple Markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-semibold text-foreground mt-5 mb-2 first:mt-0"
        >
          {inline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-sm font-semibold text-foreground mt-4 mb-1.5"
        >
          {inline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("**Sources**") || line.startsWith("## Sources")) {
      elements.push(
        <div
          key={i}
          className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-5 mb-2"
        >
          Sources
        </div>,
      );
    } else if (line.match(/^\[\d+\] /)) {
      // Numbered citation line [1] Title — URL
      const match = line.match(/^\[(\d+)\] (.+?)(?: — (https?:\/\/\S+))?$/);
      if (match) {
        const [, num, title, url] = match;
        elements.push(
          <div key={i} className="flex items-start gap-1.5 text-xs mb-1">
            <span className="text-muted-foreground/50 shrink-0">[{num}]</span>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {title}
                <ExternalLink size={9} className="shrink-0" />
              </a>
            ) : (
              <span className="text-foreground/70">{title}</span>
            )}
          </div>,
        );
      } else {
        elements.push(
          <p key={i} className="text-sm text-foreground/70 mb-1">
            {inline(line)}
          </p>,
        );
      }
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm text-foreground/80 mb-1">
          <span className="text-muted-foreground/50 shrink-0 mt-0.5">·</span>
          <span>{inline(line.slice(2))}</span>
        </div>,
      );
    } else if (line.match(/^\d+\. /)) {
      const numMatch = line.match(/^(\d+)\. (.+)$/);
      if (numMatch) {
        elements.push(
          <div key={i} className="flex items-start gap-2.5 text-sm text-foreground/80 mb-1.5">
            <span className="w-5 h-5 rounded bg-secondary border border-border text-foreground/50 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <span>{inline(numMatch[2])}</span>
          </div>,
        );
      }
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      elements.push(
        <p key={i} className="text-xs text-muted-foreground italic mt-4 pt-3 border-t border-border/50">
          {line.slice(1, -1)}
        </p>,
      );
    } else if (line.startsWith("|")) {
      // Simple table row — render as-is for now
      elements.push(
        <p key={i} className="text-xs font-mono text-foreground/70 mb-0.5">
          {line}
        </p>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-1">
          {inline(line)}
        </p>,
      );
    }

    i++;
  }

  return <>{elements}</>;
}

// Inline formatting: **bold**, *italic*, `code`, [n]
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 bg-secondary rounded text-xs font-mono text-foreground/80">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.match(/^\[\d+\]$/)) {
      return (
        <sup key={i} className="text-indigo-600 text-[10px] font-medium cursor-pointer">
          {part}
        </sup>
      );
    }
    return part;
  });
}

// ─── Status Line ───────────────────────────────────────────────────────────────
// Claude Code / Antigravity style: lower opacity, cycling spinner + verb

function StatusLine({
  message,
  running,
  elapsedMs,
}: {
  message: string;
  running: boolean;
  elapsedMs: number;
}) {
  const [frame, setFrame] = useState(0);
  const [verbIdx, setVerbIdx] = useState(0);

  useEffect(() => {
    if (!running) return;
    const spinTimer = setInterval(
      () => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
      80,
    );
    const verbTimer = setInterval(
      () => setVerbIdx((v) => (v + 1) % SPINNER_VERBS.length),
      2200,
    );
    return () => {
      clearInterval(spinTimer);
      clearInterval(verbTimer);
    };
  }, [running]);

  if (!running) return null;

  const elapsed = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground/50 font-mono select-none">
      <span className="text-muted-foreground/40 tabular-nums w-3 shrink-0">
        {SPINNER_FRAMES[frame]}
      </span>
      <span className="text-muted-foreground/60 font-medium">
        {SPINNER_VERBS[verbIdx]}
      </span>
      <span className="truncate">{message}</span>
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/30">
        {elapsed}s
      </span>
    </div>
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  expanded,
  onToggle,
  isLast,
}: {
  step: AgentStep;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const Icon = step.icon;
  const isDone = step.status === "completed";
  const isRunning = step.status === "running";
  const isPending = step.status === "pending";

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center shrink-0 w-4 mt-1.5">
        <div className="shrink-0 w-4 flex items-center justify-center z-10">
          {isRunning && (
            <div className="w-3 h-3 rounded-full border-2 border-foreground/30 border-t-foreground/70 animate-spin" />
          )}
          {isDone && <CheckCircle2 size={12} className="text-foreground/40" />}
          {isPending && (
            <div className="w-2 h-2 rounded-full border border-muted-foreground/20" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 mt-1 min-h-4 ${isDone ? "bg-border" : "bg-border/30"}`}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <button
          type="button"
          className={`group w-full flex items-center gap-2 py-0.5 text-left transition-colors ${
            isDone ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={isDone ? onToggle : undefined}
          tabIndex={isDone ? 0 : -1}
        >
          <Icon
            size={12}
            className={
              isPending
                ? "text-muted-foreground/25 shrink-0"
                : isDone
                  ? "text-muted-foreground/60 shrink-0"
                  : "text-foreground/70 shrink-0 animate-pulse"
            }
          />

          <span
            className={`text-sm flex-1 truncate ${
              isPending
                ? "text-muted-foreground/30"
                : isRunning
                  ? "text-foreground font-medium"
                  : "text-foreground/65"
            }`}
          >
            {step.label}
          </span>

          {isDone && step.summary && (
            <span className="text-xs text-muted-foreground/50 truncate max-w-52 hidden sm:block">
              {step.summary}
            </span>
          )}

          {isDone && (
            <span className="shrink-0 ml-1">
              {expanded ? (
                <ChevronDown size={12} className="text-muted-foreground/50" />
              ) : (
                <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
              )}
            </span>
          )}
        </button>

        {isDone && expanded && step.detail && (
          <div className="mt-2 mb-1 pl-3 border-l border-border">
            {step.detail}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Initial steps ────────────────────────────────────────────────────────────

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "intake", label: "Jurisdiction & Mode", icon: Globe, status: "pending" },
    { id: "identifying", label: "Law Identification", icon: Brain, status: "pending" },
    { id: "searching", label: "Deep Search", icon: Search, status: "pending" },
    { id: "synthesizing", label: "Legal Analysis", icon: Scale, status: "pending" },
    { id: "follow_up", label: "Follow-up Questions", icon: HelpCircle, status: "pending" },
  ];
}

// ─── Ghost mode steps ─────────────────────────────────────────────────────────

function buildGhostSteps(): AgentStep[] {
  return [
    { id: "ghost_init", label: "Ghost Mode", icon: Ghost, status: "pending" },
    { id: "ghost_thinking", label: "Local Inference", icon: Brain, status: "pending" },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const text = useChatComposerStore((s) => s.text);
  const mode = useChatComposerStore((s) => s.mode);
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const citationEnabled = useChatComposerStore((s) => s.citationEnabled);
  const attachments = useChatComposerStore((s) => s.attachments);

  // Ghost mode
  const ghostEnabled = useGhostModeStore((s) => s.enabled);
  const ghostModelId = useGhostModeStore((s) => s.selectedModelId);
  const ghostModelStatus = useGhostModeStore((s) => s.modelStatus);
  const { generate: ghostGenerate, isReady: ghostIsReady } = useGhostLLM();
  const ghostModel = findGhostModel(ghostModelId);

  const jLabel = jurisdictionLabel(jurisdiction);

  // Agent state
  const [steps, setSteps] = useState<AgentStep[]>(() =>
    ghostEnabled ? buildGhostSteps() : buildInitialSteps(),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState("Starting…");
  const [answerText, setAnswerText] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [laws, setLaws] = useState<LawItem[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(Date.now());
  const answerRef = useRef("");

  // ── Step helpers ────────────────────────────────────────────────────────────

  const updateStep = useCallback((id: string, patch: Partial<AgentStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const toggleStep = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Ghost mode runner ────────────────────────────────────────────────────────

  const runGhost = useCallback(
    async (ticker: ReturnType<typeof setInterval>) => {
      // Step 1 — Ghost init
      updateStep("ghost_init", { status: "running" });
      setStatusMsg(`Loading ${ghostModel?.name ?? "local model"}…`);

      // Wait for the model to be ready (it may still be loading)
      if (ghostModelStatus !== "ready" || !ghostIsReady) {
        setStatusMsg("Waiting for model to finish loading…");
        // Poll until ready or error
        await new Promise<void>((resolve, reject) => {
          const check = setInterval(() => {
            const status = useGhostModeStore.getState().modelStatus;
            if (status === "ready") {
              clearInterval(check);
              resolve();
            } else if (status === "error") {
              clearInterval(check);
              reject(new Error("Model failed to load. WebGPU required (Chrome/Edge 113+)."));
            }
          }, 500);
        });
      }

      updateStep("ghost_init", {
        status: "completed",
        summary: ghostModel?.name ?? "Local model",
        detail: (
          <div className="space-y-1 text-xs text-foreground/70">
            <div className="flex items-center gap-1.5 py-1 border-b border-border/40">
              <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
              <span>Your data never leaves this device</span>
            </div>
            <div className="flex items-center gap-1.5 py-1 border-b border-border/40">
              <WifiOff size={11} className="text-muted-foreground/60 shrink-0" />
              <span>No internet required for inference</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium">{ghostModel?.name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{ghostModel?.provider}</span>
            </div>
          </div>
        ),
      });

      // Step 2 — Local inference
      updateStep("ghost_thinking", { status: "running" });
      setStatusMsg("Running local inference…");

      const docContext = attachments
        .filter((a) => a.status === "done" && a.extractedText)
        .map((a) => `=== ${a.name} ===\n${a.extractedText}`)
        .join("\n\n");

      const systemPrompt = [
        `You are a legal AI assistant specializing in ${jurisdictionLabel(jurisdiction)} law.`,
        `Mode: ${mode}. Citations: ${citationEnabled ? "enabled" : "disabled"}.`,
        `Be thorough but concise. Use headings where helpful. Cite specific laws or statutes when relevant.`,
        docContext ? `\n\nAttached documents:\n${docContext}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await ghostGenerate({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        onToken: (token) => {
          answerRef.current += token;
          setAnswerText(answerRef.current);
        },
        onDone: () => {
          updateStep("ghost_thinking", {
            status: "completed",
            summary: `${answerRef.current.split(/\s+/).length} words`,
          });
          setStatusMsg("Complete");
          setIsDone(true);
        },
        onError: (err) => {
          setError(err);
        },
      });

      clearInterval(ticker);
      setIsRunning(false);
      setElapsedMs(Date.now() - startTimeRef.current);
    },
    [
      ghostModel,
      ghostModelStatus,
      ghostIsReady,
      ghostGenerate,
      text,
      mode,
      jurisdiction,
      citationEnabled,
      attachments,
      updateStep,
    ],
  );

  // ── SSE / Ghost dispatch ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!text.trim()) return;

    startTimeRef.current = Date.now();
    setIsRunning(true);

    const ticker = setInterval(
      () => setElapsedMs(Date.now() - startTimeRef.current),
      100,
    );

    if (ghostEnabled) {
      runGhost(ticker).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        clearInterval(ticker);
        setIsRunning(false);
      });
      return () => clearInterval(ticker);
    }

    const run = async () => {
      try {
        const body = {
          message: text,
          jurisdiction: jurisdiction.toUpperCase(),
          mode,
          citationEnabled,
          attachments: attachments
            .filter((a) => a.status === "done" && a.extractedText)
            .map((a) => ({ filename: a.name, text: a.extractedText! })),
        };

        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            try {
              const event: AgentEvent = JSON.parse(part.slice(6));
              handleEvent(event);
            } catch {
              // Malformed event — skip
            }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Connection to agent failed",
        );
        setIsRunning(false);
      } finally {
        clearInterval(ticker);
        setIsRunning(false);
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    };

    run();
    return () => clearInterval(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Event dispatcher ────────────────────────────────────────────────────────

  const handleEvent = (event: AgentEvent) => {
    const { step, data } = event;

    switch (step) {
      case "intake":
        setStatusMsg("Locking jurisdiction and mode…");
        updateStep("intake", {
          status: "running",
        });
        break;

      case "identifying":
        updateStep("intake", {
          status: "completed",
          summary: `${jLabel} · ${String(data.mode ?? "General")} mode`,
          detail: (
            <div className="space-y-1 text-xs text-foreground/70">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Jurisdiction</span>
                <span className="font-medium">{jLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-medium">{String(data.mode ?? "General")}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Citations</span>
                <span className="font-medium">{citationEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          ),
        });
        updateStep("identifying", { status: "running" });
        setStatusMsg("Identifying applicable laws and statutes…");
        break;

      case "laws_found": {
        const foundLaws = (data.laws as LawItem[]) ?? [];
        setLaws(foundLaws);
        const primaryLaws = foundLaws.filter((l) => l.relevance === "primary");
        updateStep("identifying", {
          status: "completed",
          summary: `${foundLaws.length} statute${foundLaws.length !== 1 ? "s" : ""} · ${String(data.domain ?? "")}`,
          detail:
            foundLaws.length > 0 ? (
              <div className="space-y-2">
                {foundLaws.map((law, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-secondary rounded-md border border-border/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground/80">
                        {law.citation}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          law.relevance === "primary"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {law.relevance}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {law.applies_because}
                    </p>
                    <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground/30 rounded-full"
                        style={{ width: `${Math.round(law.confidence * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {Math.round(law.confidence * 100)}% confidence
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No specific statutes identified — using general legal principles.
              </p>
            ),
        });

        setStatusMsg(
          primaryLaws.length > 0
            ? `Found ${primaryLaws.length} primary statute${primaryLaws.length !== 1 ? "s" : ""}…`
            : "Proceeding with research…",
        );
        break;
      }

      case "searching": {
        updateStep("searching", {
          status: "running",
          summary: undefined,
        });
        const idx = Number(data.index ?? 1);
        const total = Number(data.total ?? 1);
        const query = String(data.query ?? "");
        setStatusMsg(
          `Searching ${idx}/${total}: "${query.slice(0, 60)}${query.length > 60 ? "…" : ""}"`,
        );
        break;
      }

      case "search_results":
        // Intermediate — update status only
        setStatusMsg(
          `Found ${Number(data.count ?? 0)} sources for "${String(data.query ?? "").slice(0, 50)}…"`,
        );
        break;

      case "sources_ranked": {
        const total = Number(data.total ?? 0);
        const engine = String(data.searchEngine ?? "Web");
        updateStep("searching", {
          status: "completed",
          summary: `${total} source${total !== 1 ? "s" : ""} · ${engine}`,
          detail: (
            <p className="text-xs text-muted-foreground">
              {total} deduplicated sources retrieved via {engine}. Top sources
              ranked by domain authority and relevance score.
            </p>
          ),
        });
        setStatusMsg(`Ranked ${total} sources · beginning synthesis…`);
        break;
      }

      case "synthesizing":
        updateStep("synthesizing", { status: "running" });
        setStatusMsg("Composing legal analysis…");
        break;

      case "delta": {
        const token = String(data.text ?? "");
        answerRef.current += token;
        setAnswerText(answerRef.current);
        break;
      }

      case "follow_up_generating":
        updateStep("synthesizing", {
          status: "completed",
          summary: `${answerRef.current.split(/\s+/).length} words`,
        });
        updateStep("follow_up", { status: "running" });
        setStatusMsg("Generating follow-up questions…");
        break;

      case "done": {
        const doneSources = (data.sources as Source[]) ?? [];
        const doneLaws = (data.laws as LawItem[]) ?? [];
        const doneQuestions = (data.followUpQuestions as string[]) ?? [];

        setSources(doneSources);
        if (doneLaws.length > 0) setLaws(doneLaws);
        setFollowUpQuestions(doneQuestions);

        updateStep("follow_up", {
          status: "completed",
          summary: `${doneQuestions.length} question${doneQuestions.length !== 1 ? "s" : ""}`,
        });

        setStatusMsg("Complete");
        setIsDone(true);
        break;
      }

      case "error":
        setError(String(data.message ?? "Unknown error"));
        break;
    }
  };

  const completedCount = steps.filter((s) => s.status === "completed").length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[98vh] w-[98.5%] pb-10 relative bg-card rounded-lg border border-border shadow-sm">
      <div className="absolute top-4 left-4 z-10">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pt-12">
        <div className="max-w-3xl mx-auto px-4 pb-8 space-y-3">

          {/* ── User question ── */}
          <div className="bg-secondary/50 rounded-lg border border-border p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0 text-foreground/50 text-xs font-bold mt-0.5">
                U
              </div>
              <div className="flex-1 min-w-0">
                {text ? (
                  <p className="text-foreground text-[15px] leading-relaxed">
                    {text}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">
                    No question provided.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                    <Globe size={9} />
                    {jLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                    {mode} mode
                  </span>
                  {ghostEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground border border-foreground/20 text-xs text-card">
                      <Ghost size={9} />
                      Ghost Mode · {ghostModel?.shortName ?? "Local"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-xs text-indigo-600">
                      <Search size={9} />
                      Deep Search
                    </span>
                  )}
                  {attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                      <FileText size={9} />
                      {attachments.length} attachment
                      {attachments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Ghost mode: model not ready warning ── */}
          {ghostEnabled && ghostModelStatus === "loading" && !error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
              <Ghost size={13} className="shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-semibold">Downloading model…</span>
                {" "}This may take a moment the first time. The model is cached locally after the first download.
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Agent error</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ── Agent steps card ── */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                  <Sparkles size={8} className="text-foreground/50" />
                </div>
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {ghostEnabled && <Ghost size={12} className="text-foreground/60" />}
                  {ghostEnabled ? "Ghost AI" : "Legal AI Agent"}
                </span>
                {!isDone && !error ? (
                  <span className="text-xs text-muted-foreground/60">
                    · {completedCount}/{steps.length} steps
                  </span>
                ) : isDone ? (
                  <span className="text-xs font-medium text-green-600">
                    · Done in {(elapsedMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </div>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = steps
                      .filter((s) => s.status === "completed")
                      .map((s) => s.id);
                    const allExpanded = allIds.every((id) =>
                      expandedIds.has(id),
                    );
                    if (allExpanded) {
                      setExpandedIds(new Set());
                    } else {
                      setExpandedIds(new Set(allIds));
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  {steps
                    .filter((s) => s.status === "completed")
                    .every((s) => expandedIds.has(s.id))
                    ? "Collapse all"
                    : "Expand all"}
                </button>
              )}
            </div>

            {/* Status line — Claude Code style */}
            <StatusLine
              message={statusMsg}
              running={isRunning && !isDone}
              elapsedMs={elapsedMs}
            />

            {/* Steps */}
            <div className="px-4 py-3">
              {steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  expanded={expandedIds.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                  isLast={i === steps.length - 1}
                />
              ))}
            </div>
          </div>

          {/* ── Streaming answer ── */}
          {answerText && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 bg-secondary/40">
                <div className="w-5 h-5 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0">
                  <Gavel size={10} className="text-foreground/50" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Legal Analysis
                </span>
                {!isDone && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />
                )}
              </div>
              <div className="px-5 py-5">
                {renderMarkdown(answerText)}
                {/* Cursor while streaming */}
                {!isDone && (
                  <span className="inline-block w-0.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            </div>
          )}

          {/* ── Sources ── */}
          {isDone && sources.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <BookOpen size={12} className="text-muted-foreground/60" />
                <span className="text-sm font-medium text-foreground">
                  Sources
                </span>
                <span className="text-xs text-muted-foreground/50 ml-auto">
                  {sources.length} retrieved
                </span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1.5 hover:bg-secondary/50 rounded px-1.5 -mx-1.5 transition-colors group"
                  >
                    <span className="text-[10px] text-muted-foreground/40 w-4 shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground/75 truncate group-hover:text-foreground transition-colors">
                        {s.title}
                      </div>
                      {s.domain && (
                        <div className="text-[10px] text-muted-foreground/50">
                          {s.domain}
                        </div>
                      )}
                    </div>
                    <ExternalLink
                      size={10}
                      className="text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Identified laws (sidebar card) ── */}
          {isDone && laws.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Layers size={12} className="text-muted-foreground/60" />
                <span className="text-sm font-medium text-foreground">
                  Applicable Laws
                </span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {laws.map((law, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                        law.relevance === "primary"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {law.relevance === "primary"
                        ? "PRIMARY"
                        : law.relevance === "secondary"
                          ? "SEC"
                          : "SUPP"}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-foreground/80">
                        {law.citation}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {law.applies_because}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Follow-up questions ── */}
          {isDone && followUpQuestions.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle size={13} className="text-amber-600 shrink-0" />
                <span className="text-sm font-medium text-amber-800">
                  To sharpen the analysis, please confirm:
                </span>
              </div>
              <ul className="space-y-2.5">
                {followUpQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-amber-800"
                  >
                    <span className="w-5 h-5 rounded bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>

      {/* Sticky chat input */}
      <AIChatInput />
    </div>
  );
}
