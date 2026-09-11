import { z } from "zod";

const configSchema = z.object({
  // Docker binds inside the container while the host mapping remains loopback-only.
  HOST: z.union([z.literal("127.0.0.1"), z.literal("0.0.0.0")]),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  QVAC_TEXT_MODEL: z.literal("LLAMA_3_2_1B_INST_Q4_0").default("LLAMA_3_2_1B_INST_Q4_0"),
  QVAC_MODEL: z.literal("LLAMA_3_2_1B_INST_Q4_0").default("LLAMA_3_2_1B_INST_Q4_0"),
  QVAC_VISION_MODEL: z.literal("VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M").default("VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M"),
  QVAC_VISION_MMPROJ: z.string().min(1).default("MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0"),
  QVAC_OCR_MODEL: z.literal("OCR_LATIN").default("OCR_LATIN"),
  QVAC_LOAD_DOCUMENT_MODELS: z.union([z.literal(true), z.literal(false), z.literal("true"), z.literal("false")]).transform(value => value === true || value === "true").default(false),
  MAX_DOCUMENT_SIZE_BYTES: z.coerce.number().int().positive().default(10_485_760),
});

export const config = configSchema.parse({
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: process.env.PORT ?? "4173",
  QVAC_TEXT_MODEL: process.env.QVAC_TEXT_MODEL ?? process.env.QVAC_MODEL ?? "LLAMA_3_2_1B_INST_Q4_0",
  QVAC_MODEL: process.env.QVAC_MODEL ?? "LLAMA_3_2_1B_INST_Q4_0",
  QVAC_VISION_MODEL: process.env.QVAC_VISION_MODEL ?? "VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M",
  QVAC_VISION_MMPROJ: process.env.QVAC_VISION_MMPROJ ?? "MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0",
  QVAC_OCR_MODEL: process.env.QVAC_OCR_MODEL ?? "OCR_LATIN",
  QVAC_LOAD_DOCUMENT_MODELS: process.env.QVAC_LOAD_DOCUMENT_MODELS ?? "false",
  MAX_DOCUMENT_SIZE_BYTES: process.env.MAX_DOCUMENT_SIZE_BYTES ?? "10485760",
});

export type AppConfig = typeof config;
