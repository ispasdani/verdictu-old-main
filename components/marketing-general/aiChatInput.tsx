"use client";

import React, { useState } from "react";
import { Paperclip, ChevronDown, ArrowUp, Sparkles } from "lucide-react";

const AIChatInput = () => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* 1. ATTACHMENTS PREVIEW AREA (Visible above the bubble) */}
      <div className="flex flex-wrap gap-2 mb-2 px-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="bg-gray-100 rounded-lg p-2 text-sm border flex items-center gap-2"
          >
            <Paperclip size={14} />
            <span>{file.name}</span>
          </div>
        ))}
      </div>

      {/* 2. MAIN CHAT BUBBLE */}
      <div className="bg-white border border-gray-200 rounded-[24px] shadow-sm p-4 transition-shadow focus-within:shadow-md">
        {/* TEXT AREA & ICON */}
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="text-gray-400 mt-1" size={18} />
          <textarea
            className="w-full bg-transparent border-none outline-none resize-none text-[16px] placeholder-gray-500 min-h-[80px]"
            placeholder="Ask AI a question or make a request..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* BOTTOM TOOLBAR */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ATTACH BUTTON */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Paperclip size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Attach</span>
            </button>

            {/* WRITING STYLES BUTTON */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-gray-700">
                Writing Styles
              </span>
              <ChevronDown size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* CITATION TOGGLE */}
            <div className="flex items-center gap-2">
              <div className="relative inline-flex items-center cursor-pointer">
                <div className="w-11 h-6 bg-indigo-600 rounded-full flex items-center px-1">
                  <div className="bg-white w-4 h-4 rounded-full shadow-sm translate-x-5" />
                </div>
              </div>
              <span className="text-sm text-gray-600">Citation</span>
            </div>

            {/* SEND BUTTON */}
            <button
              className="bg-[#14151a] p-2.5 rounded-xl text-white hover:bg-black transition-colors"
              onClick={() => (window.location.href = `/chat/new-id/`)} // Placeholder for routing
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatInput;
