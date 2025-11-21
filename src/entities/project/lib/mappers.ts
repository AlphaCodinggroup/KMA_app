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
  switch (dto) {
    case 'ACTIVE':
      return 'active'
    case 'ARCHIVED':
      return 'archived'
    default:
      // fallback defensivo ante valores nuevos del backend
      return 'archived'
  }
}

/** DTO (snake_case) → Dominio (camelCase) */
export function mapProjectItemDto(dto: ProjectItemDTO): Project {
  return createProject({
    id: dto.project_id,
    code: dto.code ?? null,
    name: dto.name ?? '',
    description: dto.description ?? null,
    status: mapStatus(dto.status ?? 'ARCHIVED'),
    userIds: dto.user_ids ?? [],
    facilityIds: dto.facility_ids ?? [],
    createdAt: dto.created_at ?? '',
    updatedAt: dto.updated_at ?? '',
    createdBy: dto.created_by ?? '',
  })
}

/** Respuesta de listado → Página de dominio (items + cursor/limit) */
export function mapProjectsListResponseDto(dto: ProjectsListResponseDTO): ProjectsPage {
  const items = dto.data.projects.map(mapProjectItemDto)
  return {
    items,
    nextCursor: dto.data.cursor ?? '',
    limit: dto.data.limit ?? 0,
  }
}

/** Respuesta de detalle → Dominio */
export function mapProjectDetailResponseDto(dto: ProjectDetailResponseDTO): Project {
  return mapProjectItemDto(dto.data.project)
}
