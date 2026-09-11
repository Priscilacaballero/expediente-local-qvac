import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import MiniSearch from "minisearch";
import { z } from "zod";

const ruleSchema = z.object({
  rule_id: z.string().min(1),
  title: z.string().min(1),
  requirement: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]),
  text: z.string().min(1),
});
const procedureSchema = z.object({ procedureVersion: z.string().min(1), rules: z.array(ruleSchema) });
export type ProcedureRule = z.infer<typeof ruleSchema>;
export type ProcedureSearchResult = ProcedureRule & { procedureVersion: string };
type IndexedRule = ProcedureRule & { id: string };

function rejectUnsafeQuery(query: string): void {
  if (/https?:\/\//iu.test(query) || /(?:^|[\\/])\.?(?:\.[\\/])?/u.test(query) && /[\\/]/u.test(query) || /[\u0000-\u001f\u007f]/u.test(query)) {
    throw new Error("La búsqueda solo admite texto de reglas locales");
  }
}

export class ProcedureSearch {
  private readonly procedureVersion: string;
  private readonly rules: ProcedureRule[];
  private readonly index: MiniSearch<IndexedRule>;

  private constructor(procedureVersion: string, rules: ProcedureRule[]) {
    this.procedureVersion = procedureVersion;
    this.rules = rules;
    this.index = new MiniSearch({ fields: ["rule_id", "title", "requirement", "severity", "text"], storeFields: ["rule_id", "title", "requirement", "severity", "text"] });
    this.index.addAll(rules.map((rule) => ({ ...rule, id: rule.rule_id })));
  }

  static async load(path = resolve("data/procedures/procedure-v1.json")): Promise<ProcedureSearch> {
    const parsed = procedureSchema.parse(JSON.parse(await readFile(path, "utf8")));
    return new ProcedureSearch(parsed.procedureVersion, parsed.rules);
  }

  search(query: string, limit = 5): ProcedureSearchResult[] {
    rejectUnsafeQuery(query);
    const safeLimit = Math.max(0, Math.min(5, Math.trunc(limit)));
    if (!query.trim()) return [];
    return this.index.search(query, { prefix: true, fuzzy: 0.2, combineWith: "OR" }).slice(0, safeLimit).map((result) => {
      const rule = this.rules.find(({ rule_id }) => rule_id === result.id);
      if (!rule) throw new Error("Resultado de procedimiento inválido");
      return { ...rule, procedureVersion: this.procedureVersion };
    });
  }
}
