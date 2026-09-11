import { z } from "zod";
import { caseIdSchema, caseStatusSchema, fieldKeySchema, fieldStatusSchema, severitySchema } from "./domain.js";

export const caseSummarySchema = z.object({
  id: caseIdSchema,
  status: caseStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

export const fieldCandidateSchema = z.object({
  id: z.string().min(1),
  caseId: caseIdSchema,
  documentId: z.string().min(1).nullable(),
  fieldKey: fieldKeySchema,
  value: z.string().nullable(),
  normalizedValue: z.string().nullable(),
  status: fieldStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  sourcePage: z.number().int().positive().nullable().optional(),
  sourceQuote: z.string().nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
});
export type FieldCandidate = z.infer<typeof fieldCandidateSchema>;

export const findingSchema = z.object({
  id: z.string().min(1),
  caseId: caseIdSchema,
  ruleId: z.string().min(1),
  severity: severitySchema,
  kind: z.string().min(1),
  message: z.string().min(1),
  documentId: z.string().min(1).nullable(),
  page: z.number().int().positive().nullable(),
  quote: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Finding = z.infer<typeof findingSchema>;
