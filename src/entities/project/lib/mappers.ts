import type {
  ProjectItemDTO,
  ProjectsListResponseDTO,
  ProjectDetailResponseDTO,
  ProjectStatusDTO,
} from '@entities/project/api/project.dto'
import {
  createProject,
  type Project,
  type ProjectsPage,
  type ProjectStatus,
} from '@entities/project/model'

/** Map de estado API → dominio */
function mapStatus(dto: ProjectStatusDTO): ProjectStatus {
  // Mantener defensa por si el backend agrega estados nuevos
  if (dto === 'ACTIVE' || dto === 'ARCHIVED') return dto

  return 'ARCHIVED'
}

/** DTO (snake_case) → Dominio (camelCase) */
export function mapProjectItemDto(dto: ProjectItemDTO): Project {
  return createProject({
    id: dto.project_id,
    name: dto.name ?? '',
    description: dto.description ?? null,
    status: mapStatus(dto.status ?? 'ARCHIVED'),
    users: (dto.users ?? []).map(u => ({
      id: u.id,
      name: u.name,
    })),
    facilities: (dto.facilities ?? []).map(f => ({
      // Si el DTO cambiara a `id`, esto lo hace más tolerante
      id: (f as any).facility_id ?? (f as any).id,
      name: f.name,
    })),
    createdAt: dto.created_at ?? undefined,
    updatedAt: dto.updated_at ?? undefined,
    createdBy: dto.created_by ?? undefined,
  })
}

/** Respuesta de listado → Página de dominio (items + cursor/limit) */
export function mapProjectsListResponseDto(dto: ProjectsListResponseDTO): ProjectsPage {
  const items = dto.data.projects.map(mapProjectItemDto)

  return {
    items,
    limit: dto.data.limit ?? items.length,
    // Si el backend no manda cursor, lo dejamos como undefined
    nextCursor: dto.data.cursor ?? undefined,
  }
}

/** Respuesta de detalle → Dominio */
export function mapProjectDetailResponseDto(dto: ProjectDetailResponseDTO): Project {
  return mapProjectItemDto(dto.data.project)
}
