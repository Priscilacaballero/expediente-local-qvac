import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type Database from "better-sqlite3";
import { ingestPdf } from "../documents/pdf-ingestion.js";
import { classifyDocument } from "../documents/classification.js";

export async function ensureSyntheticCases(db: Database.Database, root = resolve("data/synthetic")): Promise<number> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const caseDirectories = entries.filter((entry) => entry.isDirectory() && /^case-\d{4}$/.test(entry.name));
  for (const directory of caseDirectories) {
    const caseId = directory.name;
    if (!db.prepare("SELECT 1 FROM cases WHERE id = ?").get(caseId)) {
      const timestamp = new Date().toISOString();
      db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', ?, ?)").run(caseId, timestamp, timestamp);
    }
    const files = await readdir(resolve(root, caseId));
    for (const filename of files.filter((name) => name.toLowerCase().endsWith(".pdf"))) {
      if (db.prepare("SELECT 1 FROM documents WHERE case_id = ? AND filename = ?").get(caseId, filename)) continue;
      const data = await readFile(resolve(root, caseId, filename));
      const parsed = await ingestPdf(data, { filename, mimeType: "application/pdf" }).catch(() => null);
      if (!parsed) continue;
      const id = `${caseId}-${filename.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/g, "")}`;
      const timestamp = new Date().toISOString();
      const insert = db.transaction(() => {
        db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, document_type, page_count, text_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, caseId, parsed.filename, parsed.mimeType, classifyDocument(parsed.filename, parsed.text), parsed.pageCount, parsed.text, timestamp);
        const pageInsert = db.prepare("INSERT INTO document_pages (document_id, page, text_content) VALUES (?, ?, ?)");
        for (const page of parsed.pages) pageInsert.run(id, page.page, page.text);
        db.prepare("UPDATE cases SET status = 'documentos_cargados', updated_at = ? WHERE id = ?").run(timestamp, caseId);
      });
      insert();
    }
  }
  return caseDirectories.length;
}
