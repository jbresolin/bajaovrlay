/**
 * The actor name of a WebSocket connection (apps/server)
 *
 * What this module is for:
 *   Every command is logged with an actor, and the authorisation step decides by the
 *   role at the start of that name. Until operators log in, a connection says what it
 *   is with the address it connects to: `/ws?role=renderer` is a renderer page, and
 *   anything else is an operator. The connection's own id follows the role, so the
 *   event log can tell two renderers (or two operators) apart.
 *
 * What these tests prove:
 *   - `/ws?role=renderer` gives `renderer:<connection id>`.
 *   - `/ws` with no role, with another role, or with a role spelt differently gives
 *     `operador:<connection id>`: only the exact word `renderer` makes a renderer.
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
    const actor = buildActorForConnection(requestTarget, connectionId);

    // Assert: the role comes from the address and the id from the connection.
    expect(actor, 'the actor must be the role, a colon and the connection id').toBe(expectedActor);
  });
});
