import type { FlowSummary } from '@entities/flow/model'
import type { FlowSummaryDto } from './dto'

export function mapFlowSummaryDtoToDomain(dto: FlowSummaryDto): FlowSummary {
  return {
    id: dto.id,
    title: dto.title,
    version: dto.version,
    description: dto.description,
    stepsCount: dto.stepsCount,
  }
}
