"use client";

import React, { useMemo, useRef } from "react";
import {
  Paperclip,
  ChevronDown,
  ArrowUp,
  Sparkles,
  X,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import {
  useChatComposerStore,
  type AttachmentAction,
  type AttachmentItem,
} from "@/store/chatComposerStore";

const ACCEPTED_MIME = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const ACCEPTED_EXT_HINTS = "PDF, DOCX, image, txt";
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return ImageIcon;
  return FileText;
}

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
    nameLower.endsWith(".txt") ||
    nameLower.endsWith(".png") ||
    nameLower.endsWith(".jpg") ||
    nameLower.endsWith(".jpeg") ||
    nameLower.endsWith(".webp");

  if (!mimeOk && !extOk) {
    return `Unsupported file type. Please upload ${ACCEPTED_EXT_HINTS}.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Max ${MAX_FILE_SIZE_MB}MB.`;
  }
  return null;
}

export default function AIChatInput() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const text = useChatComposerStore((s) => s.text);
  const attachments = useChatComposerStore((s) => s.attachments);
  const globalError = useChatComposerStore((s) => s.globalError);
  const isDragOver = useChatComposerStore((s) => s.isDragOver);

  const setText = useChatComposerStore((s) => s.setText);
  const setGlobalError = useChatComposerStore((s) => s.setGlobalError);
  const setIsDragOver = useChatComposerStore((s) => s.setIsDragOver);

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

  const openFilePicker = () => {
    setGlobalError(null);
    fileInputRef.current?.click();
  };

  // Simulated upload (replace with real API upload later)
  const simulateUpload = (id: string) => {
    let progress = 0;
    const interval = window.setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 6;
      if (progress >= 100) progress = 100;

      updateAttachment(id, {
        status: progress === 100 ? "done" : "uploading",
        progress,
      });

      if (progress === 100) window.clearInterval(interval);
    }, 180);
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
      setGlobalError("Some files couldn’t be added. Please check the errors.");
    }

    addAttachments(next);

    for (const item of next) {
      if (item.status === "uploading") simulateUpload(item.id);
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
    updateAttachment(id, {
      status: "uploading",
      progress: 0,
      error: undefined,
    });
    simulateUpload(id);
  };

  // Drag & Drop (whole bubble is drop target)
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

  const acceptAttr =
    ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp";

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Hidden real file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptAttr}
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* 1. ATTACHMENTS PREVIEW AREA (Visible above the bubble) */}
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
          {attachments.map((att) => {
            const Icon = getFileIcon(att.file);

            return (
              <div
                key={att.id}
                className="bg-gray-100 rounded-lg p-2 text-sm border flex items-center gap-2"
                title={att.file.name}
              >
                <Icon size={14} />

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
                      onClick={() =>
                        runAttachmentAction(att.id, "use_as_source")
                      }
                      disabled={att.status !== "done"}
                      title="Use this file as a source for citations"
                      type="button"
                    >
                      Use as source
                    </button>
                    <button
                      className="text-xs text-gray-700 underline underline-offset-2 disabled:text-gray-400"
                      onClick={() => runAttachmentAction(att.id, "summarize")}
                      disabled={att.status !== "done"}
                      title="Summarize this file"
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
                      title="Extract citations found in this file"
                      type="button"
                    >
                      Extract citations
                    </button>

                    <button
                      className="text-xs text-gray-700 underline underline-offset-2"
                      onClick={() => renameAttachment(att.id)}
                      title="Rename"
                      type="button"
                    >
                      Rename
                    </button>

                    <button
                      className="ml-auto p-1 rounded hover:bg-gray-200 transition-colors"
                      onClick={() => removeAttachment(att.id)}
                      title="Remove"
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
            );
          })}
        </div>
      </div>

      {/* 2. MAIN CHAT BUBBLE (Drop target) */}
      <div
        className={`bg-white border border-gray-200 rounded-[24px] shadow-sm p-4 transition-shadow focus-within:shadow-md ${
          isDragOver ? "ring-2 ring-indigo-600 ring-offset-2" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="text-gray-400 mt-1" size={18} />
          <textarea
            className="w-full bg-transparent border-none outline-none resize-none text-[16px] placeholder-gray-500 min-h-[80px]"
            placeholder="Ask AI a question or make a request..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {isDragOver && (
          <div className="mb-4 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 flex items-center gap-2">
            <Paperclip size={16} className="text-gray-700" />
            Drop files to attach ({ACCEPTED_EXT_HINTS})
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              onClick={openFilePicker}
              type="button"
            >
              <Paperclip size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Attach</span>
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              type="button"
            >
              <span className="text-sm font-medium text-gray-700">
                Writing Styles
              </span>
              <ChevronDown size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative inline-flex items-center cursor-pointer">
                <div className="w-11 h-6 bg-indigo-600 rounded-full flex items-center px-1">
                  <div className="bg-white w-4 h-4 rounded-full shadow-sm translate-x-5" />
                </div>
              </div>
              <span className="text-sm text-gray-600">Citation</span>
            </div>

            <button
              className="bg-[#14151a] p-2.5 rounded-xl text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => (window.location.href = `/chat/new-id/`)}
              disabled={hasAnyUploading}
              title={
                hasAnyUploading ? "Please wait for uploads to finish" : "Send"
              }
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
