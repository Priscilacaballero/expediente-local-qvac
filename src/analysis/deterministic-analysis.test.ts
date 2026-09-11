import { describe, expect, it } from "vitest";
import { LocalDatabase } from "../storage/database.js";
import { analyzeCaseDeterministically } from "./deterministic-analysis.js";

describe("deterministic case analysis", () => {
  it("persists a complete result with source evidence", async () => {
    const database = new LocalDatabase(":memory:");
    const now = new Date().toISOString();
    database.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES ('case-0001', 'nuevo', ?, ?)").run(now, now);
    const identity = "id-complete";
    const income = "income-complete";
    database.db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, sha256, page_count, text_content, created_at) VALUES (?, 'case-0001', 'identidad.pdf', 'application/pdf', ?, 1, ?, ?)").run(identity, "a".repeat(64), "Nombre: Ana Demo\nFecha de nacimiento: 1990-01-15\nDocumento: DEMO-0001\nDireccion: Calle 1", now);
    database.db.prepare("INSERT INTO documents (id, case_id, filename, mime_type, sha256, page_count, text_content, created_at) VALUES (?, 'case-0001', 'ingresos.pdf', 'application/pdf', ?, 1, ?, ?)").run(income, "b".repeat(64), "Situacion laboral: empleada\nIngreso mensual: 2500 USD\nFuente de fondos: salario", now);
    database.db.prepare("INSERT INTO document_pages (document_id, page, text_content) VALUES (?, 1, ?), (?, 1, ?)").run(identity, "Nombre: Ana Demo\nFecha de nacimiento: 1990-01-15\nDocumento: DEMO-0001\nDireccion: Calle 1", income, "Situacion laboral: empleada\nIngreso mensual: 2500 USD\nFuente de fondos: salario");
    const result = await analyzeCaseDeterministically(database.db, "case-0001");
    expect(result.status).toBe("listo_para_revision");
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM field_candidates WHERE case_id = 'case-0001'").get()).toEqual({ count: 8 });
    expect(database.db.prepare("SELECT source_page, source_quote FROM field_candidates WHERE field_key = 'full_name'").get()).toEqual({ source_page: 1, source_quote: "Nombre: Ana Demo" });
    database.close();
  });
});
