/**
 * Auto-out and the preview commands (apps/server)
 *
 * What this module is for:
 *   An item with `autoOutAfterMs` leaves its layer by itself that long after it goes ON
 *   AIR. Looking at the item in the Prévia monitor is not going on air: a preview must
 *   start no wait, or the item would vanish from the monitor (and, because the auto-out
 *   clears a whole layer, take the program output of that layer with it). When the
 *   preview is then sent to air with takePreview, the item is on air like after any
 *   take, so the wait starts there, counting from that take.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - previewItem of an item with a delay starts no wait: a minute later the preview is
 *     still there and nobody sent a clearLayer.
 *   - takePreview of that preview starts the wait at the take: the item leaves program
 *     exactly one delay after the take, signed `sistema:auto-out`, however long it had
 *     been previewed.
 *
 * What these tests deliberately do not cover:
 *   - Every other way a wait starts, ends or is called off; autoOut.test.ts and
 *     autoOutPreviewAndClearAll.test.ts cover them.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { startAutoOutScheduler } from './autoOut.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';
const idOfTheSponsorClockItem = 'item-relogio-do-patrocinador';

// "Relógio do patrocinador": the enduro clock as an item that leaves by itself after 10 s.
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
 * on the PREVIEW output of the clock layer.
 */
function startStoreAndSchedulerWithTheSponsorClockPreviewed(): StateStore {
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
  store.applyCommand({ type: 'previewItem', itemId: idOfTheSponsorClockItem }, operatorActor);
  return store;
}

/** Reads the layer and output of every instance, as `layer on output` words. */
function readLayersAndOutputs(store: StateStore): string[] {
  return store
    .readAllSlices()
    .instances.map((instance) => `${instance.layerId} on ${instance.target}`);
}

describe('auto-out and an item that is only previewed', () => {
  it('starts no wait: the preview is still there a minute later', () => {
    // Arrange: the 10 second item on the preview output.
    const store = startStoreAndSchedulerWithTheSponsorClockPreviewed();
    const numberOfWaitsRightAfterThePreview = vi.getTimerCount();

    // Act: let a whole minute pass, six times the item's delay.
    vi.advanceTimersByTime(60_000);

    // Assert: no wait was ever started, nobody sent a clearLayer, and the item is still
    // in the Prévia monitor.
    expect(numberOfWaitsRightAfterThePreview, 'a preview must start no auto-out wait').toBe(0);
    expect(
      store.readAllSlices().eventLog.map((entry) => entry.command),
      'no clearLayer may follow a preview',
    ).toEqual(['createItem', 'previewItem']);
    expect(readLayersAndOutputs(store), 'the preview must still be there').toEqual([
      'clock on preview',
    ]);
  });
});

describe('auto-out and a preview sent to air', () => {
  it('starts the wait at the take, so the item leaves one full delay after it', () => {
    // Arrange: the 10 second item previewed, looked at for 25 seconds, then taken.
    const store = startStoreAndSchedulerWithTheSponsorClockPreviewed();
    vi.advanceTimersByTime(25_000);
    const outcomeOfTake = store.applyCommand(
      { type: 'takePreview', layerId: 'clock' },
      operatorActor,
    );
    const numberOfWaitsRightAfterTheTake = vi.getTimerCount();

    // Act: go to one millisecond before the 10 seconds are over, look, then pass it.
    vi.advanceTimersByTime(9_999);
    const onAirJustBeforeTheDelayEnds = readLayersAndOutputs(store);
    vi.advanceTimersByTime(1);

    // Assert: the take started exactly one wait; the item stayed on program for the whole
    // delay counted from the take, and then left, cleared by the system.
    expect(outcomeOfTake, 'the take of the preview must be accepted').toEqual({ ok: true });
    expect(numberOfWaitsRightAfterTheTake, 'the take must start the wait of the item').toBe(1);
    expect(
      onAirJustBeforeTheDelayEnds,
      'the item must be on program until its delay, counted from the take, is over',
    ).toEqual(['clock on program']);
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.actor, entry.command]),
      'the auto-out must fire as a clearLayer signed sistema:auto-out',
    ).toEqual([
      [operatorActor, 'createItem'],
      [operatorActor, 'previewItem'],
      [operatorActor, 'takePreview'],
      ['sistema:auto-out', 'clearLayer'],
    ]);
    expect(readLayersAndOutputs(store), 'the layer must be empty after the auto-out').toEqual([]);
  });
});
