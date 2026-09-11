import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";
import type { ProcedureSearch } from "../tools/search-procedure.js";

export type LocalAnswer = { answer: string; sources: Array<{ id: string; title: string }> ; provider: "QVAC local" | "local-safe-fallback" };

export async function answerClient(db: Database.Database, adapter: QvacAdapter, language: "es" | "en", query: string): Promise<LocalAnswer> {
  const guides = db.prepare("SELECT id, title, content FROM education_guides WHERE language = ? AND (lower(title) LIKE ? OR lower(content) LIKE ? OR lower(keywords) LIKE ?) ORDER BY id LIMIT 3").all(language, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`) as Array<{ id: string; title: string; content: string }>;
  const products = db.prepare("SELECT id, name, description FROM product_catalog WHERE language = ? AND (lower(name) LIKE ? OR lower(description) LIKE ?) ORDER BY id LIMIT 3").all(language, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`) as Array<{ id: string; name: string; description: string }>;
  const sources = [...guides.map((item) => ({ id: item.id, title: item.title })), ...products.map((item) => ({ id: item.id, title: item.name }))];
  const fallback = guides.length ? guides.map((item) => `${item.title}: ${item.content}`).join(" ") : products.length ? products.map((item) => `${item.name}: ${item.description}`).join(" ") : language === "es" ? "No encontré una guía local para esa pregunta. Consulta a un ejecutivo; no puedo aprobar productos ni solicitar claves." : "I could not find a local guide for that question. Ask a representative; I cannot approve products or request passwords.";
  try {
    const local = await adapter.complete([{ role: "user", content: `Responde en ${language === "es" ? "español claro" : "inglés claro"}, usando solo esta información local y sin tomar decisiones: ${fallback}` }]);
    if (local.trim()) return { answer: local.trim(), sources, provider: "QVAC local" };
  } catch { /* the safe local answer remains available */ }
  return { answer: fallback, sources, provider: "local-safe-fallback" };
}

export async function answerProcedure(db: Database.Database, procedure: ProcedureSearch, language: "es" | "en", query: string): Promise<LocalAnswer> {
  const results = procedure.search(query);
  const sources = results.map((item) => ({ id: item.rule_id, title: item.title }));
  const answer = results.length ? results.map((item) => `${item.title}: ${item.requirement}`).join(" ") : language === "es" ? "No encontré una regla local relacionada; solicita revisión humana." : "I found no related local rule; request human review.";
  const id = randomUUID();
  db.prepare("INSERT INTO procedure_answers (id, query, language, answer, source_rule_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, query, language, answer, JSON.stringify(results.map((item) => item.rule_id)), new Date().toISOString());
  return { answer, sources, provider: "local-safe-fallback" };
}
