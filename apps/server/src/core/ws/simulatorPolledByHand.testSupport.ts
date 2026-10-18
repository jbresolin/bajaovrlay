// Test support for the screen-slice tests of the hub: the seeded "Simulador — Enduro"
// polled by hand, so a test decides exactly which polls the store records and when.
// Nothing here keeps state between calls.
import type { RecordDataSourcePollCommand, SessionShape } from '@bajaovrlay/shared';

import { buildDataSourcePollerActor } from '../store/commandActors.js';
import type { StateStore } from '../store/createStateStore.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
// The seeded "Simulador — Enduro", which every new database has, turned off.
const enduroSimulatorId = 'simulador-enduro';
const enduroSimulatorPollerActor = buildDataSourcePollerActor(enduroSimulatorId);
/** The first poll of the enduro of 14 August 2027. */
export const firstPollAtMs = Date.parse('2027-08-14T14:00:02.000Z');
/** The second poll, two seconds later. */
export const secondPollAtMs = Date.parse('2027-08-14T14:00:04.000Z');
/** The third poll, two seconds after the second. */
export const thirdPollAtMs = Date.parse('2027-08-14T14:00:06.000Z');

/** Builds the enduro session with the given number of laps done by the leader. */
function buildEnduroSessionWithLeaderLaps(
  lapsCompletedByLeader: number,
  updatedAtMs: number,
): SessionShape {
  return {
    sessionId: 'enduro-2027-nacional',
    eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
    sessionName: 'Enduro de Resistência',
    sessionKind: 'enduro',
    state: 'green',
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: 12_475_000,
      referenceWallClockMs: updatedAtMs,
      running: true,
    },
    scheduledDurationMs: 14_400_000,
    lapsCompletedByLeader,
    updatedAtMs,
  };
}

/** The poller's good poll of the simulator: the session after some laps, at a moment. */
export function buildGoodPollOfTheSimulator(
  lapsCompletedByLeader: number,
  receivedAtMs: number,
): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: enduroSimulatorId,
    result: {
      ok: true,
      shapes: { session: buildEnduroSessionWithLeaderLaps(lapsCompletedByLeader, receivedAtMs) },
      receivedAtMs,
    },
  };
}

/**
 * Turns the simulator on, records the given polls by hand and turns it off again, all
 * within one tick: the poller's first poll waits on a 0 ms timer, and turning the source
 * off calls that timer off, so the only polls recorded are these. The snapshot stays.
 */
export function recordPollsOfTheSimulatorByHand(
  stateStore: StateStore,
  polls: RecordDataSourcePollCommand[],
): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: true },
    operatorActor,
  );
  for (const poll of polls) {
    stateStore.applyCommand(poll, enduroSimulatorPollerActor);
  }
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: false },
    operatorActor,
  );
}
