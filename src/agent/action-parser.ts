import { z } from "zod";
import { TOOL_NAMES } from "../tools/tool-registry.js";

const toolCallSchema = z.object({ type: z.literal("tool_call"), tool: z.enum(TOOL_NAMES), args: z.record(z.string(), z.unknown()), reason: z.string().min(1) });
const messageSchema = z.object({ type: z.literal("message"), text: z.string().min(1), questionCount: z.number().int().min(0).max(2) });
const finishSchema = z.object({ type: z.literal("finish"), status: z.enum(["requiere_datos", "requiere_revision", "listo_para_revision"]), summary: z.string().min(1) });
export const agentActionSchema = z.discriminatedUnion("type", [toolCallSchema, messageSchema, finishSchema]);
export type AgentAction = z.infer<typeof agentActionSchema>;
export function parseAgentAction(value: unknown): AgentAction { return agentActionSchema.parse(value); }
