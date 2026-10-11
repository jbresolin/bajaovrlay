import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';

import { type WebSocket, WebSocketServer } from 'ws';

import type { ServerLogger } from '../logger/createLogger.js';
import type { StateStore } from '../store/createStateStore.js';
import { answerClientMessage } from './clientMessageAnswers.js';
import { buildActorForConnection } from './connectionActor.js';
import { startHeartbeat } from './heartbeat.js';
import {
  buildHelloMessage,
  buildSliceMessage,
  serializeServerMessage,
} from './serverMessageBuilding.js';

/** The only path that upgrades to a WebSocket (the control page's dev proxy forwards it). */
export const webSocketPath = '/ws';

/** What the hub needs: the HTTP server to share, the store, a logger, the ping interval. */
export type WebSocketHubOptions = {
  httpServer: Server;
  stateStore: StateStore;
  logger: ServerLogger;
  heartbeatIntervalInMilliseconds: number;
};

/** The running hub; close() drops every client and stops the heartbeat. */
export type WebSocketHub = { close: () => Promise<void> };

/**
 * Attaches the WebSocket protocol to the HTTP server, on the same port at `/ws`. Each
 * client gets `hello`, then a `slice` message whenever a slice changes, and a
 * `commandResult` for each message it sends (a command, or a renderer's
 * `instanceStatus`). A connection to `/ws?role=renderer` acts as a renderer, any other
 * as an operator. Any other upgrade path is refused.
 */
export function attachWebSocketHub(options: WebSocketHubOptions): WebSocketHub {
  const { httpServer, stateStore, logger } = options;
  // noServer: the HTTP server is Hono's; this hub only takes over the upgrades below.
  const webSocketServer = new WebSocketServer({ noServer: true });
  const heartbeat = startHeartbeat({
    webSocketServer,
    intervalInMilliseconds: options.heartbeatIntervalInMilliseconds,
    logger,
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const requestPath = readUpgradeRequestPath(request.url);
    if (requestPath !== webSocketPath) {
      // Node removes its own socket error handler before emitting 'upgrade'; without
      // this one, a peer resetting the connection here would be an uncaught error.
      // (handleUpgrade below adds its own, so /ws needs none.)
      socket.on('error', (socketError) => {
        logger.warn({ err: socketError }, 'refused upgrade socket error');
        socket.destroy();
      });
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request);
    });
  });

  webSocketServer.on('connection', (client: WebSocket, request: IncomingMessage) => {
    // No login yet: a connection is a renderer or an operator by the address it chose,
    // and is told apart by its own id so the event log can say which one sent what.
    const connectionId = randomUUID();
    const actor = buildActorForConnection(request.url, connectionId);
    const connectionLogger = logger.child({ connection_id: connectionId, actor });
    connectionLogger.info('websocket client connected');

    heartbeat.trackClient(client);
    client.send(serializeServerMessage(buildHelloMessage(stateStore.readAllSlices())));

    client.on('message', (data, isBinary) => {
      const commandResult = answerClientMessage({
        messageText: isBinary ? undefined : data.toString(),
        stateStore,
        actor,
        logger: connectionLogger,
      });
      client.send(serializeServerMessage(commandResult));
    });
    client.on('error', (socketError) => {
      connectionLogger.warn({ err: socketError }, 'websocket client error');
    });
    client.on('close', () => connectionLogger.info('websocket client disconnected'));
  });

  // Every client hears about every change, the sender included. This runs inside
  // applyCommand, so the slices reach the sender before its commandResult does.
  const stopListening = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    for (const sliceName of changedSliceNames) {
      const messageText = serializeServerMessage(buildSliceMessage(sliceName, slices));
      for (const client of webSocketServer.clients) {
        if (client.readyState === client.OPEN) {
          client.send(messageText);
        }
      }
    }
  });

  return {
    close: () => {
      stopListening();
      heartbeat.stop();
      // terminate, not close: close() waits up to 30 s for a frozen client's answer.
      // Clients reconnect and get a fresh hello, so nothing is lost.
      for (const client of webSocketServer.clients) {
        client.terminate();
      }
      return new Promise((resolve) => webSocketServer.close(() => resolve()));
    },
  };
}

/**
 * The path an upgrade request asked for, or undefined when its target is not a URL.
 * Node accepts absolute-form targets such as `http://[`, and `new URL` throws on those;
 * inside the 'upgrade' listener that throw would crash the server that owns the state.
 */
function readUpgradeRequestPath(requestTarget: string | undefined): string | undefined {
  try {
    return new URL(requestTarget ?? '/', 'http://localhost').pathname;
  } catch {
    return undefined;
  }
}
