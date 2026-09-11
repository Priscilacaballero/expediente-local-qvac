import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const validateCaseInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/) });
const requiredFields = ["full_name", "date_of_birth", "identity_document", "residential_address", "employment_status", "monthly_income", "income_currency", "source_of_funds"] as const;
export async function validateCase(input: z.infer<typeof validateCaseInputSchema>, context: ToolContext) {
  const values = context.db.prepare("SELECT field_key, normalized_value, status FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(input.caseId) as Array<{ field_key: string; normalized_value: string | null; status: string }>;
  const missing = requiredFields.filter((field) => !values.some((value) => value.field_key === field && value.normalized_value));
  const conflicts = requiredFields.filter((field) => new Set(values.filter((value) => value.field_key === field && value.normalized_value).map((value) => value.normalized_value)).size > 1);
  const status = conflicts.length > 0 ? "requiere_revision" : missing.length > 0 ? "requiere_datos" : "listo_para_revision";
  context.db.prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), input.caseId);
  return { caseId: input.caseId, status, missing, conflicts, requiresHumanReview: conflicts.length > 0 };
}
