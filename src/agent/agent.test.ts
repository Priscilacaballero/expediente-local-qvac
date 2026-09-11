import { describe, expect, it } from "vitest";
import { parseAgentAction } from "./action-parser.js";

describe("agent action contract", () => {
  it("accepts only the three public action types", () => {
    expect(parseAgentAction({ type: "tool_call", tool: "list_documents", args: { caseId: "case-0001" }, reason: "Necesito revisar documentos" }).type).toBe("tool_call");
    expect(parseAgentAction({ type: "message", text: "¿Puedes confirmar el dato?", questionCount: 1 }).type).toBe("message");
    expect(parseAgentAction({ type: "finish", status: "listo_para_revision", summary: "Expediente preparado" }).type).toBe("finish");
  });

  it("rejects unknown tools and more than two questions", () => {
    expect(() => parseAgentAction({ type: "tool_call", tool: "run_sql", args: {}, reason: "no" })).toThrow();
    expect(() => parseAgentAction({ type: "message", text: "preguntas", questionCount: 3 })).toThrow();
  });
});
