// Test support for the screen-slice tests (core/ws/webSocketHubScreenSlices.test.ts and
// api/v1/stateRoute.test.ts): a store with something in every slice a screen is not
// sent, so "that slice goes out empty to a screen" is proven for each one, not passed
// by accident because the server had nothing in it either. Nothing here keeps state
// between calls.
import type { SliceName, Slices } from '@bajaovrlay/shared';

import { buildDataSourcePollerActor } from '../store/commandActors.js';
import type { StateStore } from '../store/createStateStore.js';
import {
  buildGreenFlagEnduroClockData,
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
} from '../store/raceClockItemOnTheStore.testSupport.js';
import { buildGoodPollOfTheSimulator, firstPollAtMs } from './simulatorPolledByHand.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
// The seeded "Simulador — Enduro", which every new database has, turned off.
const enduroSimulatorId = 'simulador-enduro';

/**
 * The slices a screen is not sent, one row each, with what puts something in it on the
 * server (see fillEverySliceAScreenIsNotSent). Lists only: `obs`, an object, is sent to a
 * screen as "no OBS" whatever OBS does, which slicesSentToScreensObs.test.ts proves.
 */
export const sliceNamesAScreenIsNotSent: Array<Exclude<SliceName, 'obs' | 'triggerActivity'>> = [
  // A clock whose flag follows the simulator, taken after its poll (BAJAOVRLAY-20).
  'instanceBindings',
  // Seeded at the first boot: "Sessão principal".
  'rundowns',
  // The race clock item prepared in "Sessão principal".
  'items',
  // Seeded at the first boot: "Atalhos".
  'quickFirePanels',
  // The macro "Aguardar o pódio" (two waits, nothing on air).
  'macros',
  // That macro pressed: its run lasts 20 seconds, longer than any of these tests.
  'macroRuns',
  // An HTTP trigger that runs that macro (BAJAOVRLAY-48).
  'triggers',
  // Seeded at the first boot: the simulator (and the store adds no other).
  'dataSources',
  // The one poll of the simulator recorded by hand.
  'dataSnapshots',
  // The session name of the simulator corrected by the operator (BAJAOVRLAY-20).
  'overrides',
  // "Gravar" pressed on the simulator: closed when it is turned off, but kept listed.
  'recordings',
  // Every command above writes a row.
  'eventLog',
];

/**
 * Puts something into every slice a screen is not sent: an item, a macro, a trigger
 * naming it and its run,
 * the simulator recorded (no line in it), then polled once by hand and turned off, a
 * clock bound to its flag taken, and its session name corrected
 * (all within one tick, so the poller's first poll, on a 0 ms timer, never runs). Throws when the
 * store refuses a step, so a broken Arrange step fails loudly.
 */
export function fillEverySliceAScreenIsNotSent(stateStore: StateStore): void {
  createRaceClockItemOnTheStore(stateStore);
  applyOrThrow(stateStore, {
    type: 'createMacro',
    label: 'Aguardar o pódio',
    color: 'success',
    steps: [
      { kind: 'wait', ms: 10_000 },
      { kind: 'wait', ms: 10_000 },
    ],
  });
  const createdMacroId = stateStore.readAllSlices().macros[0]?.id ?? 'macro-nao-criada';
  applyOrThrow(stateStore, {
    type: 'createTrigger',
    name: 'Botão do pódio',
    when: { kind: 'http' },
    macroId: createdMacroId,
  });
  applyOrThrow(stateStore, { type: 'runMacro', macroId: createdMacroId });
  // "Gravar" is pressed and the source turned off before its poll, so the recording
  // holds no line: on a running server the recorder writes the source's snapshot when a
  // recording opens and counts the line a moment later, so the slices a test read
  // beforehand would no longer match what the hello carries.
  turnTheSimulatorOnOrOff(stateStore, true);
  applyOrThrow(stateStore, { type: 'startRecording', sourceId: enduroSimulatorId });
  turnTheSimulatorOnOrOff(stateStore, false);
  turnTheSimulatorOnOrOff(stateStore, true);
  applyOrThrow(
    stateStore,
    buildGoodPollOfTheSimulator(6, firstPollAtMs),
    buildDataSourcePollerActor(enduroSimulatorId),
  );
  turnTheSimulatorOnOrOff(stateStore, false);
  // The simulator now has data (and stays off): a clock bound to its flag can go on air.
  const boundClockItemId = createRaceClockItemOnTheStore(stateStore, {
    label: 'Relógio do enduro — fonte',
    fields: {
      ...buildLiteralItemFieldsFromData(buildGreenFlagEnduroClockData()),
      state: {
        kind: 'binding',
        sourceId: enduroSimulatorId,
        shapeKey: 'session',
        path: 'state',
        isLive: true,
      },
    },
  });
  applyOrThrow(stateStore, { type: 'takeItem', itemId: boundClockItemId });
  applyOrThrow(stateStore, {
    type: 'setOverride',
    sourceId: enduroSimulatorId,
    scope: 'session',
    field: 'sessionName',
    value: 'Enduro — Etapa Nacional',
    reason: 'Nome oficial da prova.',
  });
}

/** The names of the slices a screen is not sent that hold nothing on the server. */
export function listHiddenSlicesTheServerHoldsNothingIn(slicesOnTheServer: Slices): SliceName[] {
  return sliceNamesAScreenIsNotSent.filter((sliceName) => {
    const slice: unknown[] = slicesOnTheServer[sliceName];
    return slice.length === 0;
  });
}

/** Turns the seeded simulator on or off, as the operator does with its switch. */
function turnTheSimulatorOnOrOff(stateStore: StateStore, isEnabled: boolean): void {
  applyOrThrow(stateStore, {
    type: 'setDataSourceEnabled',
    sourceId: enduroSimulatorId,
    isEnabled,
  });
}

/** Sends one command to the store as the operator (or the given actor); throws on a refusal. */
function applyOrThrow(
  stateStore: StateStore,
  command: Record<string, unknown>,
  actor: string = operatorActor,
): void {
  const outcome = stateStore.applyCommand(command, actor);
  if (!outcome.ok) {
    throw new Error(`The store refused ${String(command.type)}: ${JSON.stringify(outcome)}`);
  }
}
