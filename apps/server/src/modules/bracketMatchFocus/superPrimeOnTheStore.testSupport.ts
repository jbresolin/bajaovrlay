// Test support for the match focus through a real store: a store on a temporary database,
// the seeded simulator on and polled by hand with a Super Prime of eight cars (the poller
// is not started, so no poll arrives that the test did not send), and the two commands as
// the page sends them. The rounds come from shared's superPrimeBrackets.testSupport. Every
// function builds fresh objects on each call.
import type { BracketRound } from '@bajaovrlay/shared';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import {
  buildDataSourcePollerActor,
  buildLoggedInOperatorActor,
} from '../../core/store/commandActors.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';

/** The Produtor at the main desk, who moves "agora" and "a seguir". */
export const producerActor = buildLoggedInOperatorActor('produtor', 'Mesa 1');

/** The data operator, who prepares the show but never changes the air. */
export const dataOperatorActor = buildLoggedInOperatorActor('dados', 'Mesa 2');

/** The seeded simulator every new database has. */
export const simulatorSourceId = 'simulador-enduro';

/** The session of shared's Super Prime builders. */
export const superPrimeSessionId = 'super-prime-30a-competicao';

/** 15:30 UTC on 15 August 2027, the Super Prime's afternoon: the store's clock in these tests. */
const momentOfTheCommandsMs = Date.parse('2027-08-15T15:30:00.000Z');

/** A store on a temporary database (or the one given) with the seeded simulator on. */
export function openStoreWithTheSimulatorOn(databasePath = createTemporaryDatabasePath()) {
  const stateStore = createStateStore({
    database: openDatabaseForTests(databasePath),
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentOfTheCommandsMs),
  });
  applyOrThrow(stateStore, {
    type: 'setDataSourceEnabled',
    sourceId: simulatorSourceId,
    isEnabled: true,
  });
  return { stateStore, databasePath };
}

/** Records one good poll of the simulator carrying these rounds, as its poller. */
export function pollTheSimulatorWithRounds(
  stateStore: StateStore,
  rounds: BracketRound[],
  sessionId: string = superPrimeSessionId,
): void {
  applyOrThrow(
    stateStore,
    {
      type: 'recordDataSourcePoll',
      sourceId: simulatorSourceId,
      result: {
        ok: true,
        shapes: { brackets: { sessionId, updatedAtMs: momentOfTheCommandsMs, rounds } },
        receivedAtMs: momentOfTheCommandsMs,
      },
    },
    buildDataSourcePollerActor(simulatorSourceId),
  );
}

/** "Escolher partida" for a slot, as the page sends it. */
export function buildChoiceOf(slot: 'current' | 'upNext', matchId: string | null) {
  return {
    type: 'setBracketMatchFocus',
    sourceId: simulatorSourceId,
    sessionId: superPrimeSessionId,
    slot,
    matchId,
  };
}

/**
 * "Usar sugestão", as the page sends it: with the proposal the page showed, "agora" and "a
 * seguir" (null when it showed nothing "a seguir").
 */
export function buildAcceptOf(currentMatchId: string, upNextMatchId: string | null) {
  return {
    type: 'acceptSuggestedBracketMatches',
    sourceId: simulatorSourceId,
    sessionId: superPrimeSessionId,
    currentMatchId,
    upNextMatchId,
  };
}

/** The simulator's match focus now, if the operator ever chose. */
export function readFocusOfTheSimulator(stateStore: StateStore) {
  return stateStore
    .readAllSlices()
    .bracketMatchFocuses.find((focus) => focus.sourceId === simulatorSourceId);
}

/** The newest row of the event log. */
export function readNewestEventLogRow(stateStore: StateStore) {
  return stateStore.readAllSlices().eventLog.at(-1);
}

/** Sends one command to the store (as the Produtor unless told); throws on a refusal. */
export function applyOrThrow(
  stateStore: StateStore,
  command: Record<string, unknown>,
  actor: string = producerActor,
): void {
  const outcome = stateStore.applyCommand(command, actor);
  if (!outcome.ok) {
    throw new Error(`The store refused ${String(command.type)}: ${JSON.stringify(outcome)}`);
  }
}
