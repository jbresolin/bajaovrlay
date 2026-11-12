// Test support: two consoles on one layer (BAJAOVRLAY-69). Two lower thirds of the Super
// Prime, the captain of Baja UFPR on "Atalhos" and the team chief of Baja UFSC in the
// rundown; the captain on air as the Produtor at "Mesa 1" just took her; and the context the
// store would hand a take from the second console, at "Mesa 2", 0,8 s later. Every function
// builds fresh objects on each call, so no test can change what another one sees.
import type { Instance, Item } from '@bajaovrlay/shared';

import type { ReducerContext, SlicesChangedByCommands } from '../reducers/reducerTypes.js';
import {
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  shortcutsPanelId,
} from '../reducers/rundownSlices.testSupport.js';
import type { ProgramChangeOfALayer } from './lastProgramChangeOfEachLayer.js';

/** The console (browser tab) of the Produtor at "Mesa 1", as the server hands ids out. */
export const consoleAtMesa1 = 'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';

/** The console of the second Produtor, at "Mesa 2". */
export const consoleAtMesa2 = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

/** The moment Mesa 1 took the captain: 0,8 s before the take of the tests, 14:32:05. */
export const momentMesa1TookTheCaptain = '2026-10-09T14:32:04.200Z';

/** The id of the captain's instance on program, the one Mesa 1's take made. */
export const captainOnAirInstanceId = '4f2e8a1c-6b3d-4e5f-9a07-1c2d3e4f5a6b';

/** Builds "Tarja — capitã da UFPR", the first button of "Atalhos". */
export function buildCaptainLowerThirdItem(): Item {
  return {
    id: 'item-tarja-capita-ufpr',
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
    order: 0,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: {
      teamNumber: { kind: 'literal', value: 42 },
      teamName: { kind: 'literal', value: 'Ana Souza, capitã da Baja UFPR' },
    },
    label: 'Tarja — capitã da UFPR',
    color: 'info',
    notes: '',
  };
}

/** Builds "Tarja — chefe da UFSC", in the main session's rundown. */
export function buildChiefLowerThirdItem(): Item {
  return {
    id: 'item-tarja-chefe-ufsc',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    order: 0,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: {
      teamNumber: { kind: 'literal', value: 7 },
      teamName: { kind: 'literal', value: 'Bruno Lima, chefe da Baja UFSC' },
    },
    label: 'Tarja — chefe da UFSC',
    color: 'info',
    notes: '',
  };
}

/** Builds the captain on the program output of "Tarja", as Mesa 1's take left her. */
export function buildCaptainOnProgram(): Instance {
  return {
    id: captainOnAirInstanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber: 42, teamName: 'Ana Souza, capitã da Baja UFPR' },
    currentStep: 0,
    status: 'on-air',
    takenAt: momentMesa1TookTheCaptain,
    itemId: 'item-tarja-capita-ufpr',
  };
}

/** Builds the chief on the preview output of "Tarja", as Mesa 2's "Prévia" left him. */
export function buildChiefOnPreview(): Instance {
  return {
    id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'preview',
    resolvedData: { teamNumber: 7, teamName: 'Bruno Lima, chefe da Baja UFSC' },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:31:50.000Z',
    previewOrigin: 'manual',
    itemId: 'item-tarja-chefe-ufsc',
  };
}

/** Builds the change Mesa 1's take of the captain made on "Tarja", as the store signs it. */
export function buildMesa1TookTheCaptain(): ProgramChangeOfALayer {
  return {
    changedAt: momentMesa1TookTheCaptain,
    serverClockStepCount: 0,
    consoleId: consoleAtMesa1,
    consoleRole: 'produtor',
  };
}

/**
 * Builds the context the store hands a command from Mesa 2's console at 14:32:05, with
 * "Tarja"'s last change as given (none when left out), the server clock having made no step
 * unless told. `actor` may be replaced, for a console with the login off
 * (`operador:<connection id>`).
 */
export function buildContextOfMesa2(parts: {
  lastChangeOfTheLowerThirdLayer?: ProgramChangeOfALayer;
  actor?: string;
  serverClockStepCount?: number;
}): ReducerContext {
  return {
    ...contextOfTheRundownCommand,
    actor: parts.actor ?? 'produtor:Mesa 2',
    consoleId: consoleAtMesa2,
    serverClockStepCount: parts.serverClockStepCount ?? 0,
    lastProgramChangeOfEachLayer: buildLastChangesWithTheLowerThird(
      parts.lastChangeOfTheLowerThirdLayer,
    ),
  };
}

/**
 * Builds the context the store hands a command from the command API (a Companion button)
 * at 14:32:05: no console, so nothing it did not see can refuse it.
 */
export function buildContextOfTheCommandApi(parts: {
  lastChangeOfTheLowerThirdLayer?: ProgramChangeOfALayer;
}): ReducerContext {
  return {
    ...contextOfTheRundownCommand,
    actor: 'api:companion',
    lastProgramChangeOfEachLayer: buildLastChangesWithTheLowerThird(
      parts.lastChangeOfTheLowerThirdLayer,
    ),
  };
}

/** Builds the store's record with "Tarja"'s last change, or empty when there is none. */
function buildLastChangesWithTheLowerThird(
  lastChangeOfTheLowerThirdLayer: ProgramChangeOfALayer | undefined,
): Map<string, ProgramChangeOfALayer> {
  const lastProgramChangeOfEachLayer = new Map<string, ProgramChangeOfALayer>();
  if (lastChangeOfTheLowerThirdLayer !== undefined) {
    lastProgramChangeOfEachLayer.set('lower-third', lastChangeOfTheLowerThirdLayer);
  }
  return lastProgramChangeOfEachLayer;
}

/**
 * Builds the race day with both lower thirds and the yellow flag clock item, the given
 * instances and "vai limpar" marks, and the main session's cursor where given (none else).
 */
export function buildRaceDayWithBothLowerThirds(parts: {
  instances: Instance[];
  previewClearedLayerIds?: string[];
  cursorItemId?: string | null;
}): SlicesChangedByCommands {
  return buildRaceDaySlicesWithRundown({
    rundowns: [buildMainSessionRundown(parts.cursorItemId ?? null), buildPodiumRundown(null)],
    items: [buildCaptainLowerThirdItem(), buildChiefLowerThirdItem(), buildYellowFlagItem(1)],
    instances: parts.instances,
    previewClearedLayerIds: parts.previewClearedLayerIds ?? [],
  });
}

/** The refusal sentence Mesa 2 reads when its take of the chief loses to Mesa 1's captain. */
export const refusalOfTheChiefOverTheCaptain =
  'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
  'sua tomada de "Tarja — chefe da UFSC" não foi feita.';
