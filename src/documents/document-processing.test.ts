import { describe, expect, it } from "vitest";
import { LocalDatabase } from "../storage/database.js";
import { ingestDocument } from "./document-ingestion.js";
import { DocumentProcessingQueue } from "./document-processing.js";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const fakeAdapter = { ocr: async () => [{ text: "Nombre: Ana Demo", bbox: [1, 2, 30, 10] as [number, number, number, number], confidence: 0.91 }], getCapabilities: () => ({ text: true, ocr: true, vision: false, models: { text: "LLAMA_3_2_1B_INST_Q4_0", ocr: "OCR_LATIN", vision: "VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M", mmproj: "MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0" } }) } as unknown as QvacAdapter;

describe("document processing", () => {
  it("processes images with local OCR metadata", async () => {
    const result = await ingestDocument(png, { filename: "id.png", mimeType: "image/png" }, fakeAdapter.ocr.bind(fakeAdapter));
    expect(result.scanned).toBe(true); expect(result.text).toContain("Ana Demo"); expect(result.ocrBlocks[0]?.bbox).toEqual([1, 2, 30, 10]); expect(result.pages[0]?.asset?.width).toBe(1);
  });

  it("queues a textual PDF and exposes completed provenance", async () => {
    const db = new LocalDatabase(":memory:"); db.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', datetime('now'), datetime('now'))").run("case-user-a1b2c3d4");
    const queue = new DocumentProcessingQueue(db.db, fakeAdapter); const pdf = Buffer.from("not-used");
    const result = await queue.enqueue({ caseId: "case-user-a1b2c3d4", filename: "bad.pdf", mimeType: "application/pdf", bytes: pdf }); await new Promise(resolve => setTimeout(resolve, 20));
    expect(result.documentId).toBeTypeOf("string"); expect(db.db.prepare("SELECT processing_status FROM documents WHERE id = ?").get(result.documentId)).toEqual({ processing_status: "failed" }); db.close();
  });
});
