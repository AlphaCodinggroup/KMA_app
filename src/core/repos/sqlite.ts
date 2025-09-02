/**
 * @file Capa fina de acceso a SQLite para Expo SDK 53 (API asíncrona).
 * Expone un singleton de base de datos y corre migraciones idempotentes.
 * - Usa `openDatabaseAsync` y `execAsync` (API moderna de `expo-sqlite`).
 * - Activa `PRAGMA journal_mode = WAL` para mejorar concurrencia/fiabilidad.
 */

import * as SQLite from 'expo-sqlite'

// Mantenemos una única instancia (singleton)
let _db: SQLite.SQLiteDatabase | null = null

/**
 * Obtiene una instancia única de la base de datos de la app.
 * Si ya existe, la reutiliza (patrón singleton).
 * @returns {Promise<SQLite.SQLiteDatabase>} Instancia abierta de la DB.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db
  _db = await SQLite.openDatabaseAsync('kma.db') // SDK 53
  return _db
}

/**
 * Ejecuta las migraciones necesarias de manera idempotente.
 * - Configura `journal_mode = WAL`.
 * - Crea las tablas `outbox` y `forms_local` si no existen.
 * @returns {Promise<void>} Promesa que resuelve al finalizar las migraciones.
 * @remarks
 * Debe llamarse una sola vez durante el arranque de la aplicación.
 */
export async function runMigrations(): Promise<void> {
  const db = await getDb()
  // Ejecutamos todo en un batch
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      filePath TEXT,
      createdAt INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT
    );

    CREATE TABLE IF NOT EXISTS forms_local (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `)
}
