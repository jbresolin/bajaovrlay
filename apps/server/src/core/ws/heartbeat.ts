import type { WebSocket, WebSocketServer } from 'ws';

import type { ServerLogger } from '../logger/createLogger.js';

/** How often the server pings every client; a client that misses one ping is dropped. */
export const defaultHeartbeatIntervalInMilliseconds = 15_000;

/** The heartbeat: track each new client, and stop it all on shutdown. */
export type Heartbeat = {
  trackClient: (client: WebSocket) => void;
  stop: () => void;
};

/**
 * Pings every client each interval. A client that has not answered (pong) the previous
 * ping by the next tick is terminated: a frozen tab or a dropped network otherwise
 * stays in the client list forever, and broadcasts keep queuing up for it.
 */
export function startHeartbeat(options: {
  webSocketServer: WebSocketServer;
  intervalInMilliseconds: number;
  logger: ServerLogger;
}): Heartbeat {
  const clientsThatAnsweredTheLastPing = new WeakSet<WebSocket>();

  const heartbeatTimer = setInterval(() => {
    for (const client of options.webSocketServer.clients) {
      if (!clientsThatAnsweredTheLastPing.has(client)) {
        options.logger.info('websocket client dropped after missing a ping');
        client.terminate();
        continue;
      }
      clientsThatAnsweredTheLastPing.delete(client);
      client.ping();
    }
  }, options.intervalInMilliseconds);

  return {
    trackClient: (client) => {
      // A client that just connected counts as alive until its first ping.
      clientsThatAnsweredTheLastPing.add(client);
      client.on('pong', () => clientsThatAnsweredTheLastPing.add(client));
    },
    stop: () => clearInterval(heartbeatTimer),
  };
}
