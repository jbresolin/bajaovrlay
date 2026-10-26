// Test support: the instances and layers the renderer's unit tests share, written the way the
// server lists them. Every function builds a fresh object, so no test can change what
// another one sees.
import type { Instance, Layer } from '@bajaovrlay/shared';

export const enduroClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';
export const finalClockInstanceId = 'b84f6c1e-0a3d-4c59-8e7b-5d2a9f31c602';
export const ufprLowerThirdInstanceId = '2c9e7f40-6b1a-4d83-9f25-e1a0c4b7d915';
export const feiLowerThirdInstanceId = '91d0a3b7-5e2c-47f6-a8c4-3b6e0f2d7a48';

/**
 * The layers the tests use: the clock animates out then in, the lower third cuts, and the
 * full screen (the podium's, whose steps instancePlayer.steps.test.ts plays) cuts too.
 */
export const layersOfTheStream: Layer[] = [
  {
    id: 'clock',
    outputId: 'program',
    name: 'Relógio',
    zIndex: 30,
    replacePolicy: 'out-then-in',
    persistent: true,
  },
  {
    id: 'lower-third',
    outputId: 'program',
    name: 'Legenda',
    zIndex: 40,
    replacePolicy: 'cut',
    persistent: false,
  },
  {
    id: 'fullscreen',
    outputId: 'program',
    name: 'Tela cheia',
    zIndex: 50,
    replacePolicy: 'cut',
    persistent: false,
  },
];

/** Builds the race clock of the enduro, on air on the clock layer under green flag. */
export function createEnduroClockInstance(changes: Partial<Instance> = {}): Instance {
  return {
    id: enduroClockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green', running: true },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:00:00.000Z',
    ...changes,
  };
}

/** Builds the race clock of the final heat, a different take on the same clock layer. */
export function createFinalClockInstance(): Instance {
  return createEnduroClockInstance({
    id: finalClockInstanceId,
    resolvedData: { sessionName: 'Final', state: 'pre', running: false },
    takenAt: '2026-10-09T15:30:00.000Z',
  });
}

/** Builds a lower third naming one team, on the lower-third layer. */
export function createTeamLowerThirdInstance(
  instanceId: string,
  teamNumber: number,
  teamName: string,
): Instance {
  return {
    id: instanceId,
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber, teamName },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:05:00.000Z',
  };
}
