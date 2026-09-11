import type Database from "better-sqlite3";

const migrationStatements = [
  `CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('nuevo', 'documentos_cargados', 'analizando', 'requiere_datos', 'requiere_revision', 'listo_para_revision')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    document_type TEXT,
    page_count INTEGER,
    text_content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id)`,
  `CREATE TABLE IF NOT EXISTS field_candidates (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    document_id TEXT,
    field_key TEXT NOT NULL,
    value_text TEXT,
    normalized_value TEXT,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'candidate', 'missing', 'conflict', 'user_reported')),
    confidence REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_field_candidates_case_id ON field_candidates(case_id)`,
  `CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    document_id TEXT,
    page INTEGER,
    quote TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_findings_case_id ON findings(case_id)`,
  `CREATE TABLE IF NOT EXISTS user_answers (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    value_text TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_answers_case_id ON user_answers(case_id)`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    model TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider = 'QVAC local'),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    latency_ms INTEGER,
    calls_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_case_id ON agent_runs(case_id)`,
] as const;

export function runMigrations(db: Database.Database): void {
  const migrate = db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
    const applied = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    const appliedVersions = new Set(applied.map(({ version }) => version));
    migrationStatements.forEach((statement, index) => {
      const version = index + 1;
      if (appliedVersions.has(version)) return;
      db.exec(statement);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
    });
  });
  migrate();
}
