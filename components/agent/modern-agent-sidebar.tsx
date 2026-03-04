"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  PanelLeftClose,
  HelpCircle,
  Check,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";

// ─── Mock data ──────────────────────────────────────────────────────────────────

const WORKSPACES = [
  { id: "personal", name: "Personal" },
  { id: "acme", name: "Acme Law" },
];

type ChatPeriod = "Today" | "Yesterday" | "Last 7 days";

const MOCK_CHATS: { id: string; title: string; period: ChatPeriod }[] = [
  {
    id: "1",
    title: "Can a landlord increase rent during a fixed-term lease?",
    period: "Today",
  },
  {
    id: "2",
    title: "Employment termination rights in Germany",
    period: "Today",
  },
  {
    id: "3",
    title: "How to dispute an insurance claim refusal",
    period: "Yesterday",
  },
  {
    id: "4",
    title: "GDPR data deletion request process",
    period: "Yesterday",
  },
  {
    id: "5",
    title: "What is force majeure in a commercial contract?",
    period: "Last 7 days",
  },
  {
    id: "6",
    title: "Tenant rights when landlord fails to make repairs",
    period: "Last 7 days",
  },
  {
    id: "7",
    title: "Non-compete clause enforceability in Denmark",
    period: "Last 7 days",
  },
];

const PERIODS: ChatPeriod[] = ["Today", "Yesterday", "Last 7 days"];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AgentSidebar() {
  const close = useSidebarStore((s) => s.close);
  const pathname = usePathname();

  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Workspace header ── */}
      <div className="flex items-center gap-1 px-3 py-3 border-b border-zinc-100">
        {/* Selector */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-50 transition text-left"
          >
            {/* Workspace avatar */}
            <div className="w-5 h-5 rounded bg-zinc-100 shrink-0 flex items-center justify-center">
              <img
                src="/icons/verdictu-black.svg"
                alt=""
                className="w-3 h-3 object-contain"
              />
            </div>

            <span className="flex-1 text-[13px] font-medium text-zinc-800 truncate">
              {activeWorkspace.name}
            </span>

            <ChevronDown
              size={12}
              className={`shrink-0 text-zinc-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Workspace dropdown */}
          {dropdownOpen && (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-1.5 w-full bg-white border border-zinc-100 rounded-lg z-50 overflow-hidden shadow-lg shadow-zinc-100"
            >
              {WORKSPACES.map((ws) => (
                <button
                  key={ws.id}
                  role="option"
                  aria-selected={ws.id === activeWorkspace.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition text-left"
                >
                  {ws.name}
                  {ws.id === activeWorkspace.id && (
                    <Check size={11} className="text-zinc-400 shrink-0" />
                  )}
                </button>
              ))}

              <div className="border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition text-left"
                >
                  <Plus size={11} />
                  Create workspace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close sidebar */}
        <button
          type="button"
          onClick={close}
          aria-label="Close sidebar"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* ── Chat history ── */}
      <nav aria-label="Chat history" className="flex-1 overflow-y-auto py-2">
        {PERIODS.map((period) => {
          const chats = MOCK_CHATS.filter((c) => c.period === period);
          if (!chats.length) return null;

          return (
            <div key={period} className="mb-1">
              <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {period}
              </p>

              {chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.id}`;
                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    title={chat.title}
                    className={`group flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-md text-[13px] transition ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                    }`}
                  >
                    <MessageSquare
                      size={12}
                      className={`shrink-0 ${
                        isActive
                          ? "text-zinc-500"
                          : "text-zinc-300 group-hover:text-zinc-400"
                      }`}
                    />
                    <span className="truncate leading-snug">{chat.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Help ── */}
      <div className="border-t border-zinc-100 px-3 py-3">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition"
        >
          <HelpCircle size={14} className="shrink-0" />
          <span>Help &amp; Support</span>
        </button>
      </div>
    </div>
  );
}
