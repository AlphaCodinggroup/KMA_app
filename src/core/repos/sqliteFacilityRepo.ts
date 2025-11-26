import type {
  Facility,
  FacilityId,
  FacilityStatus,
  ProjectId,
  GeoPoint,
} from '@entities/facility/model'
import { query, run, withTransaction } from '@shared/storage/db'

type FacilityRow = {
  id: string
  project_id: string | null
  name: string | null
  address: string | null
  city: string | null
  geo_lat: number | null
  geo_lng: number | null
  notes: string | null
  status: string | null
  user_ids_json: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

type ListFilter = {
  status?: FacilityStatus
  search?: string
}

/**
 * Repositorio SQLite para cachear Facilities.
 * Usa la tabla `facilities` creada en migrations.ts (id = 2).
 *
 * Igual que con projects: esto es capa de caché local, NO reemplaza
 * al repo HTTP. Después lo vamos a combinar en un repo “composite”.
 */
export const sqliteFacilityRepo = {
  /**
   * Upsert de muchas facilities en bloque.
   * Ideal para ir guardando cada página que viene de la API.
   */
  async upsertMany(items: Facility[]): Promise<void> {
    if (!items.length) return

    await withTransaction(async () => {
      for (const f of items) {
        await run(
          `
          INSERT OR REPLACE INTO facilities (
            id,
            project_id,
            name,
            address,
            city,
            geo_lat,
            geo_lng,
            notes,
            status,
            user_ids_json,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            f.id,
            f.projectId ?? null,
            f.name ?? null,
            f.address ?? null,
            f.city ?? null,
            f.geo?.lat ?? null,
            f.geo?.lng ?? null,
            f.notes ?? null,
            f.status ?? null, // 'ACTIVE' | 'ARCHIVED'
            JSON.stringify(f.userIds ?? []),
            f.createdAt ?? null,
            f.updatedAt ?? null,
            f.createdBy ?? null,
            f.updatedBy ?? null,
          ],
        )
      }
    })
  },

  /**
   * Reemplaza todas las facilities de un project dado.
   * Útil si querés hacer un “full refresh” del listado de un proyecto.
   */
  async replaceAllForProject(projectId: ProjectId, items: Facility[]): Promise<void> {
    await withTransaction(async () => {
      await run('DELETE FROM facilities WHERE project_id = ?', [projectId])

      if (!items.length) return

      for (const f of items) {
        await run(
          `
          INSERT OR REPLACE INTO facilities (
            id,
            project_id,
            name,
            address,
            city,
            geo_lat,
            geo_lng,
            notes,
            status,
            user_ids_json,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            f.id,
            f.projectId ?? projectId ?? null,
            f.name ?? null,
            f.address ?? null,
            f.city ?? null,
            f.geo?.lat ?? null,
            f.geo?.lng ?? null,
            f.notes ?? null,
            f.status ?? null,
            JSON.stringify(f.userIds ?? []),
            f.createdAt ?? null,
            f.updatedAt ?? null,
            f.createdBy ?? null,
            f.updatedBy ?? null,
          ],
        )
      }
    })
  },

  /**
   * Lista facilities cacheadas por proyecto, con filtros simples:
   * - status: 'ACTIVE' | 'ARCHIVED'
   * - search: substring en name (LIKE %search%)
   */
  async listByProjectCached(projectId: ProjectId, filter: ListFilter = {}): Promise<Facility[]> {
    const where: string[] = ['project_id = ?']
    const params = [projectId]

    if (filter.status) {
      where.push('status = ?')
      params.push(filter.status)
    }

    if (filter.search && filter.search.trim()) {
      where.push('name LIKE ?')
      params.push(`%${filter.search.trim()}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await query<FacilityRow>(
      `
      SELECT
        id,
        project_id,
        name,
        address,
        city,
        geo_lat,
        geo_lng,
        notes,
        status,
        user_ids_json,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM facilities
      ${whereSql}
      ORDER BY name ASC
    `,
      params,
    )

    return rows.map(mapRowToDomain)
  },

  /**
   * Devuelve una facility por ID desde la cache local.
   */
  async getById(id: FacilityId): Promise<Facility | null> {
    const rows = await query<FacilityRow>(
      `
      SELECT
        id,
        project_id,
        name,
        address,
        city,
        geo_lat,
        geo_lng,
        notes,
        status,
        user_ids_json,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM facilities
      WHERE id = ?
      LIMIT 1
    `,
      [id],
    )

    if (!rows.length) return null
    return mapRowToDomain(rows[0])
  },

  /**
   * Elimina todas las facilities de la cache local.
   * Útil en logout o para un reset completo.
   */
  async clearAll(): Promise<void> {
    await run('DELETE FROM facilities')
  },

  /**
   * Elimina sólo las facilities de un proyecto específico.
   */
  async clearByProject(projectId: ProjectId): Promise<void> {
    await run('DELETE FROM facilities WHERE project_id = ?', [projectId])
  },
}

// ----------------------
// Helpers privados
// ----------------------

function mapRowToDomain(row: FacilityRow): Facility {
  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    name: row.name ?? '',
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    geo: toGeoPoint(row.geo_lat, row.geo_lng),
    notes: row.notes ?? undefined,
    status: normalizeStatus(row.status),
    userIds: parseUserIds(row.user_ids_json),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  }
}

function toGeoPoint(lat: number | null, lng: number | null): GeoPoint | undefined {
  if (lat == null || lng == null) return undefined
  return { lat, lng }
}

function normalizeStatus(value: string | null): FacilityStatus | undefined {
  if (!value) return undefined
  // Dominio usa 'ACTIVE' | 'ARCHIVED'
  if (value === 'ACTIVE' || value === 'ARCHIVED') return value as FacilityStatus
  // Por si en algún momento se guarda en lower-case
  const upper = value.toUpperCase()
  if (upper === 'ACTIVE' || upper === 'ARCHIVED') {
    return upper as FacilityStatus
  }
  return undefined
}

function parseUserIds(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string')
    }
    return []
  } catch {
    return []
  }
}
