import type { Command, CommandErrorCode, LayerNotTaken } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * Why a command did not happen: one of the server's refusal codes, or one of the two
 * reasons that arise on this side of the WebSocket (no answer in time, no connection).
 */
export type CommandFailureCode = CommandErrorCode | 'COMMAND_TIMED_OUT' | 'NOT_CONNECTED';

/**
 * The part of the page whose buttons sent a command, when several parts send the same type:
 * a `takeItem` comes from the rundown column, the quick-fire strip, a Camadas row
 * (`layerPanel`) or the item editor, and each shows its own refusals beside its buttons
 * (BAJAOVRLAY-69; the last two since gate 2 of PR #64). Left out, a refusal shows in every
 * part listing its type.
 */
export type AreaOfThePage = 'rundown' | 'quickFire' | 'layerPanel' | 'itemEditor';

/** The last failed command, as the store keeps it for the page to show. */
export type LastCommandError = {
  /** Which kind of command failed, so each part of the page shows only its own failures. */
  commandType: Command['type'];
  code: CommandFailureCode;
  /** A pt-BR sentence for the operator: the server's own, or one from the catalog. */
  message: string;
  /**
   * The part of the page that sent it, when the sender said; it is then shown there only,
   * once, instead of in every part that lists the command's type.
   */
  areaOfThePage?: AreaOfThePage;
  /**
   * One pt-BR sentence per layer, shown as a list under `message`: the layers a "Tomar tudo"
   * left because another console had just changed them (BAJAOVRLAY-69).
   */
  sentenceOfEachLayer?: string[];
};

/** What the connection knows of a failed command when it records it. */
export type FailureOfACommand = {
  commandType: Command['type'];
  areaOfThePage: AreaOfThePage | undefined;
  code: CommandFailureCode;
  operatorMessage: string;
};

/** The store's record of a failed command, with its area only when the sender named one. */
export function buildLastCommandError(failure: FailureOfACommand): LastCommandError {
  const lastCommandError: LastCommandError = {
    commandType: failure.commandType,
    code: failure.code,
    message: failure.operatorMessage,
  };
  if (failure.areaOfThePage !== undefined) {
    lastCommandError.areaOfThePage = failure.areaOfThePage;
  }
  return lastCommandError;
}

/**
 * The store's record of a "Tomar tudo" that was accepted but left layers another console
 * had just changed (BAJAOVRLAY-69): shown where its refusals are, the server's sentence of
 * each layer left on a line of its own.
 */
export function buildErrorOfLayersNotTaken(
  commandType: Command['type'],
  layersNotTaken: LayerNotTaken[],
): LastCommandError {
  return {
    commandType,
    code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
    message: ptBR.commandFailures.someLayersNotTaken,
    sentenceOfEachLayer: layersNotTaken.map((layerNotTaken) => layerNotTaken.error.message),
  };
}

/**
 * What sendCommand rejects with. `message` is the pt-BR sentence for the operator and
 * `code` is the stable value code can react to.
 */
export class CommandFailedError extends Error {
  readonly code: CommandFailureCode;

  constructor(code: CommandFailureCode, operatorMessage: string) {
    super(operatorMessage);
    this.name = 'CommandFailedError';
    this.code = code;
  }
}
