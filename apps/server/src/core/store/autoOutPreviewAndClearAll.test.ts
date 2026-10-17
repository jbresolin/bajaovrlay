/**
 * Auto-out: the preview output and the panic clear (apps/server)
 *
 * What this module is for:
 *   An item taken with `autoOutAfterMs` leaves its layer by itself after that delay. The
 *   wait belongs to the instance the take put on the program output, and is called off
 *   only when that instance is gone. Two cases of that rule are easy to get wrong and
 *   are written down in docs/decisions.md, so they are proven here: a take on the same
 *   layer of the PREVIEW output does not remove the program instance, so the wait goes
 *   on; a clearAll removes it, so the wait is called off.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - A preview of another item on the same layer (previewItem) does not call the wait
 *     off: the program instance leaves exactly when its delay is over, signed
 *     `sistema:auto-out`, and the preview on that layer stays, because the auto-out
 *     clears program only.
 *   - clearAll calls the wait off at once: no timer is left, and an item with no delay
 *     taken on that layer afterwards stays on air.
 *
 * What these tests deliberately do not cover:
 *   - Every other way a wait starts, ends or is called off; autoOut.test.ts covers them.
 *   - Whether `sistema:auto-out` may send its clear; authorizeCommand.test.ts covers it.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { startAutoOutScheduler } from './autoOut.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { createRaceClockItemOnTheStore } from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

// "Relógio do patrocinador": the same clock as an item that leaves by itself after 10 s.
const createSponsorClockItemThatLeavesAfterTenSeconds = {
  type: 'createItem',
  home: { kind: 'rundown', rundownId: 'sessao-principal' },
  graphicId: 'race-clock',
  layerId: 'clock',
  label: 'Relógio do patrocinador',
  autoOutAfterMs: 10_000,
  fields: {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 3_900_000 },
    referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
    running: { kind: 'literal', value: true },
  },
};

/**
 * Builds what both tests start from: fake timers (put back after the test), a store on
 * a fresh database, a running scheduler, "Relógio do enduro" (a clock item with no
 * delay) prepared, and the 10 second sponsor clock item already taken on the program
 * output. Returns the store and the id of the item with no delay.
 */
function startStoreAndSchedulerWithTheSponsorClockOnAir(): {
  store: StateStore;
  clockItemWithoutDelayId: string;
} {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const store = createStateStore({
    database: openTemporaryDatabase().database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
  });
  const scheduler = startAutoOutScheduler({
    stateStore: store,
    logger: createLogger({ level: 'silent' }),
  });
  onTestFinished(() => scheduler.stop());
  const clockItemWithoutDelayId = createRaceClockItemOnTheStore(store);
  const outcomeOfTheSponsorItem = store.applyCommand(
    createSponsorClockItemThatLeavesAfterTenSeconds,
    operatorActor,
  );
  if (!outcomeOfTheSponsorItem.ok || outcomeOfTheSponsorItem.createdItemId === undefined) {
    throw new Error('The sponsor clock item was not created, so no test here can run.');
  }
  store.applyCommand(
    { type: 'takeItem', itemId: outcomeOfTheSponsorItem.createdItemId },
    operatorActor,
  );
  return { store, clockItemWithoutDelayId };
}

/** Reads the layer and output of everything on air, as `layer on output` words. */
function readLayersAndOutputsOnAir(store: StateStore): string[] {
  return store
    .readAllSlices()
    .instances.map((instance) => `${instance.layerId} on ${instance.target}`);
}

describe('auto-out and a take on the preview output of the same layer', () => {
  it('is not called off: the program instance leaves exactly when its delay is over', () => {
    // Arrange: the 10 second item on program, and 4 seconds later the operator checks
    // the clock item with no delay on the PREVIEW output of the same layer.
    const { store, clockItemWithoutDelayId } = startStoreAndSchedulerWithTheSponsorClockOnAir();
    vi.advanceTimersByTime(4_000);
    const outcomeOfPreviewTake = store.applyCommand(
      { type: 'previewItem', itemId: clockItemWithoutDelayId },
      operatorActor,
    );

    // Act: go to one millisecond before the 10 seconds are over, look, then pass it.
    vi.advanceTimersByTime(5_999);
    const onAirJustBeforeTheDelayEnds = readLayersAndOutputsOnAir(store);
    const numberOfWaitsJustBeforeTheDelayEnds = vi.getTimerCount();
    vi.advanceTimersByTime(1);

    // Assert: the preview was accepted and left the item on program with its wait
    // still running; at 10 seconds the scheduler sent its clearLayer aimed at program,
    // which takes the item off air and leaves the operator's preview where it was.
    expect(outcomeOfPreviewTake, 'the preview must be accepted').toEqual({ ok: true });
    expect(
      onAirJustBeforeTheDelayEnds,
      'the item must still be on program beside the preview until its delay is over',
    ).toEqual(['clock on program', 'clock on preview']);
    expect(
      numberOfWaitsJustBeforeTheDelayEnds,
      'the wait of the program instance must still be running after the preview',
    ).toBe(1);
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.actor, entry.command]),
      'the auto-out must still fire, as a clearLayer signed sistema:auto-out',
    ).toEqual([
      [operatorActor, 'createItem'],
      [operatorActor, 'createItem'],
      [operatorActor, 'takeItem'],
      [operatorActor, 'previewItem'],
      ['sistema:auto-out', 'clearLayer'],
    ]);
    expect(
      readLayersAndOutputsOnAir(store),
      'the auto-out must take the item off program and keep the preview prepared on that layer',
    ).toEqual(['clock on preview']);
  });
});

describe('auto-out and the panic clear', () => {
  it('is called off by clearAll, so a graphic taken afterwards stays on air', () => {
    // Arrange: the 10 second item on program; after 4 seconds the operator presses the
    // panic button, and 2 seconds later takes the clock item with no delay on that layer.
    const { store, clockItemWithoutDelayId } = startStoreAndSchedulerWithTheSponsorClockOnAir();
    vi.advanceTimersByTime(4_000);
    store.applyCommand({ type: 'clearAll' }, operatorActor);
    const numberOfWaitsRightAfterClearAll = vi.getTimerCount();
    vi.advanceTimersByTime(2_000);
    store.applyCommand({ type: 'takeItem', itemId: clockItemWithoutDelayId }, operatorActor);

    // Act: let a whole minute pass, far beyond the 10 seconds of the old wait.
    vi.advanceTimersByTime(60_000);

    // Assert: the wait was called off at the clearAll, nobody sent a clearLayer, and the
    // clock with no delay is still on air.
    expect(
      numberOfWaitsRightAfterClearAll,
      'clearAll must call the pending auto-out off at once',
    ).toBe(0);
    expect(
      store.readAllSlices().eventLog.map((entry) => entry.command),
      'no clearLayer may be sent once clearAll called the wait off',
    ).toEqual(['createItem', 'createItem', 'takeItem', 'clearAll', 'takeItem']);
    expect(
      readLayersAndOutputsOnAir(store),
      'the clock taken after the clearAll must not be cleared by the old wait',
    ).toEqual(['clock on program']);
  });
});
