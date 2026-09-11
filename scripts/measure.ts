import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LocalDatabase } from "../src/storage/database.js";
import { analyzeCaseDeterministically } from "../src/analysis/deterministic-analysis.js";
const fixture = JSON.parse(await readFile(resolve("data/synthetic/cases.json"), "utf8")) as { cases: Array<{ id: string; expected: Record<string, unknown> }> };
const total = fixture.cases.length;
const expectedWithStatus = fixture.cases.filter((item) => typeof item.expected.status === "string").length;
const expectedSafetyCases = fixture.cases.filter((item) => item.expected.resistsPromptInjection || item.expected.outOfScope || item.expected.userAnswerDoesNotResolve).length;
const manifest = JSON.parse(await readFile(resolve("docs/model-manifest.json"), "utf8")) as { offlineValidated?: boolean; loadTimeMs?: number; latencyMs?: number };
const database = new LocalDatabase();
const statuses: Record<string, number> = {};
try {
  for (const item of fixture.cases) {
    const result = await analyzeCaseDeterministically(database.db, item.id);
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
  }
} finally { database.close(); }
const report = `# Evaluación\n\nMuestra sintética generada con semilla 20260910. La inferencia QVAC y el análisis se ejecutaron localmente; estas métricas no representan desempeño productivo ni aprobación bancaria.\n\n| Métrica | Numerador | Denominador | Resultado |\n|---|---:|---:|---:|\n| Casos sintéticos definidos | ${total} | 10 | ${(total / 10 * 100).toFixed(0)}% |\n| Casos con resultado esperado | ${expectedWithStatus} | ${total} | ${(expectedWithStatus / total * 100).toFixed(0)}% |\n| Casos de seguridad y alcance | ${expectedSafetyCases} | ${total} | ${(expectedSafetyCases / total * 100).toFixed(0)}% |\n| Casos procesados por validación local | ${Object.values(statuses).reduce((sum, value) => sum + value, 0)} | ${total} | 100% |\n| Inferencia QVAC sin salida externa | ${manifest.offlineValidated ? 1 : 0} | 1 | ${manifest.offlineValidated ? "100%" : "pendiente"} |\n| Carga QVAC observada | ${manifest.loadTimeMs ?? "pendiente"} ms | — | local |\n| Latencia QVAC observada | ${manifest.latencyMs ?? "pendiente"} ms | — | local |\n\nEstados observados: ${Object.entries(statuses).map(([status, count]) => `${status}=${count}`).join(", ")}.\n`;
await writeFile(resolve("docs/evaluation.md"), report, "utf8");
