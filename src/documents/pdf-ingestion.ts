import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { validateDocumentMetadata, DocumentPolicyError, type DocumentMetadata } from "./file-policy.js";

export type IngestedPage = { page: number; text: string };
export type IngestedPdf = {
  filename: string;
  mimeType: "application/pdf";
  sha256: string;
  pageCount: number;
  text: string;
  pages: IngestedPage[];
};

export async function ingestPdf(data: Buffer, metadata: Omit<DocumentMetadata, "size">): Promise<IngestedPdf> {
  validateDocumentMetadata({ ...metadata, size: data.byteLength });
  const sha256 = createHash("sha256").update(data).digest("hex");
  const parser = new PDFParse({ data });
  try {
    const parsed = await parser.getText({ pageJoiner: "\n" });
    const pages = parsed.pages.map((page) => ({ page: page.num, text: page.text }));
    const text = pages.map(({ text: pageText }) => pageText).join("\n").trim();
    if (!text) throw new DocumentPolicyError("El PDF no contiene texto seleccionable");
    return { filename: metadata.filename, mimeType: "application/pdf", sha256, pageCount: parsed.total, text, pages };
  } finally {
    await parser.destroy();
  }
}
