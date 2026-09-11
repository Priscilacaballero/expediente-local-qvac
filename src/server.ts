import { buildApp } from "./app.js";
import { config } from "./config.js";
import { ensureSyntheticCases } from "./storage/synthetic-bootstrap.js";
const { app, dependencies } = await buildApp();
await ensureSyntheticCases(dependencies.db.db);
await dependencies.adapter.initialize();
await app.listen({ host: config.HOST, port: config.PORT });
const shutdown = async (): Promise<void> => { await app.close(); await dependencies.adapter.shutdown(); dependencies.db.close(); };
process.once("SIGINT", () => void shutdown()); process.once("SIGTERM", () => void shutdown());
