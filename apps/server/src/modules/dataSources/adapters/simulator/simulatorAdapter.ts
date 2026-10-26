// The adapter of kind `simulator`: a simulated enduro, and a simulated Super Prime beside
// it (BAJAOVRLAY-25), played as a live source.
import { type DataShapeKey, type SimulatorConfig, SimulatorConfigSchema } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import type { DataSourceAdapter } from '../dataSourceAdapter.js';
import { buildShapesFromRaceState } from './shapesFromRaceState.js';
import { simulateEnduroAt } from './simulateEnduro.js';

// The shapes every simulator poll answers: the enduro's four, and its Super Prime's brackets.
const simulatorShapeKeys: DataShapeKey[] = [
  'session',
  'positions',
  'standings',
  'incidents',
  'brackets',
];

/**
 * Simulated time since the green flag at the wall-clock moment `nowMs`: real time since
 * `simulatedStartAtMs` times `speed` (at 60, one real minute is one simulated hour).
 * With no start yet, or before it, the race is at its green flag (0).
 */
export function convertWallTimeToSimulatedElapsedMs(
  config: SimulatorConfig,
  nowMs: number,
): number {
  if (config.simulatedStartAtMs === undefined) {
    return 0;
  }
  const realTimeSinceStartMs = nowMs - config.simulatedStartAtMs;
  return Math.max(0, realTimeSinceStartMs * config.speed);
}

/**
 * Builds the simulator adapter. It keeps nothing between polls: each poll turns now into
 * simulated time, asks simulateEnduroAt for the race at that moment, and builds the
 * shapes. lapLengthKm is not read: the lap times are written for the default 2 km track.
 */
export function createSimulatorAdapter(): DataSourceAdapter<SimulatorConfig> {
  return {
    kind: 'simulator',
    configSchema: SimulatorConfigSchema,
    listProducedShapes: () => [...simulatorShapeKeys],
    // The signal is not watched: a poll is a few milliseconds of arithmetic, far under
    // the shortest timeout (500 ms), with nothing to wait on.
    pollOnce: (config, context) => {
      if (config.isFailing) {
        return Promise.reject(new Error(ptBR.dataSourceErrors.simulatedFailure));
      }
      const nowMs = context.readCurrentTime().getTime();
      const elapsedSimulatedMs = convertWallTimeToSimulatedElapsedMs(config, nowMs);
      const raceState = simulateEnduroAt(
        {
          seed: config.seed,
          carCount: config.carCount,
          sessionDurationMs: config.sessionDurationMs,
        },
        elapsedSimulatedMs,
      );
      const shapes = buildShapesFromRaceState(raceState, nowMs, config.simulatedStartAtMs);
      return Promise.resolve({ shapes });
    },
  };
}
