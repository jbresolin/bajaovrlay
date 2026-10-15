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
 *   - A take on the same layer for the preview output does not call the wait off: the
 *     program instance leaves exactly when its delay is over, signed `sistema:auto-out`.
 *   - clearAll calls the wait off at once: no timer is left, and a graphic taken on that
 *     layer afterwards stays on air.
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

const operatorActor = 'operador:conexao-7';
const idOfTheSponsorClockItem = 'item-relogio-do-patrocinador';

// The enduro under green flag, 1:05:00 in and running: all six fields the race clock needs.
const greenFlagEnduroData = {
  sessionName: 'Enduro de Resistência',
  state: 'green',
  clockMode: 'elapsed',
  referenceTimeMs: 3_900_000,
  referenceWallClockMs: 1_791_550_800_000,
  running: true,
};

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
 * a fresh database, a running scheduler, and the 10 second sponsor clock item already
 * taken on the program output.
 */
function startStoreAndSchedulerWithTheSponsorClockOnAir(): StateStore {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const store = createStateStore({
    database: openTemporaryDatabase().database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    createItemId: () => idOfTheSponsorClockItem,
  });
  const scheduler = startAutoOutScheduler({
    stateStore: store,
    logger: createLogger({ level: 'silent' }),
  });
  onTestFinished(() => scheduler.stop());
  store.applyCommand(createSponsorClockItemThatLeavesAfterTenSeconds, operatorActor);
  store.applyCommand({ type: 'takeItem', itemId: idOfTheSponsorClockItem }, operatorActor);
  return store;
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
    // another clock on the PREVIEW output of the same layer.
    const store = startStoreAndSchedulerWithTheSponsorClockOnAir();
    vi.advanceTimersByTime(4_000);
    const outcomeOfPreviewTake = store.applyCommand(
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: greenFlagEnduroData,
        target: 'preview',
      },
      operatorActor,
    );

    // Act: go to one millisecond before the 10 seconds are over, look, then pass it.
    vi.advanceTimersByTime(5_999);
    const onAirJustBeforeTheDelayEnds = readLayersAndOutputsOnAir(store);
    const numberOfWaitsJustBeforeTheDelayEnds = vi.getTimerCount();
    vi.advanceTimersByTime(1);

    // Assert: the preview take was accepted and left the item on program with its wait
    // still running; at 10 seconds the scheduler sent its clearLayer, which empties the
    // layer on both outputs because clearLayer names only a layer.
    expect(outcomeOfPreviewTake, 'the take on preview must be accepted').toEqual({ ok: true });
    expect(
      onAirJustBeforeTheDelayEnds,
      'the item must still be on program beside the preview take until its delay is over',
    ).toEqual(['clock on program', 'clock on preview']);
    expect(
      numberOfWaitsJustBeforeTheDelayEnds,
      'the wait of the program instance must still be running after the preview take',
    ).toBe(1);
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.actor, entry.command]),
      'the auto-out must still fire, as a clearLayer signed sistema:auto-out',
    ).toEqual([
      [operatorActor, 'createItem'],
      [operatorActor, 'takeItem'],
      [operatorActor, 'takeGraphic'],
      ['sistema:auto-out', 'clearLayer'],
    ]);
    expect(
      readLayersAndOutputsOnAir(store),
      'the clear must take the item off program (and, naming only a layer, the preview too)',
    ).toEqual([]);
  });
});

describe('auto-out and the panic clear', () => {
  it('is called off by clearAll, so a graphic taken afterwards stays on air', () => {
    // Arrange: the 10 second item on program; after 4 seconds the operator presses the
    // panic button, and 2 seconds later takes a clock by hand on the same layer.
    const store = startStoreAndSchedulerWithTheSponsorClockOnAir();
    vi.advanceTimersByTime(4_000);
    store.applyCommand({ type: 'clearAll' }, operatorActor);
    const numberOfWaitsRightAfterClearAll = vi.getTimerCount();
    vi.advanceTimersByTime(2_000);
    store.applyCommand(
      { type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock', data: greenFlagEnduroData },
      operatorActor,
    );

    // Act: let a whole minute pass, far beyond the 10 seconds of the old wait.
    vi.advanceTimersByTime(60_000);

    // Assert: the wait was called off at the clearAll, nobody sent a clearLayer, and the
    // clock taken by hand is still on air.
    expect(
      numberOfWaitsRightAfterClearAll,
      'clearAll must call the pending auto-out off at once',
    ).toBe(0);
    expect(
      store.readAllSlices().eventLog.map((entry) => entry.command),
      'no clearLayer may be sent once clearAll called the wait off',
    ).toEqual(['createItem', 'takeItem', 'clearAll', 'takeGraphic']);
    expect(
      readLayersAndOutputsOnAir(store),
      'the clock taken after the clearAll must not be cleared by the old wait',
    ).toEqual(['clock on program']);
  });
});
