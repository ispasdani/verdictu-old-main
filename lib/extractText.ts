/**
 * Client-side text extraction.
 * Imported only from "use client" components — never runs on the server.
 *
 * Supported formats: .txt, .docx, .pdf
 * .doc (legacy binary) is handled server-side via /api/extract-doc
 */

export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "txt") {
    return file.text();
  }

  if (ext === "docx") {
    const mammoth = (await import("mammoth")).default;
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value.trim();
  }

  if (ext === "pdf") {
    const pdfjsLib = await import("pdfjs-dist");
    // Use the matching version from cdnjs to avoid worker mismatch
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
    const pdfDocument = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        // TextItem has `str`; TextMarkedContent does not
        .map((item) => ("str" in item ? (item as { str: string }).str : ""))
        .join(" ");
      pages.push(pageText);
    }

    return pages.join("\n\n").trim();
  }

  throw new Error(`No client-side extractor for .${ext}`);
}
