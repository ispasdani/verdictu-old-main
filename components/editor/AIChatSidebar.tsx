"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am your AI document assistant. Highlight text in the editor to get suggestions or ask me anything directly." }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    // Mock AI delay
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm a mocked response for: " + userMsg }]);
    }, 1000);
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
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-zinc-200">
        <div className="flex gap-2 relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask AI..."
            className="flex-1 rounded-full border border-zinc-200 pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <Button 
            size="icon" 
            variant="ghost" 
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-900"
            onClick={handleSend}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
