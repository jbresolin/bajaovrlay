// Test support: the stage the instancePlayer tests play on. It builds a stage with the two
// layers of instancesOnAir.testSupport.ts, a player whose graphics write down their calls
// (recordingGraphic.testSupport.ts), a log kept in a list, and a second list with what the
// player reported to the server about each instance. Every function builds fresh objects,
// so no test can change what another one sees; the one exception, a counter that only
// keeps tag names apart, is explained in recordingGraphic.testSupport.ts.
import type { Graphic, Instance, InstanceStatusMessage } from '@bajaovrlay/shared';

import type { GraphicLoader } from './graphicLoader.js';
import { createInstancePlayer } from './instancePlayer.js';
import type { LayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  finalClockInstanceId,
  layersOfTheStream,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import { createLayerContainers } from './layerContainers.js';
import {
  createRecordingGraphicLoader,
  type RecordingGraphicLoader,
} from './recordingGraphic.testSupport.js';
import type { RendererLogLevel } from './rendererLog.js';

/** One captured log line: its level, its message and the details written with it. */
export type CapturedLogLine = {
  level: RendererLogLevel;
  message: string;
  details: Record<string, unknown>;
};

/** The short names the recorded calls use for the four instances of the tests. */
const nameByInstanceId: Record<string, string> = {
  [enduroClockInstanceId]: 'Enduro',
  [finalClockInstanceId]: 'Final',
  [ufprLowerThirdInstanceId]: 'UFPR',
  [feiLowerThirdInstanceId]: 'FEI',
};

/** Builds a graphic as the `graphics` slice lists it; only the id matters to the player. */
function createGraphic(graphicId: string, name: string): Graphic {
  return {
    id: graphicId,
    manifest: { id: `baja-${graphicId}`, name, main: `${graphicId}.js` },
    defaultLayerId: 'fullscreen',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The graphics slice of the tests: the race clock and the team lower third. */
export const graphicsOfTheStream: Graphic[] = [
  createGraphic('race-clock', 'Relógio de prova'),
  createGraphic('team-lower-third', 'Legenda de equipe'),
];

export const finalScoreboardInstanceId = 'e5a17c93-8d24-4b6f-b0e9-6c3f1d7a2854';
const finalScoreboardGraphicId = 'placar final';
/** The tag the loader answers for the final scoreboard; the space makes it impossible. */
export const tagNoPageAccepts = 'baja-graphic-placar final';

/** The same slice plus the final scoreboard, the graphic whose element cannot be created. */
export const graphicsWithTheFinalScoreboard: Graphic[] = [
  ...graphicsOfTheStream,
  createGraphic(finalScoreboardGraphicId, 'Placar final'),
];

/**
 * Builds a stage with the clock and lower-third layers, a player on it, graphics that
 * write down their calls, a log kept in a list, and the list of what the player reported
 * to the server (`statusReports`).
 */
export function createStageWithPlayer() {
  const recording = createRecordingGraphicLoader(nameByInstanceId);
  return createStageWithPlayerOnLoader(recording, recording.graphicLoader);
}

/**
 * Builds the same stage, except that the element of the final scoreboard cannot be
 * created: its loader answers a tag with a space in it, as a package folder named
 * `placar final` would give, and no page accepts such a tag. Creating the element
 * therefore throws inside the player. Every other graphic is the recording stand-in.
 */
export function createStageWhoseFinalScoreboardCannotBeCreated() {
  const recording = createRecordingGraphicLoader(nameByInstanceId);
  const loaderThatCannotCreateTheScoreboard: GraphicLoader = {
    defineGraphicElement: async (graphic) => {
      if (graphic.id === finalScoreboardGraphicId) {
        return tagNoPageAccepts;
      }
      return recording.graphicLoader.defineGraphicElement(graphic);
    },
  };
  return createStageWithPlayerOnLoader(recording, loaderThatCannotCreateTheScoreboard);
}

/** What Chromium answers when a graphic's main file is missing from the server. */
export const reasonTheModuleCannotBeImported =
  'TypeError: Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js';

/**
 * Builds the same stage, except that no graphic's module can be imported, as when the
 * server lists a package whose files were deleted from disk.
 */
export function createStageWhoseGraphicModulesCannotBeImported() {
  const recording = createRecordingGraphicLoader(nameByInstanceId);
  const loaderWhoseImportsFail: GraphicLoader = {
    defineGraphicElement: async () => {
      throw new TypeError(
        'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
      );
    },
  };
  return createStageWithPlayerOnLoader(recording, loaderWhoseImportsFail);
}

/**
 * Puts the layers, the player, the list that keeps the log and the list that keeps the
 * status reports around one loader.
 */
function createStageWithPlayerOnLoader(
  recording: RecordingGraphicLoader,
  graphicLoader: GraphicLoader,
) {
  const stage = document.createElement('div');
  const layerContainers = createLayerContainers(stage);
  layerContainers.showLayers(layersOfTheStream);
  const logLines: CapturedLogLine[] = [];
  const statusReports: InstanceStatusMessage[] = [];
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader,
    reportInstanceStatus: (statusReport) => {
      statusReports.push(statusReport);
    },
    logEvent: (level, message, details = {}) => {
      logLines.push({ level, message, details });
    },
  });
  return { stage, instancePlayer, recording, logLines, statusReports };
}

/**
 * Builds the stage of a program monitor: the same layers, graphics and captured log, but
 * the player is given no way to report to the server, as renderer.ts builds it for a page
 * opened with `?monitor=1`. The final scoreboard cannot be created here either, so a test
 * can watch the renderer's own failure on a page that reports nothing.
 */
export function createStageWithPlayerThatHasNoStatusReporter() {
  const recording = createRecordingGraphicLoader(nameByInstanceId);
  const stage = document.createElement('div');
  const layerContainers = createLayerContainers(stage);
  layerContainers.showLayers(layersOfTheStream);
  const logLines: CapturedLogLine[] = [];
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader: {
      defineGraphicElement: async (graphic) => {
        if (graphic.id === finalScoreboardGraphicId) {
          return tagNoPageAccepts;
        }
        return recording.graphicLoader.defineGraphicElement(graphic);
      },
    },
    logEvent: (level, message, details = {}) => {
      logLines.push({ level, message, details });
    },
  });
  return { stage, instancePlayer, recording, logLines };
}

/**
 * Builds the final scoreboard of the competition with its top two teams. The stage of
 * these tests has no full-screen layer, so it is taken on the lower-third layer.
 */
export function createFinalScoreboardInstance(): Instance {
  return {
    id: finalScoreboardInstanceId,
    layerId: 'lower-third',
    graphicId: finalScoreboardGraphicId,
    target: 'program',
    resolvedData: {
      title: 'Classificação final',
      rows: [
        { position: 1, teamNumber: 42, teamName: 'Baja UFPR', points: 912.4 },
        { position: 2, teamNumber: 7, teamName: 'FEI Baja', points: 897.1 },
      ],
    },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T17:45:00.000Z',
  };
}

/** Builds an enduro clock whose load does not finish until the test releases it. */
export function createEnduroClockThatLoadsSlowly(): Instance {
  return createEnduroClockInstance({
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      fakeGraphicLoadOutcome: 'waits-to-be-released',
    },
  });
}

/**
 * Builds an enduro clock with the data field that tells the recording graphic how its
 * playAction must go: `'rejects'`, or `'waits-to-be-released'` for a long in-animation.
 */
export function createEnduroClockWhosePlay(
  fakeGraphicPlayOutcome: 'rejects' | 'waits-to-be-released',
): Instance {
  return createEnduroClockInstance({
    resolvedData: { sessionName: 'Enduro de Resistência', fakeGraphicPlayOutcome },
  });
}

/**
 * Builds the clock of the final heat with the data field that tells the recording graphic
 * how its load must go: `'rejects'`, or `'waits-to-be-released'` for a slow graphic.
 */
export function createFinalClockWhoseLoad(
  fakeGraphicLoadOutcome: 'rejects' | 'waits-to-be-released',
): Instance {
  return {
    ...createFinalClockInstance(),
    resolvedData: { sessionName: 'Final', fakeGraphicLoadOutcome },
  };
}

/**
 * Builds team 42's lower third with the data field that tells the recording graphic how
 * its load must go: `'rejects'` or `'answers-nothing'`.
 */
export function createUfprLowerThirdWhoseLoad(
  fakeGraphicLoadOutcome: 'rejects' | 'answers-nothing',
): Instance {
  return {
    ...createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR', fakeGraphicLoadOutcome },
  };
}

/** Builds what the reconciler sends for a plain take: load and play it on its own layer. */
export function createTakeOf(instance: Instance): LayerOperations[] {
  return [
    {
      layerId: instance.layerId,
      operations: [{ kind: 'loadAndPlay', instance, skipAnimation: false }],
    },
  ];
}

/**
 * Waits until every queued operation that can finish has finished. The stand-in graphics
 * answer without any timer, so a whole queue runs before the next timer does; waiting for
 * one timer of zero milliseconds is therefore enough.
 */
export function waitForQueuedOperations(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Lists the instance ids of the elements inside one layer's container, in page order. */
export function readInstanceIdsOnLayer(
  stage: HTMLElement,
  layerId: string,
): Array<string | undefined> {
  const container = stage.querySelector(`[data-layer-id="${layerId}"]`);
  const elements = Array.from(container?.children ?? []) as HTMLElement[];
  return elements.map((element) => element.dataset.instanceId);
}

/**
 * Lists the elements inside one layer's container as sentences, in page order:
 * `Enduro: visible`, `Final: hidden`. Hidden means the player set `visibility: hidden` on
 * the element, which it does while a graphic loads behind the one it will replace.
 */
export function readVisibilityOfElementsOnLayer(stage: HTMLElement, layerId: string): string[] {
  const container = stage.querySelector(`[data-layer-id="${layerId}"]`);
  const elements = Array.from(container?.children ?? []) as HTMLElement[];
  return elements.map((element) => {
    const instanceId = element.dataset.instanceId ?? '';
    const instanceName = nameByInstanceId[instanceId] ?? instanceId;
    const visibility = element.style.visibility === 'hidden' ? 'hidden' : 'visible';
    return `${instanceName}: ${visibility}`;
  });
}
