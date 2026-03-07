"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";
import {
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  Globe,
  BookOpen,
  Scale,
  Lock,
  Brain,
  Filter,
  FileSearch,
  FileText,
  HelpCircle,
  MessageSquarePlus,
  Sparkles,
  Layers,
  Circle,
  ExternalLink,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AIChatInput from "@/components/agent-general/aiChatInput";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "completed";

interface StepConfig {
  id: string;
  num: string;
  label: string;
  icon: React.ElementType;
  runningMsg: string;
  completedSummary: string;
  renderDetails: () => React.ReactNode;
}

// ─── Step timing (ms) ─────────────────────────────────────────────────────────

const TIMINGS: Array<{ start: number; dur: number }> = [
  { start: 500, dur: 600 }, // 0: Jurisdiction Lock
  { start: 1200, dur: 900 }, // 1: Task Analysis
  { start: 2200, dur: 700 }, // 2: Research Strategy
  { start: 3000, dur: 900 }, // 3: Search Queries
  { start: 4000, dur: 1400 }, // 4: Web Search
  { start: 5500, dur: 900 }, // 5: Filter Sources
  { start: 6500, dur: 1200 }, // 6: Retrieve Content
  { start: 7800, dur: 1300 }, // 7: Extract Rules
  { start: 9200, dur: 1500 }, // 8: Apply to Facts
  { start: 10800, dur: 2000 }, // 9: Final Answer
  { start: 12900, dur: 500 }, // 10: Follow-up
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJurisdictionLabel(j: string): string {
  const map: Record<string, string> = {
    auto: "Auto-detected",
    dk: "Denmark",
    eu: "European Union",
    de: "Germany",
    uk: "United Kingdom",
    fr: "France",
    se: "Sweden",
    nl: "Netherlands",
  };
  return map[j] ?? j.toUpperCase();
}

// ─── Step configs ─────────────────────────────────────────────────────────────

function buildStepConfigs(jurisdictionLabel: string): StepConfig[] {
  return [
    {
      id: "jurisdiction-lock",
      num: "0",
      label: "Jurisdiction Lock",
      icon: Lock,
      runningMsg: "Verifying jurisdiction…",
      completedSummary: `${jurisdictionLabel} confirmed · Civil law framework`,
      renderDetails: () => (
        <div className="space-y-1.5 text-sm">
          {[
            ["Selected jurisdiction", jurisdictionLabel],
            ["Legal system", "Civil Law"],
            ["Primary legislation", "Danish Tenancy Act (Lejeloven)"],
            ["Enforcement body", "Danish Housing Authority (Huslejenævnet)"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between py-1.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-gray-500 text-xs">{k}</span>
              <span className="font-medium text-gray-800 text-xs">{v}</span>
            </div>
          ))}
          <div className="mt-1 p-2.5 bg-green-50 rounded-md text-xs text-green-700 border border-green-100">
            Jurisdiction locked. Proceeding with {jurisdictionLabel}-specific
            legal framework.
          </div>
        </div>
      ),
    },
    {
      id: "task-analysis",
      num: "1",
      label: "Task Analysis",
      icon: Brain,
      runningMsg: "Structuring your legal question…",
      completedSummary:
        "Landlord-Tenant Law · Explain rule · 2 facts, 3 missing facts",
      renderDetails: () => (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Legal Topic", "Landlord-Tenant Law"],
              ["Task Type", "Explain Legal Rule"],
              ["Jurisdiction", jurisdictionLabel],
              ["User Intent", "Understand tenant rights"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
                  {label}
                </div>
                <div className="font-medium text-gray-800 text-xs">{value}</div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-50 space-y-1.5">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Facts Provided
            </div>
            {[
              "Rent increase requested by landlord",
              "Lease type is fixed-term",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 text-xs text-gray-700"
              >
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-50 space-y-1.5">
            <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
              Missing Facts
            </div>
            {[
              "Does the lease include a rent adjustment or indexation clause?",
              "Was a formal notice period given by the landlord?",
              "Is there a CPI escalation clause in the contract?",
            ].map((f) => (
              <div
                key={f}
                className="flex items-start gap-2 text-xs text-gray-700"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "research-strategy",
      num: "2",
      label: "Research Strategy",
      icon: Layers,
      runningMsg: "Deciding research approach…",
      completedSummary: "Web search required · Document analysis not needed",
      renderDetails: () => (
        <div className="space-y-1 text-sm">
          {[
            {
              task: "Web search",
              needed: true,
              reason: "Jurisdiction-specific statute required",
            },
            {
              task: "Document analysis",
              needed: false,
              reason: "No contracts uploaded by user",
            },
            {
              task: "Document drafting",
              needed: false,
              reason: "User is asking, not requesting a draft",
            },
          ].map(({ task, needed, reason }) => (
            <div
              key={task}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <div>
                <div className="font-medium text-gray-800 text-xs">{task}</div>
                <div className="text-[11px] text-gray-400">{reason}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${needed ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-400"}`}
              >
                {needed ? "YES" : "NO"}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "search-queries",
      num: "3",
      label: "Search Query Generation",
      icon: Search,
      runningMsg: "Generating optimized search queries…",
      completedSummary: "4 targeted queries generated",
      renderDetails: () => (
        <div className="space-y-1.5">
          {[
            "denmark rent increase fixed lease lejeloven",
            "danish tenancy act fixed term rent regulation §47",
            "lejeloven rent adjustment clause indexation fixed term",
            "denmark landlord tenant rights rent increase notice period",
          ].map((q, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md"
            >
              <span className="text-gray-400 text-[10px] shrink-0 w-4">
                {i + 1}.
              </span>
              <span className="font-mono text-xs text-gray-700">{q}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "web-search",
      num: "4",
      label: "Web Search",
      icon: Globe,
      runningMsg: "Searching legal databases and government portals…",
      completedSummary:
        "6 sources found across government, regulatory, and commentary sites",
      renderDetails: () => (
        <div className="space-y-1">
          {[
            {
              title: "Danish Tenancy Act – retsinformation.dk",
              domain: "retsinformation.dk",
              type: "Legislation",
            },
            {
              title: "Housing Authority Guidance on Rent Regulation",
              domain: "huslejenaevnet.dk",
              type: "Regulator",
            },
            {
              title: "Lejeloven Commentary – Karnov Group",
              domain: "karnovgroup.com",
              type: "Legal Publisher",
            },
            {
              title: "Fixed-Term Lease Rights – advokatsamfundet.dk",
              domain: "advokatsamfundet.dk",
              type: "Bar Association",
            },
            {
              title: "Tenant Rights FAQ – lejernes-lo.dk",
              domain: "lejernes-lo.dk",
              type: "Tenant Org",
            },
            {
              title: "Rent Increase Analysis – lawfirm.dk",
              domain: "lawfirm.dk",
              type: "Law Firm",
            },
          ].map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-[10px] text-gray-300 w-4 shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-800 truncate">{r.title}</div>
                <div className="text-[10px] text-gray-400">{r.domain}</div>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                {r.type}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "filter-sources",
      num: "5",
      label: "Filter & Rank Sources",
      icon: Filter,
      runningMsg: "Ranking sources by authority and relevance…",
      completedSummary: "3 authoritative sources selected · 3 filtered out",
      renderDetails: () => (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Selected — High Authority
          </div>
          {[
            {
              title: "Danish Tenancy Act – retsinformation.dk",
              rank: 1,
              type: "Legislation",
            },
            {
              title: "Housing Authority Rent Guidance",
              rank: 2,
              type: "Regulator",
            },
            {
              title: "Karnov Legal Commentary",
              rank: 4,
              type: "Legal Publisher",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="flex items-center gap-2 px-2.5 py-2 bg-green-50 rounded-md border border-green-100"
            >
              <span className="w-5 h-5 rounded bg-green-200 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                P{s.rank}
              </span>
              <span className="flex-1 text-xs text-gray-800 truncate">
                {s.title}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {s.type}
              </span>
            </div>
          ))}
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-2">
            Filtered Out
          </div>
          {[
            "Tenant Rights FAQ – lejernes-lo.dk",
            "Rent Increase Analysis – lawfirm.dk",
            "Bar Association General FAQ",
          ].map((t) => (
            <div key={t} className="px-2.5 py-1.5 bg-gray-50 rounded-md">
              <span className="text-xs text-gray-400 line-through">{t}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "retrieve-content",
      num: "6",
      label: "Retrieve Content",
      icon: FileSearch,
      runningMsg: "Downloading and extracting statutory text…",
      completedSummary:
        "3 documents retrieved · Key statutory sections extracted",
      renderDetails: () => (
        <div className="space-y-2.5">
          {[
            {
              source: "Danish Tenancy Act · Section 53",
              text: "Rent increases during a fixed-term lease are only permitted if the lease agreement explicitly includes an adjustment clause or the parties have agreed to indexation.",
            },
            {
              source: "Housing Authority · Rent Regulation §47",
              text: "A landlord cannot increase rent during the fixed period unless the contract specifically allows for it. Unilateral increases without contractual basis are void.",
            },
          ].map((c) => (
            <div
              key={c.source}
              className="p-3 bg-gray-50 rounded-md border border-gray-100"
            >
              <div className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                {c.source}
              </div>
              <p className="text-gray-700 text-xs leading-relaxed italic">
                "{c.text}"
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "extract-rules",
      num: "7",
      label: "Extract Legal Rules",
      icon: BookOpen,
      runningMsg: "Structuring legal rules from retrieved text…",
      completedSummary: "3 rules extracted with conditions and exceptions",
      renderDetails: () => (
        <div className="space-y-2">
          {[
            {
              rule: "Rent increases during a fixed-term lease are not permitted without an explicit contractual clause.",
              conditions: [
                "Lease must be fixed-term",
                "No adjustment clause in contract",
              ],
              exceptions: [
                "CPI indexation clause present",
                "Agreed escalation terms in contract",
              ],
            },
            {
              rule: "An indexation clause allows rent adjustments tied to the Consumer Price Index (CPI).",
              conditions: [
                "Clause must be explicit in the lease",
                "Notice period must be observed",
              ],
              exceptions: [],
            },
            {
              rule: "Unilateral rent increases without contractual basis are void under Danish law.",
              conditions: ["Applies to all fixed-term leases"],
              exceptions: ["Court orders", "Regulatory mandated adjustments"],
            },
          ].map((r, i) => (
            <div
              key={i}
              className="p-3 rounded-md border border-gray-200 bg-white space-y-1.5"
            >
              <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                Rule {i + 1}
              </div>
              <p className="text-xs text-gray-800 leading-relaxed">{r.rule}</p>
              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase mb-0.5">
                  Conditions
                </div>
                {r.conditions.map((c) => (
                  <div
                    key={c}
                    className="text-xs text-gray-600 flex items-start gap-1"
                  >
                    <span className="text-blue-400 shrink-0 mt-0.5">·</span> {c}
                  </div>
                ))}
              </div>
              {r.exceptions.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-gray-400 uppercase mb-0.5">
                    Exceptions
                  </div>
                  {r.exceptions.map((e) => (
                    <div
                      key={e}
                      className="text-xs text-gray-600 flex items-start gap-1"
                    >
                      <span className="text-amber-400 shrink-0 mt-0.5">·</span>{" "}
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "apply-rules",
      num: "8",
      label: "Apply Law to Facts",
      icon: Scale,
      runningMsg: "Matching legal rules against your situation…",
      completedSummary:
        "Outcome: likely void · Key variable is the lease adjustment clause",
      renderDetails: () => (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {["Legal Rule", "User Fact", "Result"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-gray-400 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    rule: "Fixed-term = no rent increase",
                    fact: "Lease is fixed-term",
                    result: "Rule applies",
                    color: "text-green-700",
                  },
                  {
                    rule: "Exception: adjustment clause",
                    fact: "Clause status unknown",
                    result: "Uncertain",
                    color: "text-amber-700",
                  },
                  {
                    rule: "Unilateral increase = void",
                    fact: "Landlord demanded increase",
                    result: "Likely void",
                    color: "text-red-700",
                  },
                ].map((row) => (
                  <tr key={row.rule} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-700">{row.rule}</td>
                    <td className="px-3 py-2 text-gray-500 italic">
                      {row.fact}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${row.color}`}>
                      {row.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-md border border-amber-100 text-xs text-amber-800">
            <strong>Conclusion:</strong> The rent increase is likely invalid.
            The presence or absence of a contractual adjustment clause is the
            decisive factor.
          </div>
        </div>
      ),
    },
    {
      id: "final-answer",
      num: "9",
      label: "Generate Answer",
      icon: Sparkles,
      runningMsg: "Composing your legal answer…",
      completedSummary:
        "Answer ready · 3 cited sources · Action steps included",
      renderDetails: () => (
        <p className="text-xs text-gray-400">
          See the full answer in the panel below.
        </p>
      ),
    },
    {
      id: "follow-up",
      num: "10",
      label: "Follow-Up Questions",
      icon: MessageSquarePlus,
      runningMsg: "Identifying gaps that may affect the answer…",
      completedSummary: "3 clarifying questions generated",
      renderDetails: () => (
        <p className="text-xs text-gray-400">See follow-up questions below.</p>
      ),
    },
  ];
}

// ─── Step row (Claude Code style) ─────────────────────────────────────────────

function StepRow({
  config,
  status,
  expanded,
  onToggle,
}: {
  config: StepConfig;
  status: StepStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = config.icon;
  const isDone = status === "completed";
  const isRunning = status === "running";
  const isPending = status === "pending";

  return (
    <div>
      <button
        type="button"
        className={`group w-full flex items-center gap-2.5 py-1.5 px-2 rounded-md text-left transition-colors ${
          isDone ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
        }`}
        onClick={isDone ? onToggle : undefined}
        tabIndex={isDone ? 0 : -1}
      >
        {/* Status indicator */}
        <div className="shrink-0 w-4 flex items-center justify-center">
          {isRunning && (
            <Loader2 size={13} className="text-indigo-500 animate-spin" />
          )}
          {isDone && <CheckCircle2 size={13} className="text-green-500" />}
          {isPending && <Circle size={13} className="text-gray-200" />}
        </div>

        {/* Step icon */}
        <Icon
          size={13}
          className={
            isPending
              ? "text-gray-200"
              : isDone
                ? "text-gray-400"
                : "text-indigo-500"
          }
        />

        {/* Label */}
        <span
          className={`text-sm flex-1 truncate ${
            isPending
              ? "text-gray-300"
              : isRunning
                ? "text-gray-800 font-medium"
                : "text-gray-600"
          }`}
        >
          {config.label}
        </span>

        {/* Right side: running message or completed summary */}
        {isRunning && (
          <span className="text-xs text-indigo-400 truncate max-w-50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            {config.runningMsg}
          </span>
        )}
        {isDone && (
          <span className="text-xs text-gray-400 truncate max-w-55 hidden sm:block">
            {config.completedSummary}
          </span>
        )}

        {/* Expand chevron — only for completed */}
        {isDone && (
          <span className="shrink-0 ml-1">
            {expanded ? (
              <ChevronDown size={13} className="text-gray-400" />
            ) : (
              <ChevronRight
                size={13}
                className="text-gray-300 group-hover:text-gray-400 transition-colors"
              />
            )}
          </span>
        )}
      </button>

      {/* Expanded details — indented with left border accent */}
      {isDone && expanded && (
        <div className="ml-7.5 mt-1 mb-2 pl-3 border-l-2 border-gray-100">
          {config.renderDetails()}
        </div>
      )}
    </div>
  );
}

// ─── Final answer card ────────────────────────────────────────────────────────

function FinalAnswer({ jLabel }: { jLabel: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-indigo-50/30">
        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
          <Sparkles size={12} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-800">
          Legal Answer
        </span>
      </div>
      <div className="px-5 py-5 space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          In <strong>{jLabel}</strong>, a landlord generally{" "}
          <strong>cannot increase rent during a fixed-term lease</strong> unless
          the lease agreement explicitly allows it — for example, through a CPI
          indexation clause or an agreed escalation schedule.
        </p>

        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            What to check in your lease
          </div>
          <ol className="space-y-2">
            {[
              "Whether the lease includes a rent adjustment or indexation clause",
              "Whether the landlord gave formal written notice as contractually required",
              "Whether the increase follows a CPI formula or agreed escalation clause",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-3 bg-red-50 rounded-md border border-red-100">
          <div className="font-semibold text-red-800 text-xs mb-1">
            If there is no adjustment clause:
          </div>
          <p className="text-red-700 text-xs leading-relaxed">
            The rent increase is likely <strong>void under Danish law</strong>.
            You have the right to refuse it and may file a complaint with the
            local Rent Tribunal (<em>Huslejenævnet</em>).
          </p>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
            Sources Cited
          </div>
          <div className="space-y-1.5">
            {[
              "Danish Tenancy Act (Lejeloven) § 47, § 53",
              "Housing Authority Rent Regulation Guidance",
              "Karnov Group Legal Commentary on Fixed-Term Leases",
            ].map((s) => (
              <div
                key={s}
                className="flex items-center gap-1.5 text-xs text-indigo-600"
              >
                <ExternalLink size={10} className="shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const text = useChatComposerStore((s) => s.text);
  const mode = useChatComposerStore((s) => s.mode);
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const attachments = useChatComposerStore((s) => s.attachments);

  const jLabel = getJurisdictionLabel(jurisdiction);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stepConfigs = useMemo(() => buildStepConfigs(jLabel), []);

  const [statuses, setStatuses] = useState<StepStatus[]>(
    () => Array(stepConfigs.length).fill("pending") as StepStatus[],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    TIMINGS.forEach(({ start, dur }, i) => {
      timers.push(
        setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev];
            next[i] = "running";
            return next;
          });
        }, start),
      );
      timers.push(
        setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev];
            next[i] = "completed";
            return next;
          });
          if (i === TIMINGS.length - 1) setDone(true);
        }, start + dur),
      );
    });

    const ticker = setInterval(() => setElapsedMs(Date.now() - startTime), 200);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(ticker);
    };
  }, [startTime]);

  const toggleStep = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      const completedIds = stepConfigs
        .filter((_, i) => statuses[i] === "completed")
        .map((c) => c.id);
      setExpandedIds(new Set(completedIds));
      setAllExpanded(true);
    }
  };

  const completedCount = statuses.filter((s) => s === "completed").length;
  const runningIdx = statuses.findIndex((s) => s === "running");
  const showFinalAnswer = statuses[9] === "completed";
  const showFollowUp = statuses[10] === "completed";

  return (
    <div className="flex flex-col h-[98vh] w-[98.5%] relative bg-white rounded-lg">
      <div className="absolute top-4 left-4">
        <SidebarTrigger />
      </div>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-4">
            {/* ── User question card ── */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 text-white text-xs font-bold mt-0.5">
                  U
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-[15px] leading-relaxed">
                    {text || (
                      <span className="text-gray-400 italic">
                        No question provided.
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600 font-medium">
                      <Globe size={10} />
                      {jLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600 font-medium">
                      {mode} mode
                    </span>
                    {attachments.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600 font-medium">
                        <FileText size={10} />
                        {attachments.length} attachment
                        {attachments.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Agent steps card ── */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles size={10} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    Legal AI Agent
                  </span>
                  {!done ? (
                    <span className="text-xs text-gray-400">
                      {runningIdx >= 0
                        ? `· ${stepConfigs[runningIdx]?.label}…`
                        : `· ${completedCount} of ${stepConfigs.length} steps`}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-green-600">
                      · Done in {(elapsedMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  >
                    {allExpanded ? "Collapse all" : "Expand all"}
                  </button>
                )}
              </div>

              {/* Steps list */}
              <div className="px-2 py-2 space-y-0.5">
                {stepConfigs.map((config, i) => (
                  <StepRow
                    key={config.id}
                    config={config}
                    status={statuses[i]}
                    expanded={expandedIds.has(config.id)}
                    onToggle={() => toggleStep(config.id)}
                  />
                ))}
              </div>
            </div>

            {/* ── Final answer ── */}
            {showFinalAnswer && <FinalAnswer jLabel={jLabel} />}

            {/* ── Follow-up questions ── */}
            {showFollowUp && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle size={14} className="text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-800">
                    To give a more precise answer, please confirm:
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {[
                    "Does your lease contract include a rent adjustment or indexation clause?",
                    "When was the lease signed and what is the fixed-term period?",
                    "Has the landlord provided written notice, and if so, how long in advance?",
                  ].map((q, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-amber-800"
                    >
                      <span className="w-5 h-5 rounded bg-amber-200 text-amber-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
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
      </div>

      {/* ── Sticky input bar at the bottom ── */}

      <AIChatInput />
    </div>
  );
}
