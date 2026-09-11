import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
import { fieldKeySchema } from "../types/domain.js";
export const recordUserAnswerInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/), fieldKey: fieldKeySchema, value: z.string().min(1), message: z.string().min(1) });
export async function recordUserAnswer(input: z.infer<typeof recordUserAnswerInputSchema>, context: ToolContext) { const id = randomUUID(); context.db.prepare("INSERT INTO user_answers (id, case_id, field_key, value_text, message, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, input.caseId, input.fieldKey, input.value, input.message, new Date().toISOString()); return { id, caseId: input.caseId, fieldKey: input.fieldKey, value: input.value, status: "user_reported" as const }; }
