import { z } from "zod";

const configSchema = z.object({
  // Docker binds inside the container while the host mapping remains loopback-only.
  HOST: z.union([z.literal("127.0.0.1"), z.literal("0.0.0.0")]),
  PORT: z.coerce.number().int().min(1).max(65535).default(4173),
  QVAC_MODEL: z.literal("LLAMA_3_2_1B_INST_Q4_0").default("LLAMA_3_2_1B_INST_Q4_0"),
  MAX_DOCUMENT_SIZE_BYTES: z.coerce.number().int().positive().default(10_485_760),
});

export const config = configSchema.parse({
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: process.env.PORT ?? "4173",
  QVAC_MODEL: process.env.QVAC_MODEL ?? "LLAMA_3_2_1B_INST_Q4_0",
  MAX_DOCUMENT_SIZE_BYTES: process.env.MAX_DOCUMENT_SIZE_BYTES ?? "10485760",
});

export type AppConfig = typeof config;
