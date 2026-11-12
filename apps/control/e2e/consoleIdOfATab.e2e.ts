/**
 * One tab, one console (apps/control, Playwright)
 *
 * What this module is for:
 *   To tell two operators apart (BAJAOVRLAY-69), the server hands each tab of the control
 *   page a console id in its first hello. The tab keeps it in its sessionStorage and names
 *   it again in the address of every later connection, so a reload of the tab is still the
 *   same console, and a second tab is another one. The server then refuses a take only when
 *   ANOTHER console changed the layer moments before, unseen; one operator's quick presses,
 *   reloads included, are never refused.
 *
 * What these tests prove (a real Chromium, the real server):
 *   - A tab opened for the first time gets a console id from its hello and keeps it.
 *   - After a reload, the tab connects naming that id, and the server's hello gives it the
 *     same id back.
 *   - A second tab gets another console id.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with the id (the 2 s rule): apps/server's
 *     consoles/unseenChangeByAnotherConsole.test.ts and webSocketHubConsoleId.test.ts.
 *   - Two consoles racing on one layer in real browsers: e2e/chaos/twoTakesOnOneLayer.chaos.ts.
 *   - "Duplicar guia" in a browser, which copies sessionStorage into the copy: the copy
 *     starts as the same console (consoleIdOfThisTab.ts says why that is harmless).
 *
 * Sharing the server with the other tests: these tests change no state on it.
 */
import { expect, type Page, test } from '@playwright/test';

// The key the page keeps its console id under (apps/control/src/state/consoleIdOfThisTab.ts).
const consoleIdStorageKey = 'bajaovrlay.consoleId';

/** The console ids the hellos of this page's own connection named, oldest first. */
type ConsoleConnections = { addressesDialled: string[]; consoleIdsOfTheHellos: string[] };

/**
 * Watches the control page's own WebSocket (not the "Programa" and "Prévia" frames, which
 * connect as monitors): every address it dials and the console id of every hello it gets.
 */
function watchTheConsoleConnections(page: Page): ConsoleConnections {
  const connections: ConsoleConnections = { addressesDialled: [], consoleIdsOfTheHellos: [] };
  page.on('websocket', (webSocket) => {
    const isAMonitorFrame = webSocket.url().includes('role=');
    if (isAMonitorFrame) {
      return;
    }
    connections.addressesDialled.push(webSocket.url());
    webSocket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string' || !frame.payload.startsWith('{"type":"hello"')) {
        return;
      }
      const hello = JSON.parse(frame.payload) as { consoleId?: string };
      connections.consoleIdsOfTheHellos.push(hello.consoleId ?? 'no console id');
    });
  });
  return connections;
}

/** Waits until the page's badge reads "Conectado": its hello has arrived. */
async function waitUntilConnected(page: Page): Promise<void> {
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the console must be connected to the server',
  ).toHaveText('Conectado');
}

/** The console id this tab keeps in its sessionStorage, or null. */
function readTheConsoleIdTheTabKeeps(page: Page): Promise<string | null> {
  return page.evaluate(
    (storageKey) => window.sessionStorage.getItem(storageKey),
    consoleIdStorageKey,
  );
}

test.describe('one tab, one console', () => {
  test('a tab keeps its console id across a reload, and a second tab gets another', async ({
    context,
  }) => {
    // Arrange: a first tab of the console, watched from its first connection.
    const firstTab = await context.newPage();
    const connectionsOfTheFirstTab = watchTheConsoleConnections(firstTab);
    await firstTab.goto('/');
    await waitUntilConnected(firstTab);
    const consoleIdOfTheFirstTab = await readTheConsoleIdTheTabKeeps(firstTab);

    // Act: reload the first tab; open a second tab.
    await firstTab.reload();
    await waitUntilConnected(firstTab);
    const secondTab = await context.newPage();
    await secondTab.goto('/');
    await waitUntilConnected(secondTab);

    // Assert: the id kept is the one the first hello handed out; after the reload the tab
    // named it and got it back; the second tab is another console.
    expect(
      consoleIdOfTheFirstTab,
      'the tab must keep a console id once its first hello arrived',
    ).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(
      connectionsOfTheFirstTab.consoleIdsOfTheHellos,
      'both hellos of the first tab, before and after the reload, must name the same console',
    ).toEqual([consoleIdOfTheFirstTab, consoleIdOfTheFirstTab]);
    expect(
      connectionsOfTheFirstTab.addressesDialled.at(-1),
      'after the reload the tab must name its console in the address',
    ).toContain(`console=${String(consoleIdOfTheFirstTab)}`);
    expect(
      await readTheConsoleIdTheTabKeeps(firstTab),
      'the reload must not change the console id the tab keeps',
    ).toBe(consoleIdOfTheFirstTab);
    const consoleIdOfTheSecondTab = await readTheConsoleIdTheTabKeeps(secondTab);
    expect(consoleIdOfTheSecondTab, 'the second tab must get a console id').toMatch(
      /^[A-Za-z0-9-]{8,64}$/,
    );
    expect(consoleIdOfTheSecondTab, 'two tabs must be two consoles').not.toBe(
      consoleIdOfTheFirstTab,
    );
  });
});
