// Test support: a stand-in for the server's end of the WebSocket. A test hands
// `openSocket` to connectToServer, then plays the server by hand: it accepts the
// connection, sends messages, drops the line, and reads what the control page sent.
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
  /** Every command message the control page has sent, oldest first. */
  listCommandMessagesReceived: () => CommandMessageReceivedByFakeServer[];
  /** The newest command message; throws if the control page has not sent one. */
  readLastCommandMessageReceived: () => CommandMessageReceivedByFakeServer;
  /** The server answers the newest command with `ok: true`. */
  acceptLastCommand: () => void;
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

  // Checked instead of cast: if the control page ever sends something that is not a
  // command message, the test fails here with the field named, not later with `undefined`.
  function listCommandMessagesReceived(): CommandMessageReceivedByFakeServer[] {
    return textsReceived.map((text) => {
      const messageAsSent: unknown = JSON.parse(text);
      return CommandMessageReceivedByFakeServerSchema.parse(messageAsSent);
    });
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
    listCommandMessagesReceived,
    readLastCommandMessageReceived,
    acceptLastCommand: () => {
      const requestId = readLastCommandMessageReceived().requestId;
      sendMessage({ type: 'commandResult', requestId, ok: true });
    },
    refuseLastCommand: (error) => {
      const requestId = readLastCommandMessageReceived().requestId;
      sendMessage({ type: 'commandResult', requestId, ok: false, error });
    },
  };
}
