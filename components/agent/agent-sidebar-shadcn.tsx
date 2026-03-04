"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  PanelLeftClose,
  HelpCircle,
  Plus,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function AgentSidebarShadcn() {
  const close = useSidebarStore((s) => s.close);
  const pathname = usePathname();

  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">

      {/* ── Workspace header ── */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-sidebar-border">

        {/* Workspace selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-start gap-2 px-2 min-w-0"
            >
              <div className="w-5 h-5 rounded bg-muted shrink-0 flex items-center justify-center">
                <img
                  src="/icons/verdictu-black.svg"
                  alt=""
                  className="w-3 h-3 object-contain"
                />
              </div>
              <span className="flex-1 text-left text-[13px] font-medium truncate">
                {activeWorkspace.name}
              </span>
              <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="bottom">
            {WORKSPACES.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => setActiveWorkspace(ws)}
                className={cn(ws.id === activeWorkspace.id && "font-medium")}
              >
                {ws.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Plus />
              Create workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close sidebar */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={close}
          aria-label="Close sidebar"
        >
          <PanelLeftClose />
        </Button>
      </div>

      {/* ── Chat history ── */}
      <nav aria-label="Chat history" className="flex-1 overflow-y-auto py-2 px-2">
        {PERIODS.map((period) => {
          const chats = MOCK_CHATS.filter((c) => c.period === period);
          if (!chats.length) return null;

          return (
            <div key={period} className="mb-2">
              <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {period}
              </p>

              {chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.id}`;
                return (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    size="sm"
                    asChild
                    className={cn(
                      "w-full justify-start gap-2 font-normal",
                      isActive && "bg-accent text-accent-foreground font-medium"
                    )}
                  >
                    <Link href={`/chat/${chat.id}`} title={chat.title}>
                      <MessageSquare className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{chat.title}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Help ── */}
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 font-normal text-muted-foreground"
        >
          <HelpCircle />
          Help &amp; Support
        </Button>
      </div>
    </div>
  );
}
