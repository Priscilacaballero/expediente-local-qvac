import { z } from "zod";

export const caseStatusSchema = z.enum([
  "nuevo",
  "documentos_cargados",
  "analizando",
  "requiere_datos",
  "requiere_revision",
  "listo_para_revision",
]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const fieldStatusSchema = z.enum([
  "confirmed",
  "candidate",
  "missing",
  "conflict",
  "user_reported",
]);
export type FieldStatus = z.infer<typeof fieldStatusSchema>;

export const severitySchema = z.enum(["info", "warning", "critical"]);
export type Severity = z.infer<typeof severitySchema>;

export const evidenceSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().positive(),
  quote: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const caseIdSchema = z.string().regex(/^case-[0-9]{4}$/);
export const fieldKeySchema = z.enum([
  "full_name",
  "date_of_birth",
  "identity_document",
  "residential_address",
  "employment_status",
  "monthly_income",
  "income_currency",
  "source_of_funds",
]);
export type FieldKey = z.infer<typeof fieldKeySchema>;
