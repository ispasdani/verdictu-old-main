"use client";

import { useChatComposerStore } from "@/store/chatComposerStore";
import MarqueeRow from "./marquee-row";
import { BOTTOM_PROMPTS } from "@/data/marquee-data";

// ─── SingleMarqueePrompt ──────────────────────────────────────────────────────
export default function SingleMarqueePrompt() {
  const setText = useChatComposerStore((s) => s.setText);

  return (
    <section className="w-full py-2 mt-5" aria-label="Example prompts">
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
