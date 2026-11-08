/**
 * The actor name of a WebSocket connection (apps/server)
 *
 * What this module is for:
 *   Every command runs under an actor name, and the authorisation step decides by the
 *   role at the start of that name. Until operators log in, a connection says what it
 *   is with the address it connects to: `/ws?role=renderer` is the renderer page OBS
 *   loads, `/ws?role=monitor` is a copy of it framed by the control page ("Programa" or
 *   "Prévia"), and anything else is an operator. The connection's own id follows the
 *   role, so the event log can tell two renderers (or two operators) apart.
 *
 * What these tests prove:
 *   - `/ws?role=renderer` gives `renderer:<connection id>`, and `/ws?role=monitor` gives
 *     `monitor:<connection id>`.
 *   - `/ws` with no role, with another role, or with a role spelt differently gives
 *     `operador:<connection id>`: only the exact words `renderer` and `monitor` count.
 *   - With a session (BAJAOVRLAY-29) a control page is `<role>:<station>`, while a monitor
 *     frame carrying the page's cookie stays a monitor.
 *
 * What these tests deliberately do not cover:
 *   - That the hub really uses this name for a connection's commands;
 *     webSocketHubRoles.test.ts proves it over a real socket.
 *   - What each role may do; store/authorizeCommand.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { buildActorForConnection } from './connectionActor.js';

const connectionId = '3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';

const connectionAddressScenarios = [
  // The renderer page loaded by OBS connects like this.
  {
    name: 'gives a renderer actor to /ws?role=renderer',
    requestTarget: '/ws?role=renderer',
    expectedActor: `renderer:${connectionId}`,
  },
  // The control page connects with no role at all.
  {
    name: 'gives an operator actor to /ws with no role',
    requestTarget: '/ws',
    expectedActor: `operador:${connectionId}`,
  },
  // A role the server does not know must not gain the renderer's one permission.
  {
    name: 'gives an operator actor to a role the server does not know',
    requestTarget: '/ws?role=narrador',
    expectedActor: `operador:${connectionId}`,
  },
  // Only the exact word counts, so a typo cannot half-work.
  {
    name: 'gives an operator actor to the role spelt in capitals',
    requestTarget: '/ws?role=Renderer',
    expectedActor: `operador:${connectionId}`,
  },
  // Other query fields next to the role do not matter.
  {
    name: 'gives a renderer actor when the role sits beside another query field',
    requestTarget: '/ws?output=program&role=renderer',
    expectedActor: `renderer:${connectionId}`,
  },
  // The control page's "Programa" and "Prévia" frames connect like this.
  {
    name: 'gives a monitor actor to /ws?role=monitor',
    requestTarget: '/ws?role=monitor',
    expectedActor: `monitor:${connectionId}`,
  },
  // Same rule as for the renderer: a monitor role in capitals is not the agreed word.
  {
    name: 'gives an operator actor to the monitor role spelt in capitals',
    requestTarget: '/ws?role=MONITOR',
    expectedActor: `operador:${connectionId}`,
  },
  // Node may hand over no request target at all; that is an ordinary connection.
  {
    name: 'gives an operator actor when the request has no address',
    requestTarget: undefined,
    expectedActor: `operador:${connectionId}`,
  },
];

describe('buildActorForConnection', () => {
  it.each(connectionAddressScenarios)('$name', ({ requestTarget, expectedActor }) => {
    // Arrange: the address this connection asked for (see the table above).

    // Act: build the actor name for the connection.
    const actor = buildActorForConnection(requestTarget, connectionId, undefined);

    // Assert: the role comes from the address and the id from the connection.
    expect(actor, 'the actor must be the role, a colon and the connection id').toBe(expectedActor);
  });
});

describe('buildActorForConnection with a session (BAJAOVRLAY-29)', () => {
  const sessionOfDataAtMesa2 = {
    sessionId: 'b3e1f7a2-5c84-4d19-9a6e-2f0c8d7b4e51',
    role: 'dados' as const,
    station: 'Mesa 2',
    expiresAt: '2026-11-08T05:00:00.000Z',
  };

  it('signs a logged-in control page with its role and station', () => {
    // Arrange: a control page's address, and Dados's session at "Mesa 2".
    const requestTarget = '/ws';

    // Act: build the actor name for the connection.
    const actor = buildActorForConnection(requestTarget, connectionId, sessionOfDataAtMesa2);

    // Assert: the role and the station, not the connection id.
    expect(actor, 'the event log must name the role and the station').toBe('dados:Mesa 2');
  });

  it('keeps a monitor frame a monitor, even with the page’s session cookie', () => {
    // Arrange: a monitor frame, which carries the cookie of the page it is framed in.
    const requestTarget = '/ws?role=monitor';

    // Act: build the actor name for the connection.
    const actor = buildActorForConnection(requestTarget, connectionId, sessionOfDataAtMesa2);

    // Assert: a monitor, which may send nothing.
    expect(actor, 'a screen’s address wins over a session').toBe(`monitor:${connectionId}`);
  });
});
