/**
 * The server's own jobs on a layer of the PiP output (apps/server)
 *
 * What this module is for:
 *   The auto-out, the macro runner, the event inbox and the live refresher act on a layer
 *   by its id, from timers of their own (BAJAOVRLAY-49 asks to prove they still work on a
 *   layer the operator added to another output, not to assume it). Each test adds the
 *   PiP output and its caption layer through the store, as "Saídas e camadas" does, puts
 *   a race clock there, and lets the job run.
 *
 * What these tests prove (with a real SQLite file and timers run by hand):
 *   - The auto-out clears the caption when the item's delay is over.
 *   - A macro takes an item onto the caption and then clears it.
 *   - "No ar" on an event whose rule's item is on the caption shows the notice there.
 *   - A live bound field of a clock on the caption follows the source.
 *
 * What these tests deliberately do not cover:
 *   - Each job in detail; autoOut.test.ts, macroRunner.test.ts, modules/events and
 *     modules/bindings cover them on program's layers.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { startAutoOutScheduler } from '../../core/store/autoOut.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import { startMacroRunner } from '../../core/store/macroRunner.js';
import {
  applyOrThrow as applyOnTheRefresherStore,
  buildEnduroSession,
  buildSessionBinding,
  createClockItem,
  openStoreWithTheRefresher,
  pollTheSimulatorWithSession,
  readInstanceOn,
} from '../bindings/liveRefresh.testSupport.js';
import {
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from '../events/detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow as applyOnTheInboxStore,
  createClockItemForEvents,
  openEventInboxOnTheStore,
  pollTheSimulator,
} from '../events/eventInboxOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** The commands that add the PiP output and its caption layer, as the settings page does. */
const commandsThatAddThePipAndItsCaption = [
  { type: 'createOutput', outputId: 'pip', name: 'PiP' },
  {
    type: 'createLayer',
    layerId: 'legenda-pip',
    outputId: 'pip',
    name: 'Legenda',
    zIndex: 20,
    replacePolicy: 'out-then-in',
    persistent: false,
  },
];

/** The createItem of a race clock under green on the PiP's caption. */
function buildCreateClockOnTheCaption(autoOutAfterMs?: number) {
  return {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'race-clock',
    layerId: 'legenda-pip',
    label: 'Relógio na PiP',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
    ...(autoOutAfterMs === undefined ? {} : { autoOutAfterMs }),
  };
}

/**
 * Fake timers (put back after the test), a store on a fresh database with the PiP and
 * its caption, and the clock item on the caption with the delay given; answers both.
 */
function openStoreWithAClockOnTheCaption(autoOutAfterMs?: number) {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const store = createStateStore({
    database: openDatabaseForTests(createTemporaryDatabasePath()),
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    createItemId: () => 'item-relogio-na-pip',
    createMacroId: () => 'macro-relogio-na-pip',
  });
  for (const command of commandsThatAddThePipAndItsCaption) {
    store.applyCommand(command, operatorActor);
  }
  store.applyCommand(buildCreateClockOnTheCaption(autoOutAfterMs), operatorActor);
  return { store, clockItemId: 'item-relogio-na-pip' };
}

/** Which layers have something on air. */
function readLayerIdsOnAir(store: StateStore): string[] {
  return store.readAllSlices().instances.map((instance) => instance.layerId);
}

describe('the auto-out on the PiP caption', () => {
  it('clears the caption when the delay is over', () => {
    // Arrange: the clock on the caption leaves after 10 s; the scheduler runs; take it.
    const { store, clockItemId } = openStoreWithAClockOnTheCaption(10_000);
    const scheduler = startAutoOutScheduler({
      stateStore: store,
      logger: createLogger({ level: 'silent' }),
    });
    onTestFinished(() => scheduler.stop());
    store.applyCommand({ type: 'takeItem', itemId: clockItemId }, operatorActor);
    const layerIdsOnAirAtTheTake = readLayerIdsOnAir(store);

    // Act: let the ten seconds pass.
    vi.advanceTimersByTime(10_000);

    // Assert: on the caption at the take, gone after the delay.
    expect(layerIdsOnAirAtTheTake, 'the clock is on the caption').toEqual(['legenda-pip']);
    expect(readLayerIdsOnAir(store), 'the auto-out cleared the caption').toEqual([]);
  });
});

describe('a macro on the PiP caption', () => {
  it('takes the clock onto the caption and then clears it', () => {
    // Arrange: a macro that takes the clock and clears the caption; the runner runs.
    const { store, clockItemId } = openStoreWithAClockOnTheCaption();
    store.applyCommand(
      {
        type: 'createMacro',
        label: 'Relógio na PiP e fora',
        color: 'info',
        steps: [
          { kind: 'takeItem', itemId: clockItemId },
          { kind: 'wait', ms: 1000 },
          { kind: 'clearLayer', layerId: 'legenda-pip' },
        ],
      },
      operatorActor,
    );
    const runner = startMacroRunner({
      stateStore: store,
      logger: createLogger({ level: 'silent' }),
    });
    onTestFinished(() => runner.stop());

    // Act: press the macro, look after its take, then after its wait.
    store.applyCommand({ type: 'runMacro', macroId: 'macro-relogio-na-pip' }, operatorActor);
    vi.advanceTimersByTime(0);
    const layerIdsOnAirDuringTheWait = readLayerIdsOnAir(store);
    vi.advanceTimersByTime(1000);

    // Assert: on the caption during the wait, cleared by the last step.
    expect(layerIdsOnAirDuringTheWait, 'the macro took the clock onto the caption').toEqual([
      'legenda-pip',
    ]);
    expect(readLayerIdsOnAir(store), 'the macro cleared the caption').toEqual([]);
  });
});

describe('an event notice on the PiP caption', () => {
  it('"No ar" shows the notice on the caption', () => {
    // Arrange: the inbox; the PiP and its caption; the incidents rule showing its events
    // with a clock item moved onto the caption; car 47's penalty waiting.
    const inbox = openEventInboxOnTheStore();
    onTestFinished(() => inbox.shutDown());
    for (const command of commandsThatAddThePipAndItsCaption) {
      applyOnTheInboxStore(inbox.stateStore, command);
    }
    const itemId = createClockItemForEvents(inbox.stateStore, 'Aviso na PiP');
    applyOnTheInboxStore(inbox.stateStore, {
      type: 'updateItemFields',
      itemId,
      layerId: 'legenda-pip',
    });
    applyOnTheInboxStore(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      itemId,
    });
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    inbox.clock.letTimePass(60_000);
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Act: the operator presses "No ar".
    applyOnTheInboxStore(inbox.stateStore, {
      type: 'showEvent',
      eventId: 'simulador-enduro:incident:ocorrencia-0007',
    });

    // Assert: the notice is on air on the caption, carrying the event.
    const notice = inbox.stateStore
      .readAllSlices()
      .instances.find((instance) => instance.target === 'program');
    expect(notice?.layerId, 'the notice lands on the caption').toBe('legenda-pip');
    expect(notice?.eventId, 'it carries the event').toBe(
      'simulador-enduro:incident:ocorrencia-0007',
    );
  });
});

describe('live refresh on the PiP caption', () => {
  it('raises the yellow flag on a clock on the caption', () => {
    // Arrange: the simulator under green; the PiP and its caption; a clock there with
    // its flag bound live, on air.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    for (const command of commandsThatAddThePipAndItsCaption) {
      applyOnTheRefresherStore(stateStore, command);
    }
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio na PiP — fonte', 'legenda-pip', {
      state: buildSessionBinding('state'),
    });
    applyOnTheRefresherStore(stateStore, { type: 'takeItem', itemId: clockItemId });
    refreshTimer.runThePendingRefresh();

    // Act: the simulator raises the yellow flag, and the refresher runs.
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ state: 'yellow' }));
    refreshTimer.runThePendingRefresh();

    // Assert: the clock on the caption shows yellow.
    expect(
      readInstanceOn(stateStore, 'legenda-pip', 'program')?.resolvedData.state,
      'the clock on the caption follows the source',
    ).toBe('yellow');
  });
});
