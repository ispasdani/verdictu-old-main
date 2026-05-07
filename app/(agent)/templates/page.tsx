import { TemplateGrid } from "@/components/agent-general/template-grid";

export const metadata = {
  title: "Templates | Verdictu",
  description: "Browse and create legal document templates.",
};

export default function TemplatesPage() {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#fbf9f5]">
      <TemplateGrid />
    </div>
  );
}
