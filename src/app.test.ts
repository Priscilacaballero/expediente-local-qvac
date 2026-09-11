import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { LocalDatabase } from "./storage/database.js";
import { ProcedureSearch } from "./tools/search-procedure.js";
import { QvacAdapter } from "./qvac/qvac-adapter.js";
describe("local API", () => { it("serves health, cases and controlled readiness", async () => { const db = new LocalDatabase(":memory:"); db.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', ?, ?)").run("case-0001", new Date().toISOString(), new Date().toISOString()); const { app, dependencies } = await buildApp({ db, procedure: await ProcedureSearch.load(), adapter: new QvacAdapter() }); expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200); expect((await app.inject({ method: "GET", url: "/api/cases" })).json()).toHaveLength(1); expect((await app.inject({ method: "POST", url: "/api/cases/case-0001/agent-turn", payload: { requestId: "one" } })).statusCode).toBe(503); await app.close(); dependencies.db.close(); }); });
