import type { Building } from '@entities/building/model'

/**
 * Mock estático para desarrollo de UI.
 * Mantener ids estables para facilitar testing y navegación.
 */
export const MOCK_BUILDINGS: ReadonlyArray<Building> = [
  { id: 'bldg-main', name: 'Main Building' },
  { id: 'bldg-north', name: 'North Tower' },
  { id: 'bldg-admin', name: 'Administrative Annex' },
]

/**
 * Wrapper asíncrono para simular latencia de red si fuese necesario.
 * Útil para previsualizar skeletons/estados de carga en la UI.
 */
export async function getMockBuildings(delayMs = 0): Promise<Building[]> {
  if (delayMs > 0) {
    await new Promise(r => setTimeout(r, delayMs))
  }
  // retornamos una copia inmutable
  return [...MOCK_BUILDINGS]
}
