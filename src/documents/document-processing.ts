import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type Database from "better-sqlite3";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";
import { ingestDocument, type IngestedDocument } from "./document-ingestion.js";
import { classifyDocument } from "./classification.js";
import { extractFields } from "../tools/extract-fields.js";

const assetsRoot = resolve(".qvac/document-assets");
const now = () => new Date().toISOString();

export type ProcessingStatus = "queued" | "extracting" | "ocr" | "visual_review" | "completed" | "failed" | "requires_review";

export class DocumentProcessingQueue {
  constructor(private readonly db: Database.Database, private readonly adapter: QvacAdapter) {}

  async enqueue(input: { caseId: string; filename: string; mimeType: "application/pdf" | "image/png" | "image/jpeg"; bytes: Buffer }): Promise<{ documentId: string; jobId: string }> {
    const documentId = randomUUID(); const jobId = randomUUID(); const timestamp = now(); const directory = resolve(assetsRoot, documentId); await mkdir(directory, { recursive: true }); const originalPath = resolve(directory, "original"); await writeFile(originalPath, input.bytes);
    const hash = createHash("sha256").update(input.bytes).digest("hex");
    const transaction = this.db.transaction(() => { this.db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, document_type, sha256, page_count, text_content, processing_status, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, '', 'queued', ?)").run(documentId, input.caseId, input.filename, input.mimeType, classifyDocument(input.filename, ""), hash, timestamp); this.db.prepare("INSERT INTO document_assets (id, document_id, page, asset_type, mime_type, sha256, local_path, created_at) VALUES (?, ?, NULL, 'original', ?, ?, ?, ?)").run(randomUUID(), documentId, input.mimeType, hash, originalPath, timestamp); this.db.prepare("INSERT INTO document_processing_jobs (id, document_id, status, created_at, updated_at) VALUES (?, ?, 'queued', ?, ?)").run(jobId, documentId, timestamp, timestamp); }); transaction();
    queueMicrotask(() => { void this.process(jobId, documentId, input.caseId, input.filename, input.mimeType, input.bytes); });
    return { documentId, jobId };
  }

  async reprocess(documentId: string): Promise<{ documentId: string; jobId: string }> {
    const row = this.db.prepare("SELECT id, case_id AS caseId, filename, mime_type AS mimeType FROM documents WHERE id = ?").get(documentId) as { id: string; caseId: string; filename: string; mimeType: "application/pdf" | "image/png" | "image/jpeg" } | undefined;
    const asset = this.db.prepare("SELECT local_path AS localPath FROM document_assets WHERE document_id = ? AND asset_type = 'original' LIMIT 1").get(documentId) as { localPath: string } | undefined;
    if (!row || !asset) throw new Error("Documento original no encontrado");
    const jobId = randomUUID(); const timestamp = now(); const bytes = await readFile(asset.localPath); this.db.prepare("INSERT INTO document_processing_jobs (id, document_id, status, created_at, updated_at) VALUES (?, ?, 'queued', ?, ?)").run(jobId, documentId, timestamp, timestamp); this.setStatus(documentId, jobId, "queued"); queueMicrotask(() => { void this.process(jobId, documentId, row.caseId, row.filename, row.mimeType, bytes); }); return { documentId, jobId };
  }

  private setStatus(documentId: string, jobId: string, status: ProcessingStatus, page?: number, totalPages?: number, error?: string): void { const timestamp = now(); this.db.prepare("UPDATE documents SET processing_status = ?, processing_error = ? WHERE id = ?").run(status, error ?? null, documentId); this.db.prepare("UPDATE document_processing_jobs SET status = ?, current_page = ?, total_pages = COALESCE(?, total_pages), error = ?, updated_at = ? WHERE id = ?").run(status, page ?? null, totalPages ?? null, error ?? null, timestamp, jobId); }

  private async process(jobId: string, documentId: string, caseId: string, filename: string, mimeType: "application/pdf" | "image/png" | "image/jpeg", bytes: Buffer): Promise<void> {
    try {
      this.setStatus(documentId, jobId, "extracting");
      const parsed = await ingestDocument(bytes, { filename, mimeType }, async image => { this.setStatus(documentId, jobId, "ocr"); return this.adapter.ocr(image); });
      const visualReady = this.adapter.getCapabilities().vision; this.setStatus(documentId, jobId, parsed.scanned ? "visual_review" : "extracting", undefined, parsed.pageCount);
      this.db.prepare("DELETE FROM visual_inspections WHERE document_id = ?").run(documentId);
      this.db.prepare("DELETE FROM document_ocr_blocks WHERE document_id = ?").run(documentId);
      this.db.prepare("DELETE FROM document_assets WHERE document_id = ? AND asset_type <> 'original'").run(documentId);
      this.db.prepare("DELETE FROM document_pages WHERE document_id = ?").run(documentId);
      const directory = resolve(assetsRoot, documentId); const pageInsert = this.db.prepare("INSERT INTO document_assets (id, document_id, page, asset_type, mime_type, sha256, width, height, local_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"); const textPageInsert = this.db.prepare("INSERT INTO document_pages (document_id, page, text_content) VALUES (?, ?, ?)");
      for (const page of parsed.pages) { textPageInsert.run(documentId, page.page, page.text); if (page.asset) { const path = resolve(directory, `page-${String(page.page).padStart(3, "0")}.png`); await writeFile(path, page.asset.bytes); const assetId = randomUUID(); pageInsert.run(assetId, documentId, page.page, page.asset.kind === "image" ? "image" : "rendered_page", page.asset.mimeType, createHash("sha256").update(page.asset.bytes).digest("hex"), page.asset.width, page.asset.height, path, now()); } }
      const blockInsert = this.db.prepare("INSERT INTO document_ocr_blocks (id, document_id, page, text, bbox, confidence, model, created_at) VALUES (?, ?, ?, ?, ?, ?, 'OCR_LATIN', ?)"); for (const block of parsed.ocrBlocks) blockInsert.run(randomUUID(), documentId, block.page, block.text, block.bbox ? JSON.stringify(block.bbox) : null, block.confidence, now());
      await extractFields({ caseId, documentId }, { db: this.db } as never);
      if (parsed.scanned && this.adapter.getCapabilities().vision) { const visualPrompt = "Inspecciona esta página de documento. Devuelve solo observaciones verificables sobre legibilidad, campos visibles, tablas, sellos, firmas o discrepancias; no inventes datos."; const visualRows = this.db.prepare("SELECT id, page, local_path FROM document_assets WHERE document_id = ? AND asset_type IN ('rendered_page', 'image')").all(documentId) as Array<{ id: string; page: number; local_path: string }>; const visualInsert = this.db.prepare("INSERT INTO visual_inspections (id, document_id, asset_id, model, model_sha256, prompt, result, status, created_at) VALUES (?, ?, ?, 'VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M', NULL, ?, ?, ?, ?)"); for (const asset of visualRows) { const result = await this.adapter.analyzeImage(asset.local_path, visualPrompt); visualInsert.run(randomUUID(), documentId, asset.id, visualPrompt, result, "requires_review", now()); } }
      const model = parsed.scanned ? "OCR_LATIN" : "pdf-parse"; const finalStatus: ProcessingStatus = parsed.scanned && !visualReady ? "requires_review" : "completed"; const finalError = parsed.scanned && !visualReady ? "Revisión visual pendiente: prepara VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M y su mmproj" : null; this.db.prepare("UPDATE documents SET page_count = ?, text_content = ?, document_type = ?, extraction_method = ?, producer_model = ?, processing_status = ?, processing_error = ? WHERE id = ?").run(parsed.pageCount, parsed.text, classifyDocument(filename, parsed.text), parsed.scanned ? "ocr" : "pdf_text", model, finalStatus, finalError, documentId); this.db.prepare("UPDATE cases SET status = 'documentos_cargados', updated_at = ? WHERE id = ?").run(now(), caseId); this.setStatus(documentId, jobId, finalStatus, parsed.pageCount, parsed.pageCount, finalError ?? undefined);
    } catch (error) { this.setStatus(documentId, jobId, "failed", undefined, undefined, error instanceof Error ? error.message : "Error de procesamiento local"); }
  }
}
