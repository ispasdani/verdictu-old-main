"use client";

import React, { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  ChevronDown,
  ArrowUp,
  Sparkles,
  X,
  FileText,
  AlertTriangle,
  Loader2,
  Check,
  Globe,
} from "lucide-react";
import {
  useChatComposerStore,
  type AttachmentAction,
  type AttachmentItem,
} from "@/store/chatComposerStore";
import { GhostModeToggle } from "@/components/ghost/GhostModeToggle";

// ─── Constants ───────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { value: "eu", label: "EU" },
  { value: "dk", label: "Denmark" },
  { value: "de", label: "Germany" },
  { value: "uk", label: "UK" },
  { value: "fr", label: "France" },
  { value: "se", label: "Sweden" },
  { value: "nl", label: "Netherlands" },
];

const ACCEPTED_MIME = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ACCEPTED_EXT_HINTS = "PDF, DOCX, DOC, TXT";
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPT_ATTR =
  ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function validateFile(file: File): string | null {
  const mimeOk = ACCEPTED_MIME.has(file.type);
  const nameLower = file.name.toLowerCase();
  const extOk =
    nameLower.endsWith(".pdf") ||
    nameLower.endsWith(".doc") ||
    nameLower.endsWith(".docx") ||
    nameLower.endsWith(".txt");

  if (!mimeOk && !extOk)
    return `Unsupported file type. Please upload ${ACCEPTED_EXT_HINTS}.`;
  if (file.size === 0)
    return "File is empty. Open it in Word/your editor and save it first.";
  if (file.size > MAX_FILE_SIZE_BYTES)
    return `File too large. Max ${MAX_FILE_SIZE_MB}MB.`;
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AIChatInputProps {
  /** If provided, called instead of navigating — used for follow-up messages inside an existing chat. */
  onSend?: (text: string, attachments: AttachmentItem[]) => void;
  /** Disable the send button externally (e.g. while the agent is running). */
  disabled?: boolean;
}

export default function AIChatInput({ onSend, disabled: externalDisabled }: AIChatInputProps = {}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const text = useChatComposerStore((s) => s.text);
  const attachments = useChatComposerStore((s) => s.attachments);
  const globalError = useChatComposerStore((s) => s.globalError);
  const isDragOver = useChatComposerStore((s) => s.isDragOver);
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const citationEnabled = useChatComposerStore((s) => s.citationEnabled);

  const setText = useChatComposerStore((s) => s.setText);
  const setGlobalError = useChatComposerStore((s) => s.setGlobalError);
  const setIsDragOver = useChatComposerStore((s) => s.setIsDragOver);
  const setJurisdiction = useChatComposerStore((s) => s.setJurisdiction);
  const setCitationEnabled = useChatComposerStore((s) => s.setCitationEnabled);
  const addAttachments = useChatComposerStore((s) => s.addAttachments);
  const updateAttachment = useChatComposerStore((s) => s.updateAttachment);
  const removeAttachment = useChatComposerStore((s) => s.removeAttachment);
  const renameAttachmentInStore = useChatComposerStore(
    (s) => s.renameAttachment,
  );

  const hasAnyUploading = useMemo(
    () => attachments.some((a) => a.status === "uploading"),
    [attachments],
  );
  const hasJurisdiction = jurisdiction !== "";
  const canSend = !hasAnyUploading && hasJurisdiction && !externalDisabled;

  // ── File handling ───────────────────────────────────────────────────────────

  const openFilePicker = () => {
    setGlobalError(null);
    fileInputRef.current?.click();
  };

  const extractTextFromFile = async (id: string, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let text: string;
      if (ext === "doc") {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extract-doc", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        text = data.text ?? "";
      } else {
        const { extractText } = await import("@/lib/extractText");
        text = await extractText(file);
      }
      updateAttachment(id, {
        status: "done",
        progress: 100,
        extractedText: text,
      });
    } catch (err) {
      updateAttachment(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Text extraction failed.",
      });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    setGlobalError(null);
    const next: AttachmentItem[] = [];
    const list = Array.isArray(files) ? files : Array.from(files);
    for (const file of list) {
      const error = validateFile(file);
      next.push({
        id: makeId(),
        file,
        name: file.name,
        status: error ? "error" : "uploading",
        progress: 0,
        error: error ?? undefined,
      });
    }
    if (next.some((n) => n.status === "error")) {
      setGlobalError("Some files couldn't be added. Please check the errors.");
    }
    addAttachments(next);
    for (const item of next) {
      if (item.status === "uploading") extractTextFromFile(item.id, item.file);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    if (f && f.length > 0) addFiles(f);
    e.target.value = "";
  };

  const renameAttachment = (id: string) => {
    const current = attachments.find((a) => a.id === id);
    if (!current) return;
    const nextName = window.prompt("Rename file", current.name);
    if (!nextName) return;
    renameAttachmentInStore(id, nextName);
  };

  const runAttachmentAction = (id: string, action: AttachmentAction) => {
    updateAttachment(id, { lastAction: action });
  };

  const retryUpload = (id: string) => {
    const att = attachments.find((a) => a.id === id);
    if (!att) return;
    updateAttachment(id, { status: "uploading", progress: 0, error: undefined });
    extractTextFromFile(id, att.file);
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) addFiles(dropped);
  };

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!canSend) return;
    if (onSend) {
      const currentAttachments = attachments;
      setText("");
      onSend(text, currentAttachments);
    } else {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      router.push(`/chat/${id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl w-full mx-auto px-4 my-20">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Attachment list */}
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground/50">
            Attach {ACCEPTED_EXT_HINTS} (max {MAX_FILE_SIZE_MB}MB each)
          </div>
          <div className="text-xs text-muted-foreground/40">
            Files stay in your workspace / not shared externally
          </div>
        </div>

        {globalError && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle size={13} />
            <span>{globalError}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="bg-secondary border border-border rounded-lg p-2 text-sm flex items-center gap-2"
              title={att.file.name}
            >
              <FileText
                size={13}
                className="text-muted-foreground/60 shrink-0"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="max-w-[220px] truncate text-foreground/70">
                    {att.name}
                  </span>
                  {att.status === "uploading" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" />
                      {att.progress}%
                    </span>
                  )}
                  {att.status === "done" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check size={11} />
                      Ready
                    </span>
                  )}
                  {att.status === "error" && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      Error
                    </span>
                  )}
                </div>

                {att.status === "uploading" && (
                  <div className="h-0.5 w-60 max-w-[60vw] bg-border rounded mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-foreground/60 transition-all"
                      style={{ width: `${att.progress}%` }}
                    />
                  </div>
                )}

                {att.status === "error" && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-red-400">
                      {att.error ?? "Upload failed."}
                    </span>
                    <button
                      className="text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground/70"
                      onClick={() => retryUpload(att.id)}
                      type="button"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-30 hover:text-foreground/70"
                    onClick={() => runAttachmentAction(att.id, "use_as_source")}
                    disabled={att.status !== "done"}
                    type="button"
                  >
                    Use as source
                  </button>
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-30 hover:text-foreground/70"
                    onClick={() => runAttachmentAction(att.id, "summarize")}
                    disabled={att.status !== "done"}
                    type="button"
                  >
                    Summarize
                  </button>
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-30 hover:text-foreground/70"
                    onClick={() =>
                      runAttachmentAction(att.id, "extract_citations")
                    }
                    disabled={att.status !== "done"}
                    type="button"
                  >
                    Extract citations
                  </button>
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground/70"
                    onClick={() => renameAttachment(att.id)}
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="ml-auto p-1 rounded hover:bg-accent transition-colors"
                    onClick={() => removeAttachment(att.id)}
                    type="button"
                  >
                    <X size={13} className="text-muted-foreground" />
                  </button>
                </div>

                {att.lastAction && (
                  <div className="text-[11px] text-muted-foreground/50 mt-1">
                    Last action:{" "}
                    {att.lastAction === "use_as_source"
                      ? "Use as source"
                      : att.lastAction === "summarize"
                        ? "Summarize"
                        : "Extract citations"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat bubble */}
      <div
        className={`bg-secondary border border-border rounded-lg p-4 transition-colors ${
          isDragOver ? "ring-1 ring-foreground/30 border-foreground/30" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex items-start gap-3 mb-4">
          <Sparkles
            className="text-muted-foreground/40 mt-1 shrink-0"
            size={16}
          />
          <textarea
            className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-foreground placeholder:text-muted-foreground/40 min-h-20"
            placeholder="Ask a question, compare documents, request a draft…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {isDragOver && (
          <div className="mb-4 px-3 py-2 rounded-md border border-border bg-accent text-sm text-foreground/60 flex items-center gap-2">
            <Paperclip size={14} className="text-foreground/50" />
            Drop files to attach ({ACCEPTED_EXT_HINTS})
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Attach */}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md hover:bg-accent bg-transparent transition-colors cursor-pointer"
              onClick={openFilePicker}
              type="button"
            >
              <Paperclip size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Attach
              </span>
            </button>

            {/* Jurisdiction */}
            <div
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md hover:bg-accent bg-transparent transition-colors ${
                !hasJurisdiction
                  ? "border-amber-500/60 text-amber-500"
                  : "border-border"
              }`}
            >
              <Globe
                size={13}
                className={!hasJurisdiction ? "text-amber-500 shrink-0" : "text-muted-foreground shrink-0"}
              />
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs font-medium cursor-pointer appearance-none pr-3 ${
                  !hasJurisdiction ? "text-amber-500" : "text-muted-foreground"
                }`}
              >
                <option value="" disabled className="bg-card text-muted-foreground">
                  Select jurisdiction
                </option>
                {JURISDICTIONS.map((j) => (
                  <option
                    key={j.value}
                    value={j.value}
                    className="bg-card text-foreground"
                  >
                    {j.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="text-muted-foreground/50 pointer-events-none absolute right-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ghost Mode */}
            <GhostModeToggle />

            {/* Citations toggle */}
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => setCitationEnabled(!citationEnabled)}
            >
              <div
                className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${
                  citationEnabled ? "bg-foreground" : "bg-border"
                }`}
              >
                <div
                  className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${
                    citationEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-xs text-muted-foreground">Citations</span>
            </button>

            {/* Send */}
            <button
              className="bg-foreground p-2 rounded-md text-card hover:bg-foreground/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={handleSend}
              disabled={!canSend}
              title={
                hasAnyUploading
                  ? "Please wait for uploads to finish"
                  : !hasJurisdiction
                    ? "Select a jurisdiction before sending"
                    : "Send"
              }
              type="button"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
