import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrations.js";

export class LocalDatabase {
  readonly db: Database.Database;

  constructor(filename = ".qvac/expediente.db") {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }
}
