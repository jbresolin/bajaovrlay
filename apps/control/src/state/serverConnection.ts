import { type CommandInput, type ServerMessage, ServerMessageSchema } from '@bajaovrlay/shared';
import { recordServerClockSample } from '@bajaovrlay/shared/clock';

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

/** The server accepted the command. A refused command never gets here: sendCommand rejects. */
export type CommandResult = { ok: true; requestId: string };

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

    const waitInMilliseconds =
      waitsBeforeRedialInMilliseconds[numberOfFailedCallsInARow] ??
      longestWaitBeforeRedialInMilliseconds;
    numberOfFailedCallsInARow += 1;
    redialTimer = setTimeout(dialTheServer, waitInMilliseconds);
  }

  function handleMessageText(text: unknown): void {
    // Read before the message is checked: checking a large hello takes a few
    // milliseconds, and each of them would make the sample of the server's clock later.
    const localTimeAtArrivalMs = Date.now();
    const message = readServerMessage(text);
    if (message === undefined) {
      logEvent('warn', 'ignored a server message that is not in the protocol');
      return;
    }
    recordServerClockSampleOfMessage(message, localTimeAtArrivalMs);

    switch (message.type) {
      case 'hello':
        numberOfFailedCallsInARow = 0;
        serverStateStore.getState().replaceEverySlice(message.slices);
        serverStateStore.getState().changeConnectionStatus('connected');
        break;
      case 'slice':
        serverStateStore.getState().replaceOneSlice(message);
        break;
      case 'slices':
        serverStateStore.getState().replaceSeveralSlices(message.slices);
        break;
      case 'commandResult':
        settleCommandAwaitingThisResult(message);
        break;
      case 'time':
        // The server's ten-second time message. Its sample was recorded just above and
        // that is all: nothing is set in the store, so no component redraws, and no
        // line is logged every ten seconds.
        break;
    }
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
      commandAwaitingThisResult.resolve({ ok: true, requestId });
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
    currentSocket?.close();
  }

  dialTheServer();
  return { sendCommand, close };
}

/**
 * Hands the server's time in a hello, slice, slices or time message to the shared server-aligned
 * clock, which "Edição rápida" reads to show the time a clock on air shows. The renderer
 * does the same (apps/renderer/src/serverConnection.ts), so the page and the screen
 * count from the same clock. A hello or slice without the time records NOTHING: it is
 * "no sample", never a sample saying the two clocks agree.
 * What could go wrong: the sample is late by the time the message took to arrive. A
 * step of this computer's clock is corrected by the time messages, which come every ten
 * seconds even when nothing changes; three are needed, so about thirty seconds.
 */
function recordServerClockSampleOfMessage(
  message: ServerMessage,
  localTimeAtArrivalMs: number,
): void {
  if (message.type === 'commandResult') {
    return;
  }
  // The field is optional in the protocol; a message without it gives no sample.
  if (message.serverNowMs === undefined) {
    return;
  }
  recordServerClockSample(message.serverNowMs, localTimeAtArrivalMs);
}

/** Reads one message as the protocol defines it, or undefined when it is not one. */
function readServerMessage(text: unknown): ServerMessage | undefined {
  if (typeof text !== 'string') {
    return undefined;
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsedMessage = ServerMessageSchema.safeParse(parsedJson);
  if (!parsedMessage.success) {
    return undefined;
  }
  return parsedMessage.data;
}
