"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { Toolbar } from "./Toolbar";
import { FloatingTextMenu } from "./FloatingTextMenu";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode } from "lexical";
import { useEffect } from "react";

const theme = {
  paragraph: "mb-4",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
};

function InitPlugin({ initialContent }: { initialContent?: string }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (initialContent) {
      editor.update(() => {
        const root = $getRoot();
        if (root.getFirstChild() === null) {
          const lines = initialContent.split('\n');
          for (const line of lines) {
            const p = $createParagraphNode();
            if (line) {
              p.append($createTextNode(line));
            }
            root.append(p);
          }
        }
      });
    }
  }, [editor, initialContent]);

  return null;
}

export function EditorCanvas({ initialContent }: { initialContent?: string }) {
  const initialConfig = {
    namespace: "VerdictuEditor",
    theme,
    onError: (error: Error) => console.error(error),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-col flex-1 bg-zinc-50 h-full relative">
        <Toolbar />
        <div className="flex-1 overflow-y-auto relative p-8">
          <div className="max-w-4xl mx-auto bg-white min-h-[800px] p-12 sm:p-16 border border-zinc-200 shadow-sm rounded-lg relative">
            <RichTextPlugin
              contentEditable={<ContentEditable className="outline-none min-h-full font-sans text-zinc-800 leading-relaxed max-w-none text-base" />}
              placeholder={<div className="absolute top-12 sm:top-16 left-12 sm:left-16 text-zinc-400 pointer-events-none">Start typing...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <FloatingTextMenu />
            <InitPlugin initialContent={initialContent} />
          </div>
        </div>
      </div>
    </LexicalComposer>
  );
}
