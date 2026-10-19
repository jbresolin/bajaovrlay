/**
 * Graphic data sent over /ws: refused when the graphic does not accept it, changed in
 * place when it does (apps/server)
 *
 * What this module is for:
 *   The control page puts the race clock on air with `takeItem` (of an item prepared
 *   earlier) and changes it while it is on air with `updateInstanceData`. The server
 *   checks the data of both against the schema in the graphic's manifest before anything
 *   changes, so wrong data is answered to its sender in pt-BR, naming the field, and
 *   never reaches the screen.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A take of an item whose stored fields miss a required field, carry a field the
 *     graphic does not have, or carry a value the graphic does not accept is answered
 *     INVALID_GRAPHIC_DATA with a pt-BR message naming that field, and nothing goes on
 *     air. (createItem does not check field values against the graphic, so such an item
 *     can be stored; the take is where the check happens.)
 *   - An `updateInstanceData` carrying only the flag reaches the renderer as an
 *     instances slice (alone: a renderer is never sent the event log) in which the
 *     instance has the same id, the new flag, every other field as it was taken, and the
 *     flag listed as changed on air.
 *   - An update whose value the graphic does not accept is refused the same way, and the
 *     data on air stays as it was.
 *
 * What these tests deliberately do not cover:
 *   - Every rule of the check itself (graphicDataValidation.test.ts) and of the two
 *     reducers (reducers/putGraphicOnOutputData.test.ts, reducers/updateInstanceData.test.ts).
 *   - The rest of the hub (webSocketHub.test.ts) and who may send what
 *     (webSocketHubRoles.test.ts).
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { noSourceHostAllowlist } from '../../modules/dataSources/index.js';
import { startServer } from '../boot/startServer.js';
import { createTemporaryDataFolder } from '../boot/temporaryDataFolder.testSupport.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import {
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../store/raceClockItemOnTheStore.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

// All six fields the race clock's manifest schema requires: the enduro under green flag,
// 1:05:00 in and running.
const raceClockDataUnderGreenFlag = {
  sessionName: 'Enduro de Resistência',
  state: 'green',
  clockMode: 'elapsed',
  referenceTimeMs: 3_900_000,
  referenceWallClockMs: 1_791_550_800_000,
  running: true,
};

/**
 * Starts the whole server, silent, on a random free port with a fresh temporary
 * database and the race clock registered. It is shut down when the test ends.
 */
async function startServerOnARandomPort() {
  const runningServer = await startServer({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    dataFolder: createTemporaryDataFolder(),
    sourceHostAllowlist: noSourceHostAllowlist,
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/**
 * Prepares a race clock item holding this data (every field typed in) as a button of
 * "Atalhos", straight on the server's store, and returns the take of it for a client to
 * send. Called before any client connects, so no client hears of the createItem.
 */
function prepareTheTakeOfAClockItemHolding(stateStore: StateStore, data: Record<string, unknown>) {
  const clockItemId = createRaceClockItemOnTheStore(stateStore, {
    fields: buildLiteralItemFieldsFromData(data),
    home: shortcutsPanelHome,
  });
  return { type: 'takeItem', itemId: clockItemId };
}

/** True for any `commandResult` message. */
function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}

/**
 * True for a message whose first instance shows the yellow flag: a `slices` message to
 * an operator, or a `slice` of instances alone to a renderer, which is never sent the
 * event log that changes with it.
 */
function isInstancesSliceWithTheYellowFlag(message: ServerMessage): boolean {
  if (message.type === 'slice' && message.name === 'instances') {
    return message.slice[0]?.resolvedData.state === 'yellow';
  }
  return (
    message.type === 'slices' && message.slices.instances?.[0]?.resolvedData.state === 'yellow'
  );
}

const invalidTakeScenarios = [
  // The item was saved without the flag: the graphic cannot draw its band.
  {
    name: 'refuses a take that misses a required field, naming the field',
    data: {
      sessionName: 'Enduro de Resistência',
      clockMode: 'elapsed',
      referenceTimeMs: 3_900_000,
      referenceWallClockMs: 1_791_550_800_000,
      running: true,
    },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "state" é obrigatório e não foi enviado.',
  },
  // A typo in a field name of the item must not go on air silently ignored.
  {
    name: 'refuses a take with a field the graphic does not have, naming the field',
    data: { ...raceClockDataUnderGreenFlag, voltasDoLider: 12 },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "voltasDoLider" não existe neste gráfico.',
  },
  // "azul" is not one of the six flags the race clock knows.
  {
    name: 'refuses a take with a value the graphic does not accept, naming the field',
    data: { ...raceClockDataUnderGreenFlag, state: 'azul' },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor que o gráfico não aceita.',
  },
];

describe('a takeItem of an item with invalid data sent over /ws', () => {
  it.each(invalidTakeScenarios)('$name', async ({ data, expectedMessage }) => {
    // Arrange: a running server holding a clock item with the wrong data, and the control
    // page connected.
    const runningServer = await startServerOnARandomPort();
    const takeOfTheWrongClockItem = prepareTheTakeOfAClockItemHolding(
      runningServer.stateStore,
      data,
    );
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: take the clock item and wait for the answer.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: takeOfTheWrongClockItem,
    });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: refused in pt-BR with the field's name, and nothing went on air.
    expect(commandResult, 'the refusal must name the field in pt-BR').toEqual({
      type: 'commandResult',
      requestId: 'pedido-1',
      ok: false,
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(
      runningServer.stateStore.readAllSlices().instances,
      'a refused take must leave every layer as it was: empty',
    ).toEqual([]);
  });
});

describe('an updateInstanceData sent over /ws', () => {
  it('changes only the flag for every client and keeps the instance id', async () => {
    // Arrange: a running server, the control page and a second client (the renderer),
    // with the race clock item taken under the green flag.
    const runningServer = await startServerOnARandomPort();
    const takeOfTheGreenFlagClock = prepareTheTakeOfAClockItemHolding(
      runningServer.stateStore,
      raceClockDataUnderGreenFlag,
    );
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: takeOfTheGreenFlagClock,
    });
    await controlPage.waitForMessage('take result', isCommandResultMessage);
    const instanceAfterTheTake = runningServer.stateStore.readAllSlices().instances[0];

    // Act: a yellow flag comes out; the control page sends the flag and nothing else.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-2',
      command: {
        type: 'updateInstanceData',
        instanceId: instanceAfterTheTake?.id,
        data: { state: 'yellow' },
      },
    });
    const sliceOnRenderer = await renderer.waitForMessage(
      'instances slice with the yellow flag',
      isInstancesSliceWithTheYellowFlag,
    );

    // Assert: the renderer hears of the same instance (same id, so it updates in place)
    // with the yellow flag, every other field as it was taken, and the flag listed as
    // differing from the item (the chip "alterado no ar").
    // The update's own line in the event log is not in it: a renderer never gets that slice.
    expect(sliceOnRenderer, 'the update must keep the id and change only the flag').toEqual({
      type: 'slice',
      name: 'instances',
      slice: [
        {
          ...instanceAfterTheTake,
          resolvedData: { ...raceClockDataUnderGreenFlag, state: 'yellow' },
          fieldsChangedOnAir: ['state'],
        },
      ],
      // The time of the server's clock; webSocketHub.test.ts checks its exact value.
      serverNowMs: expect.any(Number),
    });
  });

  it('refuses a value the graphic does not accept, naming the field, and keeps what is on air', async () => {
    // Arrange: a running server with the race clock item taken under the green flag.
    const runningServer = await startServerOnARandomPort();
    const takeOfTheGreenFlagClock = prepareTheTakeOfAClockItemHolding(
      runningServer.stateStore,
      raceClockDataUnderGreenFlag,
    );
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: takeOfTheGreenFlagClock,
    });
    await controlPage.waitForMessage('take result', isCommandResultMessage);
    const instanceAfterTheTake = runningServer.stateStore.readAllSlices().instances[0];

    // Act: update the reference time to a negative number, which no clock can show.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-2',
      command: {
        type: 'updateInstanceData',
        instanceId: instanceAfterTheTake?.id,
        data: { referenceTimeMs: -1 },
      },
    });
    const commandResult = await controlPage.waitForMessage(
      'update result',
      (message) => message.type === 'commandResult' && message.requestId === 'pedido-2',
    );

    // Assert: refused in pt-BR with the field's name, and the instance is untouched.
    expect(commandResult, 'the refusal must name the field in pt-BR').toEqual({
      type: 'commandResult',
      requestId: 'pedido-2',
      ok: false,
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" tem um valor que o gráfico não aceita.',
      },
    });
    expect(
      runningServer.stateStore.readAllSlices().instances[0],
      'a refused update must leave the instance exactly as it was taken',
    ).toEqual(instanceAfterTheTake);
  });
});
