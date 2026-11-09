// Test support: a real store whose clock is a server clock over Vitest's fake Date and
// fake performance, so a test can step the machine's wall clock (Date.now() alone) while
// monotonic time runs on, as WSL2's and Docker Desktop's time sync do under load.
// Every function builds fresh objects on each call, so no test sees another's.
import { onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../store/createStateStore.js';
import { createItemOnTheStore } from '../store/raceClockItemOnTheStore.testSupport.js';
import { createServerClock } from './serverClock.js';

/** The operator's page, which prepares and takes the clock. */
export const operatorWhoRunsTheClock = 'operador:conexao-7';

/** 10 October 2026, 13:00 UTC (10:00 in Brasília): the enduro is an hour in. */
export const tenOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/**
 * Fakes the machine's wall clock, its monotonic time and its interval timers at ten
 * o'clock of the enduro, and puts the real ones back when the test ends.
 */
export function fakeTheMachineClocksAtTenOClock(): void {
  vi.useFakeTimers({
    toFake: ['Date', 'performance', 'setInterval', 'clearInterval'],
    now: tenOClockOfTheEnduroMs,
  });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Steps the wall clock alone by the given milliseconds, as a time sync does. */
export function stepTheWallClockBy(milliseconds: number): void {
  vi.setSystemTime(Date.now() + milliseconds);
}

/**
 * Builds a server clock and a store on a fresh database with the built race clock, the
 * store stamping every command with that server clock (as startServer wires them).
 * Call fakeTheMachineClocksAtTenOClock first, so the clock starts at ten o'clock.
 */
export function createStoreOnAServerClock() {
  const serverClock = createServerClock();
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: serverClock.readCurrentTime,
  });
  return { serverClock, store };
}

/**
 * Creates "Largada do enduro" (a race clock from 0:00 whose reference moment is the
 * take) on the clock layer, running or held as asked, and takes it on air.
 */
export function takeTheEnduroClockOnAir(
  store: ReturnType<typeof createStoreOnAServerClock>['store'],
  options: { isRunning: boolean },
): void {
  const itemId = createItemOnTheStore(store, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Largada do enduro',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: options.isRunning },
    },
  });
  const outcome = store.applyCommand({ type: 'takeItem', itemId }, operatorWhoRunsTheClock);
  if (!outcome.ok) {
    throw new Error(`The enduro clock was not taken: ${JSON.stringify(outcome)}`);
  }
}

/** Stops the clock on air, as "Parar" in "Edição rápida" does: one field, running false. */
export function stopTheClockOnAir(
  store: ReturnType<typeof createStoreOnAServerClock>['store'],
): void {
  const instanceOnAir = store.readAllSlices().instances[0];
  if (instanceOnAir === undefined) {
    throw new Error('There is no clock on air to stop.');
  }
  const outcome = store.applyCommand(
    { type: 'updateInstanceData', instanceId: instanceOnAir.id, data: { running: false } },
    operatorWhoRunsTheClock,
  );
  if (!outcome.ok) {
    throw new Error(`The clock on air was not stopped: ${JSON.stringify(outcome)}`);
  }
}
