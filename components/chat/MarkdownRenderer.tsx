"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export const LAW_CHIP_REGEX =
  /\b((?:Art(?:icle)?\.?\s*\d+(?:\(\d+\))?(?:\([a-z]\))?(?:\s+(?:GDPR|DSA|DMA|AI Act|DSGVO|CCPA|HIPAA|NIS2|ePrivacy|TFEU|ECHR))?)|(?:§+\s*\d+(?:\s*(?:Abs\.|para\.)\s*\d+)?(?:\s+[A-Z][A-Za-z]+)?)|(?:Regulation\s+\(EU\)\s+\d{4}\/\d+)|(?:Directive\s+\d{4}\/\d+\/EU))\b/g;

export function inline(
  text: string,
  onCiteClick?: (n: number) => void,
): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 bg-secondary rounded text-xs font-mono text-foreground/80"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.match(/^\[\d+\]$/)) {
      const n = parseInt(part.slice(1, -1), 10);
      return (
        <sup
          key={i}
          onClick={() => onCiteClick?.(n)}
          className={`text-indigo-600 text-[10px] font-medium ${onCiteClick ? "cursor-pointer hover:text-indigo-800 underline underline-offset-2" : ""}`}
        >
          {part}
        </sup>
      );
    }
    const chipParts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    LAW_CHIP_REGEX.lastIndex = 0;
    while ((m = LAW_CHIP_REGEX.exec(part)) !== null) {
      if (m.index > last) chipParts.push(part.slice(last, m.index));
      chipParts.push(
        <span
          key={`chip-${i}-${m.index}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium mx-0.5"
        >
          {m[0]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (chipParts.length > 0) {
      if (last < part.length) chipParts.push(part.slice(last));
      return <React.Fragment key={i}>{chipParts}</React.Fragment>;
    }
    return part;
  });
}

export function renderMarkdown(
  text: string,
  onCiteClick?: (n: number) => void,
): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-semibold text-foreground mt-5 mb-2 first:mt-0"
        >
          {inline(line.slice(3), onCiteClick)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-sm font-semibold text-foreground mt-4 mb-1.5"
        >
          {inline(line.slice(4), onCiteClick)}
        </h3>,
      );
    } else if (
      line.startsWith("**Sources**") ||
      line.startsWith("## Sources")
    ) {
      elements.push(
        <div
          key={i}
          className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-5 mb-2"
        >
          Sources
        </div>,
      );
    } else if (line.match(/^\[\d+\] /)) {
      const match = line.match(/^\[(\d+)\] (.+?)(?: — (https?:\/\/\S+))?$/);
      if (match) {
        const [, num, title, url] = match;
        elements.push(
          <div key={i} className="flex items-start gap-1.5 text-xs mb-1">
            <span className="text-muted-foreground/50 shrink-0">[{num}]</span>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {title}
                <ExternalLink size={9} className="shrink-0" />
              </a>
            ) : (
              <span className="text-foreground/70">{title}</span>
            )}
          </div>,
        );
      } else {
        elements.push(
          <p key={i} className="text-sm text-foreground/70 mb-1">
            {inline(line, onCiteClick)}
          </p>,
        );
      }
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div
          key={i}
          className="flex items-start gap-2 text-sm text-foreground/80 mb-1"
        >
          <span className="text-muted-foreground/50 shrink-0 mt-0.5">·</span>
          <span>{inline(line.slice(2), onCiteClick)}</span>
        </div>,
      );
    } else if (line.match(/^\d+\. /)) {
      const numMatch = line.match(/^(\d+)\. (.+)$/);
      if (numMatch) {
        elements.push(
          <div
            key={i}
            className="flex items-start gap-2.5 text-sm text-foreground/80 mb-1.5"
          >
            <span className="w-5 h-5 rounded bg-secondary border border-border text-foreground/50 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <span>{inline(numMatch[2], onCiteClick)}</span>
          </div>,
        );
      }
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      elements.push(
        <p
          key={i}
          className="text-xs text-muted-foreground italic mt-4 pt-3 border-t border-border/50"
        >
          {line.slice(1, -1)}
        </p>,
      );
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [headerRow, , ...bodyRows] = tableLines;
      const parseRow = (r: string) =>
        r
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {parseRow(headerRow).map((cell, ci) => (
                  <th
                    key={ci}
                    className="text-left px-3 py-2 bg-secondary border border-border font-semibold text-foreground/80"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="even:bg-secondary/30">
                  {parseRow(row).map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-1.5 border border-border text-foreground/70"
                    >
                      {inline(cell, onCiteClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-1">
          {inline(line, onCiteClick)}
        </p>,
      );
    }
    i++;
  }

  return <>{elements}</>;
}
