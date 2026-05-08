"use client";

import { useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Send, Sparkles, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGhostLLM } from "@/hooks/useGhostLLM";
import { runGhostAgent } from "@/lib/ghost/agent";
import { InsertButton } from "./InsertButton";
import { useGhostModeStore } from "@/store/ghostModeStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am your AI document assistant. Highlight text in the editor to get suggestions or ask me anything directly." }
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { generate, abort, isReady, modelStatus, loadModel } = useGhostLLM();
  const ghostEnabled = useGhostModeStore(s => s.enabled);
  const ghostOpenEnabled = useGhostModeStore(s => s.ghostOpenEnabled);
  const selectedModelId = useGhostModeStore(s => s.selectedModelId);
  const selectedApiModelId = useGhostModeStore(s => s.selectedApiModelId);
  const loadProgress = useGhostModeStore(s => s.loadProgress);
  const loadPercent = useGhostModeStore(s => s.loadPercent);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    if (ghostEnabled && !isReady) {
      setMessages(prev => [...prev, { role: "assistant", content: "Ghost engine is not loaded. Please load a model first." }]);
      return;
    }

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsGenerating(true);

    // Initial assistant message for streaming
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    if (ghostEnabled) {
      try {
        await runGhostAgent({
          message: userMsg,
          jurisdiction: "EU", // Default
          mode: "General",
          citationEnabled: true,
          deepSearchEnabled: false,
          attachments: [],
          baseUrl: window.location.origin,
          generate,
          onEvent: (event) => {
            if (event.step === "delta") {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  return [...prev.slice(0, -1), { ...last, content: last.content + event.text }];
                }
                return prev;
              });
            } else if (event.step === "error") {
               setMessages(prev => [...prev, { role: "assistant", content: "Error: " + event.message }]);
            }
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsGenerating(false);
      }
    } else if (ghostOpenEnabled) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      try {
        const res = await fetch("/api/ghost-api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMsg,
            modelId: selectedApiModelId,
            jurisdiction: "EU",
            mode: "General",
            citationEnabled: true,
            attachments: [],
          }),
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
              const event = JSON.parse(part.slice(6));
              if (event.step === "delta") {
                const text = event.data?.text ?? event.text ?? "";
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant") {
                    return [...prev.slice(0, -1), { ...last, content: last.content + text }];
                  }
                  return prev;
                });
              } else if (event.step === "error") {
                const msg = event.data?.message ?? event.message ?? "Error";
                setMessages(prev => [...prev, { role: "assistant", content: "Error: " + msg }]);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages(prev => [...prev, { role: "assistant", content: "Connection failed: " + (err instanceof Error ? err.message : String(err)) }]);
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Standard non-ghost mode could go here if needed
      setMessages(prev => [...prev, { role: "assistant", content: "Please enable Ghost or Ghost Open mode." }]);
      setIsGenerating(false);
    }
  };

  const handleAbort = () => {
    if (ghostEnabled) {
      abort();
    } else if (ghostOpenEnabled) {
      abortControllerRef.current?.abort();
    }
    setIsGenerating(false);
  };

  return (
    <div className="w-80 border-l border-zinc-200 bg-zinc-50 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-zinc-200 flex items-center gap-2 bg-white">
        <Sparkles className="h-5 w-5 text-[#c49a6c]" />
        <h3 className="font-semibold text-zinc-900">AI Assistant</h3>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                <div className="whitespace-pre-wrap">{msg.content || (isGenerating && i === messages.length - 1 ? "..." : "")}</div>
                {msg.role === "assistant" && msg.content && !isGenerating && (
                  <InsertButton content={msg.content} />
                )}
              </div>
            </div>
          ))}
          
          {ghostEnabled && !isReady && modelStatus === "idle" && (
            <div className="flex justify-center p-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => loadModel(selectedModelId)}
              >
                <Sparkles className="h-4 w-4" />
                Load Ghost Engine
              </Button>
            </div>
          )}

          {modelStatus === "loading" && (
            <div className="p-4 bg-white border border-zinc-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading Model... {loadPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#c49a6c] transition-all duration-300" 
                  style={{ width: `${loadPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-400 truncate">{loadProgress}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-zinc-200">
        <div className="flex gap-2 relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isGenerating ? "AI is thinking..." : "Ask AI..."}
            disabled={isGenerating}
            className="flex-1 rounded-full border border-zinc-200 pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
          />
          {isGenerating ? (
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-zinc-500 hover:text-red-600"
              onClick={handleAbort}
            >
              <StopCircle size={16} />
            </Button>
          ) : (
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-900"
              onClick={handleSend}
            >
              <Send size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
