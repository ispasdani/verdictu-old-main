"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Workflow,
  HelpCircle,
  Settings,
  SquarePen,
  LayoutTemplate,
} from "lucide-react";
import { ImportChatButton } from "@/components/chat/ImportChatButton";
import { AgentSettings } from "@/components/settings/AgentSettings";
import { useChatHistory } from "@/hooks/useChatHistory";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// ─── Nav items ───────────────────────────────────────────────────────────────

const FEATURES = [
  { id: "chat", label: "Chat", icon: MessageSquare, href: "/chat/new" },
  { id: "workflows", label: "Workflows", icon: Workflow, href: "/workflows" },
  { id: "templates", label: "Templates", icon: LayoutTemplate, href: "/templates" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentSidebar() {
  const pathname = usePathname();
  const { chats, loading } = useChatHistory();

  return (
    <Sidebar>
      {/* ── Header: logo + new chat ── */}
      <SidebarHeader className="h-12 mt-3 flex items-center justify-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <img
                src="/icons/verdictu-black.svg"
                alt=""
                className="h-3.5 w-3.5 object-contain dark:invert"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="text-sm font-semibold text-[#565450] tracking-tight">
              Verdictu
            </span>
          </div>
          <Link
            href="/chat/new"
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50 hover:text-sidebar-foreground"
            title="New chat"
          >
            <SquarePen size={16} />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* ── New / Import chat ── */}
        <SidebarGroup className="pt-3 pb-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <ImportChatButton />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Features ── */}
        <SidebarGroup className="pt-2">
          <SidebarGroupLabel className="font-semibold uppercase tracking-widest text-sidebar-foreground">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                const isActive =
                  feature.id === "chat"
                    ? pathname.startsWith("/chat")
                    : pathname === feature.href;
                return (
                  <SidebarMenuItem key={feature.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={feature.label}
                      className={cn(
                        "font-normal text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors rounded-md",
                        isActive && "text-sidebar-foreground bg-sidebar-accent",
                      )}
                    >
                      <Link href={feature.href}>
                        <Icon size={15} />
                        <span className="text-sm">{feature.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── History ── */}
        <SidebarGroup className="pt-2">
          <SidebarGroupLabel className="font-semibold uppercase tracking-widest text-sidebar-foreground">
            Recent
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <span className="px-2 py-1 text-xs text-sidebar-foreground/30">
                    Loading…
                  </span>
                </SidebarMenuItem>
              )}
              {!loading && chats.length === 0 && (
                <SidebarMenuItem>
                  <span className="px-2 py-1 text-xs text-sidebar-foreground/30">
                    No saved chats yet
                  </span>
                </SidebarMenuItem>
              )}
              {chats.slice(0, 20).map((chat) => {
                const isActive = pathname === `/chat/${chat.chatId}`;
                return (
                  <SidebarMenuItem key={chat.chatId}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={chat.title}
                      className={cn(
                        "font-normal group/chat rounded-md transition-colors",
                        isActive
                          ? "text-sidebar-foreground bg-sidebar-accent"
                          : "text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent",
                      )}
                    >
                      <Link href={`/chat/${chat.chatId}`}>
                        <span className="text-sm truncate">{chat.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: help + user ── */}
      <SidebarFooter className="border-t border-sidebar-border pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help & Support"
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <HelpCircle size={15} />
              <span className="text-sm">Help &amp; Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <AgentSettings
              trigger={
                <SidebarMenuButton
                  size="lg"
                  tooltip="Agent settings"
                  className="hover:bg-sidebar-accent rounded-md transition-colors cursor-pointer"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground text-xs font-medium select-none border border-sidebar-border">
                    JD
                  </div>
                  <div className="flex flex-col gap-0.5 text-left leading-none min-w-0">
                    <span className="text-sm font-medium text-sidebar-foreground truncate">
                      John Doe
                    </span>
                    <span className="text-xs text-sidebar-foreground/40 truncate">
                      john@acmelaw.com
                    </span>
                  </div>
                  <Settings
                    size={13}
                    className="ml-auto shrink-0 text-sidebar-foreground/30"
                  />
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
