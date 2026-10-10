import {
  type CommandError,
  type CommandResultMessage,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  type SliceName,
  type Slices,
} from '@bajaovrlay/shared';

/** The `hello` a client gets right after connecting: every slice. */
export function buildHelloMessage(slices: Slices): ServerMessage {
  return { type: 'hello', slices };
}

/** The `slice` message for one slice, read from the current slices. */
export function buildSliceMessage(sliceName: SliceName, slices: Slices): SliceMessage {
  switch (sliceName) {
    case 'layers':
      return { type: 'slice', name: 'layers', slice: slices.layers };
    case 'graphics':
      return { type: 'slice', name: 'graphics', slice: slices.graphics };
    case 'instances':
      return { type: 'slice', name: 'instances', slice: slices.instances };
    case 'eventLog':
      return { type: 'slice', name: 'eventLog', slice: slices.eventLog };
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
