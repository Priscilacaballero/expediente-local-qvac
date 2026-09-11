import type Database from "better-sqlite3";
import { config } from "../config.js";
import { AgentRunRepository } from "../storage/repositories.js";
import { ToolRegistry, type ToolContext } from "../tools/tool-registry.js";
import { QvacAdapter, type QvacMessage } from "../qvac/qvac-adapter.js";
import { buildCaseContext } from "./context-builder.js";
import { agentActionSchema, type AgentAction } from "./action-parser.js";

const controllerInstruction = "Devuelve únicamente una acción JSON válida: tool_call con una de las siete herramientas autorizadas, message o finish. No inventes datos. Usa como máximo seis llamadas.";
export type AgentControllerResult = { action: AgentAction; calls: number; runId: string };

export class AgentController {
  constructor(private readonly db: Database.Database, private readonly adapter: QvacAdapter, private readonly registry: ToolRegistry) {}

  async run(caseId: string): Promise<AgentControllerResult> {
    const runs = new AgentRunRepository(this.db);
    const runId = runs.create({ caseId, model: config.QVAC_MODEL });
    const started = performance.now();
    const history: QvacMessage[] = [{ role: "user", content: `${controllerInstruction}\nContexto del caso: ${await buildCaseContext(this.db, caseId)}` }];
    let calls = 0;
    try {
      while (calls < 6) {
        let action: AgentAction;
        try {
          action = await this.adapter.completeJson(history, agentActionSchema);
        } catch (firstError) {
          history.push({ role: "user", content: `El formato anterior fue inválido. Corrígelo una sola vez y devuelve solo JSON. Error: ${firstError instanceof Error ? firstError.message : "formato inválido"}` });
          try { action = await this.adapter.completeJson(history, agentActionSchema); } catch (secondError) {
            const message = secondError instanceof Error ? secondError.message : "Formato inválido";
            runs.finish(runId, { status: "failed", callsCount: calls, latencyMs: Math.round(performance.now() - started), error: "AGENT_FORMAT_ERROR" });
            return { action: { type: "message", text: `No se pudo interpretar la respuesta del agente: ${message}`, questionCount: 0 }, calls, runId };
          }
        }
        if (action.type === "tool_call") {
          const tool = this.registry.get(action.tool);
          if (!tool) throw new Error("Herramienta no registrada");
          const result = await tool.execute(action.args, { db: this.db, procedure: await import("../tools/search-procedure.js").then((module) => module.ProcedureSearch.load()) } satisfies ToolContext);
          calls += 1;
          history.push({ role: "assistant", content: JSON.stringify(action) }, { role: "user", content: `Resultado de ${action.tool}: ${JSON.stringify(result)}` });
          continue;
        }
        if (action.type === "finish") {
          const actual = this.db.prepare("SELECT status FROM cases WHERE id = ?").get(caseId) as { status: string } | undefined;
          if (!actual || actual.status !== action.status) throw new Error("El estado final no fue validado por código");
        }
        runs.finish(runId, { status: "completed", callsCount: calls, latencyMs: Math.round(performance.now() - started) });
        return { action, calls, runId };
      }
      runs.finish(runId, { status: "completed", callsCount: calls, latencyMs: Math.round(performance.now() - started) });
      return { action: { type: "message", text: "El caso requiere continuar la revisión con las herramientas disponibles.", questionCount: 0 }, calls, runId };
    } catch (error) {
      runs.finish(runId, { status: "failed", callsCount: calls, latencyMs: Math.round(performance.now() - started), error: error instanceof Error ? error.message : "Error del agente" });
      throw error;
    }
  }
}
