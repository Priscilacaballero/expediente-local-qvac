import type Database from "better-sqlite3";
import { extractFields } from "../tools/extract-fields.js";
import { validateCase } from "../tools/validate-case.js";
import type { ToolContext } from "../tools/tool-registry.js";

export async function analyzeCaseDeterministically(db: Database.Database, caseId: string): Promise<Awaited<ReturnType<typeof validateCase>>> {
  const context = { db } as ToolContext;
  const documents = db.prepare("SELECT id FROM documents WHERE case_id = ? ORDER BY created_at, id").all(caseId) as Array<{ id: string }>;
  for (const document of documents) await extractFields({ caseId, documentId: document.id }, context);
  db.prepare("DELETE FROM findings WHERE case_id = ? AND rule_id = 'security.prompt-injection'").run(caseId);
  const sources = db.prepare("SELECT d.id, p.page, p.text_content FROM documents d JOIN document_pages p ON p.document_id = d.id WHERE d.case_id = ? ORDER BY d.id, p.page").all(caseId) as Array<{ id: string; page: number; text_content: string }>;
  for (const source of sources) {
    const match = source.text_content.match(/(?:ignora todas las reglas|env[ií]a los datos|https?:\/\/)/iu);
    if (!match) continue;
    db.prepare("INSERT INTO findings (id, case_id, rule_id, severity, kind, message, document_id, page, quote, created_at) VALUES (lower(hex(randomblob(16))), ?, 'security.prompt-injection', 'warning', 'untrusted_instruction', 'El documento contiene una instrucción no confiable; se aisló como dato.', ?, ?, ?, ?)").run(caseId, source.id, source.page, match[0], new Date().toISOString());
  }
  return validateCase({ caseId }, context);
}
