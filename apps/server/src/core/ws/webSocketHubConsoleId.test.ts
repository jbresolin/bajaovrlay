/**
 * The console id of each control page connection (apps/server)
 *
 * What this module is for:
 *   To tell two operators apart (BAJAOVRLAY-69), the server gives each tab of the control
 *   page a console id in its first `hello`. The tab keeps it in sessionStorage and names it
 *   again in the address of every later connection (`/ws?console=<id>`), so a reload or a
 *   reconnect is the same console and another tab is another one. Every command of that
 *   connection reaches the store with its console id.
 *
 * What these tests prove (a real server on a random port, real WebSocket clients):
 *   - A control page that names no console is handed a new id in its hello; one that names
 *     a valid id gets that id back; one that names something else is handed a new id.
 *   - Two pages that name no console get different ids.
 *   - A screen (the renderer OBS loads) is no console: its hello has no id.
 *   - The console id reaches the store: a second console's take on the layer the first one
 *     just took on, made without having seen it, is refused; the first console, reconnected
 *     under its own id, may take there again.
 *
 * What these tests deliberately do not cover:
 *   - The rule itself, case by case: store/consoles/unseenChangeByAnotherConsole.test.ts.
 *   - The page keeping the id in sessionStorage: apps/control (serverConnection tests and the
 *     browser test consoleIdOfATab.e2e.ts).
 */
import { ConsoleIdSchema, type ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../store/raceClockItemOnTheStore.testSupport.js';
import {
  isCommandResultMessage,
  startServerOnARandomPort,
} from './webSocketHubOnARandomPort.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

/** The console id a tab kept from an earlier hello. */
const consoleIdKeptByTheTab = 'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';

/** The console id of a hello, or undefined when it names none. */
function readConsoleIdOfTheHello(helloMessage: ServerMessage): string | undefined {
  return helloMessage.type === 'hello' ? helloMessage.consoleId : undefined;
}

describe('the console id in the hello', () => {
  it('hands a page that names no console a new, valid id', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: a control page connects for the first time, naming no console.
    const page = await connectWebSocketTestClient(runningServer.port);
    const hello = await page.waitForMessage('the hello', (message) => message.type === 'hello');

    // Assert: the hello names a console id the page can keep.
    const consoleId = readConsoleIdOfTheHello(hello);
    expect(
      ConsoleIdSchema.safeParse(consoleId).success,
      'a control page must be handed a valid console id',
    ).toBe(true);
  });

  it('gives a page back the id it names, so a reload is the same console', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: the page connects again after a reload, naming the id its tab kept.
    const page = await connectWebSocketTestClient(runningServer.port, {
      consoleId: consoleIdKeptByTheTab,
    });
    const hello = await page.waitForMessage('the hello', (message) => message.type === 'hello');

    // Assert: the same id comes back.
    expect(readConsoleIdOfTheHello(hello), 'the page must stay the same console').toBe(
      consoleIdKeptByTheTab,
    );
  });

  it('hands a new id to a page that names something that is not a console id', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: a page names a value with spaces and an accent.
    const page = await connectWebSocketTestClient(runningServer.port, {
      consoleId: 'mesa do produtor é a 1',
    });
    const hello = await page.waitForMessage('the hello', (message) => message.type === 'hello');

    // Assert: a new valid id, not the value named.
    const consoleId = readConsoleIdOfTheHello(hello);
    expect(ConsoleIdSchema.safeParse(consoleId).success, 'the id must be a valid one').toBe(true);
    expect(consoleId, 'the value named must not be kept').not.toBe('mesa do produtor é a 1');
  });

  it('gives two pages that name no console two different ids', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: two tabs connect for the first time.
    const firstTab = await connectWebSocketTestClient(runningServer.port);
    const secondTab = await connectWebSocketTestClient(runningServer.port);
    const firstHello = await firstTab.waitForMessage(
      'hello',
      (message) => message.type === 'hello',
    );
    const secondHello = await secondTab.waitForMessage(
      'hello',
      (message) => message.type === 'hello',
    );

    // Assert: two consoles.
    expect(readConsoleIdOfTheHello(firstHello), 'two tabs must be two consoles').not.toBe(
      readConsoleIdOfTheHello(secondHello),
    );
  });

  it('names no console in the hello of a screen', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: the renderer OBS loads connects.
    const renderer = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    const hello = await renderer.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: no console id.
    expect(readConsoleIdOfTheHello(hello), 'a screen sends no take: it is no console').toBe(
      undefined,
    );
  });
});

describe('the console id of a connection reaches the store', () => {
  it("refuses a second console's take it had not seen, and lets the first console take again", async () => {
    // Arrange: two clock buttons on "Atalhos"; two consoles connected; the server's clock is
    // held, so both takes happen at the same moment on it.
    const runningServer = await startServerOnARandomPort();
    const greenFlagItemId = createRaceClockItemOnTheStore(runningServer.stateStore, {
      label: 'Bandeira verde',
      home: shortcutsPanelHome,
    });
    const otherClockItemId = createRaceClockItemOnTheStore(runningServer.stateStore, {
      label: 'Relógio do enduro (reserva)',
      home: shortcutsPanelHome,
    });
    const firstConsole = await connectWebSocketTestClient(runningServer.port, {
      consoleId: consoleIdKeptByTheTab,
    });
    const secondConsole = await connectWebSocketTestClient(runningServer.port);
    await firstConsole.waitForMessage('hello', (message) => message.type === 'hello');
    await secondConsole.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: the first console takes the green flag; then the second takes the other clock,
    // saying it showed "Relógio" empty; then the first, reconnected, takes again.
    firstConsole.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: { type: 'takeItem', itemId: greenFlagItemId, instanceIdSeenOnAir: null },
    });
    await firstConsole.waitForMessage('the answer to the first take', isCommandResultMessage);
    secondConsole.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: { type: 'takeItem', itemId: otherClockItemId, instanceIdSeenOnAir: null },
    });
    const answerToTheSecondConsole = await secondConsole.waitForMessage(
      'the answer to the second console',
      isCommandResultMessage,
    );
    const firstConsoleReconnected = await connectWebSocketTestClient(runningServer.port, {
      consoleId: consoleIdKeptByTheTab,
    });
    firstConsoleReconnected.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: { type: 'takeItem', itemId: otherClockItemId, instanceIdSeenOnAir: null },
    });
    const answerToTheFirstConsoleAgain = await firstConsoleReconnected.waitForMessage(
      'the answer to the first console, reconnected',
      isCommandResultMessage,
    );

    // Assert: the second console was refused; the first console's own second take went through.
    expect(
      answerToTheSecondConsole.type === 'commandResult' && !answerToTheSecondConsole.ok
        ? answerToTheSecondConsole.error.code
        : 'accepted',
      'the second console must be refused: it had not seen the green flag',
    ).toBe('LAYER_CHANGED_BY_ANOTHER_CONSOLE');
    expect(
      answerToTheFirstConsoleAgain.type === 'commandResult' && answerToTheFirstConsoleAgain.ok,
      'the same console, reconnected under its id, may take again at once',
    ).toBe(true);
  });
});
