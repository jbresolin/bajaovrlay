// Test support: instances on the preview and program outputs of a race day, and the
// moment of a later take, for the tests of the preview commands. It builds on
// rundownSlices.testSupport.ts (the rundowns, items and slices). Every function builds
// fresh objects on each call, so no test can change what another one sees.
import type { Instance } from '@bajaovrlay/shared';

import type { ReducerContext } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildPodiumTeamItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/**
 * The moment contextOfTheRundownCommand names, 14:32:05 UTC on 9 October 2026, in
 * milliseconds: the moment of every preview in these tests.
 */
export const momentOfThePreviewInMilliseconds = 1_791_556_325_000;

/** The ids and time the store would hand the take, fifteen minutes later at 14:47:30.250 UTC. */
export const contextOfTheLaterTake: ReducerContext = {
  newInstanceId: 'e2a4c6f8-1b3d-4f5a-8c7e-9d0b1a2c3e4f',
  newItemId: '9c1e7a35-4b2d-4f60-a8e3-5d7f2b1c0a94',
  newQuickFirePanelId: '3b7d9f1a-5c2e-4a8b-9d6f-0e1c3a5b7d92',
  newMacroId: '6e2c4a8f-1b3d-4f5e-a7c9-2d4f6b8a0c13',
  now: '2026-10-09T14:47:30.250Z',
};

/** The moment contextOfTheLaterTake names, in milliseconds. */
export const momentOfTheLaterTakeInMilliseconds = 1_791_557_250_250;

/**
 * Builds the green flag clock on air on the program output, taken by hand an hour
 * earlier, before BAJAOVRLAY-37, so it names no item (as an older database may hold).
 */
export function buildGreenFlagClockOnProgram(): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

/**
 * Builds the item "Bandeira amarela" on the preview output of the clock layer, exactly
 * as a previewItem asked for by hand at 14:32:05 leaves it. Every field of that item is
 * a typed value, so the instance remembers no field to stamp again.
 */
export function buildYellowFlagItemOnPreview(): Instance {
  return {
    id: contextOfTheRundownCommand.newInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'preview',
    resolvedData: buildEnduroClockData('yellow'),
    currentStep: 0,
    status: 'loading',
    takenAt: contextOfTheRundownCommand.now,
    previewOrigin: 'manual',
    itemId: 'item-bandeira-amarela',
  };
}

/**
 * Builds the item "Largada do enduro" on the preview output with a clock at zero whose
 * reference moment was left to the server: the preview stamped it with 14:32:05, and the
 * instance remembers that the field is a stamp.
 */
export function buildStartItemOnPreviewWithItsMomentStamped(): Instance {
  return {
    id: contextOfTheRundownCommand.newInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'preview',
    resolvedData: {
      ...buildEnduroClockData('green'),
      referenceTimeMs: 0,
      referenceWallClockMs: momentOfThePreviewInMilliseconds,
    },
    currentStep: 0,
    status: 'loading',
    takenAt: contextOfTheRundownCommand.now,
    previewOrigin: 'manual',
    itemId: 'item-largada-do-enduro',
    takeTimeFieldKeys: ['referenceWallClockMs'],
  };
}

/**
 * Builds the lower third for team 42 on the preview output, previewed by hand from the
 * "Atalhos" button "Tarja — Baja UFPR" (buildTeam42ShortcutItem in rundownSlices).
 */
export function buildTeam42LowerThirdOnPreview(): Instance {
  return {
    id: 'a7c35e19-8d2b-4f46-9c01-6e3b5d7f2a80',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'preview',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:20:00.000Z',
    previewOrigin: 'manual',
    itemId: 'item-atalho-tarja-baja-ufpr',
  };
}

/**
 * Builds the item "Pódio — Baja UFPR" on the preview output of the lower third layer,
 * as "Prévia automática" left it a minute before the previews of these tests, when the
 * cursor arrived on that item.
 */
export function buildPodiumItemOnPreviewByAutoPreview(): Instance {
  return {
    id: 'f3d9b7a1-5c2e-4a68-9b04-7e1c3a5d8f26',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'preview',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:31:05.000Z',
    previewOrigin: 'auto',
    itemId: buildPodiumTeamItem(0).id,
  };
}

/**
 * Reads each instance as `layer on output` words, in the order of the slice, with who
 * asked for it after a preview that says so: `lower-third on preview (auto)`.
 */
export function readLayerOutputAndOriginOfEachInstance(
  instances: Instance[] | undefined,
): string[] {
  return (instances ?? []).map((instance) => {
    const layerAndOutput = `${instance.layerId} on ${instance.target}`;
    return instance.previewOrigin === undefined
      ? layerAndOutput
      : `${layerAndOutput} (${instance.previewOrigin})`;
  });
}

/** Reads each instance as `layer on output` words, in the order of the slice. */
export function readLayerAndOutputOfEachInstance(instances: Instance[] | undefined): string[] {
  return (instances ?? []).map((instance) => `${instance.layerId} on ${instance.target}`);
}
