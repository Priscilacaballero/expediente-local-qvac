import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";
import type { ProcedureSearch } from "../tools/search-procedure.js";

export type LocalAnswer = { answer: string; sources: Array<{ id: string; title: string }> ; provider: "QVAC local" | "local-safe-fallback" };

type Guide = { id: string; title: string; content: string; keywords: string };
type Product = { id: string; name: string; description: string; audience: string; requirements: string; searchTerms: string };

function productAnswer(products: Product[], language: "es" | "en") {
  if (products.length === 0) return "";
  if (products.length > 1) return language === "es"
    ? `Encontré ${products.length} opciones relacionadas con tu pregunta: ${products.map((product) => product.name).join(", ")}. Dime cuál quieres explorar y te explico sus características con más detalle.`
    : `I found ${products.length} options related to your question: ${products.map((product) => product.name).join(", ")}. Tell me which one you would like to explore and I will explain it in more detail.`;
  const product = products[0]!;
  return language === "es"
    ? `Encontré una opción relacionada con tu pregunta: ${product.name}. ${product.description} Está pensada para ${product.audience.toLowerCase()}. Para esta demostración necesitarías ${product.requirements.toLowerCase()}. Es una orientación informativa y no constituye una aprobación.`
    : `I found an option related to your question: ${product.name}. ${product.description} It is intended for ${product.audience.toLowerCase()}. For this demo, you would need ${product.requirements.toLowerCase()}. This is informational guidance only and is not an approval.`;
}

function guideAnswer(guides: Guide[], language: "es" | "en") {
  if (guides.length === 0) return language === "es" ? "Puedo orientarte sobre ahorro, seguridad de cuenta y productos del catálogo local. ¿Qué te gustaría consultar?" : "I can explain savings, account safety, and products in the local catalog. What would you like to know?";
  if (guides.length > 1) return language === "es" ? `Encontré información relacionada en ${guides.length} temas: ${guides.map((guide) => guide.title).join(", ")}. ¿Cuál quieres revisar primero?` : `I found related information in ${guides.length} topics: ${guides.map((guide) => guide.title).join(", ")}. Which one would you like to review first?`;
  const guide = guides[0]!;
  return language === "es" ? `Sobre ${guide.title}: ${guide.content} Si quieres, puedo darte un ejemplo o ayudarte a revisar el siguiente paso.` : `About ${guide.title}: ${guide.content} I can also give you an example or help with the next step.`;
}

export async function answerClient(db: Database.Database, adapter: QvacAdapter, language: "es" | "en", query: string): Promise<LocalAnswer> {
  const terms = query.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((term) => term.length > 3 && !["como", "para", "what", "with", "quiero", "puedo"].includes(term));
  const searchable = terms.flatMap((term) => [term, term.endsWith("ar") || term.endsWith("er") || term.endsWith("ir") ? term.slice(0, -2) : term.endsWith("s") ? term.slice(0, -1) : term]);
  const allGuides = db.prepare("SELECT id, title, content, keywords FROM education_guides WHERE language = ? ORDER BY id").all(language) as Guide[];
  const allProducts = db.prepare("SELECT id, name, description, audience, requirements, search_terms AS searchTerms FROM product_catalog WHERE language = ? ORDER BY id").all(language) as Product[];
  const score = (text: string) => searchable.reduce((total, term) => total + (text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term) ? 1 : 0), 0);
  const rankedGuides = allGuides.map((item) => ({ item, score: score(`${item.title} ${item.content} ${item.keywords}`) })).filter(({ score: itemScore }) => searchable.length === 0 || itemScore > 0).sort((a, b) => b.score - a.score);
  const rankedProducts = allProducts.map((item) => ({ item, score: score(`${item.name} ${item.description} ${item.audience} ${item.requirements} ${item.searchTerms}`) })).filter(({ score: itemScore }) => searchable.length === 0 || itemScore > 0).sort((a, b) => b.score - a.score);
  const topGuideScore = rankedGuides[0]?.score ?? 0;
  const topProductScore = rankedProducts[0]?.score ?? 0;
  const categoryWords = new Set(["tipo", "tipos", "producto", "productos", "prestamo", "prestamos", "ofrecer", "ofrecen", "cliente", "clientes"]);
  const specificProductTerm = searchable.some((term) => !categoryWords.has(term) && rankedProducts.some(({ item }) => `${item.name} ${item.description} ${item.audience} ${item.requirements} ${item.searchTerms}`.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)));
  const asksForCategory = !specificProductTerm && terms.some((term) => term.length > 4 && term.endsWith("s"));
  const guides = rankedGuides.filter(({ score: itemScore }) => itemScore === topGuideScore).map(({ item }) => item).slice(0, 3);
  const products = rankedProducts.filter(({ score: itemScore }) => asksForCategory ? itemScore > 0 : itemScore === topProductScore).map(({ item }) => item).slice(0, 3);
  const productFirst = specificProductTerm || topProductScore > topGuideScore;
  const selectedGuides = productFirst ? [] : guides;
  const selectedProducts = productFirst ? products : topGuideScore > topProductScore ? [] : products;
  const sources = [...selectedGuides.map((item) => ({ id: item.id, title: item.title })), ...selectedProducts.map((item) => ({ id: item.id, title: item.name }))];
  const naturalFallback = selectedProducts.length ? productAnswer(selectedProducts, language) : guideAnswer(selectedGuides, language);
  const polishedFallback = naturalFallback.replace(/\.\s*\./g, ".");
  if (sources.length === 0) return { answer: polishedFallback, sources, provider: "local-safe-fallback" };
  try {
    const local = await adapter.completeAssistant([{ role: "user", content: `Responde en ${language === "es" ? "español claro" : "inglés claro"}.\n\nPregunta del usuario: ${query}\n\nInformación local autorizada: ${polishedFallback}` }]);
    const normalized = local.trim().toLocaleLowerCase();
    const refusalOnly = normalized.length < 40 || /\b(no puedo|no soy capaz|cannot|can't|lo siento|sorry)\b/iu.test(normalized);
    if (local.trim() && !refusalOnly && selectedProducts.length === 0) return { answer: local.trim(), sources, provider: "QVAC local" };
  } catch { /* the safe local answer remains available */ }
  return { answer: polishedFallback, sources, provider: "local-safe-fallback" };
}

export async function answerProcedure(db: Database.Database, procedure: ProcedureSearch, language: "es" | "en", query: string): Promise<LocalAnswer> {
  const results = procedure.search(query);
  const sources = results.map((item) => ({ id: item.rule_id, title: item.title }));
  const answer = results.length ? results.map((item) => `${item.title}: ${item.requirement}`).join(" ") : language === "es" ? "No encontré una regla local relacionada; solicita revisión humana." : "I found no related local rule; request human review.";
  const id = randomUUID();
  db.prepare("INSERT INTO procedure_answers (id, query, language, answer, source_rule_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, query, language, answer, JSON.stringify(results.map((item) => item.rule_id)), new Date().toISOString());
  return { answer, sources, provider: "local-safe-fallback" };
}
