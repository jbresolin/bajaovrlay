import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/** The refusal for a command naming a layer that does not exist. */
export function refuseUnknownLayer(layerId: string): CommandError {
  return { code: 'LAYER_NOT_FOUND', message: ptBR.commandErrors.layerNotFound(layerId) };
}

/** The refusal for a command naming a graphic that is not registered. */
export function refuseUnknownGraphic(graphicId: string): CommandError {
  return { code: 'GRAPHIC_NOT_FOUND', message: ptBR.commandErrors.graphicNotFound(graphicId) };
}

/** The refusal for a command the authorisation hook said no to. */
export function refuseUnauthorizedCommand(): CommandError {
  return { code: 'UNAUTHORIZED_COMMAND', message: ptBR.commandErrors.unauthorizedCommand };
}

/**
 * The refusal for a command whose shape is wrong, naming the first bad field (for
 * example `layerId` or `data.teamNumber`). An empty path means the command was not
 * even an object.
 */
export function refuseInvalidCommand(badFieldPath: PropertyKey[]): CommandError {
  if (badFieldPath.length === 0) {
    return { code: 'INVALID_COMMAND', message: ptBR.commandErrors.invalidCommandShape };
  }
  const fieldPathAsText = badFieldPath.map(String).join('.');
  return {
    code: 'INVALID_COMMAND',
    message: ptBR.commandErrors.invalidCommandField(fieldPathAsText),
  };
}

/** The error for something that broke on the server while running a command. */
export function describeUnexpectedServerError(): CommandError {
  return { code: 'UNEXPECTED_SERVER_ERROR', message: ptBR.commandErrors.unexpectedServerError };
}

/** The error for a WebSocket message that is not JSON or not in the protocol. */
export function describeInvalidMessage(): CommandError {
  return { code: 'INVALID_MESSAGE', message: ptBR.commandErrors.invalidMessage };
}
