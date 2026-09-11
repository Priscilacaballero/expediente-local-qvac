import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const prepareReportInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/) });
export async function prepareReport(input: z.infer<typeof prepareReportInputSchema>, context: ToolContext) {
  const caseRow = context.db.prepare("SELECT id, status FROM cases WHERE id = ?").get(input.caseId) as { id: string; status: string } | undefined;
  if (!caseRow) throw new Error("Caso no encontrado");
  const findings = context.db.prepare("SELECT rule_id, severity, kind, message, document_id, page, quote FROM findings WHERE case_id = ? ORDER BY created_at, id").all(input.caseId);
  const fields = context.db.prepare("SELECT field_key, value_text, status, document_id FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(input.caseId);
  const answers = context.db.prepare("SELECT field_key, value_text, message FROM user_answers WHERE case_id = ? ORDER BY created_at, id").all(input.caseId);
  return { caseId: caseRow.id, status: caseRow.status, fields, findings, userAnswers: answers, disclaimer: "Reporte factual para revisión humana; una discrepancia no prueba fraude." };
}
