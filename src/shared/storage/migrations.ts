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
]
