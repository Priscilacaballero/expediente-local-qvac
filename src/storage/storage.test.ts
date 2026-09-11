import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDatabase } from "./database.js";
import { CaseRepository, DocumentRepository, FieldCandidateRepository, FindingRepository } from "./repositories.js";

describe("local persistence", () => {
  it("keeps records isolated by case", () => {
    const database = new LocalDatabase(":memory:");
    const cases = new CaseRepository(database.db);
    const documents = new DocumentRepository(database.db);
    const fields = new FieldCandidateRepository(database.db);
    const findings = new FindingRepository(database.db);

    cases.create("case-0001");
    cases.create("case-0002");
    const documentId = documents.create({ caseId: "case-0001", filename: "id.pdf", mimeType: "application/pdf", sha256: "a".repeat(64), textContent: "DATOS SINTÉTICOS" });
    fields.create({ caseId: "case-0001", documentId, fieldKey: "full_name", value: "Ana Demo", normalizedValue: "ana demo", status: "candidate" });
    findings.create({ caseId: "case-0001", ruleId: "RULE-001", severity: "critical", kind: "missing", message: "Falta evidencia" });

    expect(documents.listForCase("case-0002")).toEqual([]);
    expect(fields.listForCase("case-0002")).toEqual([]);
    expect(findings.listForCase("case-0002")).toEqual([]);
    expect(documents.getForCase("case-0002", documentId)).toBeNull();
    database.close();
  });

  it("applies required SQLite pragmas and idempotent migrations", () => {
    const database = new LocalDatabase(":memory:");
    expect(database.db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(database.db.pragma("journal_mode", { simple: true })).toBe("memory");
    expect(database.db.pragma("busy_timeout", { simple: true })).toBe(5000);
    database.close();

    const secondDatabase = new LocalDatabase(":memory:");
    expect(secondDatabase.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 14 });
    secondDatabase.close();
  });

  it("keeps a case after closing and reopening the database", () => {
    const directory = mkdtempSync(join(tmpdir(), "expediente-local-"));
    const filename = join(directory, "case.db");
    const first = new LocalDatabase(filename);
    new CaseRepository(first.db).create("case-0001");
    first.close();

    const reopened = new LocalDatabase(filename);
    expect(new CaseRepository(reopened.db).get("case-0001")?.status).toBe("nuevo");
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
