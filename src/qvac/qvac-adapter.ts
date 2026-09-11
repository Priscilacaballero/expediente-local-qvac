import {
  completion,
  ocr,
  getLoadedModelInfo,
  getSystemResources,
  loadModel,
  unloadModel,
  type CompletionParams,
} from "@qvac/sdk";
import { z } from "zod";
import { config } from "../config.js";
import { DOCUMENT_MODEL_MANIFEST, MODEL_DESCRIPTOR, MODEL_NAME, OCR_MODEL_NAME, VISION_MODEL_NAME } from "./model-manifest.js";
import { CLIENT_ASSISTANT_SYSTEM_PROMPT, JSON_RESPONSE_INSTRUCTION, SYSTEM_PROMPT } from "./prompts.js";

export type QvacMessage = CompletionParams["history"][number];

export type QvacRuntimeInfo = {
  provider: "QVAC local";
  model: typeof MODEL_NAME;
  modelId: string | null;
  host: typeof config.HOST;
  port: typeof config.PORT;
  ready: boolean;
  sdk: string;
  hardware: string | null;
  ramBytes: number | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>).value;
}

export function extractRuntimeResources(resources: unknown): Pick<QvacRuntimeInfo, "hardware" | "ramBytes"> {
  if (!resources || typeof resources !== "object") return { hardware: null, ramBytes: null };
  const record = resources as Record<string, unknown>;
  const capabilities = record.capabilities;
  if (!capabilities || typeof capabilities !== "object") return { hardware: null, ramBytes: null };
  const capabilityRecord = capabilities as Record<string, unknown>;
  const memory = capabilityRecord.memory;
  const totalBytes = memory && typeof memory === "object"
    ? (memory as Record<string, unknown>).totalBytes
    : undefined;
  const totalValue = metricValue(totalBytes);
  const cpu = capabilityRecord.cpu;
  const cpuValue = metricValue(cpu);
  const cpuName = metricValue(cpuValue && typeof cpuValue === "object"
    ? (cpuValue as Record<string, unknown>).name
    : undefined);
  return {
    hardware: typeof cpuName === "string" ? cpuName : null,
    ramBytes: asNumber(totalValue),
  };
}

export class QvacAdapter {
  private modelId: string | null = null;
  private ocrModelId: string | null = null;
  private visionModelId: string | null = null;
  private initialized = false;
  private readonly sdkVersion = "0.19.0";

  async initialize(): Promise<void> {
    await this.initializeText();
  }

  async initializeText(): Promise<void> {
    if (this.initialized && this.modelId) return;
    this.modelId = await loadModel({ modelSrc: MODEL_DESCRIPTOR, modelConfig: { ctx_size: 4096 } });
    this.initialized = true;
  }

  async initializeOcr(): Promise<void> {
    if (this.ocrModelId) return;
    this.ocrModelId = await loadModel({ modelSrc: DOCUMENT_MODEL_MANIFEST.ocr.descriptor, modelConfig: { langList: ["en", "es"] } });
  }

  async initializeVision(): Promise<void> {
    if (this.visionModelId) return;
    this.visionModelId = await loadModel({ modelSrc: DOCUMENT_MODEL_MANIFEST.vision.descriptor, modelConfig: { ctx_size: 2048, projectionModelSrc: DOCUMENT_MODEL_MANIFEST.mmproj.descriptor } });
  }

  async ocr(image: Buffer): Promise<Array<{ text: string; bbox: [number, number, number, number] | null; confidence: number | null }>> {
    if (!this.ocrModelId) throw new Error(`${OCR_MODEL_NAME} no está preparado`);
    const result = await ocr({ modelId: this.ocrModelId, image: Buffer.from(image) as never });
    return (await result.blocks).map(block => ({ text: block.text, bbox: block.bbox ?? null, confidence: block.confidence ?? null }));
  }

  async analyzeImage(imagePath: string, prompt: string): Promise<string> {
    if (!this.visionModelId) throw new Error(`${VISION_MODEL_NAME} no está preparado`);
    const run = completion({ modelId: this.visionModelId, history: [{ role: "user", content: prompt, attachments: [{ path: imagePath }] }], stream: false });
    return (await run.final).contentText;
  }

  getCapabilities(): { text: boolean; ocr: boolean; vision: boolean; models: { text: string; ocr: string; vision: string; mmproj: string } } {
    return { text: this.isReady(), ocr: this.ocrModelId !== null, vision: this.visionModelId !== null, models: { text: MODEL_NAME, ocr: OCR_MODEL_NAME, vision: VISION_MODEL_NAME, mmproj: DOCUMENT_MODEL_MANIFEST.mmproj.model } };
  }

  async complete(history: QvacMessage[]): Promise<string> {
    if (!this.modelId) throw new Error("QVAC model is not initialized");
    const run = completion({
      modelId: this.modelId,
      history: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      stream: false,
    });
    const result = await run.final;
    return result.contentText;
  }

  async completeAssistant(history: QvacMessage[]): Promise<string> {
    if (!this.modelId) throw new Error("QVAC model is not initialized");
    const run = completion({ modelId: this.modelId, history: [{ role: "system", content: CLIENT_ASSISTANT_SYSTEM_PROMPT }, ...history], stream: false });
    const result = await run.final;
    return result.contentText;
  }

  async completeJson<T>(history: QvacMessage[], schema: z.ZodType<T>): Promise<T> {
    const response = await this.complete([
      ...history,
      { role: "user", content: JSON_RESPONSE_INSTRUCTION },
    ]);
    const normalized = response.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
    const candidates = [normalized];
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start >= 0 && end > start) candidates.push(normalized.slice(start, end + 1));
    let parseError: unknown;
    for (const candidate of candidates) {
      try { return schema.parse(JSON.parse(candidate)); } catch (error) { parseError = error; }
    }
    throw new Error(`QVAC returned invalid JSON: ${response.slice(0, 240)}`, { cause: parseError });
  }

  async getRuntimeInfo(): Promise<QvacRuntimeInfo> {
    let resources: unknown = undefined;
    try {
      resources = await getSystemResources({ sample: true });
    } catch {
      resources = undefined;
    }
    return {
      provider: "QVAC local",
      model: MODEL_NAME,
      modelId: this.modelId,
      host: config.HOST,
      port: config.PORT,
      ready: this.isReady(),
      sdk: this.sdkVersion,
      ...extractRuntimeResources(resources),
    };
  }

  isReady(): boolean {
    return this.initialized && this.modelId !== null;
  }

  async shutdown(): Promise<void> {
    if (this.modelId) await unloadModel({ modelId: this.modelId });
    if (this.ocrModelId) await unloadModel({ modelId: this.ocrModelId });
    if (this.visionModelId) await unloadModel({ modelId: this.visionModelId });
    this.modelId = null;
    this.ocrModelId = null;
    this.visionModelId = null;
    this.initialized = false;
  }

  async shutdownAll(): Promise<void> { await this.shutdown(); }

  async getLoadedModelInfo(): Promise<unknown> {
    if (!this.modelId) return null;
    return getLoadedModelInfo({ modelId: this.modelId });
  }
}
