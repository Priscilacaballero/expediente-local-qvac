import type Database from "better-sqlite3";

const MAX_CONTEXT_CHARS = 48_000;
export async function buildCaseContext(db: Database.Database, caseId: string): Promise<string> {
  const context = {
    case: db.prepare("SELECT id, status, created_at, updated_at FROM cases WHERE id = ?").get(caseId),
    documents: db.prepare("SELECT id, filename, mime_type, sha256, page_count FROM documents WHERE case_id = ? ORDER BY id").all(caseId),
    fields: db.prepare("SELECT id, document_id, field_key, value_text, normalized_value, status, confidence FROM field_candidates WHERE case_id = ? ORDER BY id").all(caseId),
    findings: db.prepare("SELECT id, rule_id, severity, kind, message, document_id, page, quote FROM findings WHERE case_id = ? ORDER BY id").all(caseId),
    userAnswers: db.prepare("SELECT id, field_key, value_text, message FROM user_answers WHERE case_id = ? ORDER BY id").all(caseId),
  };
  const serialized = JSON.stringify(context);
  return serialized.length <= MAX_CONTEXT_CHARS ? serialized : `${serialized.slice(0, MAX_CONTEXT_CHARS)}\n[contexto truncado]`;
}
