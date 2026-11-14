/**
 * Two consoles on one layer, through the store (apps/server)
 *
 * What this module is for:
 *   The store runs every command through one path and keeps, beside the slices, each layer's
 *   last program change and which console made it (BAJAOVRLAY-69). A take from a console is
 *   refused when another console changed that layer less than 2 s earlier on the server
 *   clock and the taking console had not seen it. This file runs that through a real store
 *   on a real SQLite file, with the server clock moved by hand between the commands.
 *
 * What these tests prove:
 *   - Mesa 2's take 0,8 s after Mesa 1's, made on a page that still showed the layer empty,
 *     is refused with the pt-BR sentence; the air keeps Mesa 1's take; the event-log row is
 *     failed and names both consoles' roles and the moment of Mesa 1's take.
 *   - The same take 2,1 s after Mesa 1's goes through, and so does one after the server
 *     clock stepped back since Mesa 1's (the store signs each change with the step count).
 *   - One console pressing two takes 0,3 s apart: both go through.
 *   - A take from the command API between them is recorded with no console, so Mesa 2's
 *     take right after it goes through (automation stays unguarded).
 *
 * What these tests deliberately do not cover:
 *   - Each case of the rule: consoles/unseenChangeByAnotherConsole.test.ts.
 *   - Where the console id comes from (the WebSocket hub): consoleOfConnection.test.ts and
 *     webSocketHubConsoleId.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import {
  buildGreenFlagEnduroClockData,
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from './raceClockItemOnTheStore.testSupport.js';

const producerAtMesa1 = 'produtor:Mesa 1';
const producerAtMesa2 = 'produtor:Mesa 2';
const consoleAtMesa1 = 'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';
const consoleAtMesa2 = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

/**
 * A store on a new database whose server clock reads whatever `clock.now` holds, and has
 * made `clock.stepCount` steps (none until a test steps it).
 */
function openStoreWithAClockMovedByHand() {
  const clock = { now: new Date('2026-10-09T14:32:00.000Z'), stepCount: 0 };
  const { database } = openTemporaryDatabase();
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => clock.now,
    readServerClockStepCount: () => clock.stepCount,
  });
  return { store, clock };
}

/** Creates two clock buttons on "Atalhos": the green flag and the yellow flag. Returns their ids. */
function createTheTwoFlagButtons(store: StateStore) {
  const greenFlagItemId = createRaceClockItemOnTheStore(store, {
    label: 'Bandeira verde',
    home: shortcutsPanelHome,
  });
  const yellowFlagItemId = createRaceClockItemOnTheStore(store, {
    label: 'Bandeira amarela',
    home: shortcutsPanelHome,
    fields: buildLiteralItemFieldsFromData({ ...buildGreenFlagEnduroClockData(), state: 'yellow' }),
  });
  return { greenFlagItemId, yellowFlagItemId };
}

/** The item on the program output of "Relógio" now, or undefined when it is empty. */
function readItemOnTheClockLayer(store: StateStore): string | undefined {
  const instanceOnAir = store
    .readAllSlices()
    .instances.find((instance) => instance.layerId === 'clock' && instance.target === 'program');
  return instanceOnAir?.itemId;
}

describe('two consoles taking on "Relógio" through the store', () => {
  it("refuses Mesa 2's take 0,8 s after Mesa 1's, keeps Mesa 1's on air, and logs both roles", () => {
    // Arrange: two flag buttons; Mesa 1 takes the green flag at 14:32:04.200.
    const { store, clock } = openStoreWithAClockMovedByHand();
    const { greenFlagItemId, yellowFlagItemId } = createTheTwoFlagButtons(store);
    clock.now = new Date('2026-10-09T14:32:04.200Z');
    store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );

    // Act: at 14:32:05, Mesa 2, whose page still showed "Relógio" empty, takes the yellow flag.
    clock.now = new Date('2026-10-09T14:32:05.000Z');
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: yellowFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa2,
      consoleAtMesa2,
    );

    // Assert: refused in pt-BR; the green flag still on air; the row names both roles.
    expect(outcome, "Mesa 2's take must be refused, saying what Mesa 1 did").toEqual({
      ok: false,
      error: {
        code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
        message:
          'Outra mesa (Produtor) tomou "Bandeira verde" na camada "Relógio" há 0,8 s; ' +
          'sua tomada de "Bandeira amarela" não foi feita.',
      },
    });
    expect(readItemOnTheClockLayer(store), "Mesa 1's take must stay on air").toBe(greenFlagItemId);
    const newestRow = store.readAllSlices().eventLog.at(-1);
    expect(
      { actor: newestRow?.actor, status: newestRow?.result.status, details: newestRow?.details },
      'the refused take must be logged as failed, with both consoles roles',
    ).toEqual({
      actor: producerAtMesa2,
      status: 'failed',
      details: {
        takesRefusedForAnotherConsole: [
          {
            layerId: 'clock',
            refusedConsoleRole: 'produtor',
            otherConsoleRole: 'produtor',
            otherConsoleChangedAt: '2026-10-09T14:32:04.200Z',
          },
        ],
      },
    });
  });

  it("lets Mesa 2's take through 2,1 s after Mesa 1's", () => {
    // Arrange: Mesa 1 takes the green flag at 14:32:04.200.
    const { store, clock } = openStoreWithAClockMovedByHand();
    const { greenFlagItemId, yellowFlagItemId } = createTheTwoFlagButtons(store);
    clock.now = new Date('2026-10-09T14:32:04.200Z');
    store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );

    // Act: at 14:32:06.300, Mesa 2 takes the yellow flag, its page still showing nothing.
    clock.now = new Date('2026-10-09T14:32:06.300Z');
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: yellowFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa2,
      consoleAtMesa2,
    );

    // Assert: accepted; the yellow flag is on air.
    expect(outcome, 'after 2 s the take must go through').toEqual({ ok: true });
    expect(readItemOnTheClockLayer(store), 'the yellow flag must be on air').toBe(yellowFlagItemId);
  });

  it("lets Mesa 2's take through when the server clock stepped back since Mesa 1's", () => {
    // Arrange: Mesa 1 takes the green flag at 14:32:04.200; then NTP steps the server clock
    // back 1 s.
    const { store, clock } = openStoreWithAClockMovedByHand();
    const { greenFlagItemId, yellowFlagItemId } = createTheTwoFlagButtons(store);
    clock.now = new Date('2026-10-09T14:32:04.200Z');
    store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );
    clock.stepCount = 1;

    // Act: Mesa 2 takes the yellow flag at what the stepped clock reads 14:32:03.900, a
    // moment before Mesa 1's on that clock, its page still showing nothing.
    clock.now = new Date('2026-10-09T14:32:03.900Z');
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: yellowFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa2,
      consoleAtMesa2,
    );

    // Assert: accepted: no time measured across a step counts as recent.
    expect(outcome, 'a step of the clock since the other take must make it old').toEqual({
      ok: true,
    });
  });

  it('lets one console take twice, 0,3 s apart', () => {
    // Arrange: Mesa 1 takes the green flag at 14:32:04.200.
    const { store, clock } = openStoreWithAClockMovedByHand();
    const { greenFlagItemId, yellowFlagItemId } = createTheTwoFlagButtons(store);
    clock.now = new Date('2026-10-09T14:32:04.200Z');
    store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );

    // Act: 0,3 s later, before its page heard of the first take, Mesa 1 takes the yellow flag.
    clock.now = new Date('2026-10-09T14:32:04.500Z');
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: yellowFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );

    // Assert: accepted, as one operator's quick presses always are.
    expect(outcome, "one operator's second press must go through").toEqual({ ok: true });
    expect(readItemOnTheClockLayer(store), 'the yellow flag must be on air').toBe(yellowFlagItemId);
  });

  it("records the command API's take with no console, so a console's take right after goes through", () => {
    // Arrange: Mesa 1 takes the green flag; 0,3 s later a Companion button takes the yellow.
    const { store, clock } = openStoreWithAClockMovedByHand();
    const { greenFlagItemId, yellowFlagItemId } = createTheTwoFlagButtons(store);
    clock.now = new Date('2026-10-09T14:32:04.200Z');
    store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa1,
      consoleAtMesa1,
    );
    clock.now = new Date('2026-10-09T14:32:04.500Z');
    store.applyCommand({ type: 'takeItem', itemId: yellowFlagItemId }, 'api:companion');

    // Act: at 14:32:05, Mesa 2 takes the green flag, its page still showing nothing.
    clock.now = new Date('2026-10-09T14:32:05.000Z');
    const outcome = store.applyCommand(
      { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
      producerAtMesa2,
      consoleAtMesa2,
    );

    // Assert: accepted: the layer's last change was the API's, which no console made.
    expect(outcome, "a change by the command API must not refuse a console's take").toEqual({
      ok: true,
    });
  });
});
