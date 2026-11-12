/**
 * Who a new WebSocket connection is (apps/server)
 *
 * What this module is for:
 *   When a connection opens, the hub needs three facts about it, all read from its upgrade:
 *   its actor (what the event log signs its commands with), whether it is a screen (a
 *   renderer or a monitor, sent only the slices it draws), and the console it is (a control
 *   page's tab, BAJAOVRLAY-69; a screen is none). identifyTheConnection gives the three at
 *   once, so the hub stays one wiring and the rules live in connectionActor.ts and
 *   consoleOfConnection.ts.
 *
 * What these tests prove:
 *   - The renderer OBS loads is a screen, signed as a renderer, with no console, even when
 *     its address names one.
 *   - A control page with the login off is `operador:<connection id>` and is handed a new
 *     console id when it names none.
 *   - A logged-in control page that names its console keeps it, signed with its role and
 *     station.
 *
 * What these tests deliberately do not cover:
 *   - Each rule on its own: connectionActor.test.ts and consoleOfConnection.test.ts.
 *   - The hello naming the console: webSocketHubConsoleId.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { identifyTheConnection } from './connectionIdentity.js';

const connectionId = '3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const consoleIdKeptByTheTab = 'c0a8f1e2-3b4d-4c5e-8f90-1a2b3c4d5e6f';
const nextConsoleIdTheServerMakes = '5b7d9f1a-3c5e-4a8b-9d6f-0e1c3a5b7d92';

/** The Produtor's session at "Mesa 1", as the login keeps it. */
const sessionOfTheProducerAtMesa1 = {
  sessionIdHash: 'hash-da-sessao-do-produtor-na-mesa-1',
  role: 'produtor' as const,
  station: 'Mesa 1',
  expiresAt: '2026-11-08T05:00:00.000Z',
};

const connections = [
  {
    // OBS's renderer: draws, never takes; a console id in its address changes nothing.
    name: 'identifies the renderer as a screen with no console',
    requestTarget: `/ws?role=renderer&console=${consoleIdKeptByTheTab}`,
    session: undefined,
    expectedIdentity: { actor: `renderer:${connectionId}`, isScreen: true, consoleId: undefined },
  },
  {
    // A tab's first connection with the login off: a new console.
    name: 'identifies a control page with the login off, handing it a new console',
    requestTarget: '/ws',
    session: undefined,
    expectedIdentity: {
      actor: `operador:${connectionId}`,
      isScreen: false,
      consoleId: nextConsoleIdTheServerMakes,
    },
  },
  {
    // A reloaded tab of the logged-in Produtor: the same console as before the reload.
    name: 'identifies a logged-in control page by its role and the console it names',
    requestTarget: `/ws?console=${consoleIdKeptByTheTab}`,
    session: sessionOfTheProducerAtMesa1,
    expectedIdentity: {
      actor: 'produtor:Mesa 1',
      isScreen: false,
      consoleId: consoleIdKeptByTheTab,
    },
  },
];

describe('identifyTheConnection', () => {
  it.each(connections)('$name', ({ requestTarget, session, expectedIdentity }) => {
    // Arrange: the upgrade of the row, and the next id the server would make.

    // Act: identify the connection.
    const identity = identifyTheConnection({
      requestTarget,
      connectionId,
      session,
      createConsoleId: () => nextConsoleIdTheServerMakes,
    });

    // Assert: its actor, whether it is a screen, and its console.
    expect(identity, 'the connection must be who its upgrade says').toEqual(expectedIdentity);
  });
});
