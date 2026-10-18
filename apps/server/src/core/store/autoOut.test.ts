/**
 * Auto-out: taking an item off air by itself after its delay (apps/server)
 *
 * What this module is for:
 *   An item may carry `autoOutAfterMs`, for graphics that should not stay up, such as a
 *   lower third. When such an item is taken, the scheduler waits that long and then
 *   sends a clearLayer of the item's layer, aimed at program, through the store, signed
 *   `sistema:auto-out`, so it is validated, saved, logged and broadcast like any other
 *   command. If the graphic leaves its layer first (another take there, a clear), the
 *   wait is called off.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - The layer is cleared exactly when the delay is over, not before, and the event
 *     log names `sistema:auto-out` as the one who cleared it, with a clear of program
 *     only (autoOutPreviewAndClearAll.test.ts proves a preview there stays).
 *   - A take on the same layer, or a clear, calls the wait off: what the operator put
 *     there afterwards stays on air.
 *   - Taking the same item again starts the wait again from zero.
 *   - A take on another layer does not call the wait off.
 *   - An item with no delay is never cleared, not even while another item with a delay
 *     exists; neither is an item whose delay is longer than a timer can wait (it would
 *     otherwise vanish at once).
 *   - After a server restart nothing is rescheduled: what was on air stays on air until
 *     the operator clears it.
 *   - Stopping the scheduler calls every wait off; a clear that fails is logged, not thrown.
 *   - The timer functions can be replaced, and are asked for exactly the item's delay.
 *
 * What these tests deliberately do not cover:
 *   - The rules of takeItem and clearLayer themselves; the tests in reducers/ cover them.
 *   - A take on the preview output and clearAll; autoOutPreviewAndClearAll.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { startAutoOutScheduler } from './autoOut.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import {
  createItemOnTheStore,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** Builds the createItem of a race clock item, with the given auto-out delay (or none). */
function buildCreateClockItemCommand(autoOutAfterMs: number | undefined) {
  const command: Record<string, unknown> = {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Relógio do patrocinador',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
  };
  if (autoOutAfterMs !== undefined) {
    command.autoOutAfterMs = autoOutAfterMs;
  }
  return command;
}

/**
 * Opens a store on the given database. Each new item gets a fresh id, which the test
 * reads from the createItem answer (`createdItemId`), since some tests create two items.
 */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string): StateStore {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
  });
}

/**
 * Builds what every test here starts from: fake timers (put back after the test), a
 * store on a fresh database holding one race clock item with the given auto-out delay
 * (its id is `sponsorClockItemId`), and a running scheduler. Also returns what a
 * simulated restart needs.
 */
function startStoreAndSchedulerWithClockItem(options: {
  autoOutAfterMs: number | undefined;
  logger?: ServerLogger;
}) {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const databasePath = createTemporaryDatabasePath();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const database = openDatabaseForTests(databasePath);
  const store = openStoreOnDatabase(database, graphicPackagesFolder);
  const sponsorClockItemId = createItemOnTheStore(
    store,
    buildCreateClockItemCommand(options.autoOutAfterMs),
  );
  const scheduler = startAutoOutScheduler({
    stateStore: store,
    logger: options.logger ?? createLogger({ level: 'silent' }),
  });
  onTestFinished(() => scheduler.stop());
  return { store, sponsorClockItemId, scheduler, database, databasePath, graphicPackagesFolder };
}

/** Reads which layers have something on air, to say in one word what is on screen. */
function readLayerIdsOnAir(store: StateStore): string[] {
  return store.readAllSlices().instances.map((instance) => instance.layerId);
}

describe('auto-out of an item taken with a delay', () => {
  it('clears the layer exactly when the delay is over, signed sistema:auto-out', () => {
    // Arrange: a clock item that leaves by itself after 10 seconds, taken now.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);

    // Act: let 9.999 seconds pass, look, then let the last millisecond pass.
    vi.advanceTimersByTime(9_999);
    const layerIdsOnAirJustBefore = readLayerIdsOnAir(store);
    vi.advanceTimersByTime(1);

    // Assert: on air until the last moment, then gone, and the log says who cleared it.
    expect(layerIdsOnAirJustBefore, 'the clock must stay on air until the delay is over').toEqual([
      'clock',
    ]);
    expect(readLayerIdsOnAir(store), 'the clock must leave when the delay is over').toEqual([]);
    const newestLogEntry = store.readAllSlices().eventLog.at(-1);
    expect(
      [newestLogEntry?.actor, newestLogEntry?.command, newestLogEntry?.payload],
      'the clear must be a clearLayer of program in the event log, signed sistema:auto-out',
    ).toEqual([
      'sistema:auto-out',
      'clearLayer',
      { type: 'clearLayer', layerId: 'clock', target: 'program' },
    ]);
  });

  it('is called off by a take on the same layer, which then stays on air', () => {
    // Arrange: the 10 second item taken, and 4 seconds later a clock item with no delay
    // taken on the same layer.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    const clockItemWithoutDelayId = createRaceClockItemOnTheStore(store);
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    vi.advanceTimersByTime(4_000);
    store.applyCommand({ type: 'takeItem', itemId: clockItemWithoutDelayId }, operatorActor);

    // Act: let a whole minute pass.
    vi.advanceTimersByTime(60_000);

    // Assert: the clock with no delay is still there and nobody sent a clearLayer.
    expect(readLayerIdsOnAir(store), 'the later take must not be cleared by the old wait').toEqual([
      'clock',
    ]);
    expect(
      store.readAllSlices().eventLog.map((entry) => entry.command),
      'no clearLayer may be sent once the wait was called off',
    ).toEqual(['createItem', 'createItem', 'takeItem', 'takeItem']);
  });

  it('is called off by a clear, so a graphic taken afterwards stays on air', () => {
    // Arrange: the 10 second item taken, cleared by the operator after 4 seconds, and a
    // clock item with no delay taken 2 seconds after that.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    const clockItemWithoutDelayId = createRaceClockItemOnTheStore(store);
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    vi.advanceTimersByTime(4_000);
    store.applyCommand({ type: 'clearLayer', layerId: 'clock' }, operatorActor);
    vi.advanceTimersByTime(2_000);
    store.applyCommand({ type: 'takeItem', itemId: clockItemWithoutDelayId }, operatorActor);

    // Act: let a whole minute pass.
    vi.advanceTimersByTime(60_000);

    // Assert: the clock with no delay is still on air.
    expect(
      readLayerIdsOnAir(store),
      'a wait called off by a clear must not clear a later take',
    ).toEqual(['clock']);
  });

  it('starts the wait again from zero when the same item is taken again', () => {
    // Arrange: the 10 second item taken, and taken again 6 seconds later.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    vi.advanceTimersByTime(6_000);
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);

    // Act: go to 15.999 seconds after the first take, look, then pass 16 seconds.
    vi.advanceTimersByTime(9_999);
    const layerIdsOnAirBeforeSecondDelayEnds = readLayerIdsOnAir(store);
    vi.advanceTimersByTime(1);

    // Assert: the first wait did not fire at 10 s; the second one fired at 16 s.
    expect(
      layerIdsOnAirBeforeSecondDelayEnds,
      'the second take must be on air for its own full 10 seconds',
    ).toEqual(['clock']);
    expect(readLayerIdsOnAir(store), 'the second wait must clear the layer').toEqual([]);
  });

  it('is not called off by a take on another layer', () => {
    // Arrange: the 10 second item taken on the clock layer, then a clock item with no
    // delay taken on the fullscreen layer after 4 seconds.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    const fullscreenClockItemId = createRaceClockItemOnTheStore(store, { layerId: 'fullscreen' });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    vi.advanceTimersByTime(4_000);
    store.applyCommand({ type: 'takeItem', itemId: fullscreenClockItemId }, operatorActor);

    // Act: let the rest of the 10 seconds pass.
    vi.advanceTimersByTime(6_000);

    // Assert: the item left its layer; the other layer is untouched.
    expect(readLayerIdsOnAir(store), 'only the item layer may be cleared').toEqual(['fullscreen']);
  });
});

describe('takes that must never be cleared by auto-out', () => {
  it('leaves an item with no delay on air', () => {
    // Arrange: a clock item with no auto-out, taken now.
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: undefined,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);

    // Act: let an hour pass.
    vi.advanceTimersByTime(3_600_000);

    // Assert: still on air.
    expect(readLayerIdsOnAir(store), 'an item with no delay stays until cleared').toEqual([
      'clock',
    ]);
  });

  it('leaves an item on air when its delay is longer than a timer can wait', () => {
    // Arrange: a clock item with a 30 day delay, typed by mistake. Node cannot wait
    // longer than about 25 days and would fire such a timer after one millisecond.
    const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1000;
    const { store, sponsorClockItemId } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: thirtyDaysInMilliseconds,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);

    // Act: let a minute pass.
    vi.advanceTimersByTime(60_000);

    // Assert: the item did not vanish at once, and no timer was started for it.
    expect(readLayerIdsOnAir(store), 'an impossible delay must not clear the item at once').toEqual(
      ['clock'],
    );
    expect(vi.getTimerCount(), 'no timer may be started for a delay it cannot wait').toBe(0);
  });

  it('leaves an item with no delay on air, even while an item with a delay exists', () => {
    // Arrange: a 10 second item that is prepared but not taken, and a clock item with no
    // delay taken on the same layer.
    const { store } = startStoreAndSchedulerWithClockItem({ autoOutAfterMs: 10_000 });
    const clockItemWithoutDelayId = createRaceClockItemOnTheStore(store);
    store.applyCommand({ type: 'takeItem', itemId: clockItemWithoutDelayId }, operatorActor);

    // Act: let an hour pass.
    vi.advanceTimersByTime(3_600_000);

    // Assert: still on air.
    expect(
      readLayerIdsOnAir(store),
      'only the delay of the item taken counts, not of another item',
    ).toEqual(['clock']);
  });
});

describe('auto-out across a server restart and a shutdown', () => {
  it('reschedules nothing after a restart: what was on air stays on air', () => {
    // Arrange: the 10 second item taken, then the server stops 4 seconds later and
    // starts again on the same database file.
    const { store, sponsorClockItemId, scheduler, database, databasePath, graphicPackagesFolder } =
      startStoreAndSchedulerWithClockItem({ autoOutAfterMs: 10_000 });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    vi.advanceTimersByTime(4_000);
    scheduler.stop();
    database.$client.close();
    const databaseAfterRestart = openDatabaseForTests(databasePath);
    const storeAfterRestart = openStoreOnDatabase(databaseAfterRestart, graphicPackagesFolder);
    const schedulerAfterRestart = startAutoOutScheduler({
      stateStore: storeAfterRestart,
      logger: createLogger({ level: 'silent' }),
    });
    onTestFinished(() => schedulerAfterRestart.stop());

    // Act: let an hour pass on the restarted server.
    vi.advanceTimersByTime(3_600_000);

    // Assert: the item is still on air; the restart forgot the wait on purpose.
    expect(
      readLayerIdsOnAir(storeAfterRestart),
      'a restart must not reschedule the auto-out: the item stays until cleared by hand',
    ).toEqual(['clock']);
  });

  it('calls every wait off when the scheduler is stopped', () => {
    // Arrange: the 10 second item taken.
    const { store, sponsorClockItemId, scheduler } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);

    // Act: stop the scheduler, as the server does when it shuts down, and let time pass.
    scheduler.stop();
    vi.advanceTimersByTime(60_000);

    // Assert: nothing was cleared and no timer is left waiting.
    expect(readLayerIdsOnAir(store), 'a stopped scheduler must not clear anything').toEqual([
      'clock',
    ]);
    expect(vi.getTimerCount(), 'no timer may be left running after stop').toBe(0);
  });

  it('logs a clear that fails instead of throwing from the timer', () => {
    // Arrange: the 10 second item taken, then the event_log table vanishes, as on a
    // damaged file, so the clear cannot be saved. The logger is one we can read.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { store, sponsorClockItemId, database } = startStoreAndSchedulerWithClockItem({
      autoOutAfterMs: 10_000,
      logger,
    });
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    database.$client.exec('DROP TABLE event_log');

    // Act: let the delay pass.
    const letTheDelayPass = () => vi.advanceTimersByTime(10_000);

    // Assert: nothing is thrown (an error thrown from a timer would stop the server),
    // an error line names the layer, and the item is still on air, as in the database.
    expect(letTheDelayPass, 'a failed auto-out must not throw from the timer').not.toThrow();
    expect(readRecordedLines(), 'the failure must be logged with the layer').toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'auto-out could not clear the layer',
        layer_id: 'clock',
      }),
    );
    expect(readLayerIdsOnAir(store), 'the item stays on air when the clear failed').toEqual([
      'clock',
    ]);
  });
});

describe('auto-out with timer functions given by the caller', () => {
  it('asks the given timer for exactly the delay of the item, and cancels through it', () => {
    // Arrange: a store with a 7.5 second item, and hand-made timer functions that only
    // write down what they were asked.
    const database = openDatabaseForTests(createTemporaryDatabasePath());
    const store = openStoreOnDatabase(database, createGraphicsFolderWithBuiltRaceClock());
    const sponsorClockItemId = createItemOnTheStore(store, buildCreateClockItemCommand(7_500));
    const delaysAsked: number[] = [];
    const timerHandlesCancelled: unknown[] = [];
    const scheduler = startAutoOutScheduler({
      stateStore: store,
      logger: createLogger({ level: 'silent' }),
      startTimer: (onTimeIsUp, delayInMilliseconds) => {
        delaysAsked.push(delayInMilliseconds);
        return `espera-${delaysAsked.length}`;
      },
      cancelTimer: (timerHandle) => {
        timerHandlesCancelled.push(timerHandle);
      },
    });

    // Act: take the item, then stop the scheduler.
    store.applyCommand({ type: 'takeItem', itemId: sponsorClockItemId }, operatorActor);
    scheduler.stop();

    // Assert: one wait of 7.5 seconds was started, and that same wait was cancelled.
    expect(delaysAsked, 'the wait must be exactly the item delay').toEqual([7_500]);
    expect(timerHandlesCancelled, 'stop must cancel the wait it started').toEqual(['espera-1']);
  });
});
