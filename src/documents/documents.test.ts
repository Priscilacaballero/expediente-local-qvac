import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createEvidence, EvidenceValidationError } from "./evidence.js";
import { DocumentPolicyError, validateDocumentMetadata } from "./file-policy.js";
import { ingestPdf } from "./pdf-ingestion.js";

const validPdfPath = "data/synthetic/case-0001/identidad.pdf";
const emptyPdfPath = "data/synthetic/case-0006/vacio.pdf";

describe("document ingestion and evidence", () => {
  it("extracts selectable text by page and creates verifiable evidence", async () => {
    const data = await readFile(validPdfPath);
    const document = await ingestPdf(data, { filename: "identidad.pdf", mimeType: "application/pdf" });
    expect(document.pageCount).toBe(1);
    expect(document.text).toContain("Ana Demo");
    const evidence = createEvidence({ documentId: "doc-1", page: 1, quote: "Nombre: Ana Demo", sha256: document.sha256 }, document.pages);
    expect(evidence.quote).toBe("Nombre: Ana Demo");
  });

  it("rejects PDFs without selectable text", async () => {
    const data = await readFile(emptyPdfPath);
    await expect(ingestPdf(data, { filename: "vacio.pdf", mimeType: "application/pdf" })).rejects.toBeInstanceOf(DocumentPolicyError);
  });

  it("rejects unsafe metadata and unverifiable quotes", async () => {
    expect(() => validateDocumentMetadata({ filename: "..\\secreto.pdf", mimeType: "application/pdf", size: 10 })).toThrow(DocumentPolicyError);
    expect(() => validateDocumentMetadata({ filename: "imagen.png", mimeType: "image/png", size: 10 })).toThrow(DocumentPolicyError);
    const data = await readFile(validPdfPath);
    const document = await ingestPdf(data, { filename: "identidad.pdf", mimeType: "application/pdf" });
    expect(() => createEvidence({ documentId: "doc-1", page: 1, quote: "cita inventada", sha256: document.sha256 }, document.pages)).toThrow(EvidenceValidationError);
  });
});
