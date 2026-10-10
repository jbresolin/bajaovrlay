// Test support: the stage instancePlayer.test.ts plays on. It builds a stage with the two
// layers of instancesOnAir.testSupport.ts, a player whose graphics write down their calls
// (recordingGraphic.testSupport.ts) and a log kept in a list. Every function builds fresh
// objects, so no test can change what another one sees.
import type { Graphic, Instance } from '@bajaovrlay/shared';

import type { GraphicLoader } from './graphicLoader.js';
import { createInstancePlayer } from './instancePlayer.js';
import type { LayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  finalClockInstanceId,
  layersOfTheStream,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import { createLayerContainers } from './layerContainers.js';
import { createRecordingGraphicLoader } from './recordingGraphic.testSupport.js';
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
export function createGraphic(graphicId: string, name: string): Graphic {
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

/**
 * Builds a stage with the clock and lower-third layers, a player on it, graphics that
 * write down their calls, and a log kept in a list. `replaceGraphicLoader` lets a test
 * put a misbehaving loader in front of the recording one.
 */
export function createStageWithPlayer(
  replaceGraphicLoader: (recordingLoader: GraphicLoader) => GraphicLoader = (loader) => loader,
) {
  const stage = document.createElement('div');
  const layerContainers = createLayerContainers(stage);
  layerContainers.showLayers(layersOfTheStream);
  const recording = createRecordingGraphicLoader(nameByInstanceId);
  const logLines: CapturedLogLine[] = [];
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader: replaceGraphicLoader(recording.graphicLoader),
    logEvent: (level, message, details = {}) => {
      logLines.push({ level, message, details });
    },
  });
  return { stage, instancePlayer, recording, logLines };
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
 * Builds team 42's lower third with the data field that tells the recording graphic how
 * its load must go: `'rejects'` or `'answers-nothing'`.
 */
export function createUfprLowerThirdWhoseLoad(fakeGraphicLoadOutcome: string): Instance {
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
