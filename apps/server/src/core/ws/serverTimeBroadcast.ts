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
  /** How far the server clock is from real time by NTP; undefined when not known. */
  readOffFromRealTimeMs?: (() => number | undefined) | undefined;
  /** How many steps the server clock has made (serverClock.ts). */
  readServerClockStepCount: () => number;
  /** Starts a timer that fires again and again; returns what cancelRepeatingTimer takes. */
  startRepeatingTimer?:
    ((onEachInterval: () => void, intervalInMilliseconds: number) => unknown) | undefined;
  /** Cancels a timer started by startRepeatingTimer. */
  cancelRepeatingTimer?: ((timerHandle: unknown) => void) | undefined;
};

/**
 * The running broadcast: `sendTheTimeToEveryClientNow` sends a `time` outside the ten
 * seconds (after a step of the server clock); stop() ends it, and may be called more
 * than once.
 */
export type ServerTimeBroadcast = { sendTheTimeToEveryClientNow: () => void; stop: () => void };

/**
 * Sends every connected client `{ type: 'time', serverNowMs, serverClockStepCount }`
 * every ten seconds, with `offFromRealTimeMs` once NTP has answered (the control page's
 * header warns from 2 s on). Each page answers it with a `clockProbe`, which keeps its alignment with the
 * server fresh during a quiet stretch, when no slice changes (BAJAOVRLAY-62).
 * One timer serves every client, so a client that connects in the middle of an interval
 * gets the next tick; its `hello` has already lined it up.
 */
export function startServerTimeBroadcast(options: ServerTimeBroadcastOptions): ServerTimeBroadcast {
  const { webSocketServer, readCurrentTime } = options;
  const startRepeatingTimer = options.startRepeatingTimer ?? startNodeRepeatingTimer;
  const cancelRepeatingTimer = options.cancelRepeatingTimer ?? cancelNodeRepeatingTimer;

  /** Tells every open client the time. The clock is read once, right before sending. */
  function sendTimeToEveryClient(): void {
    const timeMessage = buildTimeMessage({
      serverNowMs: readCurrentTime().getTime(),
      offFromRealTimeMs: options.readOffFromRealTimeMs?.(),
      serverClockStepCount: options.readServerClockStepCount(),
    });
    const messageText = serializeServerMessage(timeMessage);
    for (const client of webSocketServer.clients) {
      // A socket that is still connecting or already closing would throw on send.
      if (client.readyState === client.OPEN) {
        client.send(messageText);
      }
    }
  }

  const timerHandle = startRepeatingTimer(sendTimeToEveryClient, serverTimeIntervalInMilliseconds);

  return {
    sendTheTimeToEveryClientNow: sendTimeToEveryClient,
    stop: () => cancelRepeatingTimer(timerHandle),
  };
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
