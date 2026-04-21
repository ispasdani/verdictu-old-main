"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChatComposerStore } from "@/store/chatComposerStore";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AIChatInput from "@/components/agent-general/aiChatInput";
import { StatusLine } from "@/components/chat/StatusLine";
import { renderMarkdown } from "@/components/chat/MarkdownRenderer";
import { Copy, Check, Square, MessageSquare } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConvMsg {
  role: "user" | "assistant";
  content: string;
}

interface CompletedTurn {
  userText: string;
  assistantText: string;
  elapsedMs: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SimpleChatPage() {
  const text = useChatComposerStore((s) => s.text);
  const attachments = useChatComposerStore((s) => s.attachments);

  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  const currentTextRef = useRef(text);
  const historyRef = useRef<ConvMsg[]>([]);
  const [currentDisplayText, setCurrentDisplayText] = useState(text);

  const [runTrigger, setRunTrigger] = useState(0);

  const [statusMsg, setStatusMsg] = useState("Starting…");
  const [answerText, setAnswerText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const startTimeRef = useRef(Date.now());
  const answerRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCopyAnswer = useCallback(() => {
    navigator.clipboard.writeText(answerRef.current).then(() => {
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    });
  }, []);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setIsDone(true);
    setStatusMsg("Stopped");
  }, []);

  // ── Agent runner ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentTextRef.current?.trim()) return;

    const msg = currentTextRef.current;
    const history = [...historyRef.current];

    setIsRunning(true);
    setIsDone(false);
    setError(null);
    setAnswerText("");
    answerRef.current = "";
    setStatusMsg("Thinking…");
    startTimeRef.current = Date.now();

    const ticker = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);

    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch("/api/simple-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, conversationHistory: history }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Server error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let event: { step: string; data: Record<string, unknown> };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            switch (event.step) {
              case "thinking":
                setStatusMsg("Thinking…");
                break;
              case "delta": {
                const chunk = event.data.text as string;
                answerRef.current += chunk;
                setAnswerText((prev) => prev + chunk);
                break;
              }
              case "done": {
                const elapsed = (event.data.elapsedMs as number) ?? 0;
                setElapsedMs(elapsed);
                setIsRunning(false);
                setIsDone(true);
                setStatusMsg("Done");
                clearInterval(ticker);

                const finalText = answerRef.current;

                historyRef.current = [
                  ...history,
                  { role: "user" as const, content: msg },
                  { role: "assistant" as const, content: finalText },
                ];

                setCompletedTurns((prev) => [
                  ...prev,
                  {
                    userText: msg,
                    assistantText: finalText,
                    elapsedMs: elapsed,
                  },
                ]);

                setAnswerText("");
                answerRef.current = "";
                setCurrentDisplayText("");
                currentTextRef.current = "";
                break;
              }
              case "error":
                setError((event.data.message as string) ?? "Unknown error");
                setIsRunning(false);
                setIsDone(true);
                clearInterval(ticker);
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unexpected error");
        setIsRunning(false);
        setIsDone(true);
      } finally {
        clearInterval(ticker);
      }
    })();

    return () => {
      clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger]);

  const handleSend = useCallback(
    (sendText: string) => {
      if (!sendText.trim() || isRunning) return;
      currentTextRef.current = sendText;
      setCurrentDisplayText(sendText);
      setRunTrigger((t) => t + 1);
    },
    [isRunning],
  );

  const isFirstRun = completedTurns.length === 0 && !isRunning && !isDone;

  return (
    <div className="relative flex flex-col w-full h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-muted-foreground/60" />
          <span className="text-sm font-medium text-foreground/70">Chat</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isFirstRun ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <MessageSquare size={32} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">
              Ask me anything — I'm here to help.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
            {/* Completed turns */}
            {completedTurns.map((turn, idx) => (
              <div key={idx} className="space-y-4">
                {/* User bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-foreground text-card rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                    {turn.userText}
                  </div>
                </div>
                {/* Assistant response */}
                <div className="space-y-2">
                  <div className="prose prose-sm max-w-none text-foreground/80">
                    {renderMarkdown(turn.assistantText)}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                      {(turn.elapsedMs / 1000).toFixed(1)}s
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(turn.assistantText);
                      }}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <Copy size={11} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Current running turn */}
            {isRunning && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-foreground text-card rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                    {currentDisplayText}
                  </div>
                </div>
                <div className="space-y-2">
                  {answerText ? (
                    <div className="prose prose-sm max-w-none text-foreground/80">
                      {renderMarkdown(answerText)}
                    </div>
                  ) : (
                    <StatusLine
                      message={statusMsg}
                      running={isRunning}
                      elapsedMs={elapsedMs}
                    />
                  )}
                  {answerText && (
                    <StatusLine
                      message={statusMsg}
                      running={isRunning}
                      elapsedMs={elapsedMs}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stop button */}
      {isRunning && (
        <div className="flex justify-center pb-2 shrink-0">
          <button
            type="button"
            onClick={handleStop}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Square size={11} />
            Stop
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0">
        <AIChatInput
          onSend={handleSend}
          disabled={isRunning}
          showJurisdiction={false}
          showCitations={false}
          newChatBasePath="/simple-chat/"
        />
      </div>
    </div>
  );
}
