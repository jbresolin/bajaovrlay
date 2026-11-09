import {
  type ClockProbeMessage,
  type CommandInput,
  type PageReloadForNewBuild,
  readBuildIdOfAHello,
  type ServerBuildWatch,
  type ServerMessage,
  ServerMessageSchema,
  startServerBuildWatch,
} from '@bajaovrlay/shared';
import {
  readThisMachineMonotonicTimeMs,
  recordClockProbeAnswer,
  startLiningUpAgainIfTheServerClockStepped,
  startLiningUpAtAHello,
} from '@bajaovrlay/shared/clock';

import { ptBR } from '@/i18n/ptBR';
import { type LogControlEvent, logControlEvent } from '@/logging/controlLog';

import { CommandFailedError, type CommandFailureCode } from './commandFailure';
import type { ServerStateStore } from './serverStateStore';

/** What the connection wants to be told about one socket. */
export type ServerSocketHandlers = {
  onOpen: () => void;
  /** The content of one message; anything but a string is treated as unreadable. */
  onMessageText: (text: unknown) => void;
  onClose: () => void;
};

/** What the connection can do with a socket it opened. */
export type OpenedServerSocket = {
  send: (text: string) => void;
  close: () => void;
};

/**
 * Dials `address` and reports to `handlers`. In the browser this is
 * openBrowserWebSocket; tests hand in a fake so no network is involved.
 */
export type OpenServerSocket = (
  address: string,
  handlers: ServerSocketHandlers,
) => OpenedServerSocket;

/**
 * The server accepted the command. A refused command never gets here: sendCommand
 * rejects. After a createItem the server names the item it made (`createdItemId`).
 */
export type CommandResult = { ok: true; requestId: string; createdItemId?: string };

/** Sends one command and waits for the server's answer to it. */
export type SendCommand = (command: CommandInput) => Promise<CommandResult>;

/** A live connection: the way to send commands, and the way to hang up. */
export type ServerConnection = {
  /**
   * Resolves when the server answers ok. Rejects with a CommandFailedError when the
   * server refuses, when it does not answer within 5 seconds, or when there is no
   * connection. Every failure is also left in the store's `lastCommandError`.
   */
  sendCommand: SendCommand;
  /** Hangs up and stops redialling. */
  close: () => void;
};

/** Everything a connection needs; main.tsx provides the real ones. */
export type ServerConnectionOptions = {
  webSocketAddress: string;
  serverStateStore: ServerStateStore;
  openSocket: OpenServerSocket;
  /**
   * The page's build and the browser's clock, reload and sessionStorage, for reloading the
   * page when a hello names another build (browserPageReloadForNewBuild in main.tsx). Left
   * out (most tests), no build is compared.
   */
  pageReloadForNewBuild?: PageReloadForNewBuild | undefined;
  /**
   * Called each time the line drops (not when the page hangs up itself). main.tsx asks
   * there whether the session ended, to go to "#/entrar" (BAJAOVRLAY-29). Left out (most
   * tests): nothing but the redialling.
   */
  onLineDropped?: (() => void) | undefined;
  logEvent?: LogControlEvent;
};

/** How long sendCommand waits for the server's answer before giving up. */
export const commandTimeoutInMilliseconds = 5_000;

// Backoff: each failed call waits longer than the one before, so a server that is down
// is not hammered, and the wait never grows past 5 s, so the page is back soon after the
// server is. The first retry is quick because most drops are a server restart.
const waitsBeforeRedialInMilliseconds = [500, 1_000, 2_000, 4_000];
const longestWaitBeforeRedialInMilliseconds = 5_000;

/** A command that was sent and whose answer has not arrived yet. */
type CommandAwaitingItsResult = {
  commandType: CommandInput['type'];
  resolve: (commandResult: CommandResult) => void;
  reject: (failure: CommandFailedError) => void;
  timeoutTimer: ReturnType<typeof setTimeout>;
};

/**
 * Connects the control page to the server and keeps it connected. Every message is
 * checked against ServerMessageSchema before it touches the store; when the line drops
 * the store says `reconnecting` and the server is dialled again with growing waits.
 */
export function connectToServer(options: ServerConnectionOptions): ServerConnection {
  const { webSocketAddress, serverStateStore, openSocket } = options;
  const logEvent = options.logEvent ?? logControlEvent;

  const commandsAwaitingTheirResult = new Map<string, CommandAwaitingItsResult>();
  let numberOfCommandsSent = 0;
  let currentSocket: OpenedServerSocket | undefined;
  let numberOfFailedCallsInARow = 0;
  let redialTimer: ReturnType<typeof setTimeout> | undefined;
  let wasClosedOnPurpose = false;
  // Compares the build of each hello with the page's (packages/shared/src/build); none
  // when the page brought no build stand-ins (most tests).
  const serverBuildWatch = startWatchOnTheServerBuild(options.pageReloadForNewBuild, logEvent);

  function dialTheServer(): void {
    currentSocket = openSocket(webSocketAddress, {
      // Nothing to do when the socket opens: the page is only "connected" once the
      // hello has arrived, because until then it has no state to show.
      onOpen: () => undefined,
      onMessageText: handleMessageText,
      onClose: handleSocketClosed,
    });
  }

  function handleSocketClosed(): void {
    currentSocket = undefined;
    if (wasClosedOnPurpose) {
      return;
    }
    serverStateStore.getState().changeConnectionStatus('reconnecting');
    options.onLineDropped?.();

    const waitInMilliseconds =
      waitsBeforeRedialInMilliseconds[numberOfFailedCallsInARow] ??
      longestWaitBeforeRedialInMilliseconds;
    numberOfFailedCallsInARow += 1;
    redialTimer = setTimeout(dialTheServer, waitInMilliseconds);
  }

  function handleMessageText(text: unknown): void {
    // Read before the message is checked: checking a large hello takes a few
    // milliseconds, and each of them would make the sample of the server's clock later.
    const localTimeAtArrivalMs = readThisMachineMonotonicTimeMs();
    const messageJson = readJsonOfMessage(text);
    const message = readServerMessage(messageJson);
    if (message === undefined) {
      logEvent('warn', 'ignored a server message that is not in the protocol');
      // A hello this page's schema refuses is the case the build check exists for: a
      // newer server's slices that this bundle does not know. Its build is read on its own.
      const buildIdOfARefusedHello = readBuildIdOfAHello(messageJson);
      if (buildIdOfARefusedHello !== undefined) {
        serverBuildWatch?.compareWithTheServerBuild(buildIdOfARefusedHello);
      }
      return;
    }
    switch (message.type) {
      case 'hello':
        // Four probes line the page up, so it and the screens count from the same clock
        // (BAJAOVRLAY-62); a page not lined up yet holds the hello's own time until they
        // answer, and one already lined up keeps its time through a reconnect.
        startLiningUpAtAHello(message, localTimeAtArrivalMs);
        sendClockProbe();
        numberOfFailedCallsInARow = 0;
        // Taken in first, so a page that does not reload (same build, or already reloaded
        // for this one) is connected as always; one that reloads loses nothing.
        serverStateStore.getState().replaceEverySlice(message.slices);
        serverStateStore.getState().changeConnectionStatus('connected');
        serverBuildWatch?.compareWithTheServerBuild(message.buildId);
        break;
      case 'slice':
        serverStateStore.getState().replaceOneSlice(message);
        break;
      case 'slices':
        serverStateStore.getState().replaceSeveralSlices(message.slices);
        break;
      case 'dataSnapshot':
        serverStateStore.getState().mergeOneDataSnapshot(message);
        break;
      case 'commandResult':
        settleCommandAwaitingThisResult(message);
        break;
      case 'time':
        // The server's ten-second time message (or the one sent at once after a step of
        // its clock, whose new step count starts four probes that line up at once): one
        // probe keeps the alignment fresh, and how far the server clock is off real time
        // goes to the store, which only changes (and redraws the header) when the whole
        // seconds change. No log line.
        startLiningUpAgainIfTheServerClockStepped(message.serverClockStepCount);
        sendClockProbe();
        serverStateStore.getState().noteServerClockOffRealTime(message.offFromRealTimeMs);
        break;
      case 'clockProbeAnswer': {
        const { isAnotherProbeNeeded } = recordClockProbeAnswer({
          pageSentAtMs: message.pageSentAtMs,
          serverNowMs: message.serverNowMs,
          pageReceivedAtMs: localTimeAtArrivalMs,
        });
        if (isAnotherProbeNeeded) {
          sendClockProbe();
        }
        break;
      }
    }
  }

  /**
   * Asks the server what its clock reads (packages/shared/src/clock/serverAlignedTime.ts):
   * after a hello, four in a row; then one per `time` message. "Edição rápida" reads the
   * time lined up this way to show what a clock on air shows.
   */
  function sendClockProbe(): void {
    if (currentSocket === undefined) {
      return;
    }
    const clockProbe: ClockProbeMessage = {
      type: 'clockProbe',
      pageSentAtMs: readThisMachineMonotonicTimeMs(),
    };
    currentSocket.send(JSON.stringify(clockProbe));
  }

  function settleCommandAwaitingThisResult(
    message: Extract<ServerMessage, { type: 'commandResult' }>,
  ): void {
    const requestId = message.requestId;
    const commandAwaitingThisResult =
      requestId === null ? undefined : commandsAwaitingTheirResult.get(requestId);
    if (requestId === null || commandAwaitingThisResult === undefined) {
      // Either the command already timed out, or the server is answering a message it
      // could not read. Nobody is waiting, so there is nothing to settle.
      // The key is `request_id`, as in the server's log lines, so one search finds both.
      logEvent('warn', 'ignored a command result nobody is waiting for', {
        request_id: requestId,
      });
      return;
    }

    clearTimeout(commandAwaitingThisResult.timeoutTimer);
    commandsAwaitingTheirResult.delete(requestId);

    if (message.ok) {
      if (serverStateStore.getState().lastCommandError !== null) {
        serverStateStore.getState().forgetCommandError();
      }
      const commandResult: CommandResult =
        message.createdItemId === undefined
          ? { ok: true, requestId }
          : { ok: true, requestId, createdItemId: message.createdItemId };
      commandAwaitingThisResult.resolve(commandResult);
      return;
    }
    commandAwaitingThisResult.reject(
      rememberCommandFailure(
        commandAwaitingThisResult.commandType,
        message.error.code,
        message.error.message,
      ),
    );
  }

  /** Leaves the failure in the store for the page to show, and builds the rejection. */
  function rememberCommandFailure(
    commandType: CommandInput['type'],
    code: CommandFailureCode,
    operatorMessage: string,
  ): CommandFailedError {
    serverStateStore.getState().rememberCommandError({
      commandType,
      code,
      message: operatorMessage,
    });
    return new CommandFailedError(code, operatorMessage);
  }

  function sendCommand(command: CommandInput): Promise<CommandResult> {
    const isConnected = serverStateStore.getState().connectionStatus === 'connected';
    if (!isConnected || currentSocket === undefined) {
      return Promise.reject(
        rememberCommandFailure(command.type, 'NOT_CONNECTED', ptBR.commandFailures.notConnected),
      );
    }

    // A counter is enough: the server echoes the id only to the socket that sent it.
    // (crypto.randomUUID is not used because browsers only offer it on https or
    // localhost, and an operator's laptop opens the page over plain http on the LAN.)
    numberOfCommandsSent += 1;
    const requestId = `pedido-${numberOfCommandsSent}`;
    const socketToSendOn = currentSocket;

    return new Promise<CommandResult>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        // The command may still have been applied: only the answer is missing. The
        // message therefore tells the operator to check the layers.
        commandsAwaitingTheirResult.delete(requestId);
        reject(
          rememberCommandFailure(command.type, 'COMMAND_TIMED_OUT', ptBR.commandFailures.timedOut),
        );
      }, commandTimeoutInMilliseconds);

      commandsAwaitingTheirResult.set(requestId, {
        commandType: command.type,
        resolve,
        reject,
        timeoutTimer,
      });
      socketToSendOn.send(JSON.stringify({ type: 'command', requestId, command }));
    });
  }

  function close(): void {
    wasClosedOnPurpose = true;
    clearTimeout(redialTimer);
    serverBuildWatch?.stop();
    currentSocket?.close();
  }

  dialTheServer();
  return { sendCommand, close };
}

/**
 * Starts the watch on the server's build with the browser's setTimeout, or none when the
 * page brought no build stand-ins. The watch logs through the control page's log.
 */
function startWatchOnTheServerBuild(
  pageReloadForNewBuild: PageReloadForNewBuild | undefined,
  logEvent: LogControlEvent,
): ServerBuildWatch | undefined {
  if (pageReloadForNewBuild === undefined) {
    return undefined;
  }
  return startServerBuildWatch({
    pageReload: pageReloadForNewBuild,
    logBuildEvent: logEvent,
    startTimer: (callback, waitInMilliseconds) => {
      const timer = setTimeout(callback, waitInMilliseconds);
      return () => clearTimeout(timer);
    },
  });
}

/** Reads the JSON of one message; undefined when it is not text or not JSON. */
function readJsonOfMessage(text: unknown): unknown {
  if (typeof text !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Reads one message as the protocol defines it, or undefined when it is not one. */
function readServerMessage(parsedJson: unknown): ServerMessage | undefined {
  const parsedMessage = ServerMessageSchema.safeParse(parsedJson);
  if (!parsedMessage.success) {
    return undefined;
  }
  return parsedMessage.data;
}
