import { z } from "zod";
import type { IngestedPage } from "./pdf-ingestion.js";
import { evidenceSchema, type Evidence } from "../types/domain.js";

export class EvidenceValidationError extends Error {
  readonly code = "EVIDENCE_QUOTE_NOT_FOUND" as const;
}

export function verifyQuote(pages: IngestedPage[], page: number, quote: string): boolean {
  const target = pages.find((entry) => entry.page === page);
  return target !== undefined && quote.length > 0 && target.text.includes(quote);
}

export function createEvidence(input: Evidence, pages: IngestedPage[]): Evidence {
  const evidence = evidenceSchema.parse(input);
  if (!verifyQuote(pages, evidence.page, evidence.quote)) {
    throw new EvidenceValidationError("La cita no existe literalmente en la página indicada");
  }
  return evidence;
}

export const evidenceInputSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().positive(),
  quote: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
