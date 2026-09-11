import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "./config.js";
import { LocalDatabase } from "./storage/database.js";
import { ProcedureSearch } from "./tools/search-procedure.js";
import { ingestPdf } from "./documents/pdf-ingestion.js";
import { QvacAdapter } from "./qvac/qvac-adapter.js";
import { AgentController } from "./agent/agent-controller.js";
import { ToolRegistry } from "./tools/tool-registry.js";

type AppDependencies = { db: LocalDatabase; procedure: ProcedureSearch; adapter: QvacAdapter };
const errors = { INVALID_INPUT: "INVALID_INPUT", NOT_FOUND: "NOT_FOUND", UNSUPPORTED_DOCUMENT_FORMAT: "UNSUPPORTED_DOCUMENT_FORMAT", QVAC_NOT_READY: "QVAC_NOT_READY", AGENT_FORMAT_ERROR: "AGENT_FORMAT_ERROR", INTERNAL_ERROR: "INTERNAL_ERROR" } as const;

export async function buildApp(dependencies?: AppDependencies): Promise<{ app: FastifyInstance; dependencies: AppDependencies }> {
  const active = dependencies ?? { db: new LocalDatabase(), procedure: await ProcedureSearch.load(), adapter: new QvacAdapter() };
  const app = Fastify({ logger: false, bodyLimit: config.MAX_DOCUMENT_SIZE_BYTES });
  const requestCache = new Map<string, unknown>();
  await app.register(multipart, { limits: { fileSize: config.MAX_DOCUMENT_SIZE_BYTES, files: 1 } });
  await app.register(fastifyStatic, { root: resolve("dist/ui"), prefix: "/" });
  app.get("/api/session", async () => ({ id: "local", synthetic: true }));
  app.get("/api/health", async () => ({ ok: true, host: config.HOST, port: config.PORT, provider: "QVAC local", model: config.QVAC_MODEL, ready: active.adapter.isReady() }));
  app.get("/api/cases", async () => active.db.db.prepare("SELECT id, status, created_at AS createdAt, updated_at AS updatedAt FROM cases ORDER BY created_at, id").all());
  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId", async (request, reply) => { const row = active.db.db.prepare("SELECT id, status, created_at AS createdAt, updated_at AS updatedAt FROM cases WHERE id = ?").get(request.params.caseId); if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" }); return row; });
  app.post<{ Params: { caseId: string } }>("/api/cases/:caseId/documents", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM cases WHERE id = ?").get(request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" });
    const part = await request.file(); if (!part) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Falta el documento" });
    try { const parsed = await ingestPdf(await part.toBuffer(), { filename: part.filename, mimeType: part.mimetype }); const id = randomUUID(); const timestamp = new Date().toISOString(); active.db.db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, sha256, page_count, text_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, request.params.caseId, parsed.filename, parsed.mimeType, parsed.sha256, parsed.pageCount, parsed.text, timestamp); active.db.db.prepare("UPDATE cases SET status = 'documentos_cargados', updated_at = ? WHERE id = ?").run(timestamp, request.params.caseId); return reply.code(201).send({ id, caseId: request.params.caseId, filename: parsed.filename, pageCount: parsed.pageCount, sha256: parsed.sha256 }); } catch (error) { return reply.code(400).send({ code: error && typeof error === "object" && "code" in error ? error.code : errors.UNSUPPORTED_DOCUMENT_FORMAT, message: "Documento rechazado" }); }
  });
  app.get<{ Params: { id: string; page: string } }>("/api/documents/:id/pages/:page", async (request, reply) => { const row = active.db.db.prepare("SELECT id, case_id AS caseId, page_count AS pageCount, text_content AS text FROM documents WHERE id = ?").get(request.params.id) as { id: string; caseId: string; pageCount: number | null; text: string } | undefined; const page = Number(request.params.page); if (!row || !Number.isInteger(page) || page < 1 || (row.pageCount !== null && page > row.pageCount)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Página no encontrada" }); return { documentId: row.id, caseId: row.caseId, page, text: page === 1 ? row.text : "" }; });
  app.post<{ Params: { caseId: string }; Body: { requestId?: string } }>("/api/cases/:caseId/agent-turn", async (request, reply) => { const requestId = request.body?.requestId; if (requestId && requestCache.has(requestId)) return requestCache.get(requestId); if (!active.adapter.isReady()) return reply.code(503).send({ code: errors.QVAC_NOT_READY, message: "QVAC local no está listo" }); const result = await new AgentController(active.db.db, active.adapter, new ToolRegistry()).run(request.params.caseId); if (requestId) requestCache.set(requestId, result); return result; });
  app.post<{ Params: { caseId: string }; Body: { fieldKey: string; value: string; message: string } }>("/api/cases/:caseId/answers", async (request, reply) => { try { const { fieldKey, value, message } = request.body; const id = randomUUID(); active.db.db.prepare("INSERT INTO user_answers (id, case_id, field_key, value_text, message, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, request.params.caseId, fieldKey, value, message, new Date().toISOString()); return { id, caseId: request.params.caseId, fieldKey, value, status: "user_reported" }; } catch { return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Respuesta inválida" }); } });
  app.post<{ Params: { caseId: string } }>("/api/cases/:caseId/report", async (request, reply) => { const row = active.db.db.prepare("SELECT id, status FROM cases WHERE id = ?").get(request.params.caseId) as { id: string; status: string } | undefined; if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" }); const findings = active.db.db.prepare("SELECT rule_id AS ruleId, severity, kind, message, document_id AS documentId, page, quote FROM findings WHERE case_id = ?").all(request.params.caseId); const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Reporte ${row.id}</title><h1>DATOS SINTÉTICOS — DEMO</h1><p>Estado: ${row.status}</p><pre>${JSON.stringify(findings, null, 2)}</pre><p>Reporte factual para revisión humana.</p></html>`; return { caseId: row.id, html }; });
  app.setErrorHandler((_error, _request, reply) => reply.code(500).send({ code: errors.INTERNAL_ERROR, message: "Error interno" }));
  return { app, dependencies: active };
}
