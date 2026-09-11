import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { validateDocumentMetadata, DocumentPolicyError, type DocumentMetadata } from "./file-policy.js";

export type SourceAsset = { page: number | null; mimeType: "image/png" | "image/jpeg"; bytes: Buffer; width: number; height: number; kind: "image" | "rendered_page" };
export type DocumentPage = { page: number; text: string; asset?: SourceAsset };
export type IngestedDocument = { filename: string; mimeType: "application/pdf" | "image/png" | "image/jpeg"; sha256: string; pageCount: number; text: string; pages: DocumentPage[]; scanned: boolean };

function imageSize(data: Buffer, mimeType: SourceAsset["mimeType"]): { width: number; height: number } {
  if (mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) { if (data[offset] !== 0xff) { offset++; continue; } const marker = data[offset + 1] ?? 0; const length = data.readUInt16BE(offset + 2); if (marker >= 0xc0 && marker <= 0xc3) return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }; offset += 2 + length; }
  }
  throw new DocumentPolicyError("No se pudieron leer las dimensiones de la imagen");
}

async function renderPdf(data: Buffer, pageCount: number): Promise<SourceAsset[]> {
  const pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  try { const assets: SourceAsset[] = []; for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) { const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.5 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise; const bytes = canvas.toBuffer("image/png"); assets.push({ page: pageNumber, mimeType: "image/png", bytes, width: canvas.width, height: canvas.height, kind: "rendered_page" }); } return assets; } finally { pdf.cleanup(); }
}

export async function ingestDocument(data: Buffer, metadata: Omit<DocumentMetadata, "size">, ocr: (image: Buffer) => Promise<Array<{ text: string; bbox: [number, number, number, number] | null; confidence: number | null }>>): Promise<IngestedDocument & { ocrBlocks: Array<{ page: number; text: string; bbox: [number, number, number, number] | null; confidence: number | null }> }> {
  validateDocumentMetadata({ ...metadata, size: data.byteLength });
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (metadata.mimeType !== "application/pdf") { const mimeType = metadata.mimeType as "image/png" | "image/jpeg"; const size = imageSize(data, mimeType); const blocks = await ocr(data); return { filename: metadata.filename, mimeType, sha256, pageCount: 1, text: blocks.map(block => block.text).join("\n").trim(), pages: [{ page: 1, text: blocks.map(block => block.text).join("\n").trim(), asset: { page: 1, mimeType, bytes: data, width: size.width, height: size.height, kind: "image" } }], scanned: true, ocrBlocks: blocks.map(block => ({ page: 1, ...block })) }; }
  const parser = new PDFParse({ data }); try { const parsed = await parser.getText({ pageJoiner: "\n" }); const pages = parsed.pages.map(page => ({ page: page.num, text: page.text })); const text = pages.map(page => page.text).join("\n").trim(); if (text) return { filename: metadata.filename, mimeType: "application/pdf", sha256, pageCount: parsed.total, text, pages, scanned: false, ocrBlocks: [] }; const assets = await renderPdf(data, parsed.total); const ocrPages = []; const ocrBlocks = []; for (const asset of assets) { const blocks = await ocr(asset.bytes); const pageText = blocks.map(block => block.text).join("\n").trim(); ocrPages.push({ page: asset.page!, text: pageText, asset }); ocrBlocks.push(...blocks.map(block => ({ page: asset.page!, ...block }))); } return { filename: metadata.filename, mimeType: "application/pdf", sha256, pageCount: parsed.total, text: ocrPages.map(page => page.text).join("\n").trim(), pages: ocrPages, scanned: true, ocrBlocks }; } finally { await parser.destroy(); }
}
