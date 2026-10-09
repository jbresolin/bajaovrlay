import { ClientMessageSchema, type CommandResultMessage } from '@bajaovrlay/shared';
import { z } from 'zod';

import type { ServerLogger } from '../logger/createLogger.js';
import { describeInvalidMessage, describeUnexpectedServerError } from '../store/commandRefusals.js';
import type { StateStore } from '../store/createStateStore.js';
import { buildErrorCommandResult, buildOkCommandResult } from './serverMessageBuilding.js';

// Used only to echo a requestId from a message that failed the protocol check.
const MessageWithRequestIdSchema = z.object({ requestId: z.string().min(1).max(200) });

/**
 * Handles one message a client sent and returns the `commandResult` to send back. A
 * message that is not JSON or not in the protocol gets an INVALID_MESSAGE error and a
 * warning in the log; it never throws, so a bad message can never close the socket.
 * `messageText` is undefined for a binary frame, which the protocol does not use.
 */
export function answerClientMessage(options: {
  messageText: string | undefined;
  stateStore: StateStore;
  actor: string;
  logger: ServerLogger;
}): CommandResultMessage {
  const { messageText, stateStore, actor, logger } = options;
  if (messageText === undefined) {
    logger.warn('websocket message refused: binary frame');
    return buildErrorCommandResult(null, describeInvalidMessage());
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(messageText);
  } catch {
    logger.warn({ message_text: messageText.slice(0, 200) }, 'websocket message refused: not JSON');
    return buildErrorCommandResult(null, describeInvalidMessage());
  }

  const parsedMessage = ClientMessageSchema.safeParse(parsedJson);
  if (!parsedMessage.success) {
    logger.warn(
      { problems: z.prettifyError(parsedMessage.error) },
      'websocket message refused: not a protocol message',
    );
    const requestIdIfReadable = MessageWithRequestIdSchema.safeParse(parsedJson).data?.requestId;
    return buildErrorCommandResult(requestIdIfReadable ?? null, describeInvalidMessage());
  }

  const requestId = parsedMessage.data.requestId ?? null;
  try {
    const outcome = stateStore.applyCommand(parsedMessage.data.command, actor);
    if (outcome.ok) {
      return buildOkCommandResult(requestId);
    }
    return buildErrorCommandResult(requestId, outcome.error);
  } catch (commandError) {
    // Saving failed (for example the disk is full). Memory is unchanged; tell the
    // operator in pt-BR and keep the details in the log.
    logger.error({ err: commandError, request_id: requestId }, 'command failed unexpectedly');
    return buildErrorCommandResult(requestId, describeUnexpectedServerError());
  }
}
