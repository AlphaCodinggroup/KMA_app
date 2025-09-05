import type { FlowSummary } from '@entities/flow/model'

export function mapToFlowSummary(dto: any): FlowSummary {
  return {
    id: dto.id ?? dto.flowId,
    title: dto.title ?? 'Sin título',
    version: dto.version ?? 'v1.0',
    description: dto.description ?? '',
    stepsCount: dto.stepsCount ?? (Array.isArray(dto.steps) ? dto.steps.length : 0),
  }
}
