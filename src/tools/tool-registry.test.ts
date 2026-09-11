import { describe, expect, it } from "vitest";
import { LocalDatabase } from "../storage/database.js";
import { ProcedureSearch } from "./search-procedure.js";
import { ToolRegistry } from "./tool-registry.js";

describe("closed agent tool registry", () => {
  it("registers exactly the seven authorized tools", () => {
    const registry = new ToolRegistry();
    expect(registry.names().sort()).toEqual(["extract_fields", "list_documents", "prepare_report", "read_document", "record_user_answer", "search_procedure", "validate_case"]);
  });

  it("does not allow an unregistered tool", () => {
    const registry = new ToolRegistry();
    expect(() => registry.register({ name: "run_sql", description: "", parameters: {} as never, execute: async () => null })).toThrow();
  });

  it("keeps user answers separate from document fields", async () => {
    const database = new LocalDatabase(":memory:");
    database.db.prepare("INSERT INTO cases (id, status, created_at, updated_at) VALUES (?, 'nuevo', ?, ?)").run("case-0001", new Date().toISOString(), new Date().toISOString());
    const registry = new ToolRegistry();
    const result = await registry.get("record_user_answer")?.execute({ caseId: "case-0001", fieldKey: "source_of_funds", value: "salario", message: "Respuesta del ejecutivo" }, { db: database.db, procedure: await ProcedureSearch.load() });
    expect(result).toMatchObject({ status: "user_reported" });
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM field_candidates").get()).toEqual({ count: 0 });
    expect(database.db.prepare("SELECT COUNT(*) AS count FROM user_answers").get()).toEqual({ count: 1 });
    database.close();
  });
});
