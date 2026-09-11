import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QvacAdapter } from "../src/qvac/qvac-adapter.js";
import { DOCUMENT_MODEL_MANIFEST } from "../src/qvac/model-manifest.js";
import { config } from "../src/config.js";

const manifestPath = resolve("docs/model-manifest.json");
const probePath = resolve(".qvac/document-assets/qvac-probe.png");
const probe = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const adapter = new QvacAdapter();
const started = performance.now();
try {
  await mkdir(resolve(".qvac/document-assets"), { recursive: true }); await writeFile(probePath, probe);
  await adapter.initializeText(); await adapter.initializeOcr(); await adapter.initializeVision();
  const ocrStarted = performance.now(); const ocrBlocks = await adapter.ocr(probe); const ocrMs = Math.round(performance.now() - ocrStarted);
  const visionStarted = performance.now(); const visualResult = await adapter.analyzeImage(probePath, "Describe únicamente si la imagen es legible. Responde brevemente."); const visionMs = Math.round(performance.now() - visionStarted);
  const runtime = await adapter.getRuntimeInfo(); const previous = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>; const roles = Object.fromEntries(Object.entries(DOCUMENT_MODEL_MANIFEST).map(([role, entry]) => [role, { model: entry.model, sha256: entry.descriptor.sha256Checksum, expectedSize: entry.descriptor.expectedSize, prepared: true, validatedAt: new Date().toISOString() }]));
  await writeFile(manifestPath, `${JSON.stringify({ ...previous, roles, documentRuntime: { ocrMs, visionMs, ocrBlocks: ocrBlocks.length, visualResponse: visualResult.slice(0, 160), host: config.HOST, ramBytes: runtime.ramBytes, preparedAt: new Date().toISOString() }, documentPreparationMs: Math.round(performance.now() - started) }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, runtime, ocrBlocks: ocrBlocks.length, ocrMs, visionMs, prepared: Object.keys(roles) }));
} finally { await adapter.shutdownAll(); }
