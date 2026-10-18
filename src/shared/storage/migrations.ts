export interface Migration {
  id: number
  name: string
  up: string
}

/**
 * MIGRACIÓN 0001 — Esquema inicial
 * - flows, flow_steps: catálogo y definición de pasos por flow
 * - submissions: envíos locales
 * - outbox: cola offline (patrón outbox)
 * - Índices pragmáticos mínimos
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'init_schema_v1',
    up: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        stepsCount INTEGER
      );

      CREATE TABLE IF NOT EXISTS flow_steps (
        flow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        step_json TEXT NOT NULL,
        PRIMARY KEY (flow_id, step_id),
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        has_files INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        file_paths_json TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL
      );

      -- Índices útiles
      CREATE INDEX IF NOT EXISTS idx_flow_steps_flow ON flow_steps(flow_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_sync ON submissions(synced, created_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);
    `,
  },
  {
    id: 2,
    name: 'add_projects_facilities_cache_v1',
    up: `
      -- Cache local de proyectos
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,           -- project_id
        code TEXT,
        name TEXT,
        description TEXT,
        status TEXT,                   -- 'ACTIVE' | 'ARCHIVED' (tal cual backend)
        user_ids_json TEXT,            -- JSON.stringify(string[])
        facility_ids_json TEXT,        -- JSON.stringify(string[])
        created_at TEXT,
        updated_at TEXT,
        created_by TEXT
      );

      -- Cache local de facilities
      CREATE TABLE IF NOT EXISTS facilities (
        id TEXT PRIMARY KEY,           -- facility_id
        project_id TEXT,               -- FK opcional al proyecto
        name TEXT,
        address TEXT,
        city TEXT,
        geo_lat REAL,                  -- geo.lat
        geo_lng REAL,                  -- geo.lng
        notes TEXT,
        status TEXT,                   -- 'ACTIVE' | 'ARCHIVED'
        user_ids_json TEXT,            -- JSON.stringify(string[] | null)
        created_at TEXT,
        updated_at TEXT,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Índices útiles para filtros y relaciones
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

      CREATE INDEX IF NOT EXISTS idx_facilities_project ON facilities(project_id);
      CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
    `,
  },
  {
    id: 3,
    name: 'add_flow_metadata_columns_v1',
    up: `
      -- Metadatos adicionales para flows (para selector offline)
      ALTER TABLE flows ADD COLUMN flowType TEXT;
      ALTER TABLE flows ADD COLUMN isActive INTEGER;
      ALTER TABLE flows ADD COLUMN createdAt TEXT;
      ALTER TABLE flows ADD COLUMN updatedAt TEXT;
    `,
  },
  {
    id: 4,
    name: 'outbox_submission_states_v1',
    up: `
      -- Estado de submissions: draft | queued | failed | legacy
      ALTER TABLE submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy';
      ALTER TABLE submissions ADD COLUMN last_error TEXT;
      ALTER TABLE submissions ADD COLUMN user_id TEXT;
      ALTER TABLE submissions ADD COLUMN updated_at INTEGER;

      -- Estado del outbox: pending | failed
      ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER;
      ALTER TABLE outbox ADD COLUMN user_id TEXT;

      -- Submissions con item en outbox pasan a 'queued'; el resto queda 'legacy'
      UPDATE submissions SET status = 'queued'
        WHERE id IN (SELECT json_extract(payload_json, '$.submissionId') FROM outbox);

      CREATE INDEX IF NOT EXISTS idx_outbox_ready ON outbox(status, next_attempt_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, flow_id);
    `,
  },
  {
    id: 5,
    name: 'submissions_without_flow_fk_v1',
    up: `
      -- submissions tenía FOREIGN KEY (flow_id) ... ON DELETE CASCADE: al refrescar o podar el
      -- catálogo de flows se borraban drafts y auditorías pendientes. Se recrea la tabla sin FK.
      CREATE TABLE submissions_new (
        id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        has_files INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'legacy',
        last_error TEXT,
        user_id TEXT,
        updated_at INTEGER
      );

      INSERT INTO submissions_new (
        id, flow_id, step_id, payload_json, has_files, synced, created_at,
        status, last_error, user_id, updated_at
      )
      SELECT
        id, flow_id, step_id, payload_json, has_files, synced, created_at,
        status, last_error, user_id, updated_at
      FROM submissions;

      DROP TABLE submissions;
      ALTER TABLE submissions_new RENAME TO submissions;

      CREATE INDEX IF NOT EXISTS idx_submissions_sync ON submissions(synced, created_at);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, flow_id);
    `,
  },
  {
    id: 6,
    name: 'audit_v2_state_v1',
    up: `
      -- Estado local del ciclo de vida V2 (RFC Auditorías V2). Las filas existentes quedan en
      -- pipeline 'v1': siguen por el camino actual. Nada escribe estas columnas con AUDITS_V2 apagado.
      ALTER TABLE submissions ADD COLUMN audit_id TEXT;            -- id generado por el móvil (BE-7)
      ALTER TABLE submissions ADD COLUMN server_version INTEGER;   -- versión confirmada por backend
      ALTER TABLE submissions ADD COLUMN server_status TEXT;       -- audit_in_progress | draft_report_pending_review | ...
      ALTER TABLE submissions ADD COLUMN pipeline TEXT NOT NULL DEFAULT 'v1'; -- v1 | v2
      ALTER TABLE submissions ADD COLUMN answer_sync_json TEXT;    -- { [step_id]: 'pending' | 'synced' }
      ALTER TABLE submissions ADD COLUMN deleted_step_ids_json TEXT; -- step_ids podados pendientes de confirmar

      -- Dependencias entre items del outbox (las usa C4)
      ALTER TABLE outbox ADD COLUMN depends_on TEXT;

      CREATE INDEX IF NOT EXISTS idx_submissions_audit ON submissions(audit_id);
    `,
  },
  {
    id: 7,
    name: 'add_photo_uploads_v1',
    up: `
      -- Una fila por foto capturada (8.M). Registra el archivo local y su estado de subida.
      CREATE TABLE IF NOT EXISTS photo_uploads (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        audit_id TEXT,
        step_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        upload_name TEXT NOT NULL,
        remote_url TEXT,
        s3_key TEXT,
        upload_url TEXT,
        expires_at INTEGER,              -- ms (backend lo envía en segundos)
        status TEXT NOT NULL,            -- pending | uploading | uploaded | failed
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_photo_uploads_status ON photo_uploads(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_photo_uploads_submission ON photo_uploads(submission_id);
    `,
  },
]
