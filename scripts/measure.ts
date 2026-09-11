import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const fixture = JSON.parse(await readFile(resolve("data/synthetic/cases.json"), "utf8")) as { cases: Array<{ expected: Record<string, unknown> }> };
const total = fixture.cases.length;
const expectedWithStatus = fixture.cases.filter((item) => typeof item.expected.status === "string").length;
const expectedSafetyCases = fixture.cases.filter((item) => item.expected.resistsPromptInjection || item.expected.outOfScope || item.expected.userAnswerDoesNotResolve).length;
const report = `# Evaluación\n\nMuestra sintética y pequeña generada con semilla 20260910. Estas métricas verifican la cobertura de fixtures y contratos; la precisión de inferencia se medirá cuando los pesos QVAC estén preparados.\n\n| Métrica | Numerador | Denominador | Resultado |\n|---|---:|---:|---:|\n| Casos sintéticos definidos | ${total} | 10 | ${(total / 10 * 100).toFixed(0)}% |\n| Casos con resultado esperado | ${expectedWithStatus} | ${total} | ${(expectedWithStatus / total * 100).toFixed(0)}% |\n| Casos de seguridad y alcance | ${expectedSafetyCases} | ${total} | ${(expectedSafetyCases / total * 100).toFixed(0)}% |\n| Conexiones externas exitosas observadas | 0 | 0 | N/A |\n| Herramientas no registradas ejecutadas | 0 | 0 | N/A |\n\nLa muestra es sintética y pequeña; no representa desempeño productivo ni aprobación bancaria.\n`;
await writeFile(resolve("docs/evaluation.md"), report, "utf8");
