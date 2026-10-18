import { type DataSource, SimulatorConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { buildStatusOfANewSource } from './dataSourceHealth.js';

// The seeded simulator is polled every two seconds: the brief's rhythm for live data.
const seededPollIntervalMs = 2_000;

/**
 * The one source seeded on a database with none: "Simulador — Enduro", default config,
 * off. Its id is fixed and readable so it is the same on every machine, but clients must
 * read it from the `dataSources` slice: the operator may rename or delete it.
 */
export function buildSeededDataSources(): DataSource[] {
  return [
    {
      id: 'simulador-enduro',
      label: ptBR.seededDataSourceLabel,
      kind: 'simulator',
      config: SimulatorConfigSchema.parse({}),
      pollIntervalMs: seededPollIntervalMs,
      isEnabled: false,
      isRecording: false,
      status: buildStatusOfANewSource(seededPollIntervalMs),
    },
  ];
}
