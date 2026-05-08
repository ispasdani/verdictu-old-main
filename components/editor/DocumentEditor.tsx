import { EditorCanvas } from "./EditorCanvas";
import { AIChatSidebar } from "./AIChatSidebar";
import { LexicalComposer } from "@lexical/react/LexicalComposer";

const theme = {
  paragraph: "mb-4",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
};

interface DocumentEditorProps {
  initialContent?: string;
  templateTitle?: string;
}

export function DocumentEditor({ initialContent, templateTitle }: DocumentEditorProps) {
  const initialConfig = {
    namespace: "VerdictuEditor",
    theme,
    onError: (error: Error) => console.error(error),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex h-screen w-full bg-zinc-50 overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <div className="h-14 border-b border-zinc-200 bg-white flex items-center px-6 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
              <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-xs uppercase tracking-wider font-semibold">
                Template Editor
              </span>
            </div>
            <div className="w-px h-4 bg-zinc-300 mx-4" />
            <h2 className="font-semibold text-zinc-900 text-lg truncate">
              {templateTitle || "Untitled Document"}
            </h2>
          </div>
          
          {/* Canvas */}
          <div className="flex-1 overflow-hidden relative">
            <EditorCanvas initialContent={initialContent} />
          </div>
        </div>
        
        {/* Sidebar */}
        <AIChatSidebar />
      </div>
    </LexicalComposer>
  );
}
