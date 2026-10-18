/**
 * The WebSocket hub at /ws: the heartbeat and the endpoint itself (apps/server)
 *
 * What this module is for:
 *   A client that vanished without closing its socket must not be kept forever, so the
 *   server pings every client and drops one that stops answering. And the WebSocket lives
 *   only at /ws, on the same port as HTTP, without a malformed upgrade being able to
 *   crash the server; shutting the server down closes every client.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A client that stops answering pings is dropped; one that answers is kept.
 *   - Only /ws upgrades to a WebSocket, an upgrade with a malformed address cannot
 *     crash the server, and shutting down closes every client.
 *
 * What these tests deliberately do not cover:
 *   - Commands and their messages: webSocketHub.test.ts.
 *   - Messages outside the protocol: webSocketHubBadMessages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectWebSocketTestClient,
  sendRawUpgradeRequest,
  tryWebSocketOnPath,
} from './webSocketTestClient.testSupport.js';

describe('the heartbeat', () => {
  it('drops a client that stops answering pings and keeps one that answers', async () => {
    // Arrange: a server pinging every 250 ms, a healthy client and a frozen one.
    // 250 ms, not less: the healthy client's pong must be read before the next tick, and
    // a busy CI machine can stall the event loop for tens of milliseconds. The test waits
    // on the frozen client's close event, so the wider interval costs well under a second.
    const runningServer = await startServerOnARandomPort({ heartbeatIntervalInMilliseconds: 250 });
    const healthyClient = await connectWebSocketTestClient(runningServer.port);
    const frozenClient = await connectWebSocketTestClient(runningServer.port, {
      answersPings: false,
    });

    // Act: wait until the server drops the frozen client.
    await frozenClient.waitUntilClosed();

    // Assert: the frozen client is gone and the healthy one, connected as long, is not.
    expect(frozenClient.isOpen(), 'a client that misses a ping must be dropped').toBe(false);
    expect(healthyClient.isOpen(), 'a client that answers pings must be kept').toBe(true);
  });
});

describe('the WebSocket endpoint itself', () => {
  it('refuses to upgrade any path other than /ws', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: try to open a WebSocket on another address.
    const outcome = await tryWebSocketOnPath(runningServer.port, '/api/v1/state');

    // Assert: the upgrade is refused.
    expect(outcome, 'only /ws may become a WebSocket').toBe('refused');
  });

  it('survives an upgrade request whose address is malformed', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: send a raw upgrade for the absolute address `http://[`, which is not a URL,
    // then ask for /health.
    const upgradeAnswer = await sendRawUpgradeRequest(runningServer.port, 'http://[');
    const healthResponse = await fetch(`http://127.0.0.1:${runningServer.port}/health`);

    // Assert: the upgrade was refused and the server is still answering.
    expect(upgradeAnswer, 'a malformed address must be refused, not upgraded').toContain(
      '404 Not Found',
    );
    expect(healthResponse.status, 'the server must still be up after the bad request').toBe(200);
  });

  it('closes every client when the server shuts down', async () => {
    // Arrange: a running server with the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: shut the server down.
    await runningServer.close();
    await controlPage.waitUntilClosed();

    // Assert: the client's socket is closed.
    expect(controlPage.isOpen(), 'shutdown must close every client socket').toBe(false);
  });
});
