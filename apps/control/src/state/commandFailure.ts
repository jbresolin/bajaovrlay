import type { Command, CommandErrorCode } from '@bajaovrlay/shared';

/**
 * Why a command did not happen: one of the server's refusal codes, or one of the two
 * reasons that arise on this side of the WebSocket (no answer in time, no connection).
 */
export type CommandFailureCode = CommandErrorCode | 'COMMAND_TIMED_OUT' | 'NOT_CONNECTED';

/** The last failed command, as the store keeps it for the page to show. */
export type LastCommandError = {
  /** Which kind of command failed, so each part of the page shows only its own failures. */
  commandType: Command['type'];
  code: CommandFailureCode;
  /** A pt-BR sentence for the operator: the server's own, or one from the catalog. */
  message: string;
};

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
