import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
import { fieldKeySchema } from "../types/domain.js";
export const extractFieldsInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/), documentId: z.string().min(1) });
const patterns: Array<[z.infer<typeof fieldKeySchema>, RegExp]> = [["full_name", /Nombre:\s*(.+)/iu], ["date_of_birth", /Fecha de nacimiento:\s*(.+)/iu], ["identity_document", /Documento:\s*(.+)/iu], ["residential_address", /Dirección:\s*(.+)/iu], ["employment_status", /Situación laboral:\s*(.+)/iu], ["monthly_income", /Ingreso mensual:\s*([0-9.,]+)/iu], ["income_currency", /(?:Ingreso mensual|Moneda):\s*[0-9.,]+\s*([A-Z]{3})/iu], ["source_of_funds", /Fuente de fondos:\s*(.+)/iu]];
export async function extractFields(input: z.infer<typeof extractFieldsInputSchema>, context: ToolContext) {
  const row = context.db.prepare("SELECT text_content FROM documents WHERE case_id = ? AND id = ?").get(input.caseId, input.documentId) as { text_content: string } | undefined;
  if (!row) throw new Error("Documento no encontrado en el caso");
  const extracted = patterns.flatMap(([fieldKey, pattern]) => { const match = row.text_content.match(pattern); return match?.[1] ? [{ fieldKey, value: match[1].trim(), status: "candidate" as const }] : []; });
  return { caseId: input.caseId, documentId: input.documentId, fields: extracted };
}
