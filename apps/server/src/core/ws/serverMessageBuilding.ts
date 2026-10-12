import {
  type CommandError,
  type CommandResultMessage,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  type SliceName,
  type Slices,
} from '@bajaovrlay/shared';

/**
 * The `hello` a client gets right after connecting: every slice, and `serverNowMs`, what
 * the server's wall clock shows now, in milliseconds.
 */
export function buildHelloMessage(slices: Slices, serverNowMs: number): ServerMessage {
  return { type: 'hello', slices, serverNowMs };
}

/**
 * The `slice` message for one slice, read from the current slices, with `serverNowMs`,
 * what the server's wall clock shows now, in milliseconds. A renderer compares that with
 * its own clock so the race clock on air counts on the server's.
 */
export function buildSliceMessage(
  sliceName: SliceName,
  slices: Slices,
  serverNowMs: number,
): SliceMessage {
  switch (sliceName) {
    case 'layers':
      return { type: 'slice', name: 'layers', slice: slices.layers, serverNowMs };
    case 'graphics':
      return { type: 'slice', name: 'graphics', slice: slices.graphics, serverNowMs };
    case 'instances':
      return { type: 'slice', name: 'instances', slice: slices.instances, serverNowMs };
    case 'rundowns':
      return { type: 'slice', name: 'rundowns', slice: slices.rundowns, serverNowMs };
    case 'items':
      return { type: 'slice', name: 'items', slice: slices.items, serverNowMs };
    case 'eventLog':
      return { type: 'slice', name: 'eventLog', slice: slices.eventLog, serverNowMs };
  }
}

/** The ok `commandResult`, echoing the client's requestId (or null). */
export function buildOkCommandResult(requestId: string | null): CommandResultMessage {
  return { type: 'commandResult', requestId, ok: true };
}

/** The error `commandResult`, echoing the client's requestId (or null). */
export function buildErrorCommandResult(
  requestId: string | null,
  error: CommandError,
): CommandResultMessage {
  return { type: 'commandResult', requestId, ok: false, error };
}

/**
 * Checks an outgoing message against the shared schema and returns its JSON text.
 * Validating on the way out too means a server bug throws here, in the server's log,
 * instead of being sent to every client.
 */
export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}
