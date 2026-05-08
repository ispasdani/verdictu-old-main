"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState, useCallback } from "react";
import { $getSelection, $isRangeSelection } from "lexical";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function FloatingTextMenu() {
  const [editor] = useLexicalComposerContext();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updateMenu = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(nativeSelection.anchorNode) ||
          selection.getTextContent() === "")
      ) {
        setShow(false);
        return;
      }

      const domRange = nativeSelection?.getRangeAt(0);
      if (domRange) {
        const rect = domRange.getBoundingClientRect();
        // Position slightly above the text relative to the viewport
        setPos({
          top: rect.top - 50,
          left: rect.left + rect.width / 2,
        });
        setShow(true);
      }
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      updateMenu();
    });
  }, [editor, updateMenu]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateMenu);
    return () => document.removeEventListener("selectionchange", updateMenu);
  }, [updateMenu]);

  if (!show) return null;

  return (
    <div 
      className="fixed z-50 flex items-center gap-1 bg-zinc-900 rounded-lg p-1 shadow-lg transform -translate-x-1/2"
      style={{ top: pos.top, left: pos.left }}
    >
      <Button size="sm" variant="ghost" className="text-white hover:bg-zinc-800 h-8 px-2 text-xs">
        <Sparkles size={14} className="mr-1 text-[#c49a6c]" />
        Improve
      </Button>
      <div className="w-px h-4 bg-zinc-700 mx-1" />
      <Button size="sm" variant="ghost" className="text-white hover:bg-zinc-800 h-8 px-2 text-xs">Make Formal</Button>
      <Button size="sm" variant="ghost" className="text-white hover:bg-zinc-800 h-8 px-2 text-xs">Expand</Button>
    </div>
  );
}
