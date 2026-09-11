import { describe, expect, it } from "vitest";
import { ProcedureSearch } from "./search-procedure.js";

describe("local procedure search", () => {
  it("recovers a rule with version and limits results", async () => {
    const search = await ProcedureSearch.load();
    const result = search.search("fuente campos requeridos", 99);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]?.procedureVersion).toBe("procedure-v1");
    expect(result.some((rule) => rule.rule_id === "RULE-001")).toBe(true);
  });

  it("rejects URLs and paths", async () => {
    const search = await ProcedureSearch.load();
    expect(() => search.search("https://example.invalid")).toThrow();
    expect(() => search.search("../secreto")).toThrow();
  });
});
