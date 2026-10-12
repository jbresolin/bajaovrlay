import type { WebSocketServer } from 'ws';

import { buildTimeMessage, serializeServerMessage } from './serverMessageBuilding.js';

/** How often every client is told what the server's clock shows. */
export const serverTimeIntervalInMilliseconds = 10_000;

/**
 * What the broadcast needs: the clients, the clock, and (for tests) the two timer
 * functions, which default to Node's setInterval and clearInterval.
 */
export type ServerTimeBroadcastOptions = {
  webSocketServer: WebSocketServer;
  /** The clock the store stamps commands with; see WebSocketHubOptions.readCurrentTime. */
  readCurrentTime: () => Date;
  /** Starts a timer that fires again and again; returns what cancelRepeatingTimer takes. */
  startRepeatingTimer?:
    ((onEachInterval: () => void, intervalInMilliseconds: number) => unknown) | undefined;
  /** Cancels a timer started by startRepeatingTimer. */
  cancelRepeatingTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running broadcast; stop() ends it, and may be called more than once. */
export type ServerTimeBroadcast = { stop: () => void };

/**
 * Sends every connected client `{ type: 'time', serverNowMs }` every ten seconds. Pages
 * learn the server's clock from `hello` and `slice` messages, but those only come when
 * something changes; during a quiet stretch a page whose own clock stepped would stay
 * wrong until the next change. This message brings a sample regardless.
 * One timer serves every client, so a client that connects in the middle of an interval
 * gets the next tick; its `hello` has already given it a first sample.
 * What could go wrong: ten seconds is the longest a stepped page clock stays uncorrected
 * by a single sample, but a page uses the median of its last five, so a step is fully
 * corrected only after three ticks, about thirty seconds.
 */
export function startServerTimeBroadcast(options: ServerTimeBroadcastOptions): ServerTimeBroadcast {
  const { webSocketServer, readCurrentTime } = options;
  const startRepeatingTimer = options.startRepeatingTimer ?? startNodeRepeatingTimer;
  const cancelRepeatingTimer = options.cancelRepeatingTimer ?? cancelNodeRepeatingTimer;

  /** Tells every open client the time. The clock is read once, right before sending. */
  function sendTimeToEveryClient(): void {
    const timeMessage = buildTimeMessage(readCurrentTime().getTime());
    const messageText = serializeServerMessage(timeMessage);
    for (const client of webSocketServer.clients) {
      // A socket that is still connecting or already closing would throw on send.
      if (client.readyState === client.OPEN) {
        client.send(messageText);
      }
    }
  }

  const timerHandle = startRepeatingTimer(sendTimeToEveryClient, serverTimeIntervalInMilliseconds);

  return { stop: () => cancelRepeatingTimer(timerHandle) };
}

/** The default startRepeatingTimer: Node's setInterval. */
function startNodeRepeatingTimer(
  onEachInterval: () => void,
  intervalInMilliseconds: number,
): unknown {
  return setInterval(onEachInterval, intervalInMilliseconds);
}

/** The default cancelRepeatingTimer: Node's clearInterval, for a handle from setInterval. */
function cancelNodeRepeatingTimer(timerHandle: unknown): void {
  clearInterval(timerHandle as NodeJS.Timeout);
}
