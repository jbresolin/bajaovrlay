// Test support: a stand-in for the server's end of the WebSocket. A test hands
// `openSocket` to connectToServer, then plays the server by hand: it accepts the
// connection, sends messages, drops the line, and reads what the control page sent: its
// commands, and apart from them its clock probes (BAJAOVRLAY-62), which no command test
// has to step over.
import type { CommandError, ServerMessage } from '@bajaovrlay/shared';
import { z } from 'zod';

import type { OpenServerSocket, ServerSocketHandlers } from './serverConnection';

// The shape every text the control page sends must have. It is stricter than the shared
// CommandMessageSchema in one place: the control page always sends a requestId, and the
// fake server needs it to answer. The command inside is left unchecked, as on the wire.
// Strict, so a field the page should not be sending fails the test instead of vanishing.
const CommandMessageReceivedByFakeServerSchema = z.strictObject({
  type: z.literal('command'),
  requestId: z.string().min(1),
  command: z.unknown(),
});

// A clock probe (BAJAOVRLAY-62): the page's own send time, nothing else.
const ClockProbeReceivedByFakeServerSchema = z.strictObject({
  type: z.literal('clockProbe'),
  pageSentAtMs: z.number().int(),
});

/** One `clockProbe` message as the control page sent it over the socket. */
export type ClockProbeReceivedByFakeServer = z.infer<typeof ClockProbeReceivedByFakeServerSchema>;

/** One `command` message as the control page sent it over the socket. */
export type CommandMessageReceivedByFakeServer = z.infer<
  typeof CommandMessageReceivedByFakeServerSchema
>;

/** The server's end of the socket, driven by the test. */
export type FakeServerSocket = {
  /** Give this to connectToServer in place of the real browser WebSocket. */
  openSocket: OpenServerSocket;
  /** How many times the control page has dialled the server so far. */
  countConnectionsOpened: () => number;
  /** The address the control page dialled most recently. */
  readLastAddressDialled: () => string | undefined;
  /** The server picks up: the newest connection becomes open. */
  acceptConnection: () => void;
  /** The server sends one protocol message on the newest connection. */
  sendMessage: (message: ServerMessage) => void;
  /** The server sends text exactly as given, for messages that break the protocol. */
  sendRawText: (text: string) => void;
  /** The line drops: the newest connection closes, as when the server restarts. */
  dropConnection: () => void;
  /** Every clock probe the control page has sent, oldest first. */
  listClockProbesReceived: () => ClockProbeReceivedByFakeServer[];
  /** Every command message the control page has sent, oldest first. */
  listCommandMessagesReceived: () => CommandMessageReceivedByFakeServer[];
  /** The newest command message; throws if the control page has not sent one. */
  readLastCommandMessageReceived: () => CommandMessageReceivedByFakeServer;
  /** The server answers the newest command with `ok: true`. */
  acceptLastCommand: () => void;
  /** The server answers the newest command (a createItem) with `ok: true`, naming the item. */
  acceptLastCommandNamingTheItemItCreated: (createdItemId: string) => void;
  /** The server answers the newest command with `ok: false` and this error. */
  refuseLastCommand: (error: CommandError) => void;
};

/** Builds a fake server socket that no control page has dialled yet. */
export function createFakeServerSocket(): FakeServerSocket {
  const handlersOfEachConnection: ServerSocketHandlers[] = [];
  const addressesDialled: string[] = [];
  const textsReceived: string[] = [];

  function readHandlersOfNewestConnection(): ServerSocketHandlers {
    const newestHandlers = handlersOfEachConnection.at(-1);
    if (newestHandlers === undefined) {
      throw new Error('the control page has not opened a connection to the fake server yet');
    }
    return newestHandlers;
  }

  /** Every text the page sent, split into its clock probes and the rest. */
  function readMessagesReceived(): { clockProbes: unknown[]; otherMessages: unknown[] } {
    const messagesAsSent = textsReceived.map((text): unknown => JSON.parse(text));
    const isClockProbe = (message: unknown) =>
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'clockProbe';
    return {
      clockProbes: messagesAsSent.filter(isClockProbe),
      otherMessages: messagesAsSent.filter((message) => !isClockProbe(message)),
    };
  }

  // Checked instead of cast: if the control page ever sends something that is neither a
  // command message nor a clock probe, the test fails here with the field named.
  function listCommandMessagesReceived(): CommandMessageReceivedByFakeServer[] {
    return readMessagesReceived().otherMessages.map((messageAsSent) =>
      CommandMessageReceivedByFakeServerSchema.parse(messageAsSent),
    );
  }

  function listClockProbesReceived(): ClockProbeReceivedByFakeServer[] {
    return readMessagesReceived().clockProbes.map((messageAsSent) =>
      ClockProbeReceivedByFakeServerSchema.parse(messageAsSent),
    );
  }

  function readLastCommandMessageReceived(): CommandMessageReceivedByFakeServer {
    const lastCommandMessage = listCommandMessagesReceived().at(-1);
    if (lastCommandMessage === undefined) {
      throw new Error('the control page has not sent any command to the fake server yet');
    }
    return lastCommandMessage;
  }

  function sendMessage(message: ServerMessage): void {
    readHandlersOfNewestConnection().onMessageText(JSON.stringify(message));
  }

  return {
    openSocket: (address, handlers) => {
      addressesDialled.push(address);
      handlersOfEachConnection.push(handlers);
      return {
        send: (text) => {
          textsReceived.push(text);
        },
        // The control page hanging up needs no reaction from the fake server.
        close: () => undefined,
      };
    },
    countConnectionsOpened: () => handlersOfEachConnection.length,
    readLastAddressDialled: () => addressesDialled.at(-1),
    acceptConnection: () => readHandlersOfNewestConnection().onOpen(),
    sendMessage,
    sendRawText: (text) => readHandlersOfNewestConnection().onMessageText(text),
    dropConnection: () => readHandlersOfNewestConnection().onClose(),
    listClockProbesReceived,
    listCommandMessagesReceived,
    readLastCommandMessageReceived,
    acceptLastCommand: () => {
      const requestId = readLastCommandMessageReceived().requestId;
      sendMessage({ type: 'commandResult', requestId, ok: true });
    },
    acceptLastCommandNamingTheItemItCreated: (createdItemId) => {
      const requestId = readLastCommandMessageReceived().requestId;
      sendMessage({ type: 'commandResult', requestId, ok: true, createdItemId });
    },
    refuseLastCommand: (error) => {
      const requestId = readLastCommandMessageReceived().requestId;
      sendMessage({ type: 'commandResult', requestId, ok: false, error });
    },
  };
}
