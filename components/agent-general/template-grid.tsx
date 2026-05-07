"use client";

import { useState } from "react";
import { Plus, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Mock Data ──────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  previewImage?: string; // Optional if we want to show a small mock doc preview
  fullContent: string;
}

const TEMPLATES: Template[] = [
  {
    id: "1",
    title: "Transmittal of Documents for Signature",
    category: "Communication",
    description: "A formal cover letter for sending documents that require a signature.",
    fullContent: `[DATE]\n\n[CONTACT NAME]\n[ADDRESS]\n\nSUBJECT: TRANSMITTAL OF DOCUMENTS FOR SIGNATURE\n\nDear [CONTACT NAME],\n\nThe following documents are enclosed and require your signature:\n\n- [DOCUMENT 1]\n- [DOCUMENT 2]\n\nPlease execute your signature where indicated and return the originals to this office. The copies that we have provided are for your files.\n\nThank you for your previous collaboration.\n\nSincerely,\n\n[YOUR NAME]\n[YOUR TITLE]`,
  },
  {
    id: "2",
    title: "Legal Service Agreement",
    category: "Contracts",
    description: "A standard agreement between a law firm and a client for legal services.",
    fullContent: `LEGAL SERVICE AGREEMENT\n\nThis Legal Service Agreement is made effective [DATE],\n\nBETWEEN: [CLIENT NAME], with a principal place of business located at [ADDRESS]\n\nAND: [LAW FIRM NAME], with a principal place of business located at [ADDRESS]\n\n1. SCOPE OF SERVICES\nThe Service Provider agrees to provide the following legal services to the Client...\n\n2. FEES AND PAYMENT\nThe Client agrees to pay the Service Provider...`,
  },
  {
    id: "3",
    title: "Checklist Documents to Bring to Your Attorney",
    category: "Checklists",
    description: "A helpful checklist for clients to prepare before meeting their attorney.",
    fullContent: `CHECKLIST\nDOCUMENTS TO BRING TO YOUR ATTORNEY\n\nEverybody in business knows that suing someone or being sued yourself is an extremely stressful and often time-consuming process. To make your initial consultation as productive as possible, please bring the following documents:\n\n[ ] Summons and Complaint\n[ ] All correspondence with the other party\n[ ] Insurance policies\n[ ] Incorporation documents\n[ ] Contracts\n[ ] Invoices or receipts`,
  },
  {
    id: "4",
    title: "Contract on Retaining Legal Counsel",
    category: "Contracts",
    description: "An agreement to officially retain a lawyer or law firm for specific legal representation.",
    fullContent: `CONTRACT ON RETAINING LEGAL COUNSEL\n\nThis Agreement for Contract on Retaining Legal Counsel is made and effective [DATE],\n\nBETWEEN: [YOUR COMPANY NAME] (the "Client")\n\nAND: [COMPANY NAME] (the "Legal Counsel")\n\n1. Legal Counsel will provide the following services:\n- Providing answers to legal questions\n- Assisting in drafting and reviewing contracts\n- Participating in contract negotiation`,
  },
  {
    id: "5",
    title: "Website Legal Notice",
    category: "Notices",
    description: "Standard terms, conditions, and copyright notices for a business website.",
    fullContent: `WEBSITE LEGAL NOTICE\n\n© Copyright [COMPANY YEAR]. All rights reserved.\n\nTERMS AND CONDITIONS OF USE\nWelcome to the corporate website of [COMPANY]. Use of this site is governed by the Terms and Conditions set forth. PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE USING THIS WEBSITE.\n\nOWNERSHIP OF INFORMATION AND MATERIALS\nThe information and any materials available on or from this website are the copyrighted works of [COMPANY]...`,
  },
  {
    id: "6",
    title: "Standard Operation Procedure",
    category: "Operations",
    description: "Internal and external document identification procedure.",
    fullContent: `STANDARD OPERATION PROCEDURE\nHow to Have Control of Your Documents & Company Data\n\nDepartment: All departments\n\nPurpose: The purpose of this Standard Operating Procedure document is to guide you on how to have better control over all corporate documents and data.\n\nFrequency: When needed\n\nProcedure:\n1. Be aware of document control policies\n2. Use standardized naming conventions...`,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function TemplateGrid() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                    <p className="text-zinc-500 mb-8">{template.description}</p>

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
