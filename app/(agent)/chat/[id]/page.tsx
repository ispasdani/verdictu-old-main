"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  useChatComposerStore,
  type AttachmentItem,
} from "@/store/chatComposerStore";
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
  Copy,
  Check,
  Square,
  Cloud as CloudIcon,
  HardDrive as HardDriveIcon,
  Download as DownloadIcon,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AIChatInput from "@/components/agent-general/aiChatInput";
import { useGhostModeStore } from "@/store/ghostModeStore";
import { useGhostLLM } from "@/hooks/useGhostLLM";
import { findGhostModel } from "@/lib/ghost/models";
import { findGhostApiModel } from "@/lib/ghost/openrouter";
import { runGhostAgent } from "@/lib/ghost/agent";
import { useChatStorageStore } from "@/store/chatStorageStore";
import { useImportedChatStore } from "@/store/importedChatStore";
import { exportChatToFile } from "@/lib/chat/exportChat";

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

interface ConvMsg {
  role: "user" | "assistant";
  content: string;
}

interface CompletedTurn {
  userText: string;
  userAttachments: { name: string; extractedText: string }[];
  userJurisdiction: string;
  userMode: string;
  assistantText: string;
  sources: Source[];
  laws: LawItem[];
  elapsedMs: number;
  isGhost: boolean;
  isGhostOpen: boolean;
  ghostModelName?: string;
}

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

// Detects common legal citation patterns in prose text and renders them as chips
const LAW_CHIP_REGEX =
  /\b((?:Art(?:icle)?\.?\s*\d+(?:\(\d+\))?(?:\([a-z]\))?(?:\s+(?:GDPR|DSA|DMA|AI Act|DSGVO|CCPA|HIPAA|NIS2|ePrivacy|TFEU|ECHR))?)|(?:§+\s*\d+(?:\s*(?:Abs\.|para\.)\s*\d+)?(?:\s+[A-Z][A-Za-z]+)?)|(?:Regulation\s+\(EU\)\s+\d{4}\/\d+)|(?:Directive\s+\d{4}\/\d+\/EU))\b/g;

function renderMarkdown(
  text: string,
  onCiteClick?: (n: number) => void,
): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  // Collect table rows for grouped rendering
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-semibold text-foreground mt-5 mb-2 first:mt-0"
        >
          {inline(line.slice(3), onCiteClick)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-sm font-semibold text-foreground mt-4 mb-1.5"
        >
          {inline(line.slice(4), onCiteClick)}
        </h3>,
      );
    } else if (
      line.startsWith("**Sources**") ||
      line.startsWith("## Sources")
    ) {
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
            {inline(line, onCiteClick)}
          </p>,
        );
      }
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div
          key={i}
          className="flex items-start gap-2 text-sm text-foreground/80 mb-1"
        >
          <span className="text-muted-foreground/50 shrink-0 mt-0.5">·</span>
          <span>{inline(line.slice(2), onCiteClick)}</span>
        </div>,
      );
    } else if (line.match(/^\d+\. /)) {
      const numMatch = line.match(/^(\d+)\. (.+)$/);
      if (numMatch) {
        elements.push(
          <div
            key={i}
            className="flex items-start gap-2.5 text-sm text-foreground/80 mb-1.5"
          >
            <span className="w-5 h-5 rounded bg-secondary border border-border text-foreground/50 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <span>{inline(numMatch[2], onCiteClick)}</span>
          </div>,
        );
      }
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      elements.push(
        <p
          key={i}
          className="text-xs text-muted-foreground italic mt-4 pt-3 border-t border-border/50"
        >
          {line.slice(1, -1)}
        </p>,
      );
    } else if (line.startsWith("|")) {
      // Collect all consecutive table rows then render as a real table
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [headerRow, , ...bodyRows] = tableLines; // skip separator row
      const parseRow = (r: string) =>
        r
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {parseRow(headerRow).map((cell, ci) => (
                  <th
                    key={ci}
                    className="text-left px-3 py-2 bg-secondary border border-border font-semibold text-foreground/80"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="even:bg-secondary/30">
                  {parseRow(row).map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-1.5 border border-border text-foreground/70"
                    >
                      {inline(cell, onCiteClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue; // i already advanced
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-1">
          {inline(line, onCiteClick)}
        </p>,
      );
    }

    i++;
  }

  return <>{elements}</>;
}

// Inline formatting: **bold**, *italic*, `code`, [n] citations, law chips
function inline(
  text: string,
  onCiteClick?: (n: number) => void,
): React.ReactNode {
  // Split on bold, italic, code, citation refs, and law chips
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 bg-secondary rounded text-xs font-mono text-foreground/80"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.match(/^\[\d+\]$/)) {
      const n = parseInt(part.slice(1, -1), 10);
      return (
        <sup
          key={i}
          onClick={() => onCiteClick?.(n)}
          className={`text-indigo-600 text-[10px] font-medium ${onCiteClick ? "cursor-pointer hover:text-indigo-800 underline underline-offset-2" : ""}`}
        >
          {part}
        </sup>
      );
    }
    // Detect law citation chips in plain text segments
    const chipParts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    LAW_CHIP_REGEX.lastIndex = 0;
    while ((m = LAW_CHIP_REGEX.exec(part)) !== null) {
      if (m.index > last) chipParts.push(part.slice(last, m.index));
      chipParts.push(
        <span
          key={`chip-${i}-${m.index}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium mx-0.5"
        >
          {m[0]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (chipParts.length > 0) {
      if (last < part.length) chipParts.push(part.slice(last));
      return <React.Fragment key={i}>{chipParts}</React.Fragment>;
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
                <ChevronRight
                  size={12}
                  className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
                />
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
    {
      id: "intake",
      label: "Jurisdiction & Mode",
      icon: Globe,
      status: "pending",
    },
    {
      id: "identifying",
      label: "Law Identification",
      icon: Brain,
      status: "pending",
    },
    { id: "searching", label: "Deep Search", icon: Search, status: "pending" },
    {
      id: "synthesizing",
      label: "Legal Analysis",
      icon: Scale,
      status: "pending",
    },
    {
      id: "follow_up",
      label: "Follow-up Questions",
      icon: HelpCircle,
      status: "pending",
    },
  ];
}

// ─── Ghost mode steps ─────────────────────────────────────────────────────────

function buildGhostSteps(): AgentStep[] {
  return [
    { id: "ghost_init", label: "Ghost Mode", icon: Ghost, status: "pending" },
    {
      id: "classifying",
      label: "Analyzing Question",
      icon: Brain,
      status: "pending",
    },
    // "searching" step is inserted dynamically when intent requires web search
    {
      id: "synthesizing",
      label: "Generating Response",
      icon: Scale,
      status: "pending",
    },
    {
      id: "follow_up",
      label: "Follow-up Questions",
      icon: HelpCircle,
      status: "pending",
    },
  ];
}

function buildGhostOpenSteps(): AgentStep[] {
  return [
    { id: "ghost_init", label: "Ghost Open", icon: Ghost, status: "pending" },
    {
      id: "classifying",
      label: "Analyzing Question",
      icon: Brain,
      status: "pending",
    },
    // "searching" step is inserted dynamically when intent requires web search
    {
      id: "synthesizing",
      label: "Generating Response",
      icon: Scale,
      status: "pending",
    },
    {
      id: "follow_up",
      label: "Follow-up Questions",
      icon: HelpCircle,
      status: "pending",
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const text = useChatComposerStore((s) => s.text);
  const mode =
    (useChatComposerStore((s) => s as Record<string, unknown>).mode as
      | string
      | undefined) ?? "General";
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const citationEnabled = useChatComposerStore((s) => s.citationEnabled);
  const attachments = useChatComposerStore((s) => s.attachments);

  // Ghost mode (local WebLLM)
  const ghostEnabled = useGhostModeStore((s) => s.enabled);
  const ghostModelId = useGhostModeStore((s) => s.selectedModelId);
  const ghostModelStatus = useGhostModeStore((s) => s.modelStatus);
  const {
    generate: ghostGenerate,
    isReady: ghostIsReady,
    abort: ghostAbort,
  } = useGhostLLM();
  const ghostModel = findGhostModel(ghostModelId);

  // Ghost Open mode (OpenRouter cloud)
  const ghostOpenEnabled = useGhostModeStore((s) => s.ghostOpenEnabled);
  const ghostOpenModelId = useGhostModeStore((s) => s.selectedApiModelId);
  const ghostOpenModel = findGhostApiModel(ghostOpenModelId);

  const jLabel = jurisdictionLabel(jurisdiction);

  // ── Storage mode + import ─────────────────────────────────────────────────
  const storageMode = useChatStorageStore((s) => s.storageMode);
  const pendingImport = useImportedChatStore((s) => s.pendingImport);
  const clearPendingImport = useImportedChatStore((s) => s.clearPendingImport);

  // ── Multi-turn conversation state ─────────────────────────────────────────
  // Completed turns rendered above the current in-progress turn
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  // Refs hold the *current* run parameters — updated by handleFollowUp before
  // incrementing runTrigger, so the next effect fires with fresh values.
  const currentTextRef = useRef(text);
  const currentAttachmentsRef = useRef(attachments);
  const historyRef = useRef<ConvMsg[]>([]);
  // Displayed text/jurisdiction/mode for the *current* user bubble
  const [currentDisplayText, setCurrentDisplayText] = useState(text);
  const [currentDisplayJurisdiction, setCurrentDisplayJurisdiction] =
    useState(jurisdiction);
  const [currentDisplayMode, setCurrentDisplayMode] = useState(mode);
  // Increment to re-trigger the agent effect for follow-ups
  const [runTrigger, setRunTrigger] = useState(0);
  // Checked synchronously so the agent useEffect can skip its first run for imports
  const skipInitialRunRef = useRef(
    !!useImportedChatStore.getState().pendingImport,
  );

  // Agent state
  const [steps, setSteps] = useState<AgentStep[]>(() => {
    if (ghostEnabled) return buildGhostSteps();
    if (ghostOpenEnabled) return buildGhostOpenSteps();
    return buildInitialSteps();
  });
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
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(
    null,
  );
  const startTimeRef = useRef(Date.now());
  const answerRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCopyAnswer = useCallback(() => {
    navigator.clipboard.writeText(answerRef.current).then(() => {
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    });
  }, []);

  const handleCiteClick = useCallback((n: number) => {
    setHighlightedSource(n);
    const el = document.getElementById(`source-${n}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => setHighlightedSource(null), 2000);
  }, []);

  const handleStop = useCallback(() => {
    if (ghostEnabled) {
      ghostAbort();
    } else {
      // Ghost Open and normal agent both use abortController (SSE fetch)
      abortControllerRef.current?.abort();
    }
    setIsRunning(false);
    setIsDone(true);
    setStatusMsg("Stopped");
  }, [ghostEnabled, ghostAbort]);

  // ── Import hydration ─────────────────────────────────────────────────────────
  // Runs once on mount. If there is a pending import, populate completedTurns
  // and conversation history from it, then clear the store so the next page
  // load starts fresh.
  useEffect(() => {
    if (!pendingImport) return;

    const turns: CompletedTurn[] = pendingImport.turns.map((t) => ({
      userText: t.userText,
      userAttachments: t.userAttachments,
      userJurisdiction: t.userJurisdiction,
      userMode: t.userMode,
      assistantText: t.assistantText,
      sources: t.sources,
      laws: t.laws,
      elapsedMs: t.elapsedMs,
      isGhost: t.isGhost ?? false,
      isGhostOpen: t.isGhostOpen ?? false,
      ghostModelName: t.ghostModelName,
    }));

    setCompletedTurns(turns);

    // Build the conversation history so follow-ups have full context
    historyRef.current = turns.flatMap((t) => [
      { role: "user" as const, content: t.userText },
      { role: "assistant" as const, content: t.assistantText },
    ]);

    // Pre-fill display state with the last turn's settings
    const last = pendingImport.turns.at(-1);
    if (last) {
      setCurrentDisplayJurisdiction(last.userJurisdiction);
      setCurrentDisplayMode(last.userMode);
    }

    // Reset current-turn display so the input looks ready for a follow-up
    setCurrentDisplayText("");
    currentTextRef.current = "";

    // Mark as done so the input isn't disabled
    setIsDone(true);

    clearPendingImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // ── Phase 1: Wait for local model ─────────────────────────────────────
      updateStep("ghost_init", { status: "running" });
      setStatusMsg(`Loading ${ghostModel?.name ?? "local model"}…`);

      if (ghostModelStatus !== "ready" || !ghostIsReady) {
        setStatusMsg("Waiting for model to finish loading…");
        await new Promise<void>((resolve, reject) => {
          const check = setInterval(() => {
            const status = useGhostModeStore.getState().modelStatus;
            if (status === "ready") {
              clearInterval(check);
              resolve();
            } else if (status === "error") {
              clearInterval(check);
              reject(
                new Error(
                  "Model failed to load. WebGPU required (Chrome/Edge 113+).",
                ),
              );
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
              <span>
                Inference runs locally — your data stays on this device
              </span>
            </div>
            <div className="flex items-center gap-1.5 py-1 border-b border-border/40">
              <Search size={11} className="text-muted-foreground/60 shrink-0" />
              <span>
                Web search runs server-side only when relevant — LLM stays local
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
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

      // ── Phase 2: Agent pipeline (intent detection → optional search → synthesis → follow-ups) ─
      await runGhostAgent({
        message: currentTextRef.current,
        jurisdiction: jurisdiction.toUpperCase(),
        mode: mode as "General" | "Compare" | "Draft",
        citationEnabled,
        attachments: currentAttachmentsRef.current
          .filter((a) => a.status === "done" && a.extractedText)
          .map((a) => ({ name: a.name, extractedText: a.extractedText! })),
        baseUrl: window.location.origin,
        generate: ghostGenerate,
        onEvent: (event) => {
          switch (event.step) {
            case "classifying":
              updateStep("classifying", { status: "running" });
              setStatusMsg("Analyzing your question…");
              break;

            case "intent": {
              const domainLabel =
                event.domain.charAt(0).toUpperCase() + event.domain.slice(1);
              updateStep("classifying", {
                status: "completed",
                summary: `${domainLabel} · ${event.needsSearch ? "searching" : "direct"}`,
                detail: (
                  <div className="space-y-1 text-xs text-foreground/70">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Domain</span>
                      <span className="font-medium capitalize">
                        {event.domain}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Web Search</span>
                      <span className="font-medium">
                        {event.needsSearch ? "Yes" : "Not needed"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Stance</span>
                      <span className="font-medium text-violet-600">
                        Always-on defense · no restrictions
                      </span>
                    </div>
                  </div>
                ),
              });

              // Dynamically insert search step before "synthesizing" if needed
              if (event.needsSearch) {
                setSteps((prev) => {
                  if (prev.some((s) => s.id === "searching")) return prev;
                  const synthIdx = prev.findIndex(
                    (s) => s.id === "synthesizing",
                  );
                  if (synthIdx === -1) return prev;
                  const searchStep: AgentStep = {
                    id: "searching",
                    label: "Searching for Exceptions & Gaps",
                    icon: Search,
                    status: "pending",
                  };
                  return [
                    ...prev.slice(0, synthIdx),
                    searchStep,
                    ...prev.slice(synthIdx),
                  ];
                });
                setStatusMsg(
                  "Searching for exceptions, exemptions, and legal gaps…",
                );
              } else {
                setStatusMsg("Generating response…");
              }
              break;
            }

            case "searching":
              updateStep("searching", {
                status: "running",
                summary: undefined,
              });
              setStatusMsg(
                `Searching ${event.index}/${event.total}: "${event.query.slice(0, 60)}${event.query.length > 60 ? "…" : ""}"`,
              );
              break;

            case "search_results":
              setStatusMsg(
                `Found ${event.count} sources for "${event.query.slice(0, 50)}…"`,
              );
              break;

            case "sources_ranked":
              updateStep("searching", {
                status: "completed",
                summary: `${event.total} source${event.total !== 1 ? "s" : ""} · ${event.engine}`,
                detail: (
                  <p className="text-xs text-muted-foreground">
                    {event.total} deduplicated sources retrieved via{" "}
                    {event.engine}.
                  </p>
                ),
              });
              setStatusMsg(
                `${event.total} sources found · generating response…`,
              );
              break;

            case "synthesizing":
              updateStep("synthesizing", { status: "running" });
              setStatusMsg("Generating response…");
              break;

            case "delta":
              answerRef.current += event.text;
              setAnswerText(answerRef.current);
              break;

            case "follow_up_generating":
              updateStep("synthesizing", {
                status: "completed",
                summary: `${answerRef.current.split(/\s+/).length} words`,
              });
              updateStep("follow_up", { status: "running" });
              setStatusMsg("Generating follow-up questions…");
              break;

            case "done": {
              setSources(event.sources);
              setFollowUpQuestions(event.followUpQuestions);
              updateStep("follow_up", {
                status: "completed",
                summary: `${event.followUpQuestions.length} question${event.followUpQuestions.length !== 1 ? "s" : ""}`,
              });
              setStatusMsg("Complete");
              setIsDone(true);
              break;
            }

            case "error":
              setError(event.message);
              break;
          }
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

  // ── Ghost Open runner (SSE → /api/ghost-api) ────────────────────────────────

  const runGhostOpen = useCallback(
    async (ticker: ReturnType<typeof setInterval>) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Mark ghost_init step running
      updateStep("ghost_init", { status: "running" });
      setStatusMsg(`Connecting to ${ghostOpenModel?.name ?? "Ghost Open"}…`);

      updateStep("ghost_init", {
        status: "completed",
        summary: ghostOpenModel?.shortName ?? "Cloud model",
        detail: (
          <div className="space-y-1 text-xs text-foreground/70">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium">{ghostOpenModel?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{ghostOpenModel?.provider}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium capitalize">
                {ghostOpenModel?.category}
              </span>
            </div>
          </div>
        ),
      });

      try {
        const body = {
          message: currentTextRef.current,
          jurisdiction: jurisdiction.toUpperCase(),
          mode,
          citationEnabled,
          attachments: currentAttachmentsRef.current
            .filter((a) => a.status === "done" && a.extractedText)
            .map((a) => ({ name: a.name, extractedText: a.extractedText! })),
          modelId: ghostOpenModelId,
        };

        const res = await fetch("/api/ghost-api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
              // Ghost API emits events in the same shape as GhostAgentEvent
              const event = JSON.parse(part.slice(6));
              switch (event.step) {
                case "classifying":
                  updateStep("classifying", { status: "running" });
                  setStatusMsg("Analyzing your question…");
                  break;

                case "intent": {
                  const domain = event.domain ?? "legal";
                  const domainLabel =
                    domain.charAt(0).toUpperCase() + domain.slice(1);
                  updateStep("classifying", {
                    status: "completed",
                    summary: `${domainLabel} · ${event.needsSearch ? "searching" : "direct"}`,
                    detail: (
                      <div className="space-y-1 text-xs text-foreground/70">
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Domain</span>
                          <span className="font-medium capitalize">
                            {domain}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">
                            Web Search
                          </span>
                          <span className="font-medium">
                            {event.needsSearch ? "Yes" : "Not needed"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Stance</span>
                          <span className="font-medium text-amber-600">
                            Always-on defense · no restrictions
                          </span>
                        </div>
                      </div>
                    ),
                  });
                  if (event.needsSearch) {
                    setSteps((prev) => {
                      if (prev.some((s) => s.id === "searching")) return prev;
                      const synthIdx = prev.findIndex(
                        (s) => s.id === "synthesizing",
                      );
                      if (synthIdx === -1) return prev;
                      const searchStep: AgentStep = {
                        id: "searching",
                        label: "Searching for Exceptions & Gaps",
                        icon: Search,
                        status: "pending",
                      };
                      return [
                        ...prev.slice(0, synthIdx),
                        searchStep,
                        ...prev.slice(synthIdx),
                      ];
                    });
                    setStatusMsg(
                      "Searching for exceptions, exemptions, and legal gaps…",
                    );
                  } else {
                    setStatusMsg("Generating response…");
                  }
                  break;
                }

                case "searching":
                  updateStep("searching", {
                    status: "running",
                    summary: undefined,
                  });
                  setStatusMsg(
                    `Searching ${event.index}/${event.total}: "${(event.query as string).slice(0, 60)}${(event.query as string).length > 60 ? "…" : ""}"`,
                  );
                  break;

                case "search_results":
                  setStatusMsg(
                    `Found ${event.count} sources for "${(event.query as string).slice(0, 50)}…"`,
                  );
                  break;

                case "sources_ranked":
                  updateStep("searching", {
                    status: "completed",
                    summary: `${event.total} source${event.total !== 1 ? "s" : ""} · ${event.engine}`,
                    detail: (
                      <p className="text-xs text-muted-foreground">
                        {event.total} deduplicated sources retrieved via{" "}
                        {event.engine}.
                      </p>
                    ),
                  });
                  setStatusMsg(
                    `${event.total} sources found · generating response…`,
                  );
                  break;

                case "synthesizing":
                  updateStep("synthesizing", { status: "running" });
                  setStatusMsg("Generating response…");
                  break;

                case "delta":
                  answerRef.current += event.text;
                  setAnswerText(answerRef.current);
                  break;

                case "follow_up_generating":
                  updateStep("synthesizing", {
                    status: "completed",
                    summary: `${answerRef.current.split(/\s+/).length} words`,
                  });
                  updateStep("follow_up", { status: "running" });
                  setStatusMsg("Generating follow-up questions…");
                  break;

                case "done":
                  setSources(event.sources ?? []);
                  setFollowUpQuestions(event.followUpQuestions ?? []);
                  updateStep("follow_up", {
                    status: "completed",
                    summary: `${(event.followUpQuestions ?? []).length} question${(event.followUpQuestions ?? []).length !== 1 ? "s" : ""}`,
                  });
                  setStatusMsg("Complete");
                  setIsDone(true);
                  break;

                case "error":
                  setError(event.message);
                  break;
              }
            } catch {
              // Malformed chunk — skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      }

      clearInterval(ticker);
      setIsRunning(false);
      setElapsedMs(Date.now() - startTimeRef.current);
    },
    [
      ghostOpenModel,
      ghostOpenModelId,
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
    // Skip the very first run when a .verdictu file was just imported —
    // the hydration effect has already populated completedTurns.
    if (skipInitialRunRef.current) {
      skipInitialRunRef.current = false;
      return;
    }

    if (!currentTextRef.current.trim()) return;

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
      // ghostAbort() is synchronous and safe to call on cleanup —
      // stops the WebLLM token loop without tearing down the engine.
      return () => {
        clearInterval(ticker);
        ghostAbort();
      };
    }

    if (ghostOpenEnabled) {
      runGhostOpen(ticker).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        clearInterval(ticker);
        setIsRunning(false);
      });
      // Abort the SSE fetch so a React StrictMode double-invoke or a
      // hot-reload doesn't leave a zombie stream writing to answerRef.
      return () => {
        clearInterval(ticker);
        abortControllerRef.current?.abort();
      };
    }

    const run = async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const body = {
          message: currentTextRef.current,
          jurisdiction: jurisdiction.toUpperCase(),
          mode,
          citationEnabled,
          attachments: currentAttachmentsRef.current
            .filter((a) => a.status === "done" && a.extractedText)
            .map((a) => ({ filename: a.name, text: a.extractedText! })),
          conversationHistory: historyRef.current,
        };

        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
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
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped — not an error
          return;
        }
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
    return () => {
      clearInterval(ticker);
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger]);

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
                <span className="font-medium">
                  {String(data.mode ?? "General")}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Citations</span>
                <span className="font-medium">
                  {citationEnabled ? "Enabled" : "Disabled"}
                </span>
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
                        style={{
                          width: `${Math.round(law.confidence * 100)}%`,
                        }}
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
                No specific statutes identified — using general legal
                principles.
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

  // ── Follow-up handler ────────────────────────────────────────────────────────
  // Called by the bottom AIChatInput instead of navigating to a new page.
  const handleFollowUp = useCallback(
    (newText: string, newAttachments: AttachmentItem[]) => {
      // Save the just-completed turn for display
      const finalAnswer = answerRef.current;
      if (finalAnswer.trim()) {
        setCompletedTurns((prev) => [
          ...prev,
          {
            userText: currentTextRef.current,
            userAttachments: currentAttachmentsRef.current
              .filter((a) => a.status === "done" && a.extractedText)
              .map((a) => ({ name: a.name, extractedText: a.extractedText! })),
            userJurisdiction: currentDisplayJurisdiction,
            userMode: currentDisplayMode,
            assistantText: finalAnswer,
            sources,
            laws,
            elapsedMs,
            isGhost: ghostEnabled,
            isGhostOpen: ghostOpenEnabled,
            ghostModelName: ghostEnabled
              ? (ghostModel?.name ?? undefined)
              : ghostOpenEnabled
                ? (ghostOpenModel?.name ?? undefined)
                : undefined,
          } satisfies CompletedTurn,
        ]);

        // Extend conversation history so the API sees prior turns
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: currentTextRef.current },
          { role: "assistant", content: finalAnswer },
        ];
      }

      // Point refs at the new turn's data
      currentTextRef.current = newText;
      currentAttachmentsRef.current = newAttachments;

      // Update display state for the new current user bubble
      setCurrentDisplayText(newText);
      setCurrentDisplayJurisdiction(jurisdiction);
      setCurrentDisplayMode(mode);

      // Reset in-progress agent state for the new turn
      answerRef.current = "";
      setAnswerText("");
      setSteps(
        ghostEnabled
          ? buildGhostSteps()
          : ghostOpenEnabled
            ? buildGhostOpenSteps()
            : buildInitialSteps(),
      );
      setExpandedIds(new Set());
      setIsDone(false);
      setIsRunning(false);
      setError(null);
      setSources([]);
      setLaws([]);
      setFollowUpQuestions([]);
      setElapsedMs(0);
      setStatusMsg("Starting…");

      // Trigger the agent effect to fire again
      setRunTrigger((n) => n + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sources,
      laws,
      elapsedMs,
      ghostEnabled,
      ghostOpenEnabled,
      ghostModel,
      ghostOpenModel,
      currentDisplayJurisdiction,
      currentDisplayMode,
      jurisdiction,
      mode,
    ],
  );

  // ── Export handler ───────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    // Include the in-progress turn if it has a complete answer
    const turnsToExport = [...completedTurns];
    if (answerRef.current.trim() && isDone) {
      turnsToExport.push({
        userText: currentTextRef.current,
        userAttachments: currentAttachmentsRef.current
          .filter((a) => a.status === "done" && a.extractedText)
          .map((a) => ({ name: a.name, extractedText: a.extractedText! })),
        userJurisdiction: currentDisplayJurisdiction,
        userMode: currentDisplayMode,
        assistantText: answerRef.current,
        sources,
        laws,
        elapsedMs,
        isGhost: ghostEnabled,
        isGhostOpen: ghostOpenEnabled,
        ghostModelName: ghostEnabled
          ? (ghostModel?.name ?? undefined)
          : ghostOpenEnabled
            ? (ghostOpenModel?.name ?? undefined)
            : undefined,
      });
    }
    exportChatToFile(turnsToExport, {
      jurisdiction: currentDisplayJurisdiction,
      mode: currentDisplayMode,
      citationEnabled,
    });
  }, [
    completedTurns,
    isDone,
    sources,
    laws,
    elapsedMs,
    currentDisplayJurisdiction,
    currentDisplayMode,
    citationEnabled,
    ghostEnabled,
    ghostOpenEnabled,
    ghostModel,
    ghostOpenModel,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[98vh] w-[98.5%] pb-10 relative bg-card rounded-lg border border-border">
      {/* ── Top bar: sidebar trigger + storage mode + export ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 h-12">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

        {/* Storage mode indicator + download button */}
        <div className="flex items-center gap-2">
          {/* Storage badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              storageMode === "local"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-indigo-200 bg-indigo-50 text-indigo-700"
            }`}
          >
            {storageMode === "local" ? (
              <>
                <HardDriveIcon size={10} /> Local only
              </>
            ) : (
              <>
                <CloudIcon size={10} /> Cloud (soon)
              </>
            )}
          </span>

          {/* Download button — visible once there's any content to export */}
          {(completedTurns.length > 0 || (isDone && answerText)) && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Download conversation as .verdictu file"
            >
              <DownloadIcon size={12} />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto pt-12"
        style={{
          backgroundImage:
            "radial-gradient(circle, #00000015 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pb-8 space-y-3">
          {/* ── Completed prior turns ── */}
          {completedTurns.map((turn, turnIdx) => (
            <React.Fragment key={turnIdx}>
              {/* User bubble */}
              <div className="bg-secondary/50 rounded-lg border border-border p-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0 text-foreground/50 text-xs font-bold mt-0.5">
                    U
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-[15px] leading-relaxed">
                      {turn.userText}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                        <Globe size={9} />
                        {jurisdictionLabel(turn.userJurisdiction)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                        {turn.userMode} mode
                      </span>
                      {turn.isGhost ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground border border-foreground/20 text-xs text-card">
                          <Ghost size={9} />
                          Ghost
                          {turn.ghostModelName
                            ? ` · ${turn.ghostModelName}`
                            : ""}
                        </span>
                      ) : turn.isGhostOpen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                          <Ghost size={9} />
                          Ghost Open
                          {turn.ghostModelName
                            ? ` · ${turn.ghostModelName}`
                            : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-xs text-indigo-600">
                          <Search size={9} />
                          Deep Search
                        </span>
                      )}
                      {turn.userAttachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                          <FileText size={9} />
                          {turn.userAttachments.length} attachment
                          {turn.userAttachments.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assistant answer */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 bg-secondary/40">
                  <div className="w-5 h-5 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0">
                    <Gavel size={10} className="text-foreground/50" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {turn.isGhost ? "Response" : "Legal Analysis"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground/40 tabular-nums">
                    {(turn.elapsedMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="px-5 py-5">
                  {renderMarkdown(turn.assistantText)}
                </div>
              </div>

              {/* Sources for this turn */}
              {turn.sources.length > 0 && (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <BookOpen size={12} className="text-muted-foreground/60" />
                    <span className="text-sm font-medium text-foreground">
                      Sources
                    </span>
                    <span className="text-xs text-muted-foreground/50 ml-auto">
                      {turn.sources.length} retrieved
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    {turn.sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-1.5 rounded px-1.5 -mx-1.5 hover:bg-secondary/50 group"
                      >
                        <span className="text-[10px] w-4 shrink-0 tabular-nums font-medium text-muted-foreground/40">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate text-foreground/75 group-hover:text-foreground">
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
                          className="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider between turns */}
              <div className="border-t border-dashed border-border/50 my-1" />
            </React.Fragment>
          ))}

          {/* ── Current turn: user question ── */}
          <div className="bg-secondary/50 rounded-lg border border-border p-5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-foreground/5 border border-border flex items-center justify-center shrink-0 text-foreground/50 text-xs font-bold mt-0.5">
                U
              </div>
              <div className="flex-1 min-w-0">
                {currentDisplayText ? (
                  <p className="text-foreground text-[15px] leading-relaxed">
                    {currentDisplayText}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">
                    No question provided.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                    <Globe size={9} />
                    {jurisdictionLabel(currentDisplayJurisdiction)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                    {currentDisplayMode} mode
                  </span>
                  {ghostEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground border border-foreground/20 text-xs text-card">
                      <Ghost size={9} />
                      Ghost · {ghostModel?.shortName ?? "Local"}
                    </span>
                  ) : ghostOpenEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      <Ghost size={9} />
                      Ghost Open · {ghostOpenModel?.shortName ?? "Cloud"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-xs text-indigo-600">
                      <Search size={9} />
                      Deep Search
                    </span>
                  )}
                  {currentAttachmentsRef.current.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                      <FileText size={9} />
                      {currentAttachmentsRef.current.length} attachment
                      {currentAttachmentsRef.current.length !== 1 ? "s" : ""}
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
                <span className="font-semibold">Downloading model…</span> This
                may take a moment the first time. The model is cached locally
                after the first download.
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
                  {(ghostEnabled || ghostOpenEnabled) && (
                    <Ghost size={12} className="text-foreground/60" />
                  )}
                  {ghostEnabled
                    ? "Ghost AI"
                    : ghostOpenEnabled
                      ? "Ghost Open AI"
                      : "Legal AI Agent"}
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

              <div className="flex items-center gap-3">
                {isRunning && !isDone && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 font-medium transition-colors"
                    title="Stop generation"
                  >
                    <Square size={11} className="fill-current" />
                    Stop
                  </button>
                )}
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
                  {ghostEnabled ? "Response" : "Legal Analysis"}
                </span>
                {!isDone && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />
                )}
                {isDone && (
                  <button
                    onClick={handleCopyAnswer}
                    title="Copy analysis"
                    className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors px-2 py-1 rounded hover:bg-secondary/60"
                  >
                    {copiedAnswer ? (
                      <>
                        <Check size={11} className="text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="px-5 py-5">
                {renderMarkdown(answerText, handleCiteClick)}
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
                    id={`source-${i + 1}`}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 py-1.5 rounded px-1.5 -mx-1.5 transition-colors group ${
                      highlightedSource === i + 1
                        ? "bg-indigo-50 border border-indigo-200"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <span
                      className={`text-[10px] w-4 shrink-0 tabular-nums font-medium ${highlightedSource === i + 1 ? "text-indigo-600" : "text-muted-foreground/40"}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs truncate transition-colors ${highlightedSource === i + 1 ? "text-indigo-700 font-medium" : "text-foreground/75 group-hover:text-foreground"}`}
                      >
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
                      className={`shrink-0 transition-colors ${highlightedSource === i + 1 ? "text-indigo-400" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"}`}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Identified laws ── */}
          {isDone && laws.length > 0 && (
            <div className="bg-emerald-50/60 rounded-lg border border-emerald-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-200 flex items-center gap-2 bg-emerald-50/80">
                <Layers size={12} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">
                  Applicable Laws
                </span>
                <span className="text-xs text-emerald-600/60 ml-auto">
                  {laws.length} identified
                </span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {laws.map((law, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                        law.relevance === "primary"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : law.relevance === "secondary"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-white/60 text-emerald-600 border border-emerald-100"
                      }`}
                    >
                      {law.relevance === "primary"
                        ? "PRIMARY"
                        : law.relevance === "secondary"
                          ? "SEC"
                          : "SUPP"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-emerald-900">
                        {law.citation}
                      </div>
                      <div className="text-[11px] text-emerald-800/70 mt-0.5 leading-relaxed">
                        {law.applies_because}
                      </div>
                      {law.confidence > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-emerald-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all"
                              style={{
                                width: `${Math.round(law.confidence * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-emerald-600/70 shrink-0 tabular-nums">
                            {Math.round(law.confidence * 100)}%
                          </span>
                        </div>
                      )}
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

      {/* Sticky chat input — follow-ups stay on this page */}
      <AIChatInput onSend={handleFollowUp} disabled={isRunning} />
    </div>
  );
}
