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
  `CREATE TABLE IF NOT EXISTS document_pages (
    document_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    PRIMARY KEY (document_id, page),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  )`,
  `ALTER TABLE field_candidates ADD COLUMN source_page INTEGER`,
  `ALTER TABLE field_candidates ADD COLUMN source_quote TEXT`,
  `CREATE TABLE IF NOT EXISTS product_catalog (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL CHECK (language IN ('es', 'en')),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    audience TEXT NOT NULL,
    requirements TEXT NOT NULL,
    version TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_catalog_language ON product_catalog(language)`,
  `CREATE TABLE IF NOT EXISTS education_guides (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL CHECK (language IN ('es', 'en')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT NOT NULL,
    version TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orientation_requests (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('es', 'en')),
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_human_review', 'closed')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES product_catalog(id)
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_ref TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    beneficiary TEXT NOT NULL,
    channel TEXT NOT NULL,
    country TEXT NOT NULL,
    synthetic INTEGER NOT NULL CHECK (synthetic = 1)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_customer_time ON transactions(customer_ref, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS risk_alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    transaction_ids TEXT NOT NULL,
    evidence TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status = 'pending_human_review'),
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS procedure_answers (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('es', 'en')),
    answer TEXT NOT NULL,
    source_rule_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `ALTER TABLE product_catalog ADD COLUMN search_terms TEXT NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS platform_workspaces (
    id TEXT PRIMARY KEY,
    use_case TEXT NOT NULL,
    role TEXT NOT NULL,
    case_id TEXT,
    last_action TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_activity (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    use_case TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    human_review TEXT NOT NULL CHECK (human_review IN ('not_required', 'pending', 'completed')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES platform_workspaces(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_platform_activity_created_at ON platform_activity(created_at)`,
] as const;

export function runMigrations(db: Database.Database): void {
  const migrate = db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
    const applied = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    const appliedVersions = new Set(applied.map(({ version }) => version));
    migrationStatements.forEach((statement, index) => {
      const version = index + 1;
      if (appliedVersions.has(version)) return;
      try {
        db.exec(statement);
      } catch (error) {
        if (!(statement.startsWith("ALTER TABLE") && error instanceof Error && error.message.includes("duplicate column name"))) throw error;
      }
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
    });
  });
  migrate();
}
