// Test support: the slices of a race day whose race clock declares its data schema, for
// the reducer tests that depend on that schema (updateInstanceData, the take step's data
// check in putGraphicOnOutput, reportInstanceStatus). Every function builds fresh objects
// on each call.
import { type Instance, obsSliceWithoutObs } from '@bajaovrlay/shared';

import { noSourceHostAllowlist } from '../../../modules/dataSources/index.js';
import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { seededLayers } from '../seedLayers.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';

/** The id of the race clock instance every factory below builds. */
export const raceClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

/** The ids and time the store would hand a reducer at 14:32:05 UTC on 9 October 2026. */
export const contextOfTheCommand: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  now: '2026-10-09T14:32:05.000Z',
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
  newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
  newDataSourceId: 'c7e1a3f5-9b2d-4c6e-8a0f-3d5b7c9e1a24',
  newEventId: 'evento-digitado-1',
  sourceHostAllowlist: noSourceHostAllowlist,
  actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
};

/** Builds complete race clock data: the enduro under green flag, 1:05:00 in, running. */
export function buildGreenFlagEnduroData(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.parse('2026-10-09T13:00:00.000Z'),
    running: true,
  };
}

/**
 * Builds the race clock on the program output, on the clock layer, showing the green
 * flag enduro, in the given status (and with the failure detail, when one is given).
 */
export function buildRaceClockInstanceWithStatus(
  status: Instance['status'],
  statusDetail?: string,
): Instance {
  const instance: Instance = {
    id: raceClockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildGreenFlagEnduroData(),
    currentStep: 0,
    status,
    takenAt: '2026-10-09T13:00:00.000Z',
  };
  if (statusDetail !== undefined) {
    instance.statusDetail = statusDetail;
  }
  return instance;
}

/** Builds a lower third for team 42 on the program output; its graphic has no data schema. */
export function buildTeam42LowerThirdOnAir(): Instance {
  return {
    id: 'c41f0e9a-2b7d-4e3c-8a65-1d2e3f4a5b6c',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
  };
}

/**
 * Builds race day slices: the five seeded layers, the race clock (whose manifest has a
 * data schema) and a team lower third (whose manifest has none), and the given instances.
 * No rundown, item, panel or macro: the commands these slices are for never read them.
 */
export function buildRaceDaySlicesWithInstances(instances: Instance[]): SlicesChangedByCommands {
  return {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: seededLayers,
    graphics: [
      {
        id: 'race-clock',
        manifest: raceClockManifestForTests,
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
      {
        id: 'team-lower-third',
        manifest: { id: 'baja-team-lower-third', name: 'Tarja de equipe', main: 'tarja.js' },
        defaultLayerId: 'lower-third',
        category: 'lower-third',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances,
    previewClearedLayerIds: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    macroStops: [],
    obs: obsSliceWithoutObs,
    triggers: [],
    triggerActivity: { isPaused: false, lastFiredAtMsByTriggerId: {}, firings: [] },
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    instanceBindings: [],
    overrides: [],
  };
}
