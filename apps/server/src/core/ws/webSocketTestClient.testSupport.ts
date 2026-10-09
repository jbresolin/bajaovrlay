// Test support: a real WebSocket client for the server's /ws endpoint. Tests wait for
// messages and closes by awaiting events, never by sleeping.
import { type ServerMessage, ServerMessageSchema } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';
import { WebSocket } from 'ws';

// Long enough for a slow CI machine, short enough to fail before Vitest's own timeout,
// so the failure names the message that never came.
const waitLimitInMilliseconds = 3000;

/** A connected test client and the ways a test talks to it. */
export type WebSocketTestClient = {
  /** Resolves with the first message (not already claimed by an earlier wait) that matches. */
  waitForMessage: (
    description: string,
    isTheExpectedMessage: (message: ServerMessage) => boolean,
  ) => Promise<ServerMessage>;
  /** Every message received so far, in arrival order. */
  readReceivedMessages: () => ServerMessage[];
  /** Sends a value as JSON text. */
  sendJson: (value: unknown) => void;
  /** Sends raw text, for messages that are not JSON at all. */
  sendText: (text: string) => void;
  /** Resolves when the server has closed (or dropped) this client's socket. */
  waitUntilClosed: () => Promise<void>;
  /** Whether the socket is still open. */
  isOpen: () => boolean;
};

/**
 * Connects to ws://127.0.0.1:<port>/ws and resolves once the socket is open. With
 * `answersPings: false` the client ignores the server's pings, like a frozen browser tab.
 * The socket is closed when the test ends.
 */
export async function connectWebSocketTestClient(
  port: number,
  options: { answersPings?: boolean } = {},
): Promise<WebSocketTestClient> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    autoPong: options.answersPings ?? true,
  });
  onTestFinished(() => socket.terminate());

  const receivedMessages: ServerMessage[] = [];
  const claimedMessages = new Set<ServerMessage>();
  const waitersForMessages = new Set<() => void>();

  // Listening starts before the socket opens, so the hello sent on connect is never missed.
  socket.on('message', (data) => {
    const message = ServerMessageSchema.parse(JSON.parse(String(data)));
    receivedMessages.push(message);
    waitersForMessages.forEach((checkAgain) => checkAgain());
  });
  const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });

  function waitForMessage(
    description: string,
    isTheExpectedMessage: (message: ServerMessage) => boolean,
  ): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const giveUpTimer = setTimeout(() => {
        waitersForMessages.delete(checkForTheMessage);
        reject(new Error(`no message arrived matching: ${description}`));
      }, waitLimitInMilliseconds);

      function checkForTheMessage(): void {
        const match = receivedMessages.find(
          (message) => !claimedMessages.has(message) && isTheExpectedMessage(message),
        );
        if (match === undefined) {
          return;
        }
        claimedMessages.add(match);
        waitersForMessages.delete(checkForTheMessage);
        clearTimeout(giveUpTimer);
        resolve(match);
      }

      waitersForMessages.add(checkForTheMessage);
      checkForTheMessage();
    });
  }

  return {
    waitForMessage,
    readReceivedMessages: () => [...receivedMessages],
    sendJson: (value) => socket.send(JSON.stringify(value)),
    sendText: (text) => socket.send(text),
    waitUntilClosed: () => closed,
    isOpen: () => socket.readyState === WebSocket.OPEN,
  };
}

/**
 * Tries to open a WebSocket on another path and resolves with how it ended: 'refused'
 * if the server would not upgrade it, 'opened' if it did.
 */
export function tryWebSocketOnPath(port: number, path: string): Promise<'refused' | 'opened'> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  onTestFinished(() => socket.terminate());
  return new Promise((resolve) => {
    socket.once('open', () => resolve('opened'));
    socket.once('error', () => resolve('refused'));
  });
}
