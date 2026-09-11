import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const validateCaseInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/) });
const requiredFields = ["full_name", "date_of_birth", "identity_document", "residential_address", "employment_status", "monthly_income", "income_currency", "source_of_funds"] as const;
export async function validateCase(input: z.infer<typeof validateCaseInputSchema>, context: ToolContext) {
  const values = context.db.prepare("SELECT field_key, normalized_value, status, document_id, source_page, source_quote FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(input.caseId) as Array<{ field_key: string; normalized_value: string | null; status: string; document_id: string | null; source_page: number | null; source_quote: string | null }>;
  const missing = requiredFields.filter((field) => !values.some((value) => value.field_key === field && value.normalized_value));
  const conflicts = requiredFields.filter((field) => new Set(values.filter((value) => value.field_key === field && value.normalized_value).map((value) => value.normalized_value)).size > 1);
  const status = conflicts.length > 0 ? "requiere_revision" : missing.length > 0 ? "requiere_datos" : "listo_para_revision";
  context.db.prepare("DELETE FROM findings WHERE case_id = ? AND rule_id LIKE 'validation.%'").run(input.caseId);
  for (const field of missing) context.db.prepare("INSERT INTO findings (id, case_id, rule_id, severity, kind, message, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'critical', 'missing_field', ?, ?)").run(input.caseId, `validation.missing.${field}`, `Falta el campo obligatorio: ${field}`, new Date().toISOString());
  for (const field of conflicts) {
    const candidates = values.filter((value) => value.field_key === field && value.normalized_value);
    const source = candidates[0];
    const quote = candidates.map((candidate) => candidate.source_quote).filter((value): value is string => Boolean(value)).join(" | ");
    context.db.prepare("INSERT INTO findings (id, case_id, rule_id, severity, kind, message, document_id, page, quote, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'warning', 'conflict', ?, ?, ?, ?, ?)").run(input.caseId, `validation.conflict.${field}`, `Hay valores contradictorios para: ${field}`, source?.document_id ?? null, source?.source_page ?? null, quote || null, new Date().toISOString());
  }
  context.db.prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), input.caseId);
  return { caseId: input.caseId, status, missing, conflicts, requiresHumanReview: conflicts.length > 0 };
}
