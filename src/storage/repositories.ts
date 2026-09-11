import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { caseStatusSchema, fieldKeySchema, fieldStatusSchema, severitySchema, type CaseStatus, type FieldKey, type FieldStatus, type Severity } from "../types/domain.js";
import type { AgentRun, AgentRunStatus } from "../types/agent.js";

type CaseRow = { id: string; status: CaseStatus; created_at: string; updated_at: string };
type DocumentRow = { id: string; case_id: string; filename: string; mime_type: string; sha256: string; document_type: string | null; page_count: number | null; text_content: string; created_at: string };
type FieldRow = { id: string; case_id: string; document_id: string | null; field_key: FieldKey; value_text: string | null; normalized_value: string | null; status: FieldStatus; confidence: number | null; created_at: string };
type FindingRow = { id: string; case_id: string; rule_id: string; severity: Severity; kind: string; message: string; document_id: string | null; page: number | null; quote: string | null; created_at: string };

const now = (): string => new Date().toISOString();

export class CaseRepository {
  constructor(private readonly db: Database.Database) {}

  create(id: string, status: CaseStatus = "nuevo"): void {
    const parsedId = id;
    caseStatusSchema.parse(status);
    this.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)").run(parsedId, status, now(), now());
  }

  get(id: string): CaseRow | null {
    return (this.db.prepare("SELECT id, status, created_at, updated_at FROM cases WHERE id = ?").get(id) as CaseRow | undefined) ?? null;
  }

  updateStatus(id: string, status: CaseStatus): void {
    caseStatusSchema.parse(status);
    this.db.prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  }
}

export class DocumentRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { caseId: string; filename: string; mimeType: string; sha256: string; documentType?: string; pageCount?: number; textContent: string }, id = randomUUID()): string {
    this.db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, sha256, document_type, page_count, text_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.caseId, input.filename, input.mimeType, input.sha256, input.documentType ?? null, input.pageCount ?? null, input.textContent, now());
    return id;
  }

  getForCase(caseId: string, id: string): DocumentRow | null {
    return (this.db.prepare("SELECT * FROM documents WHERE case_id = ? AND id = ?").get(caseId, id) as DocumentRow | undefined) ?? null;
  }

  listForCase(caseId: string): DocumentRow[] {
    return this.db.prepare("SELECT * FROM documents WHERE case_id = ? ORDER BY created_at, id").all(caseId) as DocumentRow[];
  }
}

export class FieldCandidateRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { caseId: string; documentId?: string; fieldKey: FieldKey; value?: string; normalizedValue?: string; status: FieldStatus; confidence?: number; extractionMethod?: string; producerModel?: string; producerModelSha256?: string; sourceAssetId?: string; bbox?: [number, number, number, number] }, id = randomUUID()): string {
    fieldKeySchema.parse(input.fieldKey);
    fieldStatusSchema.parse(input.status);
    this.db.prepare("INSERT INTO field_candidates (id, case_id, document_id, field_key, value_text, normalized_value, status, confidence, created_at, extraction_method, producer_model, producer_model_sha256, source_asset_id, bbox) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.caseId, input.documentId ?? null, input.fieldKey, input.value ?? null, input.normalizedValue ?? null, input.status, input.confidence ?? null, now(), input.extractionMethod ?? null, input.producerModel ?? null, input.producerModelSha256 ?? null, input.sourceAssetId ?? null, input.bbox ? JSON.stringify(input.bbox) : null);
    return id;
  }

  listForCase(caseId: string): FieldRow[] {
    return this.db.prepare("SELECT * FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(caseId) as FieldRow[];
  }
}

export class FindingRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { caseId: string; ruleId: string; severity: Severity; kind: string; message: string; documentId?: string; page?: number; quote?: string }, id = randomUUID()): string {
    severitySchema.parse(input.severity);
    this.db.prepare("INSERT INTO findings (id, case_id, rule_id, severity, kind, message, document_id, page, quote, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.caseId, input.ruleId, input.severity, input.kind, input.message, input.documentId ?? null, input.page ?? null, input.quote ?? null, now());
    return id;
  }

  listForCase(caseId: string): FindingRow[] {
    return this.db.prepare("SELECT * FROM findings WHERE case_id = ? ORDER BY created_at, id").all(caseId) as FindingRow[];
  }
}

export class UserAnswerRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { caseId: string; fieldKey: FieldKey; value: string; message: string }, id = randomUUID()): string {
    fieldKeySchema.parse(input.fieldKey);
    this.db.prepare("INSERT INTO user_answers (id, case_id, field_key, value_text, message, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, input.caseId, input.fieldKey, input.value, input.message, now());
    return id;
  }
}

export class AgentRunRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: { caseId: string; model: string }, id = randomUUID()): string {
    this.db.prepare("INSERT INTO agent_runs (id, case_id, status, model, provider, started_at, calls_count) VALUES (?, ?, 'running', ?, 'QVAC local', ?, 0)").run(id, input.caseId, input.model, now());
    return id;
  }

  finish(id: string, input: { status: Exclude<AgentRunStatus, "running">; latencyMs?: number; callsCount: number; error?: string }): void {
    this.db.prepare("UPDATE agent_runs SET status = ?, finished_at = ?, latency_ms = ?, calls_count = ?, error = ? WHERE id = ?").run(input.status, now(), input.latencyMs ?? null, input.callsCount, input.error ?? null, id);
  }

  get(id: string): AgentRun | null {
    const row = this.db.prepare("SELECT id, case_id, status, model, provider, started_at, finished_at, latency_ms, calls_count, error FROM agent_runs WHERE id = ?").get(id) as { id: string; case_id: string; status: AgentRunStatus; model: string; provider: "QVAC local"; started_at: string; finished_at: string | null; latency_ms: number | null; calls_count: number; error: string | null } | undefined;
    if (!row) return null;
    return { id: row.id, caseId: row.case_id, status: row.status, model: row.model, provider: row.provider, startedAt: row.started_at, finishedAt: row.finished_at, latencyMs: row.latency_ms, callsCount: row.calls_count, error: row.error };
  }
}
