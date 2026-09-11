import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";
import type { ProcedureSearch } from "../tools/search-procedure.js";

export type LocalAnswer = { answer: string; sources: Array<{ id: string; title: string }> ; provider: "QVAC local" | "local-safe-fallback" };

export async function answerClient(db: Database.Database, adapter: QvacAdapter, language: "es" | "en", query: string): Promise<LocalAnswer> {
  const terms = query.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((term) => term.length > 3 && !["como", "para", "what", "with", "quiero", "puedo"].includes(term));
  const searchable = terms.flatMap((term) => [term, term.endsWith("ar") || term.endsWith("er") || term.endsWith("ir") ? term.slice(0, -2) : term]);
  const allGuides = db.prepare("SELECT id, title, content, keywords FROM education_guides WHERE language = ? ORDER BY id").all(language) as Array<{ id: string; title: string; content: string; keywords: string }>;
  const allProducts = db.prepare("SELECT id, name, description FROM product_catalog WHERE language = ? ORDER BY id").all(language) as Array<{ id: string; name: string; description: string }>;
  const guides = allGuides.filter((item) => searchable.length === 0 || searchable.some((term) => `${item.title} ${item.content} ${item.keywords}`.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term))).slice(0, 3);
  const products = allProducts.filter((item) => searchable.length === 0 || searchable.some((term) => `${item.name} ${item.description}`.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term))).slice(0, 3);
  const sources = [...guides.map((item) => ({ id: item.id, title: item.title })), ...products.map((item) => ({ id: item.id, title: item.name }))];
  const fallback = guides.length ? guides.map((item) => `${item.title}: ${item.content}`).join(" ") : products.length ? products.map((item) => `${item.name}: ${item.description}`).join(" ") : language === "es" ? "Puedo orientarte sobre ahorro, seguridad de cuenta y productos sintéticos del catálogo local. Prueba con una pregunta como: ¿cómo puedo ahorrar? o ¿qué producto me ayuda a organizar una meta?" : "I can explain savings, account safety, and synthetic products in the local catalog. Try asking: How can I save? or Which product helps me organize a goal?";
  try {
    const local = await adapter.complete([{ role: "user", content: `Eres un asistente educativo bancario local. Responde la pregunta del usuario en ${language === "es" ? "español claro" : "inglés claro"}. Usa únicamente la información local proporcionada. Puedes explicar productos sintéticos, ahorro y seguridad. No apruebes productos, no evalúes solicitudes, no pidas contraseñas, códigos ni datos personales, y no ejecutes transacciones. Si la pregunta pide una decisión, explica el límite en una sola frase y ofrece información útil.\n\nPregunta del usuario: ${query}\n\nInformación local autorizada: ${fallback}` }]);
    const normalized = local.trim().toLocaleLowerCase();
    const refusalOnly = normalized.length < 40 || ["no puedo cumplir", "no puedo ayudarte", "no puedo proporcionar", "solicitar claves"].some((phrase) => normalized.includes(phrase) && !normalized.includes("puedo orientarte"));
    if (local.trim() && !refusalOnly) return { answer: local.trim(), sources, provider: "QVAC local" };
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
