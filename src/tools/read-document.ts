import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const readDocumentInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/), documentId: z.string().min(1), page: z.number().int().positive() });
export async function readDocument(input: z.infer<typeof readDocumentInputSchema>, context: ToolContext) {
  const row = context.db.prepare("SELECT text_content, page_count FROM documents WHERE case_id = ? AND id = ?").get(input.caseId, input.documentId) as { text_content: string; page_count: number | null } | undefined;
  if (!row) throw new Error("Documento no encontrado en el caso");
  if (row.page_count !== null && input.page > row.page_count) throw new Error("Página no encontrada");
  return { caseId: input.caseId, documentId: input.documentId, page: input.page, text: input.page === 1 ? row.text_content : "" };
}
