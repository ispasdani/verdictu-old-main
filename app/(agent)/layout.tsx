import { AgentSidebar } from "@/components/agent-sections/agent-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-inter">
      <TooltipProvider>
        <SidebarProvider>
          <AgentSidebar />
          <div className="w-full h-screen bg-[#fafafa] flex items-center justify-center">
            {children}
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
