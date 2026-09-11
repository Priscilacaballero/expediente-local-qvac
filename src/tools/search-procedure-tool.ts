import { z } from "zod";
import type { ToolContext } from "./tool-registry.js";
export const searchProcedureInputSchema = z.object({ caseId: z.string().regex(/^case-[0-9]{4}$/), query: z.string().min(1).max(500) });
export async function searchProcedureTool(input: z.infer<typeof searchProcedureInputSchema>, context: ToolContext) { return context.procedure.search(input.query); }
