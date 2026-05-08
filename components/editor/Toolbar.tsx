"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { FORMAT_TEXT_COMMAND, UNDO_COMMAND, REDO_COMMAND } from "lexical";
import { Bold, Italic, Underline, Strikethrough, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Toolbar() {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex items-center gap-1 p-2 border-b border-zinc-200 bg-white">
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo size={16} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo size={16} />
      </Button>
      <div className="w-px h-4 bg-zinc-300 mx-2" />
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
        <Bold size={16} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
        <Italic size={16} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}>
        <Underline size={16} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}>
        <Strikethrough size={16} />
      </Button>
    </div>
  );
}
