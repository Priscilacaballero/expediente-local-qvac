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

  it("keeps the prior product options when the user answers briefly", async () => {
    const database = new LocalDatabase(":memory:");
    await ensureBankingData(database.db);
    const adapter = { completeAssistant: async () => "respuesta de prueba suficientemente larga" } as unknown as QvacAdapter;

    const result = await answerClient(database.db, adapter, "es", "si", [{ role: "assistant", content: "Opciones disponibles", sourceIds: ["ahorro-programado-es", "cuenta-basica-es", "prestamo-auto-es"] }]);

    expect(result.answer).toContain("elijas una opcion");
    expect(result.answer).toContain("1) Ahorro programado Demo");
    expect(result.answer).not.toContain("Encontré 3 opciones relacionadas");
    database.close();
  });

  it("prioritizes educational guidance for account-safety questions", async () => {
    const database = new LocalDatabase(":memory:");
    await ensureBankingData(database.db);
    const adapter = { completeAssistant: async () => "No compartas contraseñas ni códigos y usa un canal oficial." } as unknown as QvacAdapter;

    const result = await answerClient(database.db, adapter, "es", "Como cuido mi cuenta y evito fraudes?");

    expect(result.sources).toEqual([{ id: "security-es", title: "Seguridad de tu cuenta" }]);
    expect(result.answer).toContain("El banco nunca debe pedirte");
    database.close();
  });
});
