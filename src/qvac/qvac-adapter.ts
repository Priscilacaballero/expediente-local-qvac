import {
  completion,
  getLoadedModelInfo,
  getSystemResources,
  loadModel,
  unloadModel,
  type CompletionParams,
} from "@qvac/sdk";
import { z } from "zod";
import { config } from "../config.js";
import { MODEL_DESCRIPTOR, MODEL_NAME } from "./model-manifest.js";
import { JSON_RESPONSE_INSTRUCTION, SYSTEM_PROMPT } from "./prompts.js";

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

function extractRuntimeResources(resources: unknown): Pick<QvacRuntimeInfo, "hardware" | "ramBytes"> {
  if (!resources || typeof resources !== "object") return { hardware: null, ramBytes: null };
  const record = resources as Record<string, unknown>;
  const capabilities = record.capabilities;
  if (!capabilities || typeof capabilities !== "object") return { hardware: null, ramBytes: null };
  const capabilityRecord = capabilities as Record<string, unknown>;
  const memory = capabilityRecord.memory;
  const totalBytes = memory && typeof memory === "object"
    ? (memory as Record<string, unknown>).totalBytes
    : undefined;
  const totalValue = totalBytes && typeof totalBytes === "object"
    ? (totalBytes as Record<string, unknown>).value
    : undefined;
  const cpu = capabilityRecord.cpu;
  const cpuName = cpu && typeof cpu === "object"
    ? (cpu as Record<string, unknown>).name
    : undefined;
  return {
    hardware: typeof cpuName === "string" ? cpuName : null,
    ramBytes: asNumber(totalValue),
  };
}

export class QvacAdapter {
  private modelId: string | null = null;
  private initialized = false;
  private readonly sdkVersion = "0.19.0";

  async initialize(): Promise<void> {
    if (this.initialized && this.modelId) return;
    this.modelId = await loadModel({ modelSrc: MODEL_DESCRIPTOR });
    this.initialized = true;
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

  async completeJson<T>(history: QvacMessage[], schema: z.ZodType<T>): Promise<T> {
    const response = await this.complete([
      ...history,
      { role: "user", content: JSON_RESPONSE_INSTRUCTION },
    ]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch (error) {
      throw new Error("QVAC returned invalid JSON", { cause: error });
    }
    return schema.parse(parsed);
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
    if (!this.modelId) return;
    await unloadModel({ modelId: this.modelId });
    this.modelId = null;
    this.initialized = false;
  }

  async getLoadedModelInfo(): Promise<unknown> {
    if (!this.modelId) return null;
    return getLoadedModelInfo({ modelId: this.modelId });
  }
}
