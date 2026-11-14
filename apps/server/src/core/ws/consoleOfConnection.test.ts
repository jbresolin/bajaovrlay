/**
 * The console a connection is (apps/server)
 *
 * What this module is for:
 *   A control page names its console in its WebSocket address (`/ws?console=<id>`) once the
 *   server has handed it one (BAJAOVRLAY-69). chooseConsoleIdOfConnection keeps a valid id
 *   and hands out a new one otherwise, gives a screen none, and must never throw on a
 *   strange address: a throw in the hub's connection listener would crash the server that
 *   owns the state.
 *
 * What these tests prove:
 *   - A valid id named in the address is kept; another query field beside it does not matter.
 *   - No id, an empty one, one too short, one with spaces, and an address that is not a URL
 *     all get a new id from the given maker.
 *   - A screen (a renderer or a monitor) is no console, whatever its address names.
 *
 * What these tests deliberately do not cover:
 *   - The hello that carries the id, and the store receiving it: webSocketHubConsoleId.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { chooseConsoleIdOfConnection } from './consoleOfConnection.js';

/** The id the server would make next, so a test can tell "kept" from "new". */
const nextIdTheServerMakes = '5b7d9f1a-3c5e-4a8b-9d6f-0e1c3a5b7d92';

describe('chooseConsoleIdOfConnection', () => {
  it('keeps the valid id a page names, beside other query fields', () => {
    // Arrange: the address a reloaded tab opens.
    const requestTarget = '/ws?console=c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f&outra=1';

    // Act: choose the console of the control page's connection.
    const consoleId = chooseConsoleIdOfConnection(requestTarget, false, () => nextIdTheServerMakes);

    // Assert: the id named is kept.
    expect(consoleId, 'a valid id named by the page must be kept').toBe(
      'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    );
  });

  const addressesThatGetANewId = [
    // A tab's first connection: it has no id yet.
    { name: 'gives a new id to an address naming none', requestTarget: '/ws' },
    // An empty field, as a page with an empty sessionStorage value might send.
    { name: 'gives a new id to an empty id', requestTarget: '/ws?console=' },
    // Shorter than 8: not an id the server ever handed out.
    { name: 'gives a new id to an id that is too short', requestTarget: '/ws?console=mesa1' },
    // Spaces and accents: not an id the server ever handed out.
    {
      name: 'gives a new id to a value with spaces',
      requestTarget: '/ws?console=mesa%20do%20produtor',
    },
    // A target `new URL` cannot read must not throw inside the hub.
    { name: 'gives a new id to an address that is not a URL', requestTarget: 'http://[' },
    // Node may hand the hub no target at all.
    { name: 'gives a new id when there is no address', requestTarget: undefined },
  ];

  it.each(addressesThatGetANewId)('$name', ({ requestTarget }) => {
    // Arrange: the address of the row.

    // Act: choose the console of the control page's connection.
    const consoleId = chooseConsoleIdOfConnection(requestTarget, false, () => nextIdTheServerMakes);

    // Assert: the server's new id.
    expect(consoleId, 'anything but a valid id must get a new one').toBe(nextIdTheServerMakes);
  });

  it('gives a screen no console, even when its address names one', () => {
    // Arrange: a monitor frame's address that also names a console id.
    const requestTarget = '/ws?role=monitor&console=c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';

    // Act: choose the console of the screen's connection.
    const consoleId = chooseConsoleIdOfConnection(requestTarget, true, () => nextIdTheServerMakes);

    // Assert: none.
    expect(consoleId, 'a screen sends no take: it is no console').toBeUndefined();
  });
});
