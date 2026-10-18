// Test support shared by the poller, recorder and replay tests: the seeded "Simulador —
// Enduro", the operator who works it, the moment the tests start at, and the operator's
// commands every one of those tests sends. One home, so a change to the seeded simulator
// is made once.
import type { DataSource } from '@bajaovrlay/shared';

import type { StateStore } from '../../core/store/createStateStore.js';

/** The operator signed in on the control page. */
export const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
/** The id of the seeded "Simulador — Enduro". */
export const enduroSimulatorId = 'simulador-enduro';
/** 14:00 UTC on Saturday 14 August 2027, the enduro day: the moment these tests start at. */
export const startOfTheEnduroMs = Date.parse('2027-08-14T14:00:00.000Z');

/** The operator turns "Simulador — Enduro" on. */
export function turnTheSimulatorOn(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: true },
    operatorActor,
  );
}

/** The operator turns "Simulador — Enduro" off. */
export function turnTheSimulatorOff(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: false },
    operatorActor,
  );
}

/** Reads "Simulador — Enduro" as the store holds it now; fails the test if it is gone. */
export function readTheSimulator(stateStore: StateStore): DataSource {
  const simulator = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.id === enduroSimulatorId);
  if (simulator === undefined) {
    throw new Error('the seeded simulator is missing from the store');
  }
  return simulator;
}
