"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, $getRoot, $createParagraphNode, $createTextNode } from "lexical";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsertButtonProps {
  content: string;
}

export function InsertButton({ content }: InsertButtonProps) {
  const [editor] = useLexicalComposerContext();

  const handleInsert = () => {
    editor.update(() => {
      const selection = $getSelection();
      
      // If we have a selection, insert at the cursor
      if ($isRangeSelection(selection)) {
        selection.insertText(content);
      } else {
        // Otherwise append to the end
        const root = $getRoot();
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(line));
          root.append(paragraph);
        }
      }
    });
  };

  return (
    <Button 
      size="sm" 
      variant="outline" 
      className="mt-2 flex items-center gap-2 h-7 text-xs font-medium bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
      onClick={handleInsert}
    >
      <FileDown className="h-3.5 w-3.5" />
      Insert into Document
    </Button>
  );
}
