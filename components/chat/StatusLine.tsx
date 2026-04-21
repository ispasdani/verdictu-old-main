"use client";

import { useEffect, useState } from "react";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const SPINNER_VERBS = [
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

export function StatusLine({
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
