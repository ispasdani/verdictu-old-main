"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FileText,
  Search,
  FileSearch,
  AlignLeft,
  Gavel,
  ChevronDown,
  Plus,
  HelpCircle,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Mock data ───────────────────────────────────────────────────────────────

const WORKSPACES = [
  { id: "personal", name: "Personal" },
  { id: "acme", name: "Acme Law" },
];

const FEATURES = [
  { id: "chat", label: "AI Chat", icon: MessageSquare, href: "/chat/new" },
  {
    id: "contracts",
    label: "Contract Review",
    icon: FileText,
    href: "/contracts",
  },
  { id: "research", label: "Case Research", icon: Search, href: "/research" },
  {
    id: "documents",
    label: "Document Analysis",
    icon: FileSearch,
    href: "/documents",
  },
  { id: "summary", label: "Legal Summary", icon: AlignLeft, href: "/summary" },
  { id: "rulings", label: "Case Rulings", icon: Gavel, href: "/rulings" },
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
  { id: "4", title: "GDPR data deletion request process", period: "Yesterday" },
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

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentSidebar() {
  const pathname = usePathname();
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);

  return (
    <Sidebar>
      {/* ── Header: workspace selector ── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <img
                      src="/icons/verdictu-black.svg"
                      alt=""
                      className="h-4 w-4 object-contain invert"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 text-left leading-none">
                    <span className="text-sm font-semibold">
                      {activeWorkspace.name}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60">
                      Workspace
                    </span>
                  </div>
                  <ChevronDown className="ml-auto shrink-0 text-sidebar-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-52">
                {WORKSPACES.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onSelect={() => setActiveWorkspace(ws)}
                    className={cn(
                      ws.id === activeWorkspace.id && "font-medium",
                    )}
                  >
                    {ws.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Plus className="mr-2" />
                  Create workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Features ── */}
        <SidebarGroup>
          <SidebarGroupLabel>Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                const isActive = pathname === feature.href;
                return (
                  <SidebarMenuItem key={feature.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={feature.label}
                      className="font-[400]"
                    >
                      <Link href={feature.href}>
                        <Icon />
                        <span>{feature.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* ── History ── */}
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            {PERIODS.map((period) => {
              const chats = MOCK_CHATS.filter((c) => c.period === period);
              if (!chats.length) return null;
              return (
                <div key={period}>
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                    {period}
                  </p>
                  <SidebarMenu>
                    {chats.map((chat) => {
                      const isActive = pathname === `/chat/${chat.id}`;
                      return (
                        <SidebarMenuItem key={chat.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={chat.title}
                            className="font-normal"
                          >
                            <Link href={`/chat/${chat.id}`}>
                              <MessageSquare className="text-sidebar-foreground/50" />
                              <span>{chat.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: help + user ── */}
      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help & Support">
              <HelpCircle />
              <span>Help &amp; Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Clerk user avatar — mocked */}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Account settings">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-medium select-none">
                JD
              </div>
              <div className="flex flex-col gap-0.5 text-left leading-none">
                <span className="text-sm font-medium">John Doe</span>
                <span className="text-xs text-sidebar-foreground/60">
                  john@acmelaw.com
                </span>
              </div>
              <Settings className="ml-auto shrink-0 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
