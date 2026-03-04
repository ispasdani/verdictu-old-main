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
    <div className="flex min-h-screen">
      {/* Sidebar — sticky so it stays in view while content scrolls */}
      {isOpen && (
        <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-black">
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
            className="fixed top-4 left-4 z-50 w-8 h-8 bg-white border border-black flex items-center justify-center hover:bg-black hover:text-white transition"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
