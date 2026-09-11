import { z } from "zod";

export const agentRunStatusSchema = z.enum(["running", "completed", "failed"]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const agentRunSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  status: agentRunStatusSchema,
  model: z.string().min(1),
  provider: z.literal("QVAC local"),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  callsCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type AgentRun = z.infer<typeof agentRunSchema>;
