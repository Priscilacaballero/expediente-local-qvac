import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../src/config.js";
const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
checks.push({ name: "loopback", ok: config.HOST === "127.0.0.1", detail: config.HOST });
checks.push({ name: "fixed-port", ok: config.PORT === 4173, detail: String(config.PORT) });
checks.push({ name: "local-model", ok: config.QVAC_MODEL === "LLAMA_3_2_1B_INST_Q4_0", detail: config.QVAC_MODEL });
const procedure = JSON.parse(await readFile(resolve("data/procedures/procedure-v1.json"), "utf8")) as { procedureVersion?: string; rules?: unknown[] };
checks.push({ name: "local-procedure", ok: procedure.procedureVersion === "procedure-v1" && Array.isArray(procedure.rules), detail: procedure.procedureVersion ?? "missing" });
const cases = JSON.parse(await readFile(resolve("data/synthetic/cases.json"), "utf8")) as { cases?: unknown[]; synthetic?: boolean };
checks.push({ name: "synthetic-fixtures", ok: cases.synthetic === true && cases.cases?.length === 10, detail: String(cases.cases?.length ?? 0) });
const source = await readFile(resolve("src/qvac/qvac-adapter.ts"), "utf8");
checks.push({ name: "no-provider-fallback", ok: !source.includes("openai") && !source.includes("anthropic") && !source.includes("https://"), detail: "QVAC only" });
const uiSource = await readFile(resolve("src/ui/styles.css"), "utf8");
checks.push({ name: "no-external-ui-resources", ok: !uiSource.includes("http://") && !uiSource.includes("https://") && !uiSource.includes("@import"), detail: "UI resources are local" });
const manifestSource = await readFile(resolve("public/manifest.webmanifest"), "utf8");
const serviceWorker = await readFile(resolve("public/sw.js"), "utf8");
checks.push({ name: "pwa-local-shell", ok: manifestSource.includes("Centro Bancario Local") && serviceWorker.includes("qvac-local-v1") && !serviceWorker.includes("https://"), detail: "manifest and service worker are local" });
for (const fixtureName of ["banking-catalog.json", "education-guides.json", "transactions.json"]) {
  const fixture = JSON.parse(await readFile(resolve("data/synthetic", fixtureName), "utf8")) as { synthetic?: boolean };
  checks.push({ name: `synthetic-${fixtureName}`, ok: fixture.synthetic === true, detail: fixture.synthetic ? "synthetic" : "not synthetic" });
}
const manifest = JSON.parse(await readFile(resolve("docs/model-manifest.json"), "utf8")) as { offlineValidated?: boolean; loadTimeMs?: number | null; latencyMs?: number | null };
checks.push({ name: "local-smoke-recorded", ok: manifest.offlineValidated === true && typeof manifest.loadTimeMs === "number" && typeof manifest.latencyMs === "number", detail: `${manifest.loadTimeMs ?? "pending"}ms load / ${manifest.latencyMs ?? "pending"}ms inference` });
const failed = checks.filter((check) => !check.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
if (failed.length > 0) process.exitCode = 1;
