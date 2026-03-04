"use client";

import { PanelLeftOpen } from "lucide-react";
import AgentSidebar from "./agent-sidebar";
import { useSidebarStore } from "@/store/sidebarStore";

export default function AgentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const open = useSidebarStore((s) => s.open);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar — sticky so it stays in view while content scrolls */}
      {isOpen && (
        <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-zinc-100">
          <AgentSidebar />
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 relative">
        {/* Re-open button — only visible when sidebar is closed */}
        {!isOpen && (
          <button
            type="button"
            onClick={open}
            aria-label="Open sidebar"
            className="fixed top-3.5 left-3.5 z-50 w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
