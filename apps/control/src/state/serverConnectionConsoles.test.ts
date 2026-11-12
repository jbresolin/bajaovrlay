/**
 * Server connection: this tab as one console (apps/control)
 *
 * What this module is for:
 *   Two operators at two consoles may take on one layer at the same moment (BAJAOVRLAY-69).
 *   The server tells consoles apart by a console id it hands each tab in its first hello;
 *   the tab keeps it (main.tsx: in sessionStorage) and names it again in the address of every
 *   later connection, so a reload or a reconnect stays the same console and a second tab is
 *   another. Every take the tab sends says what the page showed on its layer, and the answers
 *   that concern two consoles reach the page where its refusals are shown.
 *
 * What these tests prove (a fake server driven by hand, the real connection and store):
 *   - A tab with no id dials the plain address, keeps the id its hello hands it, and names
 *     that id when it dials again after the line dropped.
 *   - A reloaded tab, whose memory already holds an id, names it on its very first dial.
 *   - sendCommand adds what the page shows on air to a take before it leaves the page.
 *   - A refused take keeps the part of the page that sent it, so it is shown there only.
 *   - "Tomar tudo" answered ok with layers left resolves as accepted, and leaves the server's
 *     sentence for each layer left where the page shows that command's refusals.
 *
 * What these tests deliberately do not cover:
 *   - Every take path's command, one by one: whatThisPageSawOnAir.test.ts.
 *   - The browser's real sessionStorage across a reload and two tabs: the browser test
 *     e2e/consoleIdOfATab.e2e.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  connectControlPageToFakeServer,
  connectControlPageToFakeServerThatSaidHello,
} from './connectionToFakeServer.testSupport';
import type { ConsoleIdMemory } from './consoleIdOfThisTab';
import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

/** The console id the fake server hands out, as the real one would (a UUID). */
const consoleIdHandedOut = 'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';

/** A stand-in for the tab's sessionStorage: one value, starting as given. */
function createConsoleIdMemoryHolding(consoleIdKept: string | null) {
  const memory = { consoleIdKept };
  const consoleIdMemory: ConsoleIdMemory = {
    readConsoleId: () => memory.consoleIdKept,
    keepConsoleId: (consoleId) => {
      memory.consoleIdKept = consoleId;
    },
  };
  return { memory, consoleIdMemory };
}

describe('the console id of this tab', () => {
  it('dials the plain address first, keeps the id the hello hands it, and names it on the redial', () => {
    // Arrange: a new tab, with no console id kept; time moved by hand for the redial.
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { memory, consoleIdMemory } = createConsoleIdMemoryHolding(null);
    const { fakeServerSocket } = connectControlPageToFakeServer({ consoleIdMemory });
    const firstAddress = fakeServerSocket.readLastAddressDialled();

    // Act: the server says hello naming the console; the line drops; the page redials.
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithNothingOnAir(),
      consoleId: consoleIdHandedOut,
    });
    fakeServerSocket.dropConnection();
    vi.advanceTimersByTime(500);

    // Assert: plain first, then the id kept and named.
    expect(firstAddress, 'a tab with no id yet must dial the plain address').toBe(
      'ws://192.168.0.10:3000/ws',
    );
    expect(memory.consoleIdKept, 'the id the hello handed out must be kept').toBe(
      consoleIdHandedOut,
    );
    expect(
      fakeServerSocket.readLastAddressDialled(),
      'the redial must name the console, so it stays the same one',
    ).toBe(`ws://192.168.0.10:3000/ws?console=${consoleIdHandedOut}`);
  });

  it('names the id its memory kept on the very first dial of a reloaded tab', () => {
    // Arrange: the tab's sessionStorage holds the id from before the reload.
    const { consoleIdMemory } = createConsoleIdMemoryHolding(consoleIdHandedOut);

    // Act: the reloaded page dials the server.
    const { fakeServerSocket } = connectControlPageToFakeServer({ consoleIdMemory });

    // Assert: the address names the console.
    expect(
      fakeServerSocket.readLastAddressDialled(),
      'a reloaded tab must be the same console',
    ).toBe(`ws://192.168.0.10:3000/ws?console=${consoleIdHandedOut}`);
  });
});

describe('takes sent by this console', () => {
  it('adds what the page shows on air to a take before sending it', () => {
    // Arrange: a connected page showing "Relógio" empty, the yellow flag in the rundown.
    const { fakeServerSocket, serverConnection, serverStateStore } =
      connectControlPageToFakeServerThatSaidHello();
    serverStateStore.getState().replaceOneSlice({
      type: 'slice',
      name: 'items',
      slice: [
        {
          id: 'item-bandeira-amarela',
          home: { kind: 'rundown', rundownId: 'sessao-principal' },
          order: 0,
          graphicId: 'race-clock',
          layerId: 'clock',
          fields: {},
          label: 'Bandeira amarela',
          color: 'warning',
          notes: '',
        },
      ],
    });

    // Act: the operator presses "Disparar" on the yellow flag.
    void serverConnection
      .sendCommand({ type: 'takeItem', itemId: 'item-bandeira-amarela' })
      .catch(() => undefined);

    // Assert: the take left the page saying "Relógio" was empty.
    expect(
      fakeServerSocket.readLastCommandMessageReceived().command,
      'the take must say what the page showed on its layer',
    ).toEqual({ type: 'takeItem', itemId: 'item-bandeira-amarela', instanceIdSeenOnAir: null });
  });

  it('keeps the part of the page that sent a refused take', async () => {
    // Arrange: a connected page.
    const { fakeServerSocket, serverConnection, serverStateStore } =
      connectControlPageToFakeServerThatSaidHello();

    // Act: a quick-fire key sends a take; the server refuses it for another console.
    const sending = serverConnection
      .sendCommand({ type: 'takeItem', itemId: 'item-tarja-chefe-ufsc' }, 'quickFire')
      .catch(() => undefined);
    fakeServerSocket.refuseLastCommand({
      code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
      message:
        'Outra mesa tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,3 s; ' +
        'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
    });
    await sending;

    // Assert: the refusal names the quick-fire strip as where it came from.
    expect(
      serverStateStore.getState().lastCommandError,
      'the refusal must be kept with the part of the page that sent it',
    ).toEqual({
      commandType: 'takeItem',
      code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
      message:
        'Outra mesa tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,3 s; ' +
        'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
      areaOfThePage: 'quickFire',
    });
  });

  it('accepts "Tomar tudo" that left a layer, and leaves its sentence for the page to list', async () => {
    // Arrange: a connected page.
    const { fakeServerSocket, serverConnection, serverStateStore } =
      connectControlPageToFakeServerThatSaidHello();

    // Act: "Tomar tudo"; the server took "Relógio" and left "Tarja" for another console.
    const sending = serverConnection.sendCommand({ type: 'takeAllPreviews' });
    fakeServerSocket.sendMessage({
      type: 'commandResult',
      requestId: fakeServerSocket.readLastCommandMessageReceived().requestId,
      ok: true,
      layersNotTaken: [
        {
          layerId: 'lower-third',
          error: {
            code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
            message:
              'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
              'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
          },
        },
      ],
    });
    const commandResult = await sending;

    // Assert: accepted, and the layer left is listed under "Tomar tudo"'s sentence.
    expect(commandResult.ok, '"Tomar tudo" took the other layers: it was accepted').toBe(true);
    expect(
      serverStateStore.getState().lastCommandError,
      'the page must list the layer left, with the server sentence',
    ).toEqual({
      commandType: 'takeAllPreviews',
      code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
      message: 'Tomar tudo foi feito, menos nestas camadas:',
      sentenceOfEachLayer: [
        'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
          'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
      ],
    });
  });
});
