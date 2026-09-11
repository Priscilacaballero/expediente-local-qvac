import { createHash } from "node:crypto";
import { LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";

export const MODEL_NAME = "LLAMA_3_2_1B_INST_Q4_0" as const;
export const MODEL_DESCRIPTOR = LLAMA_3_2_1B_INST_Q4_0;

export type ModelManifest = {
  sdk: string;
  model: string;
  sha256: string;
  hardware: string | null;
  ramBytes: number | null;
  loadTimeMs: number | null;
  latencyMs: number | null;
  offlineValidated: boolean;
  modelSizeBytes: number;
  smokeResponse?: string;
  recordedAt: string | null;
};

export function descriptorSha256(): string {
  return MODEL_DESCRIPTOR.sha256Checksum;
}

export function manifestFingerprint(): string {
  return createHash("sha256")
    .update(`${MODEL_NAME}:${descriptorSha256()}`)
    .digest("hex");
}
