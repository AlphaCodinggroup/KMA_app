import type { AxiosRequestConfig, GenericAbortSignal } from 'axios'
import { http } from '@core/http/http'
import { Env } from '@shared/config/env'

import type { ProjectRepo, ListProjectsParams } from '@entities/project/ports'
import type { Project, ProjectsPage, ProjectStatus } from '@entities/project/model'

import {
  ProjectsListResponseDtoSchema,
  ProjectDetailResponseDtoSchema,
} from '@entities/project/api/project.dto'

import {
  mapProjectsListResponseDto,
  mapProjectDetailResponseDto,
} from '@entities/project/lib/mappers'

/** Resuelve la baseURL de la API desde Env. */
function getBaseUrl(): string {
  return Env.apiBaseUrl
}

/** Arma una URL segura respetando base y path (evita // dobles). */
function buildUrl(path: string): string {
  const base = getBaseUrl()
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Dominio → API (status) */
function toApiStatus(status?: ProjectStatus): 'ACTIVE' | 'ARCHIVED' | undefined {
  // El dominio ya usa los mismos valores que la API ('ACTIVE' | 'ARCHIVED'). Antes se comparaba con
  // 'active' (minúscula), nunca coincidía y 'ACTIVE' se enviaba como 'ARCHIVED'.
  return status
}

/** Dominio → API (query params) */
function toApiQuery(params?: ListProjectsParams) {
  if (!params) return undefined
  const qp: Record<string, string | number | undefined> = {
    status: toApiStatus(params.status),
    search: params.search,
    limit: params.limit,
    cursor: params.cursor,
    sortBy: params.sortBy, // API espera 'created_at' | 'updated_at' | 'name'
    sortOrder: params.sortOrder, // 'asc' | 'desc'
  }
  return qp
}

/** Repo HTTP real de Projects */
class HttpProjectRepo implements ProjectRepo {
  async list(params?: ListProjectsParams & { signal?: AbortSignal }): Promise<ProjectsPage> {
    const url = buildUrl('/projects')

    const axiosConfig: AxiosRequestConfig = {
      params: toApiQuery(params),
    }

    // Soporte de cancelación
    if (params?.signal) {
      axiosConfig.signal = params.signal as unknown as GenericAbortSignal
    }

    const resp = await http.get(url, axiosConfig)

    // Validar payload crudo
    const dto = ProjectsListResponseDtoSchema.parse(resp.data)

    // Mapear a dominio (items + cursor/limit)
    return mapProjectsListResponseDto(dto)
  }

  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<Project> {
    const url = buildUrl(`/projects/${id}`)

    const axiosConfig: AxiosRequestConfig | undefined = opts?.signal
      ? { signal: opts.signal as unknown as GenericAbortSignal }
      : undefined

    const resp = await http.get(url, axiosConfig)

    const dto = ProjectDetailResponseDtoSchema.parse(resp.data)

    return mapProjectDetailResponseDto(dto)
  }
}

/** Factory para wiring en bootstrap/DI */
export const createHttpProjectRepo = (): ProjectRepo => new HttpProjectRepo()
