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
} from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";

// ─── Mock data ─────────────────────────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AgentSidebar() {
  const close = useSidebarStore((s) => s.close);
  const pathname = usePathname();

  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-white">

      {/* ── Workspace header ── */}
      <div className="border-b border-black px-4 py-3 flex items-center gap-2">

        {/* Workspace selector */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 text-left"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <div className="w-6 h-6 border border-black shrink-0 flex items-center justify-center">
              <img
                src="/icons/verdictu-black.svg"
                alt=""
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
            <span className="flex-1 text-sm font-semibold truncate">
              {activeWorkspace.name}
            </span>
            <ChevronDown
              size={13}
              className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-2 w-full bg-white border border-black z-50"
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
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-black hover:text-white transition text-left"
                >
                  {ws.name}
                  {ws.id === activeWorkspace.id && <Check size={12} />}
                </button>
              ))}

              <div className="border-t border-black">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-black hover:text-white transition text-left"
                >
                  <Plus size={12} />
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
          className="w-7 h-7 border border-black shrink-0 flex items-center justify-center hover:bg-black hover:text-white transition"
          aria-label="Close sidebar"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* ── Chat history ── */}
      <nav
        aria-label="Chat history"
        className="flex-1 overflow-y-auto py-3"
      >
        {PERIODS.map((period) => {
          const chats = MOCK_CHATS.filter((c) => c.period === period);
          if (!chats.length) return null;

          return (
            <div key={period} className="mb-2">
              <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {period}
              </p>
              {chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.id}`;
                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    title={chat.title}
                    className={`flex items-center px-4 py-2 text-sm transition ${
                      isActive
                        ? "bg-black text-white font-semibold"
                        : "hover:bg-black hover:text-white"
                    }`}
                  >
                    <span className="truncate">{chat.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Help button ── */}
      <div className="border-t border-black p-4">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-black text-sm font-semibold uppercase tracking-widest hover:bg-black hover:text-white transition"
        >
          <HelpCircle size={15} />
          <span>Help &amp; Support</span>
        </button>
      </div>
    </div>
  );
}
