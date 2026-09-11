import { createHash } from "node:crypto";
import { LLAMA_3_2_1B_INST_Q4_0, VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, OCR_LATIN } from "@qvac/sdk";

export const MODEL_NAME = "LLAMA_3_2_1B_INST_Q4_0" as const;
export const MODEL_DESCRIPTOR = LLAMA_3_2_1B_INST_Q4_0;
export const VISION_MODEL_NAME = "VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M" as const;
export const VISION_MODEL_DESCRIPTOR = VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M;
export const VISION_MMPROJ_NAME = "MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0" as const;
export const VISION_MMPROJ_DESCRIPTOR = MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0;
export const OCR_MODEL_NAME = "OCR_LATIN" as const;
export const OCR_MODEL_DESCRIPTOR = OCR_LATIN;

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
  contextSize?: number;
  smokeResponse?: string;
  recordedAt: string | null;
  roles?: Record<string, { model: string; sha256: string; expectedSize: number; prepared: boolean; validatedAt: string | null }>;
};

export function descriptorSha256(): string {
  return MODEL_DESCRIPTOR.sha256Checksum;
}

export function manifestFingerprint(): string {
  return createHash("sha256")
    .update(`${MODEL_NAME}:${descriptorSha256()}`)
    .digest("hex");
}

export const DOCUMENT_MODEL_MANIFEST = {
  text: { model: MODEL_NAME, descriptor: MODEL_DESCRIPTOR },
  vision: { model: VISION_MODEL_NAME, descriptor: VISION_MODEL_DESCRIPTOR },
  mmproj: { model: VISION_MMPROJ_NAME, descriptor: VISION_MMPROJ_DESCRIPTOR },
  ocr: { model: OCR_MODEL_NAME, descriptor: OCR_MODEL_DESCRIPTOR },
} as const;
