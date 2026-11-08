import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import type { SliceNameSentWhole, Slices } from '@bajaovrlay/shared';
import { type WebSocket, WebSocketServer } from 'ws';

import { isOriginOfAnotherSite } from '../http/originOfAnotherSite.js';
import type { ServerLogger } from '../logger/createLogger.js';
import type { OperatorLogin } from '../operatorLogin/operatorLogin.js';
import type { StateStore } from '../store/createStateStore.js';
import { readServerTime } from '../time/serverClock.js';
import { answerClientMessage } from './clientMessageAnswers.js';
import { buildActorForConnection, isScreenConnectionActor } from './connectionActor.js';
import { startHeartbeat } from './heartbeat.js';
import { readOutputIdFromRequestTarget } from './screenOutput.js';
import {
  buildDataSnapshotMessage,
  buildHelloMessage,
  buildSliceMessage,
  buildSlicesMessage,
  keepSliceNamesSentWhole,
  serializeServerMessage,
} from './serverMessageBuilding.js';
import { startServerTimeBroadcast } from './serverTimeBroadcast.js';
import { trackSessionsOfConnections } from './sessionsOfConnections.js';
import {
  buildSlicesForAScreen,
  keepSliceNamesScreensReceive,
  keepSliceNamesWhoseTextDiffersFromTheLastSent,
  type TextsOfTheSlicesAScreenDraws,
  writeTextsOfTheSlicesAScreenDraws,
} from './slicesSentToScreens.js';

/** The only path that upgrades to a WebSocket (the control page's dev proxy forwards it). */
export const webSocketPath = '/ws';

/**
 * What the hub needs: the HTTP server to share, the store, a logger, the ping interval,
 * and (for tests) the clock whose time goes into each `hello`, `slice` and `slices` message.
 */
export type WebSocketHubOptions = {
  httpServer: Server;
  stateStore: StateStore;
  logger: ServerLogger;
  heartbeatIntervalInMilliseconds: number;
  /**
   * Defaults to the server clock (core/time). It must be the clock the store stamps commands
   * with: renderers line their own clock up with this one, and a race clock counts from
   * a moment the store stamped.
   */
  readCurrentTime?: (() => Date) | undefined;
  /**
   * How far the server clock is from real time by NTP (core/time), sent in every `time`
   * message; left out, or answering undefined, sends nothing (NTP off, tests).
   */
  readOffFromRealTimeMs?: (() => number | undefined) | undefined;
  /**
   * The timer behind the ten-second `time` message; defaults to Node's setInterval.
   * Tests hand in one they move by hand, together with cancelRepeatingTimer.
   */
  startRepeatingTimer?:
    ((onEachInterval: () => void, intervalInMilliseconds: number) => unknown) | undefined;
  /** Cancels a timer started by startRepeatingTimer; defaults to Node's clearInterval. */
  cancelRepeatingTimer?: ((timerHandle: unknown) => void) | undefined;
  /**
   * The build this server runs (build-id.json as startServer read it at boot), named in
   * every hello so a page from another build reloads itself (packages/shared/src/build).
   * Undefined (development, most tests): hello names none.
   */
  buildId?: string | undefined;
  /**
   * The operator login (BAJAOVRLAY-29). With the PINs set, a connection that is not a
   * screen needs a session cookie and signs as its role and station. Required, with no
   * default (gate 2 of PR #51): a wiring that forgot it must not compile into an open socket.
   */
  operatorLogin: OperatorLogin;
  /**
   * BAJAOVRLAY_PUBLIC_ORIGINS: a reverse proxy's addresses whose pages may open the socket,
   * beside the server's own (gate 2 of PR #51). None unless given.
   */
  publicOrigins?: readonly string[] | undefined;
};

/** The running hub; close() drops every client and stops the heartbeat and the time message. */
export type WebSocketHub = { close: () => Promise<void> };

/**
 * Attaches the WebSocket protocol to the HTTP server, on the same port at `/ws`. Each
 * client gets `hello` (with the server's build id when it has one), then one message per
 * state change: `slice` when one slice changed, `slices` when several did (each carrying `serverNowMs`, the server's clock at
 * the moment the message is built). An operator also gets one `dataSnapshot` message per
 * source whose snapshot changed, just before that `slice` or `slices`, because
 * `dataSnapshots` is never sent whole after the hello. Each client gets a
 * `commandResult` for each message it sends (a
 * command, or a renderer's `instanceStatus`). Every ten seconds every client also gets a
 * `time` message, so a page keeps learning the server's clock while nothing changes. A
 * connection to `/ws?role=renderer` acts as a renderer, one to `/ws?role=monitor` as a
 * monitor, any other as an operator. A screen (a renderer or a monitor) is sent only the
 * slices it draws (outputs, graphics, and the layers, instances and previewClearedLayerIds
 * of its own output, named by `&output=` in its address, program by default): every
 * other slice is empty in its hello and left out of every change, it gets no
 * `dataSnapshot` message, and no message at all for a change of other slices alone (see
 * slicesSentToScreens.ts). Any other upgrade path is refused.
 */
export function attachWebSocketHub(options: WebSocketHubOptions): WebSocketHub {
  const { httpServer, stateStore, logger } = options;
  const readCurrentTime = options.readCurrentTime ?? readServerTime;
  const { operatorLogin } = options;
  const publicOrigins = options.publicOrigins ?? [];
  // noServer: the HTTP server is Hono's; this hub only takes over the upgrades below.
  const webSocketServer = new WebSocketServer({ noServer: true });
  const heartbeat = startHeartbeat({
    webSocketServer,
    intervalInMilliseconds: options.heartbeatIntervalInMilliseconds,
    logger,
  });
  const serverTimeBroadcast = startServerTimeBroadcast({
    webSocketServer,
    readCurrentTime,
    readOffFromRealTimeMs: options.readOffFromRealTimeMs,
    startRepeatingTimer: options.startRepeatingTimer,
    cancelRepeatingTimer: options.cancelRepeatingTimer,
  });
  // The open screen connections (`/ws?role=renderer` or `/ws?role=monitor`), each with the
  // output it draws (BAJAOVRLAY-49); each leaves on close. They are sent only the slices
  // listed in slicesSentToScreens.ts, filtered to their output.
  const outputIdOfEachScreen = new Map<WebSocket, string>();
  // The text of each drawn slice as last sent to each screen, from its hello on, so a
  // screen is spared a change that leaves its own copy as it was (a take on the PiP, for
  // program's screens). Kept per screen, not per output: a screen that connects later
  // starts from its own hello, and nothing has to be kept for an output with no screen.
  const textsLastSentToEachScreen = new Map<WebSocket, TextsOfTheSlicesAScreenDraws>();
  // The operator session of each logged-in connection (BAJAOVRLAY-29).
  const sessionsOfConnections = trackSessionsOfConnections({ operatorLogin, readCurrentTime });

  /** Answers an upgrade with an HTTP error and closes it, never letting a reset crash us. */
  function refuseTheUpgrade(socket: Duplex, statusLine: string): void {
    // Node removes its own socket error handler before emitting 'upgrade'; without this
    // one, a peer resetting the connection here would be an uncaught error. (handleUpgrade
    // adds its own, so an upgrade that goes through needs none.)
    socket.on('error', (socketError) => {
      logger.warn({ err: socketError }, 'refused upgrade socket error');
      socket.destroy();
    });
    socket.end(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
  }

  httpServer.on('upgrade', (request, socket, head) => {
    if (readUpgradeRequestPath(request.url) !== webSocketPath) {
      refuseTheUpgrade(socket, '404 Not Found');
      return;
    }
    // A page of another site may not open the socket, a screen's address or not: SameSite
    // lets a page on another port of this host send the cookie (gate 2 of PR #51). Without
    // a login a page needs no cookie at all, so this holds with the PINs unset too.
    const host = request.headers.host;
    const originOfTheServer = host === undefined ? undefined : `http://${host}`;
    if (isOriginOfAnotherSite(request.headers.origin, originOfTheServer, publicOrigins)) {
      refuseTheUpgrade(socket, '403 Forbidden');
      return;
    }
    // With the PINs set, a control page needs its session; a screen (a renderer, a monitor)
    // connects without one on the LAN, as before (BAJAOVRLAY-29). A refusal is a plain 401
    // the browser cannot read; the page learns why from GET /api/v1/session.
    if (sessionsOfConnections.isUpgradeRefused(request)) {
      refuseTheUpgrade(socket, '401 Unauthorized');
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request);
    });
  });

  webSocketServer.on('connection', (client: WebSocket, request: IncomingMessage) => {
    // A connection is a renderer or a monitor by the address it chose, a logged-in operator
    // by its session, or (the login off) an operator told apart by its own id, so the event
    // log can say which one sent what.
    const connectionId = randomUUID();
    const session = sessionsOfConnections.findSessionOfTheUpgrade(request);
    const actor = buildActorForConnection(request.url, connectionId, session);
    const connectionLogger = logger.child({ connection_id: connectionId, actor });
    connectionLogger.info('websocket client connected');

    heartbeat.trackClient(client);
    const isScreen = isScreenConnectionActor(actor);
    const outputIdOfTheScreen = readOutputIdFromRequestTarget(request.url);
    if (isScreen) {
      outputIdOfEachScreen.set(client, outputIdOfTheScreen);
    }
    const allSlices = stateStore.readAllSlices();
    // A screen of an output nobody created draws nothing (screenOutput.ts); the warning
    // lets a typo in an OBS source's address be found in the log (gate 2 of PR #32).
    const isOutputOfTheScreenListed = allSlices.outputs.some(
      (output) => output.outputId === outputIdOfTheScreen,
    );
    if (isScreen && !isOutputOfTheScreenListed) {
      connectionLogger.warn(
        { output_id: outputIdOfTheScreen },
        'screen connected for an output that does not exist',
      );
    }
    const slicesForThisClient = isScreen
      ? buildSlicesForAScreen(allSlices, outputIdOfTheScreen)
      : allSlices;
    const helloMessage = buildHelloMessage(
      slicesForThisClient,
      readCurrentTime().getTime(),
      options.buildId,
    );
    client.send(serializeServerMessage(helloMessage));
    if (isScreen) {
      textsLastSentToEachScreen.set(client, writeTextsOfTheSlicesAScreenDraws(slicesForThisClient));
    }

    // A logged-in page is closed when its session ends ("Sair", its 18 hours).
    sessionsOfConnections.watchTheSessionOfConnection(client, request);

    client.on('message', (data, isBinary) => {
      if (!sessionsOfConnections.isConnectionStillAllowedToSend(client, request)) {
        return;
      }
      const answer = answerClientMessage({
        messageText: isBinary ? undefined : data.toString(),
        stateStore,
        actor,
        logger: connectionLogger,
        readCurrentTime,
      });
      client.send(serializeServerMessage(answer));
    });
    client.on('error', (socketError) => {
      connectionLogger.warn({ err: socketError }, 'websocket client error');
    });
    client.on('close', () => {
      outputIdOfEachScreen.delete(client);
      textsLastSentToEachScreen.delete(client);
      connectionLogger.info('websocket client disconnected');
    });
  });

  // Every client hears about every change, the sender included. This runs inside
  // applyCommand, so the slices reach the sender before its commandResult does.
  // One state change is ONE message: a client that took the slices one by one drew the
  // moment between them ("Prévia: limpar" on a previewed layer showed the program clock
  // for a moment before it animated out). The listener is told the command's own slices
  // and the event log together, so an accepted command always sends `slices`; a refused
  // one changes the event log alone and sends `slice`, as before `slices` existed.
  // A changed snapshot is the exception to "one message": it goes as its own
  // `dataSnapshot` message per source (BAJAOVRLAY-40), so a poll of one source does not
  // resend every source's data. Those go first, so by the time the page reads a source's
  // new "last good poll" moment in `dataSources`, that poll's data is already there.
  // What could go wrong: between the two messages the page shows the new data with the
  // source's old health for a moment, which nothing on air reads.
  const stopListening = stateStore.subscribeToSliceChanges(
    (changedSliceNames, slices, changedDataSnapshots) => {
      // The clock is read as late as possible: a renderer takes the difference between
      // this time and its own clock at arrival, so every millisecond between this reading
      // and the send shows up as an error in its sample.
      const serverNowMs = readCurrentTime().getTime();
      // Each text is built once per change and audience, not once per client: a routine
      // poll of 60 cars would otherwise be serialised again for every page connected.
      const snapshotTextsForOperators = changedDataSnapshots.map((change) =>
        serializeServerMessage(buildDataSnapshotMessage(change, serverNowMs)),
      );
      const sliceNamesForOperators = keepSliceNamesSentWhole(changedSliceNames);
      const sliceNamesForScreens = keepSliceNamesScreensReceive(sliceNamesForOperators);
      // Each undefined when that audience has no slice to hear of (a poll that changed
      // only a snapshot; for screens, any change that touches none of the slices they
      // draw, such as a poll or a refused command): an empty `slices` group is not a
      // valid message, so nothing is sent.
      const sliceTextForOperators = serializeChangeOfSlicesOrNothing(
        sliceNamesForOperators,
        slices,
        serverNowMs,
      );
      // A screen's copy, and its slices' texts, are built once per output, the first time
      // a screen of that output is met, and only when the change touches a slice screens
      // draw at all.
      const copyForScreensByOutputId = new Map<
        string,
        { slicesOfTheOutput: Slices; textsNow: TextsOfTheSlicesAScreenDraws }
      >();
      const readCopyForScreensOf = (outputId: string) => {
        let copy = copyForScreensByOutputId.get(outputId);
        if (copy === undefined) {
          const slicesOfTheOutput = buildSlicesForAScreen(slices, outputId);
          copy = {
            slicesOfTheOutput,
            textsNow: writeTextsOfTheSlicesAScreenDraws(slicesOfTheOutput),
          };
          copyForScreensByOutputId.set(outputId, copy);
        }
        return copy;
      };
      // The message text is built once per output and set of slices to send: screens of
      // one output have nearly always been sent the same, so they share one text.
      const messageTextForScreensByKey = new Map<string, string | undefined>();
      const sendTheScreenWhatChangedForIt = (screen: WebSocket, outputId: string): void => {
        const { slicesOfTheOutput, textsNow } = readCopyForScreensOf(outputId);
        const textsLastSent = textsLastSentToEachScreen.get(screen) ?? new Map();
        const sliceNamesToSend = keepSliceNamesWhoseTextDiffersFromTheLastSent(
          sliceNamesForScreens,
          textsLastSent,
          textsNow,
        );
        const messageKey = `${outputId} ${sliceNamesToSend.join(',')}`;
        if (!messageTextForScreensByKey.has(messageKey)) {
          messageTextForScreensByKey.set(
            messageKey,
            serializeChangeOfSlicesOrNothing(sliceNamesToSend, slicesOfTheOutput, serverNowMs),
          );
        }
        sendIfThereIsSomething(screen, messageTextForScreensByKey.get(messageKey));
        for (const sliceName of sliceNamesToSend) {
          textsLastSent.set(sliceName, textsNow.get(sliceName) ?? '');
        }
        textsLastSentToEachScreen.set(screen, textsLastSent);
      };
      for (const client of webSocketServer.clients) {
        if (client.readyState !== client.OPEN) {
          continue;
        }
        const outputIdOfTheScreen = outputIdOfEachScreen.get(client);
        if (outputIdOfTheScreen !== undefined) {
          if (sliceNamesForScreens.length > 0) {
            sendTheScreenWhatChangedForIt(client, outputIdOfTheScreen);
          }
          continue;
        }
        for (const snapshotText of snapshotTextsForOperators) {
          client.send(snapshotText);
        }
        sendIfThereIsSomething(client, sliceTextForOperators);
      }
    },
  );

  return {
    close: () => {
      stopListening();
      sessionsOfConnections.stop();
      heartbeat.stop();
      // Before the clients are dropped, so no tick finds a half-closed server.
      serverTimeBroadcast.stop();
      // terminate, not close: close() waits up to 30 s for a frozen client's answer.
      // Clients reconnect and get a fresh hello, so nothing is lost.
      for (const client of webSocketServer.clients) {
        client.terminate();
      }
      return new Promise((resolve) => webSocketServer.close(() => resolve()));
    },
  };
}

/** Sends the text to the client, unless there is none for it. */
function sendIfThereIsSomething(client: WebSocket, text: string | undefined): void {
  if (text !== undefined) {
    client.send(text);
  }
}

/**
 * The text of the message for one state change: `slice` when one slice changed,
 * `slices` when several did, undefined when none did.
 */
function serializeChangeOfSlicesOrNothing(
  changedSliceNames: SliceNameSentWhole[],
  slices: Slices,
  serverNowMs: number,
): string | undefined {
  if (changedSliceNames.length === 0) {
    return undefined;
  }
  const onlyChangedSliceName = changedSliceNames.length === 1 ? changedSliceNames[0] : undefined;
  const changeMessage =
    onlyChangedSliceName === undefined
      ? buildSlicesMessage(changedSliceNames, slices, serverNowMs)
      : buildSliceMessage(onlyChangedSliceName, slices, serverNowMs);
  return serializeServerMessage(changeMessage);
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
