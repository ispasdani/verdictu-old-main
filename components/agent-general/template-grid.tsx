"use client";

import { useState } from "react";
import { Plus, ArrowRight, X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

import { TEMPLATES } from "@/lib/templates";


// ─── Component ──────────────────────────────────────────────────────────────

export function TemplateGrid() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">
            Legal Documents Templates
          </h1>
          <p className="text-zinc-500 max-w-2xl">
            Browse the most relevant templates below. Select any template to view its full context and details before using it in your workflows.
          </p>
        </div>
        <Button className="shrink-0 flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6">
          <Plus size={16} />
          Create new template
        </Button>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {TEMPLATES.map((template) => {
          const isExpanded = expandedId === template.id;

          return (
            <div key={template.id} className="flex flex-col">
              {/* Card */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : template.id)}
                className={`flex flex-col bg-white border border-zinc-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-zinc-300 h-full ${
                  isExpanded ? "ring-2 ring-zinc-900 border-transparent shadow-md" : ""
                }`}
              >
                {/* Mock Document Preview Area */}
                <div className="h-48 bg-zinc-50 border-b border-zinc-100 flex items-center justify-center p-6 overflow-hidden relative group">
                  {/* Subtle document graphic */}
                  <div className="w-full h-full bg-white shadow-sm border border-zinc-200 rounded flex flex-col p-3 transition-transform duration-300 group-hover:scale-[1.02]">
                    <div className="w-1/3 h-2 bg-zinc-200 rounded mb-4"></div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded mb-2"></div>
                    <div className="w-5/6 h-1.5 bg-zinc-100 rounded mb-2"></div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded mb-2"></div>
                    <div className="w-4/5 h-1.5 bg-zinc-100 rounded mb-4"></div>
                    <div className="mt-auto w-1/4 h-1.5 bg-zinc-200 rounded"></div>
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    {template.category}
                  </div>
                  <h3 className="font-semibold text-zinc-900 leading-snug mb-2">
                    {template.title}
                  </h3>
                  <div className="mt-auto pt-4 flex items-center text-sm font-medium text-[#c49a6c] hover:text-[#a37e54] transition-colors">
                    <span>View Context</span>
                    <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Inline View */}
      {expandedId && (
        <div
          className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden relative col-span-full mt-6"
        >
            {TEMPLATES.map((template) => {
              if (template.id !== expandedId) return null;
              return (
                <div key={template.id} className="p-8 md:p-12 flex flex-col relative">
                  <button
                    onClick={() => setExpandedId(null)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-zinc-200 transition-colors text-zinc-500 hover:text-zinc-800"
                  >
                    <X size={20} />
                  </button>

                  <div className="max-w-3xl">
                    <div className="inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 mb-4 bg-white">
                      {template.category}
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-2">
                      {template.title}
                    </h2>
                    <p className="text-zinc-500 mb-6">{template.description}</p>
                    
                    <div className="mb-8">
                      <Button 
                        onClick={() => router.push(`/editor?templateId=${template.id}`)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6"
                      >
                        <Edit2 size={16} className="mr-2" />
                        Use & Edit Document
                      </Button>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 leading-relaxed">
                        {template.fullContent}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
