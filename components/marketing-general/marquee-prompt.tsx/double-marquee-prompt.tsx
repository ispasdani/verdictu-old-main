"use client";

import React, { useEffect, useMemo } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";
import Chip from "./chip";
import MarqueeRow from "./marquee-row";

const TOP_PROMPTS = [
  { text: "What is the notice period for terminating a residential lease in Denmark?" },
  { text: "Draft a mutual NDA governed by German law." },
  { text: "Compare these two software licensing agreements for liability risks." },
  { text: "What are the criteria for a Blue Card in the EU?" },
  { text: "Explain the GDPR requirements for data processing agreements." },
];

const BOTTOM_PROMPTS = [
  { text: "What are the statutory severance pay requirements in the UK?" },
  { text: "Can a landlord keep my deposit for normal wear and tear?" },
  { text: "Draft an employment contract governed by Swedish law." },
  { text: "What is the statute of limitations for debt collection in France?" },
  { text: "Review this SaaS agreement for compliance with the AI Act." },
];

// ─── PromptMarquee ────────────────────────────────────────────────────────────

export default function DoubleMarqueePrompt() {
  const setText = useChatComposerStore((s) => s.setText);

  return (
    <section className="w-full py-2" aria-label="Example prompts">
      <p className="mb-2 text-center text-xs font-medium tracking-wide text-gray-400 uppercase">
        Try asking
      </p>

      <MarqueeRow
        prompts={TOP_PROMPTS}
        direction="left"
        durationSec={32}
        onPick={setText}
      />
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
