"use client";

import React, { useMemo, useRef, useState } from "react";
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

// ─── Constants ───────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { value: "auto", label: "Auto" },
  { value: "eu", label: "EU" },
  { value: "dk", label: "Denmark" },
  { value: "de", label: "Germany" },
  { value: "uk", label: "UK" },
  { value: "fr", label: "France" },
  { value: "se", label: "Sweden" },
  { value: "nl", label: "Netherlands" },
];

const MODES = ["General", "Compare", "Draft"] as const;

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

// ─── Types ────────────────────────────────────────────────────────────────────

type CompareSlot = { file: File | null; name: string; size: number };
const EMPTY_SLOT: CompareSlot = { file: null, name: "", size: 0 };

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── CompareDocSlot sub-component ─────────────────────────────────────────────

function CompareDocSlot({
  label,
  slot,
  onPick,
  onClear,
}: {
  label: "A" | "B";
  slot: CompareSlot;
  onPick: () => void;
  onClear: () => void;
}) {
  const hasFile = slot.file !== null;

  return (
    <div
      className={`flex-1 min-h-32.5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all ${
        hasFile
          ? "border-indigo-200 bg-indigo-50/60 cursor-default"
          : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 cursor-pointer"
      }`}
      onClick={() => !hasFile && onPick()}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
        Document {label}
      </span>

      {hasFile ? (
        <>
          <FileText size={22} className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-800 text-center px-3 max-w-full truncate">
            {slot.name}
          </span>
          <span className="text-xs text-gray-400">{formatBytes(slot.size)}</span>
          <button
            type="button"
            className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X size={11} />
            Remove
          </button>
        </>
      ) : (
        <>
          <Paperclip size={20} className="text-gray-300" />
          <span className="text-sm text-gray-400">Click to upload</span>
          <span className="text-xs text-gray-300">
            {ACCEPTED_EXT_HINTS} · max {MAX_FILE_SIZE_MB}MB
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIChatInput() {
  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);

  const router = useRouter();

  // Local UI state (compare slots only)
  const [slotA, setSlotA] = useState<CompareSlot>(EMPTY_SLOT);
  const [slotB, setSlotB] = useState<CompareSlot>(EMPTY_SLOT);

  // Store — composer content
  const text = useChatComposerStore((s) => s.text);
  const attachments = useChatComposerStore((s) => s.attachments);
  const globalError = useChatComposerStore((s) => s.globalError);
  const isDragOver = useChatComposerStore((s) => s.isDragOver);

  // Store — session settings
  const mode = useChatComposerStore((s) => s.mode);
  const jurisdiction = useChatComposerStore((s) => s.jurisdiction);
  const citationEnabled = useChatComposerStore((s) => s.citationEnabled);

  const setText = useChatComposerStore((s) => s.setText);
  const setGlobalError = useChatComposerStore((s) => s.setGlobalError);
  const setIsDragOver = useChatComposerStore((s) => s.setIsDragOver);
  const setMode = useChatComposerStore((s) => s.setMode);
  const setJurisdiction = useChatComposerStore((s) => s.setJurisdiction);
  const setCitationEnabled = useChatComposerStore((s) => s.setCitationEnabled);
  const addAttachments = useChatComposerStore((s) => s.addAttachments);
  const updateAttachment = useChatComposerStore((s) => s.updateAttachment);
  const removeAttachment = useChatComposerStore((s) => s.removeAttachment);
  const renameAttachmentInStore = useChatComposerStore(
    (s) => s.renameAttachment,
  );

  // Derived
  const hasAnyUploading = useMemo(
    () => attachments.some((a) => a.status === "uploading"),
    [attachments],
  );
  const canSend =
    mode === "Compare"
      ? slotA.file !== null && slotB.file !== null
      : !hasAnyUploading;

  // ── General mode file handling ──────────────────────────────────────────────

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
      updateAttachment(id, { status: "done", progress: 100, extractedText: text });
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

  // ── Drag & Drop (General mode only) ────────────────────────────────────────

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

  // ── Compare slot handling ───────────────────────────────────────────────────

  const onSlotChange = (
    slot: "A" | "B",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data: CompareSlot = { file, name: file.name, size: file.size };
    if (slot === "A") setSlotA(data);
    else setSlotB(data);
    e.target.value = "";
  };

  // ── Send ────────────────────────────────────────────────────────────────────

  const sendTitle =
    mode === "Compare" && (!slotA.file || !slotB.file)
      ? "Upload both documents to compare"
      : hasAnyUploading
        ? "Please wait for uploads to finish"
        : "Send";

  const handleSend = () => {
    if (!canSend) return;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    router.push(`/chat/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full mx-auto mt-5 mb-5">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onFileInputChange}
      />
      <input
        ref={fileInputARef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => onSlotChange("A", e)}
      />
      <input
        ref={fileInputBRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => onSlotChange("B", e)}
      />

      {/* Above-bubble attachment list — General mode only */}
      {mode === "General" && (
        <div className="flex flex-col gap-2 mb-2 px-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              Attach {ACCEPTED_EXT_HINTS} (max {MAX_FILE_SIZE_MB}MB each)
            </div>
            <div className="text-xs text-gray-500">
              Files stay in your workspace / not shared externally
            </div>
          </div>

          {globalError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertTriangle size={14} />
              <span>{globalError}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="bg-gray-100 rounded-lg p-2 text-sm border flex items-center gap-2"
                title={att.file.name}
              >
                <FileText size={14} />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="max-w-[220px] truncate">{att.name}</span>
                    {att.status === "uploading" && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" />
                        {att.progress}%
                      </span>
                    )}
                    {att.status === "done" && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Check size={12} />
                        Ready
                      </span>
                    )}
                    {att.status === "error" && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Error
                      </span>
                    )}
                  </div>

                  {att.status === "uploading" && (
                    <div className="h-1 w-[240px] max-w-[60vw] bg-white/60 rounded mt-1 overflow-hidden border border-gray-200">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${att.progress}%` }}
                      />
                    </div>
                  )}

                  {att.status === "error" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-red-600">
                        {att.error ?? "Upload failed."}
                      </span>
                      <button
                        className="text-xs text-gray-700 underline underline-offset-2"
                        onClick={() => retryUpload(att.id)}
                        type="button"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      className="text-xs text-gray-700 underline underline-offset-2 disabled:text-gray-400"
                      onClick={() => runAttachmentAction(att.id, "use_as_source")}
                      disabled={att.status !== "done"}
                      type="button"
                    >
                      Use as source
                    </button>
                    <button
                      className="text-xs text-gray-700 underline underline-offset-2 disabled:text-gray-400"
                      onClick={() => runAttachmentAction(att.id, "summarize")}
                      disabled={att.status !== "done"}
                      type="button"
                    >
                      Summarize
                    </button>
                    <button
                      className="text-xs text-gray-700 underline underline-offset-2 disabled:text-gray-400"
                      onClick={() =>
                        runAttachmentAction(att.id, "extract_citations")
                      }
                      disabled={att.status !== "done"}
                      type="button"
                    >
                      Extract citations
                    </button>
                    <button
                      className="text-xs text-gray-700 underline underline-offset-2"
                      onClick={() => renameAttachment(att.id)}
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      className="ml-auto p-1 rounded hover:bg-gray-200 transition-colors"
                      onClick={() => removeAttachment(att.id)}
                      type="button"
                    >
                      <X size={14} className="text-gray-600" />
                    </button>
                  </div>

                  {att.lastAction && (
                    <div className="text-[11px] text-gray-500 mt-1">
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
      )}

      {/* Main chat bubble */}
      <div
        className={`bg-white border border-gray-200 rounded-[24px] shadow-sm p-4 transition-shadow focus-within:shadow-md ${
          isDragOver && mode === "General"
            ? "ring-2 ring-indigo-600 ring-offset-2"
            : ""
        }`}
        onDragOver={mode === "General" ? onDragOver : undefined}
        onDragLeave={mode === "General" ? onDragLeave : undefined}
        onDrop={mode === "General" ? onDrop : undefined}
      >
        {/* ── General / Draft body ── */}
        {(mode === "General" || mode === "Draft") && (
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="text-gray-400 mt-1" size={18} />
            <textarea
              className="w-full bg-transparent border-none outline-none resize-none text-[16px] placeholder-gray-500 min-h-20"
              placeholder={
                mode === "Draft"
                  ? "Describe the document you'd like to draft…"
                  : "Ask AI a question or make a request…"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        {/* ── Compare body ── */}
        {mode === "Compare" && (
          <>
            {/* Two document slots */}
            <div className="flex gap-3 mb-3">
              <CompareDocSlot
                label="A"
                slot={slotA}
                onPick={() => fileInputARef.current?.click()}
                onClear={() => setSlotA(EMPTY_SLOT)}
              />
              <div className="flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-gray-300 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center select-none">
                  vs
                </span>
              </div>
              <CompareDocSlot
                label="B"
                slot={slotB}
                onPick={() => fileInputBRef.current?.click()}
                onClear={() => setSlotB(EMPTY_SLOT)}
              />
            </div>

            {/* Optional question / focus area */}
            <div className="border-t border-gray-100 pt-3 mb-3">
              <textarea
                className="w-full bg-transparent border-none outline-none resize-none text-[15px] placeholder-gray-400 min-h-11"
                placeholder="What should we focus on? e.g. termination clauses, liability caps, IP ownership… (optional)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </>
        )}

        {/* Drag-over hint (General only) */}
        {isDragOver && mode === "General" && (
          <div className="mb-4 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
            <Paperclip size={16} className="text-gray-700" />
            Drop files to attach ({ACCEPTED_EXT_HINTS})
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Attach — General mode only (Compare uses slots) */}
            {mode === "General" && (
              <button
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                onClick={openFilePicker}
                type="button"
              >
                <Paperclip size={16} className="text-gray-700" />
                <span className="text-sm font-medium text-gray-700">Attach</span>
              </button>
            )}

            {/* Jurisdiction */}
            <div className="relative flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Globe size={15} className="text-gray-500 shrink-0" />
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer appearance-none pr-4"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="text-gray-400 pointer-events-none absolute right-2.5"
              />
            </div>

            {/* Mode switcher */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Citations toggle */}
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => setCitationEnabled(!citationEnabled)}
            >
              <div
                className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${
                  citationEnabled ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${
                    citationEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-sm text-gray-600">Citations</span>
            </button>

            {/* Send */}
            <button
              className="bg-[#14151a] p-2.5 rounded-xl text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSend}
              disabled={!canSend}
              title={sendTitle}
              type="button"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
