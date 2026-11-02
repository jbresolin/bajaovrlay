// Test support: the numbers and the two helpers of obs-websocket 5's protocol that the fake
// OBS (fakeObsWebSocketServer.testSupport.ts) speaks, written from the protocol's own
// document, not from the client library, so the client is checked against the protocol.
import { createHash } from 'node:crypto';

import type { WebSocket } from 'ws';

// The protocol's numbers (obs-websocket 5.x, docs/generated/protocol.md).
export const helloOpCode = 0;
export const identifyOpCode = 1;
export const identifiedOpCode = 2;
export const eventOpCode = 5;
export const requestOpCode = 6;
export const requestResponseOpCode = 7;
export const authenticationFailedCloseCode = 4009;
export const scenesEventCategory = 4;
export const uiEventCategory = 1024;
export const requestSucceededStatusCode = 100;
export const unknownRequestTypeStatusCode = 204;
export const studioModeNotActiveStatusCode = 506;
export const resourceNotFoundStatusCode = 600;

/** obs-websocket's authentication string: base64(sha256(base64(sha256(password + salt)) + challenge)). */
export function hashPassword(password: string, salt: string, challenge: string): string {
  const secret = createHash('sha256')
    .update(password + salt)
    .digest('base64');
  return createHash('sha256')
    .update(secret + challenge)
    .digest('base64');
}

/** Sends one protocol message: its op code and its data. */
export function sendMessage(socket: WebSocket, op: number, data: unknown): void {
  socket.send(JSON.stringify({ op, d: data }));
}
