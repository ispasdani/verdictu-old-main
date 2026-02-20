"use client";

import React, { useEffect, useMemo } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";

// ─── Prompts ─────────────────────────────────────────────────────────────────

type Prompt = { icon: string; text: string };

const TOP_PROMPTS: Prompt[] = [
  { icon: "⚖️", text: "What are my rights when getting fired?" },
  { icon: "📄", text: "Create a rental agreement." },
  { icon: "🧾", text: "How do I file a consumer complaint?" },
  { icon: "💼", text: "What are an employer's legal duties?" },
  { icon: "🛡️", text: "How can I protect my personal data online?" },
  { icon: "✍️", text: "Generate a non-disclosure agreement." },
  { icon: "🏠", text: "Tenant vs landlord responsibilities." },
  { icon: "🔍", text: "Is this non-compete clause enforceable?" },
];

const BOTTOM_PROMPTS: Prompt[] = [
  { icon: "📌", text: "Write a simple service contract." },
  { icon: "🧠", text: "Summarize this clause in plain English." },
  { icon: "🧑‍⚖️", text: "What evidence do I need for small claims?" },
  { icon: "📑", text: "Outline a privacy policy for my website." },
  { icon: "🤝", text: "Draft a partnership agreement outline." },
  { icon: "🧾", text: "What should invoice payment terms include?" },
  { icon: "🛂", text: "What are basic visa work rights?" },
  { icon: "📝", text: "Explain termination notice periods." },
];

// ─── Reduced motion hook ──────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  icon,
  text,
  onClick,
}: {
  icon: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition-all will-change-transform hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[13px]">
        {icon}
      </span>
      <span className="whitespace-nowrap">{text}</span>
    </button>
  );
}

// ─── MarqueeRow ───────────────────────────────────────────────────────────────

function MarqueeRow({
  prompts,
  direction,
  durationSec,
  onPick,
}: {
  prompts: Prompt[];
  direction: "left" | "right";
  durationSec: number;
  onPick: (text: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Duplicate for seamless loop: animate 0 → -50% (left) or -50% → 0 (right)
  const items = useMemo(() => [...prompts, ...prompts], [prompts]);
  return (
    <div
      className="pm-row relative overflow-hidden py-1.5 mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      aria-label="Suggested prompts"
    >
      {/* Edge blur + fade overlays — matched to white page background */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent backdrop-blur-[2px]" />

      <div
        className={`pm-track pm-track-${direction} flex w-max items-center gap-3 px-2 will-change-transform`}
        style={
          reducedMotion
            ? undefined
            : ({ "--pm-duration": `${durationSec}s` } as React.CSSProperties)
        }
      >
        {items.map((p, idx) => (
          <Chip
            key={`${p.text}-${idx}`}
            icon={p.icon}
            text={p.text}
            onClick={() => onPick(p.text)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PromptMarquee ────────────────────────────────────────────────────────────

export default function SingleMarqueePrompt() {
  const setText = useChatComposerStore((s) => s.setText);

  return (
    <section className="w-full py-2" aria-label="Example prompts">
      <p className="mb-2 text-center text-xs font-medium tracking-wide text-gray-400 uppercase">
        Try asking
      </p>

      <MarqueeRow
        prompts={BOTTOM_PROMPTS}
        direction="right"
        durationSec={38}
        onPick={setText}
      />

      <style>{`
        @keyframes pm-scroll-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes pm-scroll-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        .pm-track-left {
          animation: pm-scroll-left var(--pm-duration) linear infinite;
        }
        .pm-track-right {
          animation: pm-scroll-right var(--pm-duration) linear infinite;
        }
        .pm-row:hover .pm-track {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
