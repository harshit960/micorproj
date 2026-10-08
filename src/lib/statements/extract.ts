// Read a statement file *on this device* into text lines or table rows.
// Nothing here touches the network; heavy readers (pdf.js, xlsx) are lazy-loaded.

import { parseCsv } from "./parse";

export type Extracted = { kind: "lines"; lines: string[]; pages: number } | { kind: "rows"; rows: string[][] };

export class PasswordNeeded extends Error {
  incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? "Wrong password" : "This PDF is password-protected");
    this.incorrect = incorrect;
  }
}

const MAX_BYTES = 25 * 1024 * 1024;

const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

async function readPdf(file: File, password?: string): Promise<Extracted> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password, isEvalSupported: false }).promise;
  } catch (e: any) {
    if (e?.name === "PasswordException") throw new PasswordNeeded(e.code === 2);
    throw new Error("Couldn't open this PDF: " + (e?.message ?? e));
  }
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Rebuild visual lines: group text runs by baseline, then order left→right.
    const rows: { y: number; items: { x: number; w: number; s: string; h: number }[] }[] = [];
    for (const it of content.items as any[]) {
      if (!("str" in it) || !it.str.trim()) continue;
      const [, , , , x, y] = it.transform as number[];
      const h = Math.abs(it.height || it.transform[3] || 10);
      let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, h * 0.4));
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, w: it.width ?? 0, s: it.str, h });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = "";
      let prevEnd = -Infinity;
      for (const it of r.items) {
        const gap = it.x - prevEnd;
        line += prevEnd === -Infinity ? "" : gap > it.h * 0.9 ? "  " : gap > it.h * 0.15 ? " " : "";
        line += it.s;
        prevEnd = it.x + it.w;
      }
      lines.push(line.trim());
    }
  }
  await doc.destroy();
  return { kind: "lines", lines, pages: doc.numPages };
}

async function readXlsx(file: File): Promise<Extracted> {
  const { default: readXlsxFile } = await import("read-excel-file");
  const sheet = await readXlsxFile(file);
  return {
    kind: "rows",
    rows: sheet.map((r) => r.map((c) => (c instanceof Date ? fmtDate(c) : c == null ? "" : String(c)))),
  };
}

function readHtmlTable(html: string): Extracted {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [...doc.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").trim()));
  return { kind: "rows", rows };
}

export async function extractStatement(file: File, password?: string): Promise<Extracted> {
  if (file.size > MAX_BYTES) throw new Error("That file is over 25 MB — is it the right statement?");
  const name = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK.. (xlsx)
  const isOle = head[0] === 0xd0 && head[1] === 0xcf; // legacy binary .xls
  if (isPdf || name.endsWith(".pdf")) return readPdf(file, password);
  if (isZip || name.endsWith(".xlsx")) return readXlsx(file);
  if (isOle) throw new Error("This is an old binary .xls file. Open it in Excel/Sheets and save as .xlsx or .csv, or download the PDF statement instead.");
  const text = await file.text();
  if (/<table[\s>]/i.test(text)) return readHtmlTable(text);
  if (name.endsWith(".txt")) return { kind: "lines", lines: text.split(/\r?\n/), pages: 1 };
  return { kind: "rows", rows: parseCsv(text) };
}

/** Text to show/send when local parsing finds nothing (for the optional AI reader). */
export function extractedText(x: Extracted) {
  return x.kind === "lines" ? x.lines.join("\n") : x.rows.map((r) => r.join(" | ")).join("\n");
}
