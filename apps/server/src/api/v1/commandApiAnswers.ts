import type { CommandResultMessage } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { buildApiActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { applyCommandAndBuildCommandResult } from '../../core/ws/clientMessageAnswers.js';
import { buildOkCommandResult } from '../../core/ws/serverMessageBuilding.js';
import {
  chooseHttpStatusOfCommandRefusal,
  type CommandRefusalHttpStatus,
} from './commandRefusalHttpStatus.js';

/**
 * What a route of the command API answers: the WebSocket's commandResult as the body
 * (a refusal's `error` is the `{ code, message }` every error answer carries), and the
 * HTTP status that goes with it.
 */
export type CommandApiAnswer = {
  httpStatus: 200 | CommandRefusalHttpStatus;
  body: CommandResultMessage;
};

/**
 * Runs one command sent over HTTP through the store's one path, signed `api:<token
 * name>`, with the very function that answers a WebSocket command, and logs one line
 * naming the device, the command and how it ended (never the token: it is not here).
 */
export function runCommandFromTheApi(options: {
  commandInput: unknown;
  requestId: string | null;
  stateStore: StateStore;
  tokenName: string;
  logger: ServerLogger;
}): CommandApiAnswer {
  const commandResult = applyCommandAndBuildCommandResult({
    commandInput: options.commandInput,
    requestId: options.requestId,
    stateStore: options.stateStore,
    actor: buildApiActor(options.tokenName),
    logger: options.logger,
  });
  const httpStatus = commandResult.ok
    ? 200
    : chooseHttpStatusOfCommandRefusal(commandResult.error.code);
  options.logger.info(
    {
      api_token_name: options.tokenName,
      command: readCommandTypeAsSent(options.commandInput),
      status: httpStatus,
      error_code: commandResult.ok ? undefined : commandResult.error.code,
    },
    'api command answered',
  );
  return { httpStatus, body: commandResult };
}

/**
 * The answer of a shortcut that had nothing to send (stop-macro with no macro running):
 * ok, as the store answers a stopMacro of a macro that is not running, and nothing logged
 * in the event log, as there.
 */
export function answerOkWithoutACommand(tokenName: string, logger: ServerLogger): CommandApiAnswer {
  logger.info({ api_token_name: tokenName }, 'api shortcut had no command to send');
  return { httpStatus: 200, body: buildOkCommandResult(null) };
}

/** The `type` of a command as it was sent, for the log line; 'unknown' when it has none. */
function readCommandTypeAsSent(commandInput: unknown): string {
  if (typeof commandInput !== 'object' || commandInput === null || !('type' in commandInput)) {
    return 'unknown';
  }
  return typeof commandInput.type === 'string' ? commandInput.type : 'unknown';
}
