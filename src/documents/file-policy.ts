import { z } from "zod";
import { config } from "../config.js";

export const documentMetadataSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
});
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export class DocumentPolicyError extends Error {
  readonly code = "UNSUPPORTED_DOCUMENT_FORMAT" as const;
}

export function validateDocumentMetadata(metadata: DocumentMetadata): void {
  const parsed = documentMetadataSchema.parse(metadata);
  const allowed = (parsed.mimeType === "application/pdf" && parsed.filename.toLowerCase().endsWith(".pdf"))
    || (parsed.mimeType === "image/png" && parsed.filename.toLowerCase().endsWith(".png"))
    || (parsed.mimeType === "image/jpeg" && /\.jpe?g$/iu.test(parsed.filename));
  if (!allowed) {
    throw new DocumentPolicyError("Solo se aceptan PDF, PNG o JPG con MIME válido");
  }
  if (parsed.size > config.MAX_DOCUMENT_SIZE_BYTES) {
    throw new DocumentPolicyError("El documento supera el límite de 10 MB");
  }
  if (/[/\\]/u.test(parsed.filename) || /[\u0000-\u001f\u007f]/u.test(parsed.filename)) {
    throw new DocumentPolicyError("El nombre del documento contiene una ruta o caracteres no permitidos");
  }
  if (parsed.filename === "." || parsed.filename === ".." || parsed.filename.includes("..")) {
    throw new DocumentPolicyError("El nombre del documento contiene traversal");
  }
}
