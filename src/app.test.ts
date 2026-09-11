import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { LocalDatabase } from "./storage/database.js";
import { ProcedureSearch } from "./tools/search-procedure.js";
import { QvacAdapter } from "./qvac/qvac-adapter.js";

describe("local API", () => {
  it("serves health, cases and controlled readiness", async () => {
    const db = new LocalDatabase(":memory:");
    db.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', ?, ?)").run("case-0001", new Date().toISOString(), new Date().toISOString());
    const { app, dependencies } = await buildApp({ db, procedure: await ProcedureSearch.load(), adapter: new QvacAdapter() });
    expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    const useCases = (await app.inject({ method: "GET", url: "/api/platform/use-cases" })).json() as Array<{ id: string; limitations: string[] }>;
    expect(useCases).toHaveLength(5);
    expect(useCases.find(item => item.id === "security_review")?.limitations.join(" ")).toContain("fraude");
    const architecture = (await app.inject({ method: "GET", url: "/api/platform/architecture" })).json() as { provider: string; pearsExtension: string };
    expect(architecture.provider).toBe("QVAC local");
    expect(architecture.pearsExtension).toContain("futura");
    expect((await app.inject({ method: "GET", url: "/api/platform/status" })).json().synthetic).toBe(true);
    const workspace = await app.inject({ method: "POST", url: "/api/platform/workspace", payload: { useCase: "document_review", role: "reviewer", caseId: "case-0001" } });
    expect(workspace.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/api/platform/activity" })).json().length).toBeGreaterThan(0);
    expect((await app.inject({ method: "GET", url: "/api/cases" })).json()).toHaveLength(1);
    expect((await app.inject({ method: "POST", url: "/api/cases", payload: { label: "Prueba manual" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/api/client/products?language=es" })).json()).toHaveLength(4);
    const clientAnswer = (await app.inject({ method: "POST", url: "/api/client/assistant", payload: { language: "es", query: "¿Cómo puedo ahorrar?" } })).json() as { answer: string; sources: unknown[] };
    expect(clientAnswer.answer.toLocaleLowerCase()).not.toContain("no puedo");
    expect(clientAnswer.sources.length).toBeGreaterThan(0);
    expect((await app.inject({ method: "GET", url: "/api/security/alerts" })).json().length).toBeGreaterThanOrEqual(3);
    expect((await app.inject({ method: "POST", url: "/api/security/transactions", payload: { customerRef: "manual", amount: 5000, beneficiary: "new-manual", channel: "web", country: "XX" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/operations/procedure-assistant", payload: { language: "es", query: "¿Qué revisar?" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/cases/case-0001/agent-turn", payload: { requestId: "one" } })).statusCode).toBe(503);
    await app.close(); dependencies.db.close();
  });
});
