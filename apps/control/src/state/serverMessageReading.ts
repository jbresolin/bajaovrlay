// Reading one message the server sent over the WebSocket: its JSON, then the protocol's
// shape. Split from serverConnection.ts, whose job is the connection itself.
import { type ServerMessage, ServerMessageSchema } from '@bajaovrlay/shared';

/** Reads the JSON of one message; undefined when it is not text or not JSON. */
export function readJsonOfMessage(text: unknown): unknown {
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
export function readServerMessage(parsedJson: unknown): ServerMessage | undefined {
  const parsedMessage = ServerMessageSchema.safeParse(parsedJson);
  if (!parsedMessage.success) {
    return undefined;
  }
  return parsedMessage.data;
}
