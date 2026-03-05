import { AgentSidebar } from "@/components/agent-sections/agent-sidebar";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-inter">
      <AgentSidebar>{children}</AgentSidebar>
    </div>
  );
}
