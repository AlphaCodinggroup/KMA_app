import type { Project, ProjectId, ProjectStatus } from '@entities/project/model'
import { createProject } from '@entities/project/model'
import { query, run, withTransaction } from '@shared/storage/db'

type ProjectRow = {
  id: string
  code: string | null
  name: string | null
  description: string | null
  status: string | null
  user_ids_json: string | null
  facility_ids_json: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
}

type ListFilter = {
  status?: ProjectStatus
  search?: string
}

/**
 * Repositorio SQLite para cachear Projects.
 * Usa la tabla `projects` creada en migrations.ts (id = 2).
 *
 * No reemplaza al repo HTTP; es una capa de caché que podremos usar
 * desde un ProjectRepo "combinado" o desde los hooks.
 */
export const sqliteProjectRepo = {
  /**
   * Upsert de muchos proyectos en una transacción.
   * Ideal para guardar páginas de resultados que vienen de la API.
   */
  async upsertMany(projects: Project[]): Promise<void> {
    if (!projects.length) return

    await withTransaction(async () => {
      for (const p of projects) {
        await run(
          `
          INSERT OR REPLACE INTO projects (
            id,
            code,
            name,
            description,
            status,
            user_ids_json,
            facility_ids_json,
            created_at,
            updated_at,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            p.id,
            p.code ?? null,
            p.name ?? null,
            p.description ?? null,
            // Guardamos status exactamente como en dominio: 'ACTIVE' | 'ARCHIVED'
            p.status ?? null,
            JSON.stringify(p.userIds ?? []),
            JSON.stringify(p.facilityIds ?? []),
            p.createdAt ?? null,
            p.updatedAt ?? null,
            p.createdBy ?? null,
          ],
        )
      }
    })
  },

  /**
   * Reemplaza todo el contenido de la tabla `projects` por la lista indicada.
   * Útil si en algún momento queremos hacer un "cold sync" completo.
   */
  async replaceAll(projects: Project[]): Promise<void> {
    await withTransaction(async () => {
      await run('DELETE FROM projects')
      if (!projects.length) return

      for (const p of projects) {
        await run(
          `
          INSERT OR REPLACE INTO projects (
            id,
            code,
            name,
            description,
            status,
            user_ids_json,
            facility_ids_json,
            created_at,
            updated_at,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            p.id,
            p.code ?? null,
            p.name ?? null,
            p.description ?? null,
            p.status ?? null,
            JSON.stringify(p.userIds ?? []),
            JSON.stringify(p.facilityIds ?? []),
            p.createdAt ?? null,
            p.updatedAt ?? null,
            p.createdBy ?? null,
          ],
        )
      }
    })
  },

  /**
   * Devuelve todos los proyectos cacheados, con filtros básicos:
   * - status: 'ACTIVE' | 'ARCHIVED'
   * - search: substring en name (LIKE %search%)
   */
  async listAll(filter: ListFilter = {}): Promise<Project[]> {
    const where: string[] = []
    const params: unknown[] = []

    if (filter.status) {
      where.push('status = ?')
      params.push(filter.status)
    }

    if (filter.search && filter.search.trim()) {
      where.push('name LIKE ?')
      params.push(`%${filter.search.trim()}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await query<ProjectRow>(
      `
      SELECT
        id,
        code,
        name,
        description,
        status,
        user_ids_json,
        facility_ids_json,
        created_at,
        updated_at,
        created_by
      FROM projects
      ${whereSql}
      ORDER BY created_at DESC, name ASC
    `,
      params,
    )

    return rows.map(mapRowToDomain)
  },

  /**
   * Devuelve un proyecto por ID desde la cache local.
   */
  async getById(id: ProjectId): Promise<Project | null> {
    const rows = await query<ProjectRow>(
      `
      SELECT
        id,
        code,
        name,
        description,
        status,
        user_ids_json,
        facility_ids_json,
        created_at,
        updated_at,
        created_by
      FROM projects
      WHERE id = ?
      LIMIT 1
    `,
      [id],
    )

    if (!rows.length) return null
    return mapRowToDomain(rows[0])
  },

  /**
   * Limpia completamente la tabla projects.
   * Útil en logout o si necesitás resetear la cache.
   */
  async clearAll(): Promise<void> {
    await run('DELETE FROM projects')
  },
}

// ----------------------
// Helpers privados
// ----------------------

function mapRowToDomain(row: ProjectRow): Project {
  return createProject({
    id: row.id,
    code: row.code ?? null,
    name: row.name ?? null,
    description: row.description ?? null,
    status: normalizeStatus(row.status) ?? 'ARCHIVED',
    userIds: parseIdArray(row.user_ids_json),
    facilityIds: parseIdArray(row.facility_ids_json),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    createdBy: row.created_by ?? undefined,
  })
}

function normalizeStatus(value: string | null): ProjectStatus | undefined {
  if (!value) return undefined
  const upper = value.toUpperCase()
  if (upper === 'ACTIVE' || upper === 'ARCHIVED') return upper as ProjectStatus

  return undefined
}

function parseIdArray(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')

    return []
  } catch {
    // Si está corrupto, preferimos devolver [] antes que romper la app.
    return []
  }
}
