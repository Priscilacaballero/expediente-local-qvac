import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const listDocumentsInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/) });
export async function listDocuments(input: z.infer<typeof listDocumentsInputSchema>, context: ToolContext) {
  const rows = context.db.prepare("SELECT id, filename, mime_type, sha256, document_type, page_count, created_at FROM documents WHERE case_id = ? ORDER BY created_at, id").all(input.caseId) as Array<{ id: string; filename: string; mime_type: string; sha256: string; document_type: string | null; page_count: number | null; created_at: string }>;
  return rows.map((row) => ({ id: row.id, filename: row.filename, mimeType: row.mime_type, sha256: row.sha256, documentType: row.document_type, pageCount: row.page_count, createdAt: row.created_at }));
}
