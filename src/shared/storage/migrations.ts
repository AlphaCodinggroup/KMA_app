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
]
