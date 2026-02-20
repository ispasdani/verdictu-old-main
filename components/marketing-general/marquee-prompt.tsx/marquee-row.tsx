import { Prompt } from "@/types/marquee";
import React, { useMemo } from "react";
import { useEffect } from "react";
import Chip from "./chip";

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

// ─── MarqueeRow ───────────────────────────────────────────────────────────────
export default function MarqueeRow({
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
