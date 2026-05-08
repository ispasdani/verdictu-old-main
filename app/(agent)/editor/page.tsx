import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { TEMPLATES } from "@/components/agent-general/template-grid";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Document Editor | Verdictu",
  description: "AI-powered legal document editor.",
};

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const params = await searchParams;
  let initialContent = "";
  let templateTitle = "Untitled Document";

  if (params.templateId) {
    const template = TEMPLATES.find((t) => t.id === params.templateId);
    if (template) {
      initialContent = template.fullContent;
      templateTitle = template.title;
    }
  }

  return (
    <div className="w-full h-screen bg-zinc-50">
      <DocumentEditor initialContent={initialContent} templateTitle={templateTitle} />
    </div>
  );
}
