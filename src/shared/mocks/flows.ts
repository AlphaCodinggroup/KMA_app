import type { FlowSummary } from '@entities/flow/model'

export const MOCK_FLOWS: { flows: FlowSummary[] } = {
  flows: [
    {
      id: 'RampFlow',
      title: 'Accesibility Audit - Ramps',
      version: 'v1.0',
      description: 'Check ramp accessibility according to ADA standards',
      stepsCount: 30,
    },
    {
      id: 'DoorFlow',
      title: 'Accesibility Audit - Doors',
      version: 'v2.1',
      description: 'Evaluate door width, and handle accesibility',
      stepsCount: 25,
    },
  ],
}
