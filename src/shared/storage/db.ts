import * as SQLite from 'expo-sqlite'
import { MIGRATIONS, type Migration } from './migrations'

/** Nombre del archivo físico de la DB. Si querés, exponerlo por env. */
const DB_NAME = 'kma.db'

/** Singleton de conexión. */
let _db: SQLite.SQLiteDatabase | null = null

/** Abre la DB una sola vez y devuelve el handle. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db

  const db = await SQLite.openDatabaseAsync(DB_NAME)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `)

  _db = db
  return db
}

/** Asegura que exista la tabla de migraciones antes de aplicar MIGRATIONS. */
async function ensureMigrationsTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)
}

/** Lee los IDs de migraciones ya aplicadas. */
async function getAppliedMigrationIds(db: SQLite.SQLiteDatabase): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM migrations ORDER BY id ASC')
  return new Set(rows.map(r => r.id))
}

/** Registra como aplicada una migración. */
async function markMigrationApplied(db: SQLite.SQLiteDatabase, m: Migration) {
  await db.runAsync('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)', [
    m.id,
    m.name,
    Date.now(),
  ])
}

/** Aplica las migraciones pendientes en una transacción atómica. */
export async function applyMigrations(): Promise<void> {
  const db = await getDb()
  await ensureMigrationsTable(db)

  const applied = await getAppliedMigrationIds(db)
  const pending = MIGRATIONS.filter(m => !applied.has(m.id)).sort((a, b) => a.id - b.id)

  if (pending.length === 0) return

  // Transacción manual para control fino (BEGIN/COMMIT/ROLLBACK).
  await db.execAsync('BEGIN IMMEDIATE;')
  try {
    for (const m of pending) {
      await db.execAsync(m.up)
      await markMigrationApplied(db, m)
    }
    await db.execAsync('COMMIT;')
  } catch (e) {
    await db.execAsync('ROLLBACK;')
    throw e
  }
}

/** Inicializa la DB */
export async function initDatabase(): Promise<void> {
  await getDb()
  await applyMigrations()
}

/** Helper de consulta: devuelve array tipado T para SELECTs. */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb()
  return db.getAllAsync<T>(sql, params)
}

/** Helper de mutación: INSERT/UPDATE/DELETE con info de cambios. */
export async function run(
  sql: string,
  params: any[] = [],
): Promise<{ changes: number; lastInsertRowId?: number }> {
  const db = await getDb()
  const res = await db.runAsync(sql, params)
  return { changes: res.changes, lastInsertRowId: (res as any).lastInsertRowId }
}

/** Ejecuta un bloque en transacción IMMEDIATE. */
export async function withTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb()
  await db.execAsync('BEGIN IMMEDIATE;')
  try {
    const result = await fn(db)
    await db.execAsync('COMMIT;')
    return result
  } catch (e) {
    await db.execAsync('ROLLBACK;')
    throw e
  }
}
