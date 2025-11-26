import type {
  ProjectItemDTO,
  ProjectsListResponseDTO,
  ProjectDetailResponseDTO,
  ProjectStatusDTO,
} from '@entities/project/api/project.dto'
import type { Project, ProjectsPage, ProjectStatus } from '@entities/project/model'

/** Map de estado API → dominio */
function mapStatus(dto: ProjectStatusDTO): ProjectStatus {
  // Mantener defensa por si el backend agrega estados nuevos
  if (dto === 'ACTIVE' || dto === 'ARCHIVED') return dto

  return 'ARCHIVED'
}

/** DTO (snake_case) → Dominio (camelCase) */
export function mapProjectItemDto(dto: ProjectItemDTO): Project {
  return {
    id: dto.project_id,
    name: dto.name ?? '',
    description: dto.description ?? null,
    status: mapStatus(dto.status ?? 'ARCHIVED'),
    users: (dto.users ?? []).map(u => ({
      id: u.id,
      name: u.name,
    })),
    facilities: (dto.facilities ?? []).map(f => ({
      id: f.facility_id,
      name: f.name,
    })),
    createdAt: dto.created_at ?? '',
    updatedAt: dto.updated_at ?? '',
    createdBy: dto.created_by ?? '',
  }
}

/** Respuesta de listado → Página de dominio (items + cursor/limit) */
export function mapProjectsListResponseDto(dto: ProjectsListResponseDTO): ProjectsPage {
  const items = dto.data.projects.map(mapProjectItemDto)
  return {
    items,
    limit: dto.data.limit ?? items.length,
    nextCursor: dto.data.cursor || '',
  }
}

/** Respuesta de detalle → Dominio */
export function mapProjectDetailResponseDto(dto: ProjectDetailResponseDTO): Project {
  return mapProjectItemDto(dto.data.project)
}
