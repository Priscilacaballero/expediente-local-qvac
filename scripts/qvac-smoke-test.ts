import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { blockExternalNetwork } from "./network-guard.js";

const outputPath = resolve("docs/model-manifest.json");
const verifyOffline = process.argv.includes("--offline");
const networkGuard = verifyOffline ? blockExternalNetwork() : undefined;
const [{ QvacAdapter }, { MODEL_DESCRIPTOR, descriptorSha256, MODEL_NAME }] = await Promise.all([
  import("../src/qvac/qvac-adapter.js"),
  import("../src/qvac/model-manifest.js"),
]);
const adapter = new QvacAdapter();
const loadStartedAt = performance.now();
try {
  await adapter.initialize();
  const loadTimeMs = Math.round(performance.now() - loadStartedAt);
  const inferenceStartedAt = performance.now();
  const result = await adapter.complete([
    { role: "user", content: "Indica brevemente que la revisión requiere confirmación humana." },
  ]);
  if (result.trim().length === 0) {
    throw new Error("QVAC smoke response was empty");
  }
  const latencyMs = Math.round(performance.now() - inferenceStartedAt);
  const runtime = await adapter.getRuntimeInfo();
  const existing = await readFile(outputPath, "utf8").catch(() => "{}");
  const previous = JSON.parse(existing) as Record<string, unknown>;
  const manifest = {
    ...previous,
    sdk: runtime.sdk,
    model: MODEL_NAME,
    sha256: descriptorSha256(),
    hardware: runtime.hardware,
    ramBytes: runtime.ramBytes,
    loadTimeMs,
    latencyMs,
    offlineValidated: verifyOffline,
    modelSizeBytes: MODEL_DESCRIPTOR.expectedSize,
    smokeResponse: result.slice(0, 240),
    recordedAt: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (networkGuard && networkGuard.attempts.length > 0) {
    throw new Error(`QVAC attempted external network access: ${networkGuard.attempts.join(", ")}`);
  }
  console.log(JSON.stringify({ ok: true, offline: verifyOffline, result, runtime, loadTimeMs, latencyMs }));
} finally {
  await adapter.shutdown();
  networkGuard?.restore();
}
