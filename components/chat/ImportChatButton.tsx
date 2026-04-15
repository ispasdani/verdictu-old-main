"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { readVerdictuFile } from "@/lib/chat/importChat";
import { useImportedChatStore } from "@/store/importedChatStore";

export function ImportChatButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const setPendingImport = useImportedChatStore((s) => s.setPendingImport);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so the same file can be re-imported

    try {
      const parsed = await readVerdictuFile(file);
      setPendingImport(parsed);
      // Navigate to a fresh chat URL — the page will detect the pending import
      const id = "import-" + Date.now().toString(36);
      router.push(`/chat/${id}`);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Could not import: ${err.message}`
          : "Invalid .verdictu file.",
      );
    }
  };

  return (
    <label className="flex items-center gap-2 w-full cursor-pointer px-2 py-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
      <Upload size={15} className="shrink-0" />
      <span className="text-sm">Import chat</span>
      <input
        ref={inputRef}
        type="file"
        accept=".verdictu,.json"
        className="sr-only"
        onChange={handleChange}
      />
    </label>
  );
}
