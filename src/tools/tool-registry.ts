import { z } from "zod";
import type Database from "better-sqlite3";
import type { ProcedureSearch } from "./search-procedure.js";
import { listDocuments, listDocumentsInputSchema } from "./list-documents.js";
import { readDocument, readDocumentInputSchema } from "./read-document.js";
import { extractFields, extractFieldsInputSchema } from "./extract-fields.js";
import { searchProcedureTool, searchProcedureInputSchema } from "./search-procedure-tool.js";
import { validateCase, validateCaseInputSchema } from "./validate-case.js";
import { recordUserAnswer, recordUserAnswerInputSchema } from "./record-user-answer.js";
import { prepareReport, prepareReportInputSchema } from "./prepare-report.js";

export type ToolContext = { db: Database.Database; procedure: ProcedureSearch };
export type RegisteredTool = { name: string; description: string; parameters: z.ZodType; execute: (args: unknown, context: ToolContext) => Promise<unknown> };

export const TOOL_NAMES = ["list_documents", "read_document", "extract_fields", "search_procedure", "validate_case", "record_user_answer", "prepare_report"] as const;

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor() {
    this.register({ name: "list_documents", description: "Lista los documentos del caso.", parameters: listDocumentsInputSchema, execute: async (args, context) => listDocuments(listDocumentsInputSchema.parse(args), context) });
    this.register({ name: "read_document", description: "Lee una página de un documento del caso.", parameters: readDocumentInputSchema, execute: async (args, context) => readDocument(readDocumentInputSchema.parse(args), context) });
    this.register({ name: "extract_fields", description: "Extrae candidatos de campos desde un documento.", parameters: extractFieldsInputSchema, execute: async (args, context) => extractFields(extractFieldsInputSchema.parse(args), context) });
    this.register({ name: "search_procedure", description: "Busca reglas del procedimiento local.", parameters: searchProcedureInputSchema, execute: async (args, context) => searchProcedureTool(searchProcedureInputSchema.parse(args), context) });
    this.register({ name: "validate_case", description: "Valida determinísticamente el caso.", parameters: validateCaseInputSchema, execute: async (args, context) => validateCase(validateCaseInputSchema.parse(args), context) });
    this.register({ name: "record_user_answer", description: "Registra una respuesta sin convertirla en evidencia.", parameters: recordUserAnswerInputSchema, execute: async (args, context) => recordUserAnswer(recordUserAnswerInputSchema.parse(args), context) });
    this.register({ name: "prepare_report", description: "Prepara un reporte factual desde SQLite.", parameters: prepareReportInputSchema, execute: async (args, context) => prepareReport(prepareReportInputSchema.parse(args), context) });
  }

  register(tool: RegisteredTool): void {
    if (!TOOL_NAMES.includes(tool.name as typeof TOOL_NAMES[number])) throw new Error(`Herramienta no autorizada: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  get(name: string): RegisteredTool | undefined { return this.tools.get(name); }
  names(): string[] { return [...this.tools.keys()]; }
}
