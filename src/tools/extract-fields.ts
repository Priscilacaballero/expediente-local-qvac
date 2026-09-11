import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
import { fieldKeySchema } from "../types/domain.js";
export const extractFieldsInputSchema = z.object({ caseId: z.string().min(1), documentId: z.string().min(1) });
const nextLabel = "(?=\\s+(?:Nombre|Fecha de nacimiento|Documento|Direcci[oó]n|Situaci[oó]n laboral|Ingreso mensual|Fuente de fondos|Moneda):|$)";
const patterns: Array<[z.infer<typeof fieldKeySchema>, RegExp]> = [["full_name", new RegExp(`Nombre:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["date_of_birth", new RegExp(`Fecha de nacimiento:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["identity_document", new RegExp(`Documento:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["residential_address", new RegExp(`Direcci[oó]n:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["employment_status", new RegExp(`Situaci[oó]n laboral:\\s*([\\s\\S]+?)${nextLabel}`, "iu")], ["monthly_income", /Ingreso mensual:\s*([0-9.,]+)/iu], ["income_currency", /(?:Ingreso mensual|Moneda):\s*[0-9.,]+\s*([A-Z]{3})/iu], ["source_of_funds", new RegExp(`Fuente de fondos:\\s*([\\s\\S]+?)${nextLabel}`, "iu")]];
function normalize(fieldKey: z.infer<typeof fieldKeySchema>, value: string): string {
  if (fieldKey === "monthly_income") return value.replaceAll(",", "").replace(/\.00$/u, "");
  if (fieldKey === "income_currency") return value.toUpperCase();
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("es");
}
export async function extractFields(input: z.infer<typeof extractFieldsInputSchema>, context: ToolContext) {
  const row = context.db.prepare("SELECT text_content, extraction_method, producer_model FROM documents WHERE case_id = ? AND id = ?").get(input.caseId, input.documentId) as { text_content: string; extraction_method: string | null; producer_model: string | null } | undefined;
  if (!row) throw new Error("Documento no encontrado en el caso");
  const pages = context.db.prepare("SELECT page, text_content FROM document_pages WHERE document_id = ? ORDER BY page").all(input.documentId) as Array<{ page: number; text_content: string }>;
  const sourcePages = pages.length > 0 ? pages : [{ page: 1, text_content: row.text_content }];
  const ocrEvidence = context.db.prepare("SELECT b.page, b.text, b.bbox, b.confidence, a.id AS assetId FROM document_ocr_blocks b LEFT JOIN document_assets a ON a.document_id = b.document_id AND a.page = b.page AND a.asset_type IN ('rendered_page', 'image') WHERE b.document_id = ? ORDER BY b.page, b.id").all(input.documentId) as Array<{ page: number; text: string; bbox: string | null; confidence: number | null; assetId: string | null }>;
  const method = row.extraction_method ?? "pdf_text";
  const producer = row.producer_model ?? "pdf-parse";
  context.db.prepare("DELETE FROM field_candidates WHERE case_id = ? AND document_id = ?").run(input.caseId, input.documentId);
  const insertCandidate = (fieldKey: z.infer<typeof fieldKeySchema>, value: string, page: number, quote: string, evidence?: { assetId: string | null; bbox: string | null; confidence: number | null }) => {
    context.db.prepare("INSERT INTO field_candidates (id, case_id, document_id, field_key, value_text, normalized_value, status, confidence, created_at, source_page, source_quote, extraction_method, producer_model, producer_model_sha256, source_asset_id, bbox) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?, ?, ?, NULL, ?, ?)").run(input.caseId, input.documentId, fieldKey, value, normalize(fieldKey, value), evidence?.confidence ?? 0.8, new Date().toISOString(), page, quote, method, producer, evidence?.assetId ?? null, evidence?.bbox ?? null);
  };
  if (method === "ocr" && ocrEvidence.length) {
    const aliases: Array<[z.infer<typeof fieldKeySchema>, string[]]> = [["full_name", ["nombre", "nombrecompleto"]], ["date_of_birth", ["fechadenacimiento"]], ["identity_document", ["documento", "numero"]], ["residential_address", ["direccion"]], ["employment_status", ["situacionlaboral"]], ["monthly_income", ["ingresomensual"]], ["income_currency", ["moneda"]], ["source_of_funds", ["origendefondos"]]];
    const compact = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/giu, "").toLowerCase();
    const boxOf = (value: string | null): [number, number, number, number] | null => { if (!value) return null; try { const raw = JSON.parse(value) as [number, number, number, number]; return raw[2] > raw[0] && raw[3] > raw[1] ? [raw[0], raw[1], raw[2] - raw[0], raw[3] - raw[1]] : raw; } catch { return null; } };
    const layoutFields = aliases.flatMap(([fieldKey, names]) => { const label = ocrEvidence.find(block => names.some(name => compact(block.text).includes(name))); const labelBox = boxOf(label?.bbox ?? null); if (!label || !labelBox) return []; const valueBlock = ocrEvidence.filter(block => block.page === label.page && block.bbox && block.text !== label.text).map(block => ({ block, box: boxOf(block.bbox) })).filter((item): item is { block: typeof ocrEvidence[number]; box: [number, number, number, number] } => item.box !== null && item.box[0] > labelBox[0] + labelBox[2] && Math.abs(item.box[1] - labelBox[1]) <= Math.max(36, labelBox[3])).sort((a, b) => a.box[0] - b.box[0])[0]?.block; if (!valueBlock) return []; const normalizedBox = boxOf(valueBlock.bbox); return [{ fieldKey, value: valueBlock.text.trim(), page: label.page, quote: `${label.text}: ${valueBlock.text}`, evidence: { assetId: valueBlock.assetId, bbox: normalizedBox ? JSON.stringify(normalizedBox) : null, confidence: Math.min(label.confidence ?? 0.8, valueBlock.confidence ?? 0.8) } }]; }); layoutFields.forEach(field => insertCandidate(field.fieldKey, field.value, field.page, field.quote, field.evidence)); if (layoutFields.length) return { caseId: input.caseId, documentId: input.documentId, fields: layoutFields.map(field => ({ fieldKey: field.fieldKey, value: field.value, status: "candidate" as const, page: field.page, quote: field.quote })) }; }
  const extracted = patterns.flatMap(([fieldKey, pattern]) => {
    for (const source of sourcePages) {
      const match = source.text_content.match(pattern);
      if (!match?.[1]) continue;
      const value = match[1].trim();
      const quote = match[0].trim();
      const evidence = ocrEvidence.find(block => block.page === source.page && (block.text.includes(value) || block.text.includes(quote)));
      insertCandidate(fieldKey, value, source.page, quote, evidence ? { assetId: evidence.assetId, bbox: evidence.bbox, confidence: 0.92 } : undefined);
      return [{ fieldKey, value, status: "candidate" as const, page: source.page, quote }];
    }
    return [];
  });
  return { caseId: input.caseId, documentId: input.documentId, fields: extracted };
}
