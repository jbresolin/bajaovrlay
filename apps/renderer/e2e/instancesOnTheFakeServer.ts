// Test support: the instances the browser tests put on air through the stand-in server
// (fakeServerForPage.ts), written the way the real server lists them. Every function
// builds a fresh object.
import type { Instance } from '@bajaovrlay/shared';

export const enduroInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';
export const finalInstanceId = 'b84f6c1e-0a3d-4c59-8e7b-5d2a9f31c602';
export const ufprInstanceId = '2c9e7f40-6b1a-4d83-9f25-e1a0c4b7d915';
export const feiInstanceId = '91d0a3b7-5e2c-47f6-a8c4-3b6e0f2d7a48';

/** The names the call sentences use for each instance, e.g. "Enduro: load called". */
export const instanceNames = {
  [enduroInstanceId]: 'Enduro',
  [finalInstanceId]: 'Final',
  [ufprInstanceId]: 'UFPR',
  [feiInstanceId]: 'FEI',
};

/** Builds an instance as the server lists it: one graphic taken on one program layer. */
export function createInstance(
  instanceId: string,
  layerId: string,
  graphicId: string,
  resolvedData: Record<string, unknown>,
): Instance {
  return {
    id: instanceId,
    layerId,
    graphicId,
    target: 'program',
    resolvedData,
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

/** The enduro's clock on the clock layer, drawn by the fake graphic. */
export function createEnduroInstance(flagState: string): Instance {
  return createInstance(enduroInstanceId, 'clock', 'fake-graphic', {
    sessionName: 'Enduro de Resistência',
    state: flagState,
    lapsCompletedByLeader: 12,
  });
}

/** The final's clock: a different take on the same clock layer. */
export function createFinalInstance(): Instance {
  return createInstance(finalInstanceId, 'clock', 'fake-graphic', {
    sessionName: 'Final',
    state: 'pre',
  });
}

/** A lower third naming one team, on the lower-third layer (which cuts). */
export function createTeamInstance(
  instanceId: string,
  teamNumber: number,
  teamName: string,
): Instance {
  return createInstance(instanceId, 'lower-third', 'fake-graphic', { teamNumber, teamName });
}
