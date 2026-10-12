import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import type { GraphicDataProblem } from './graphicDataValidation.js';
import type { UpdateRuleProblem } from './updateRules/index.js';

/** The refusal for a command naming a layer that does not exist. */
export function refuseUnknownLayer(layerId: string): CommandError {
  return { code: 'LAYER_NOT_FOUND', message: ptBR.commandErrors.layerNotFound(layerId) };
}

/** The refusal for a command naming a graphic that is not registered. */
export function refuseUnknownGraphic(graphicId: string): CommandError {
  return { code: 'GRAPHIC_NOT_FOUND', message: ptBR.commandErrors.graphicNotFound(graphicId) };
}

/** The refusal for a command naming an instance that is not (or no longer) there. */
export function refuseUnknownInstance(instanceId: string): CommandError {
  return { code: 'INSTANCE_NOT_FOUND', message: ptBR.commandErrors.instanceNotFound(instanceId) };
}

/**
 * The refusal for a command the authorisation hook said no to. The older code
 * UNAUTHORIZED_COMMAND is no longer answered; it stays in the shared list only so
 * event-log rows written with it can still be read.
 */
export function refuseCommandNotAllowed(): CommandError {
  return { code: 'NOT_ALLOWED', message: ptBR.commandErrors.commandNotAllowed };
}

/**
 * The refusal for a take or an update whose data the graphic's manifest schema does
 * not accept, with a pt-BR message for each kind of problem (three of them name the field).
 */
export function refuseInvalidGraphicData(
  graphicId: string,
  problem: GraphicDataProblem,
): CommandError {
  switch (problem.kind) {
    case 'missingField':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldMissing(graphicId, problem.fieldPath),
      };
    case 'unknownField':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldUnknown(graphicId, problem.fieldPath),
      };
    case 'invalidValue':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldValueInvalid(graphicId, problem.fieldPath),
      };
    case 'unusableSchema':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataSchemaUnusable(graphicId),
      };
  }
}

/**
 * The refusal for a take or an update that names, in `takeTimeFieldKeys`, a field the
 * graphic's manifest does not mark as a wall-clock moment. It carries the same code as
 * data the schema refuses: the request does not fit what the manifest says of the field.
 */
export function refuseFieldGraphicCannotStamp(graphicId: string, fieldKey: string): CommandError {
  return {
    code: 'INVALID_GRAPHIC_DATA',
    message: ptBR.commandErrors.graphicFieldCannotBeStamped(graphicId, fieldKey),
  };
}

/**
 * The refusal for an update of a graphic whose manifest names an update rule that
 * cannot be run. It carries the same code as a data schema that cannot be used: in both
 * the manifest is at fault, and the message says what to correct in it.
 */
export function refuseUnusableUpdateRule(
  graphicId: string,
  problem: UpdateRuleProblem,
): CommandError {
  switch (problem.kind) {
    case 'unknownRule':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicUpdateRuleUnknown(graphicId, problem.ruleName),
      };
    case 'schemaPropertiesMissing':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicUpdateRuleFieldsMissing(
          graphicId,
          problem.ruleName,
          problem.missingPropertyKeys,
        ),
      };
  }
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
