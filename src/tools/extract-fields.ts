import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
import { fieldKeySchema } from "../types/domain.js";
export const extractFieldsInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/), documentId: z.string().min(1) });
const nextLabel = "(?=\\s+(?:Nombre|Fecha de nacimiento|Documento|Direcci[oó]n|Situaci[oó]n laboral|Ingreso mensual|Fuente de fondos|Moneda):|$)";
const patterns: Array<[z.infer<typeof fieldKeySchema>, RegExp]> = [["full_name", new RegExp(`Nombre:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["date_of_birth", new RegExp(`Fecha de nacimiento:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["identity_document", new RegExp(`Documento:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["residential_address", new RegExp(`Direcci[oó]n:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["employment_status", new RegExp(`Situaci[oó]n laboral:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["monthly_income", /Ingreso mensual:\s*([0-9.,]+)/iu], ["income_currency", /(?:Ingreso mensual|Moneda):\s*[0-9.,]+\s*([A-Z]{3})/iu], ["source_of_funds", new RegExp(`Fuente de fondos:\\s*([\\s\\S]+?)${nextLabel}`, "iu")]];
function normalize(fieldKey: z.infer<typeof fieldKeySchema>, value: string): string {
  if (fieldKey === "monthly_income") return value.replaceAll(",", "").replace(/\.00$/u, "");
  if (fieldKey === "income_currency") return value.toUpperCase();
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("es");
}
export async function extractFields(input: z.infer<typeof extractFieldsInputSchema>, context: ToolContext) {
  const row = context.db.prepare("SELECT text_content FROM documents WHERE case_id = ? AND id = ?").get(input.caseId, input.documentId) as { text_content: string } | undefined;
  if (!row) throw new Error("Documento no encontrado en el caso");
  const pages = context.db.prepare("SELECT page, text_content FROM document_pages WHERE document_id = ? ORDER BY page").all(input.documentId) as Array<{ page: number; text_content: string }>;
  const sourcePages = pages.length > 0 ? pages : [{ page: 1, text_content: row.text_content }];
  context.db.prepare("DELETE FROM field_candidates WHERE case_id = ? AND document_id = ?").run(input.caseId, input.documentId);
  const extracted = patterns.flatMap(([fieldKey, pattern]) => {
    for (const source of sourcePages) {
      const match = source.text_content.match(pattern);
      if (!match?.[1]) continue;
      const value = match[1].trim();
      const quote = match[0].trim();
      context.db.prepare("INSERT INTO field_candidates (id, case_id, document_id, field_key, value_text, normalized_value, status, confidence, created_at, source_page, source_quote) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?)").run(input.caseId, input.documentId, fieldKey, value, normalize(fieldKey, value), 0.92, new Date().toISOString(), source.page, quote);
      return [{ fieldKey, value, status: "candidate" as const, page: source.page, quote }];
    }
    return [];
  });
  return { caseId: input.caseId, documentId: input.documentId, fields: extracted };
}
