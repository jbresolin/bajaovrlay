import {
  type Command,
  type CommandError,
  describeWhyTheDataRoleCannotSend,
  type Graphic,
  isCommandTypeOfTheOperator,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readRoleOfLoggedInOperatorActor } from './commandActors.js';
import {
  type GraphicDataProblem,
  nameFieldOfGraphicAsTheFormDoes,
} from './graphicDataValidation.js';
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
 * The refusal for a takePreview of a layer that has nothing on its preview output. The
 * layer is named as the operator reads it on screen, since the server has its name.
 */
export function refuseTakeOfEmptyPreview(layerName: string): CommandError {
  return { code: 'LAYER_PREVIEW_EMPTY', message: ptBR.commandErrors.layerPreviewEmpty(layerName) };
}

/** The refusal for a "Próximo" on a layer whose program output is empty. */
export function refuseNextOnEmptyLayer(layerName: string): CommandError {
  return {
    code: 'NOTHING_ON_AIR_ON_LAYER',
    message: ptBR.commandErrors.nothingOnAirOnLayer(layerName),
  };
}

/**
 * The refusal for a "Próximo" pressed from a step the graphic has already left (a double
 * press, or two operators); `stepNumber` is the step it is on now, counted from 1.
 */
export function refuseNextFromAnOldStep(
  graphicName: string,
  layerName: string,
  stepNumber: number,
): CommandError {
  return {
    code: 'STEP_ALREADY_MOVED',
    message: ptBR.commandErrors.stepAlreadyMoved(graphicName, layerName, stepNumber),
  };
}

/** The refusal for a "Próximo" on a graphic of one step, or one on its last step. */
export function refuseNextWithoutAStep(graphicName: string, layerName: string): CommandError {
  return { code: 'NO_NEXT_STEP', message: ptBR.commandErrors.noNextStep(graphicName, layerName) };
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
 * The refusal for a command the authorisation hook said no to, worded for whoever sent it:
 * Dados (BAJAOVRLAY-29) sending an operator's command its role may not send is told
 * "O papel Dados não pode …", the sentence its greyed-out button shows too; every other
 * refusal is the general NOT_ALLOWED sentence. The code is NOT_ALLOWED either way (403
 * over HTTP).
 */
export function refuseCommandNotAllowedForTheActor(command: Command, actor: string): CommandError {
  const isDataRoleSendingAnOperatorCommand =
    readRoleOfLoggedInOperatorActor(actor) === 'dados' && isCommandTypeOfTheOperator(command.type);
  if (isDataRoleSendingAnOperatorCommand) {
    return { code: 'NOT_ALLOWED', message: describeWhyTheDataRoleCannotSend(command.type) };
  }
  return refuseCommandNotAllowed();
}

/**
 * The refusal for a take or an update whose data the graphic's manifest schema does
 * not accept, with a pt-BR message for each kind of problem. Three of them name the
 * field, as the item form does (its title, "Imagem"), so the operator can find it.
 */
export function refuseInvalidGraphicData(
  graphic: Graphic,
  problem: GraphicDataProblem,
): CommandError {
  const graphicId = graphic.id;
  switch (problem.kind) {
    case 'missingField':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldMissing(
          graphicId,
          nameFieldOfGraphicAsTheFormDoes(graphic, problem.fieldPath),
        ),
      };
    case 'unknownField':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldUnknown(graphicId, problem.fieldPath),
      };
    case 'invalidValue':
      return {
        code: 'INVALID_GRAPHIC_DATA',
        message: ptBR.commandErrors.graphicDataFieldValueInvalid(
          graphicId,
          nameFieldOfGraphicAsTheFormDoes(graphic, problem.fieldPath),
        ),
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
