/**
 * The ten-second time broadcast with Node's own timer (apps/server)
 *
 * What this module is for:
 *   startServerTimeBroadcast sends every connected WebSocket client what the server's
 *   clock shows, every ten seconds. The hub's own tests hand it a timer moved by hand;
 *   in production nothing is handed in and it uses Node's setInterval. This file checks
 *   that default.
 *
 * What these tests prove (with Vitest's fake timers standing in for Node's, and two
 * stand-in clients that only record what is sent to them):
 *   - With no timer handed in, a `time` message goes out every ten seconds, as valid
 *     JSON of the protocol, to a client whose socket is open and not to one that is closing.
 *   - stop() ends it, and calling stop() a second time is harmless.
 *
 * What these tests deliberately do not cover:
 *   - Real sockets and the hub's wiring; webSocketHubServerTime.test.ts covers them.
 */
import { ServerMessageSchema } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { WebSocket, WebSocketServer } from 'ws';

import { startServerTimeBroadcast } from './serverTimeBroadcast.js';

// The numbers the `ws` library uses for a socket's state.
const socketStateOpen = 1;
const socketStateClosing = 2;

/** Builds a stand-in client in the given socket state that records every text sent to it. */
function createRecordingClient(readyState: number) {
  const textsSent: string[] = [];
  const client = {
    readyState,
    OPEN: socketStateOpen,
    send: (text: string) => {
      textsSent.push(text);
    },
  };
  return { client: client as unknown as WebSocket, textsSent };
}

/**
 * Starts the broadcast with Node's timers faked at 14:32:05 UTC on 9 October 2026, for
 * one open client and one that is closing. Real timers are put back after the test.
 */
function startBroadcastOnFakedNodeTimers() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-09T14:32:05.000Z'));
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const openClient = createRecordingClient(socketStateOpen);
  const closingClient = createRecordingClient(socketStateClosing);
  const webSocketServer = {
    clients: new Set([openClient.client, closingClient.client]),
  } as unknown as WebSocketServer;
  const broadcast = startServerTimeBroadcast({
    webSocketServer,
    readCurrentTime: () => new Date(),
    readServerClockStepCount: () => 0,
  });
  onTestFinished(() => broadcast.stop());
  return { broadcast, openClient, closingClient };
}

describe('startServerTimeBroadcast with the timer of Node', () => {
  it('sends the time of the server clock every ten seconds, to open sockets only', () => {
    // Arrange: the broadcast running for an open client and a closing one.
    const { openClient, closingClient } = startBroadcastOnFakedNodeTimers();

    // Act: let twenty seconds pass.
    vi.advanceTimersByTime(20_000);

    // Assert: the open client got two messages the protocol accepts, ten seconds apart;
    // the closing one got nothing (sending to it would throw).
    const messagesToTheOpenClient = openClient.textsSent.map((text) =>
      ServerMessageSchema.parse(JSON.parse(text)),
    );
    expect(messagesToTheOpenClient, 'one time message per ten seconds').toEqual([
      { type: 'time', serverNowMs: 1_791_556_335_000, serverClockStepCount: 0 },
      { type: 'time', serverNowMs: 1_791_556_345_000, serverClockStepCount: 0 },
    ]);
    expect(closingClient.textsSent, 'a socket that is not open must be skipped').toEqual([]);
  });

  it('stops for good when stop is called, and a second stop is harmless', () => {
    // Arrange: the broadcast running, with one message already sent.
    const { broadcast, openClient } = startBroadcastOnFakedNodeTimers();
    vi.advanceTimersByTime(10_000);

    // Act: stop it twice, as a shutdown called twice would, and let a minute pass.
    broadcast.stop();
    broadcast.stop();
    vi.advanceTimersByTime(60_000);

    // Assert: still only the one message from before the stop, and no timer left.
    expect(openClient.textsSent.length, 'nothing may be sent after stop').toBe(1);
    expect(vi.getTimerCount(), 'stop must leave no timer running').toBe(0);
  });
});
