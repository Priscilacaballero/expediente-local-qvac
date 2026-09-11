import Fastify, { type FastifyInstance } from "fastify";
import { readFile, rm } from "node:fs/promises";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "./config.js";
import { LocalDatabase } from "./storage/database.js";
import { ProcedureSearch } from "./tools/search-procedure.js";
import { QvacAdapter } from "./qvac/qvac-adapter.js";
import { AgentController } from "./agent/agent-controller.js";
import { ToolRegistry } from "./tools/tool-registry.js";
import { ensureSyntheticCases } from "./storage/synthetic-bootstrap.js";
import { z } from "zod";
import { ensureBankingData } from "./banking/banking-bootstrap.js";
import { answerClient, answerProcedure } from "./banking/local-assistant.js";
import { detectSyntheticRisks } from "./banking/risk-detector.js";
import { DocumentProcessingQueue } from "./documents/document-processing.js";
import { ARCHITECTURE, USE_CASES, type UseCaseId, type WorkspaceRole } from "./platform/use-cases.js";

type AppDependencies = { db: LocalDatabase; procedure: ProcedureSearch; adapter: QvacAdapter };
const errors = { INVALID_INPUT: "INVALID_INPUT", NOT_FOUND: "NOT_FOUND", UNSUPPORTED_DOCUMENT_FORMAT: "UNSUPPORTED_DOCUMENT_FORMAT", QVAC_NOT_READY: "QVAC_NOT_READY", AGENT_FORMAT_ERROR: "AGENT_FORMAT_ERROR", INTERNAL_ERROR: "INTERNAL_ERROR" } as const;
const escapeHtml = (value: unknown): string => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export async function buildApp(dependencies?: AppDependencies): Promise<{ app: FastifyInstance; dependencies: AppDependencies }> {
  const active = dependencies ?? { db: new LocalDatabase(), procedure: await ProcedureSearch.load(), adapter: new QvacAdapter() };
  if (!dependencies) await ensureSyntheticCases(active.db.db);
  await ensureBankingData(active.db.db);
  const app = Fastify({ logger: false, bodyLimit: config.MAX_DOCUMENT_SIZE_BYTES });
  const requestCache = new Map<string, unknown>();
  const processing = new DocumentProcessingQueue(active.db.db, active.adapter);
  await app.register(multipart, { limits: { fileSize: config.MAX_DOCUMENT_SIZE_BYTES, files: 1 } });
  await app.register(fastifyStatic, { root: resolve("dist/ui"), prefix: "/" });
  app.get("/api/session", async () => ({ id: "local", synthetic: true }));
  app.get("/api/health", async () => ({ ok: true, host: config.HOST, port: config.PORT, provider: "QVAC local", model: config.QVAC_TEXT_MODEL, ready: active.adapter.isReady(), capabilities: active.adapter.getCapabilities() }));
  const logActivity = (useCase: UseCaseId, action: string, result: string, humanReview: "not_required" | "pending" | "completed" = "pending", workspaceId: string | null = null) => {
    active.db.db.prepare("INSERT INTO platform_activity (id, workspace_id, use_case, action, result, human_review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), workspaceId, useCase, action, result, humanReview, new Date().toISOString());
  };
  app.get("/api/platform/use-cases", async () => USE_CASES);
  app.get("/api/platform/architecture", async () => ARCHITECTURE);
  app.get("/api/platform/status", async () => ({ provider: "QVAC local", model: config.QVAC_TEXT_MODEL, ready: active.adapter.isReady(), capabilities: active.adapter.getCapabilities(), online: true, synthetic: true, humanReview: "La decisión final siempre es humana" }));
  app.get("/api/platform/activity", async () => active.db.db.prepare("SELECT id, workspace_id AS workspaceId, use_case AS useCase, action, result, human_review AS humanReview, created_at AS createdAt FROM platform_activity ORDER BY created_at DESC LIMIT 12").all());
  app.get("/api/platform/workspace", async () => {
    const row = active.db.db.prepare("SELECT id, use_case AS useCase, role, case_id AS caseId, last_action AS lastAction, created_at AS createdAt, updated_at AS updatedAt FROM platform_workspaces ORDER BY updated_at DESC LIMIT 1").get() as Record<string, unknown> | undefined;
    return row ? { ...row, localInference: { provider: "QVAC local", ready: active.adapter.isReady(), externalInference: false } } : null;
  });
  app.get<{ Params: { caseId: string; documentId: string } }>("/api/cases/:caseId/documents/:documentId/processing", async (request, reply) => {
    const row = active.db.db.prepare("SELECT d.id, d.case_id AS caseId, d.processing_status AS processingStatus, d.processing_error AS error, j.id AS jobId, j.current_page AS currentPage, j.total_pages AS totalPages FROM documents d LEFT JOIN document_processing_jobs j ON j.document_id = d.id WHERE d.id = ? AND d.case_id = ? ORDER BY j.created_at DESC LIMIT 1").get(request.params.documentId, request.params.caseId);
    if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Documento no encontrado" }); return row;
  });
  app.get<{ Params: { caseId: string; documentId: string } }>("/api/cases/:caseId/documents/:documentId/assets", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM documents WHERE id = ? AND case_id = ?").get(request.params.documentId, request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Documento no encontrado" });
    return active.db.db.prepare("SELECT id, page, asset_type AS assetType, mime_type AS mimeType, sha256, width, height, created_at AS createdAt FROM document_assets WHERE document_id = ? ORDER BY page, id").all(request.params.documentId);
  });
  app.delete<{ Params: { caseId: string; documentId: string } }>("/api/cases/:caseId/documents/:documentId", async (request, reply) => {
    const row = active.db.db.prepare("SELECT id FROM documents WHERE id = ? AND case_id = ?").get(request.params.documentId, request.params.caseId) as { id: string } | undefined;
    if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Documento no encontrado" });
    const assets = active.db.db.prepare("SELECT local_path AS localPath FROM document_assets WHERE document_id = ?").all(row.id) as Array<{ localPath: string }>;
    active.db.db.prepare("DELETE FROM documents WHERE id = ? AND case_id = ?").run(row.id, request.params.caseId);
    for (const asset of assets) { if (asset.localPath.startsWith(resolve(".qvac/document-assets"))) await rm(asset.localPath, { force: true }); }
    return reply.code(204).send();
  });
  app.post<{ Params: { caseId: string; documentId: string } }>("/api/cases/:caseId/documents/:documentId/reprocess", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM documents WHERE id = ? AND case_id = ?").get(request.params.documentId, request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Documento no encontrado" });
    try { return reply.code(202).send({ ...(await processing.reprocess(request.params.documentId)), processingStatus: "queued" }); } catch (error) { return reply.code(400).send({ code: errors.INVALID_INPUT, message: error instanceof Error ? error.message : "No se pudo reprocesar" }); }
  });
  app.get<{ Params: { caseId: string; documentId: string; assetId: string } }>("/api/cases/:caseId/documents/:documentId/assets/:assetId", async (request, reply) => {
    const row = active.db.db.prepare("SELECT a.local_path AS localPath, a.mime_type AS mimeType FROM document_assets a JOIN documents d ON d.id = a.document_id WHERE a.id = ? AND a.document_id = ? AND d.case_id = ?").get(request.params.assetId, request.params.documentId, request.params.caseId) as { localPath: string; mimeType: string } | undefined;
    if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Asset no encontrado" }); return reply.type(row.mimeType).send(await readFile(row.localPath));
  });
  app.post<{ Body: { useCase?: string; role?: string; caseId?: string; lastAction?: string } }>("/api/platform/workspace", async (request, reply) => {
    const body = z.object({ useCase: z.enum(["client_guidance", "financial_inclusion", "document_review", "operations", "security_review"]), role: z.enum(["client", "bank_operator", "reviewer", "security_analyst"]), caseId: z.string().optional(), lastAction: z.string().trim().max(160).optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Contexto de trabajo inválido" });
    const now = new Date().toISOString(); const id = randomUUID();
    active.db.db.prepare("INSERT INTO platform_workspaces (id, use_case, role, case_id, last_action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, body.data.useCase, body.data.role, body.data.caseId ?? null, body.data.lastAction ?? null, now, now);
    logActivity(body.data.useCase, "workspace_started", "Espacio de trabajo seleccionado", "pending", id);
    return reply.code(201).send({ id, ...body.data, localInference: { provider: "QVAC local", ready: active.adapter.isReady(), externalInference: false }, createdAt: now, updatedAt: now });
  });
  app.get<{ Querystring: { language?: string } }>("/api/client/products", async (request) => { const language = request.query.language === "en" ? "en" : "es"; return active.db.db.prepare("SELECT id, language, name, description, audience, requirements, version FROM product_catalog WHERE language = ? ORDER BY id").all(language); });
  app.get<{ Querystring: { language?: string; q?: string } }>("/api/client/guides", async (request) => { const language = request.query.language === "en" ? "en" : "es"; const query = request.query.q?.trim() ?? ""; return active.db.db.prepare("SELECT id, language, title, content, keywords, version FROM education_guides WHERE language = ? AND (lower(title) LIKE ? OR lower(content) LIKE ? OR lower(keywords) LIKE ?) ORDER BY id").all(language, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`); });
  app.post<{ Body: { language?: string; query?: string; context?: unknown } }>("/api/client/assistant", async (request, reply) => {
    const body = z.object({
      language: z.enum(["es", "en"]).default("es"),
      query: z.string().trim().min(1).max(500),
      context: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000), sourceIds: z.array(z.string().min(1).max(120)).max(3).optional() })).max(8).default([]),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Pregunta inválida" });
    return answerClient(active.db.db, active.adapter, body.data.language, body.data.query, body.data.context);
  });
  app.post<{ Body: { productId?: string; language?: string; message?: string } }>("/api/client/orientation-requests", async (request, reply) => { const body = z.object({ productId: z.string().min(1), language: z.enum(["es", "en"]).default("es"), message: z.string().trim().min(1).max(1000) }).safeParse(request.body); if (!body.success || !active.db.db.prepare("SELECT 1 FROM product_catalog WHERE id = ? AND language = ?").get(body.success ? body.data.productId : "", body.success ? body.data.language : "")) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Solicitud de orientación inválida" }); const id = randomUUID(); active.db.db.prepare("INSERT INTO orientation_requests (id, product_id, language, message, status, created_at) VALUES (?, ?, ?, ?, 'pending_human_review', ?)").run(id, body.data.productId, body.data.language, body.data.message, new Date().toISOString()); return reply.code(201).send({ id, productId: body.data.productId, language: body.data.language, status: "pending_human_review" }); });
  app.get("/api/operations/orientation-requests", async () => active.db.db.prepare("SELECT id, product_id AS productId, language, message, status, created_at AS createdAt FROM orientation_requests ORDER BY created_at DESC").all());
  app.post<{ Body: { language?: string; query?: string } }>("/api/operations/procedure-assistant", async (request, reply) => { const body = z.object({ language: z.enum(["es", "en"]).default("es"), query: z.string().trim().min(1).max(500) }).safeParse(request.body); if (!body.success) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Consulta inválida" }); return answerProcedure(active.db.db, active.procedure, body.data.language, body.data.query); });
  app.get("/api/security/transactions", async () => active.db.db.prepare("SELECT id, customer_ref AS customerRef, occurred_at AS occurredAt, amount, currency, beneficiary, channel, country FROM transactions ORDER BY occurred_at, id").all());
  app.post<{ Body: { customerRef?: string; amount?: number; beneficiary?: string; channel?: string; country?: string } }>("/api/security/transactions", async (request, reply) => { const body = z.object({ customerRef: z.string().trim().min(1).max(80), amount: z.number().positive().max(1000000), beneficiary: z.string().trim().min(1).max(120), channel: z.string().trim().min(1).max(40), country: z.string().trim().length(2).transform(value => value.toUpperCase()) }).safeParse(request.body); if (!body.success) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Transacción sintética inválida" }); const id = `tx-user-${randomUUID()}`; active.db.db.prepare("INSERT INTO transactions (id, customer_ref, occurred_at, amount, currency, beneficiary, channel, country, synthetic) VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, 1)").run(id, body.data.customerRef, new Date().toISOString(), body.data.amount, body.data.beneficiary, body.data.channel, body.data.country); detectSyntheticRisks(active.db.db); return reply.code(201).send({ id, ...body.data, currency: "USD", synthetic: true }); });
  app.get("/api/security/alerts", async () => { detectSyntheticRisks(active.db.db); const rows = active.db.db.prepare("SELECT id, alert_type AS alertType, severity, message, transaction_ids AS transactionIds, evidence, status, created_at AS createdAt FROM risk_alerts ORDER BY created_at, id").all() as Array<{ id: string; alertType: string; severity: string; message: string; transactionIds: string; evidence: string; status: string; createdAt: string }>; return rows.map((row) => ({ ...row, transactionIds: JSON.parse(row.transactionIds), evidence: JSON.parse(row.evidence) })); });
  app.get("/api/cases", async () => active.db.db.prepare("SELECT id, status, created_at AS createdAt, updated_at AS updatedAt FROM cases ORDER BY created_at, id").all());
  app.post<{ Body: { label?: string } }>("/api/cases", async (request, reply) => { const body = z.object({ label: z.string().trim().max(50).optional() }).safeParse(request.body ?? {}); if (!body.success) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Nombre de expediente inválido" }); const id = `case-user-${randomUUID().slice(0, 8)}`; const now = new Date().toISOString(); active.db.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', ?, ?)").run(id, now, now); return reply.code(201).send({ id, status: "nuevo", createdAt: now, updatedAt: now, label: body.data.label ?? "Mi expediente" }); });
  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId", async (request, reply) => { const row = active.db.db.prepare("SELECT id, status, created_at AS createdAt, updated_at AS updatedAt FROM cases WHERE id = ?").get(request.params.caseId); if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" }); return row; });
  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId/documents", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM cases WHERE id = ?").get(request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" });
    return active.db.db.prepare("SELECT id, case_id AS caseId, filename, mime_type AS mimeType, page_count AS pageCount, sha256, processing_status AS processingStatus, processing_error AS processingError, extraction_method AS extractionMethod, producer_model AS producerModel, created_at AS createdAt, (SELECT current_page FROM document_processing_jobs j WHERE j.document_id = documents.id ORDER BY j.created_at DESC LIMIT 1) AS currentPage, (SELECT total_pages FROM document_processing_jobs j WHERE j.document_id = documents.id ORDER BY j.created_at DESC LIMIT 1) AS totalPages FROM documents WHERE case_id = ? ORDER BY created_at, id").all(request.params.caseId);
  });
  app.get<{ Params: { caseId: string } }>("/api/cases/:caseId/analysis", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM cases WHERE id = ?").get(request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" });
    const fields = active.db.db.prepare("SELECT id, case_id AS caseId, document_id AS documentId, field_key AS fieldKey, value_text AS value, normalized_value AS normalizedValue, status, confidence, source_page AS sourcePage, source_quote AS sourceQuote, extraction_method AS extractionMethod, producer_model AS producerModel, producer_model_sha256 AS producerModelSha256, source_asset_id AS sourceAssetId, bbox, created_at AS createdAt FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(request.params.caseId);
    const findings = active.db.db.prepare("SELECT id, case_id AS caseId, rule_id AS ruleId, severity, kind, message, document_id AS documentId, page, quote, created_at AS createdAt FROM findings WHERE case_id = ? ORDER BY created_at, id").all(request.params.caseId);
    const visualInspections = active.db.db.prepare("SELECT id, document_id AS documentId, asset_id AS assetId, model, model_sha256 AS modelSha256, result, status, created_at AS createdAt FROM visual_inspections WHERE document_id IN (SELECT id FROM documents WHERE case_id = ?) ORDER BY created_at, id").all(request.params.caseId);
    const ocrBlocks = active.db.db.prepare("SELECT id, document_id AS documentId, page, text, bbox, confidence, model, created_at AS createdAt FROM document_ocr_blocks WHERE document_id IN (SELECT id FROM documents WHERE case_id = ?) ORDER BY document_id, page, id").all(request.params.caseId);
    return { fields, findings, visualInspections, ocrBlocks };
  });
  app.post<{ Params: { caseId: string } }>("/api/cases/:caseId/documents", async (request, reply) => {
    if (!active.db.db.prepare("SELECT 1 FROM cases WHERE id = ?").get(request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" });
    const part = await request.file(); if (!part) return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Falta el documento" });
    try { const bytes = await part.toBuffer(); if (!["application/pdf", "image/png", "image/jpeg"].includes(part.mimetype)) return reply.code(400).send({ code: errors.UNSUPPORTED_DOCUMENT_FORMAT, message: "Solo se aceptan PDF, PNG o JPG" }); const result = await processing.enqueue({ caseId: request.params.caseId, filename: part.filename, mimeType: part.mimetype as "application/pdf" | "image/png" | "image/jpeg", bytes }); return reply.code(202).send({ ...result, caseId: request.params.caseId, filename: part.filename, processingStatus: "queued" }); } catch (error) { return reply.code(400).send({ code: error && typeof error === "object" && "code" in error ? error.code : errors.UNSUPPORTED_DOCUMENT_FORMAT, message: error instanceof Error ? error.message : "Documento rechazado" }); }
  });
  app.get<{ Params: { id: string; page: string } }>("/api/documents/:id/pages/:page", async (request, reply) => { const row = active.db.db.prepare("SELECT id, case_id AS caseId, page_count AS pageCount FROM documents WHERE id = ?").get(request.params.id) as { id: string; caseId: string; pageCount: number | null } | undefined; const page = Number(request.params.page); const content = row ? active.db.db.prepare("SELECT text_content AS text FROM document_pages WHERE document_id = ? AND page = ?").get(request.params.id, page) as { text: string } | undefined : undefined; if (!row || !content || !Number.isInteger(page) || page < 1 || (row.pageCount !== null && page > row.pageCount)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Página no encontrada" }); return { documentId: row.id, caseId: row.caseId, page, text: content.text }; });
  app.post<{ Params: { caseId: string }; Body: { requestId?: string } }>("/api/cases/:caseId/agent-turn", async (request, reply) => { const requestId = request.body?.requestId; const cacheKey = requestId ? `${request.params.caseId}:${requestId}` : undefined; if (cacheKey && requestCache.has(cacheKey)) return requestCache.get(cacheKey); if (!active.adapter.isReady()) return reply.code(503).send({ code: errors.QVAC_NOT_READY, message: "QVAC local no está listo" }); const result = await new AgentController(active.db.db, active.adapter, new ToolRegistry()).run(request.params.caseId); if (cacheKey) requestCache.set(cacheKey, result); return result; });
  app.post<{ Params: { caseId: string }; Body: { fieldKey: string; value: string; message: string } }>("/api/cases/:caseId/answers", async (request, reply) => { try { const body = z.object({ fieldKey: z.string(), value: z.string().trim().min(1).max(500), message: z.string().trim().min(1).max(1000) }).parse(request.body); if (!active.db.db.prepare("SELECT 1 FROM cases WHERE id = ?").get(request.params.caseId)) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" }); const id = randomUUID(); active.db.db.prepare("INSERT INTO user_answers (id, case_id, field_key, value_text, message, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, request.params.caseId, body.fieldKey, body.value, body.message, new Date().toISOString()); return { id, caseId: request.params.caseId, ...body, status: "user_reported" }; } catch { return reply.code(400).send({ code: errors.INVALID_INPUT, message: "Respuesta inválida" }); } });
  app.post<{ Params: { caseId: string } }>("/api/cases/:caseId/report", async (request, reply) => { const row = active.db.db.prepare("SELECT id, status FROM cases WHERE id = ?").get(request.params.caseId) as { id: string; status: string } | undefined; if (!row) return reply.code(404).send({ code: errors.NOT_FOUND, message: "Caso no encontrado" }); const findings = active.db.db.prepare("SELECT rule_id AS ruleId, severity, kind, message, document_id AS documentId, page, quote FROM findings WHERE case_id = ? ORDER BY created_at, id").all(request.params.caseId) as Array<Record<string, unknown>>; const fields = active.db.db.prepare("SELECT field_key AS fieldKey, value_text AS value, status, source_page AS page, source_quote AS quote FROM field_candidates WHERE case_id = ? ORDER BY created_at, id").all(request.params.caseId) as Array<Record<string, unknown>>; const findingRows = findings.map((finding) => `<li><strong>${escapeHtml(finding.severity)}</strong> ${escapeHtml(finding.message)} — ${escapeHtml(finding.documentId ?? "sin documento")} ${escapeHtml(finding.page ? `p. ${finding.page}` : "")}<blockquote>${escapeHtml(finding.quote ?? "Sin cita: ausencia de campo")}</blockquote></li>`).join(""); const fieldRows = fields.map((field) => `<tr><td>${escapeHtml(field.fieldKey)}</td><td>${escapeHtml(field.value ?? "")}</td><td>${escapeHtml(field.status)}</td><td>${escapeHtml(field.quote ?? "")}</td></tr>`).join(""); const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Reporte ${escapeHtml(row.id)}</title><style>body{font:14px system-ui;max-width:900px;margin:40px auto;color:#1d2925}blockquote{color:#65746a;border-left:3px solid #c9e85b;padding-left:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dfe6dd;padding:8px;text-align:left}</style><h1>DATOS SINTÉTICOS — DEMO</h1><p>Estado: <strong>${escapeHtml(row.status)}</strong></p><h2>Campos extraídos</h2><table><thead><tr><th>Campo</th><th>Valor</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>${fieldRows}</tbody></table><h2>Hallazgos</h2><ul>${findingRows || "<li>No hay hallazgos.</li>"}</ul><p>Reporte factual para revisión humana. Una discrepancia no prueba fraude.</p></html>`; return { caseId: row.id, html }; });
  app.setErrorHandler((_error, _request, reply) => reply.code(500).send({ code: errors.INTERNAL_ERROR, message: "Error interno" }));
  return { app, dependencies: active };
}
