import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { QvacAdapter } from "../src/qvac/qvac-adapter.js";
import { descriptorSha256, MODEL_NAME } from "../src/qvac/model-manifest.js";

const outputPath = resolve("docs/model-manifest.json");
const smokeSchema = z.object({
  ok: z.literal(true),
  model: z.string(),
});

const adapter = new QvacAdapter();
const loadStartedAt = performance.now();
try {
  await adapter.initialize();
  const loadTimeMs = Math.round(performance.now() - loadStartedAt);
  const inferenceStartedAt = performance.now();
  const result = await adapter.completeJson(
    [{ role: "user", content: "Devuelve un objeto JSON con ok igual a true y model igual a LLAMA_3_2_1B_INST_Q4_0." }],
    smokeSchema,
  );
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
    recordedAt: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, result, runtime, loadTimeMs, latencyMs }));
} finally {
  await adapter.shutdown();
}
