import { describe, expect, it } from "vitest";
import { ensureBankingData } from "./banking-bootstrap.js";
import { answerClient } from "./local-assistant.js";
import { LocalDatabase } from "../storage/database.js";
import type { QvacAdapter } from "../qvac/qvac-adapter.js";

describe("local assistant answers", () => {
  it("redacts raw catalog metadata and responds naturally about a product", async () => {
    const database = new LocalDatabase(":memory:");
    await ensureBankingData(database.db);
    const adapter = { completeAssistant: async () => "respuesta de prueba suficientemente larga" } as unknown as QvacAdapter;

    const result = await answerClient(database.db, adapter, "es", "¿Cómo funciona el ahorro programado?");

    expect(result.answer).toContain("Encontré una opción relacionada");
    expect(result.answer).not.toContain("Público:");
    expect(result.answer).not.toContain("Requisitos de demostración:");
    expect(result.sources.length).toBeGreaterThan(0);
    database.close();
  });
});
