import { ClientMessageSchema, type CommandResultMessage } from '@bajaovrlay/shared';
import { z } from 'zod';

import type { ServerLogger } from '../logger/createLogger.js';
import { describeInvalidMessage, describeUnexpectedServerError } from '../store/commandRefusals.js';
import type { StateStore } from '../store/createStateStore.js';
import { buildErrorCommandResult, buildOkCommandResult } from './serverMessageBuilding.js';

// Used only to echo a requestId from a message that failed the protocol check.
const MessageWithRequestIdSchema = z.object({ requestId: z.string().min(1).max(200) });

/**
 * Handles one client message and returns the `commandResult` to send back; anything
 * outside the protocol gets INVALID_MESSAGE and a warning. Never throws, so a bad
 * message can never close the socket.
 */
export function answerClientMessage(options: {
  messageText: string | undefined;
  stateStore: StateStore;
  actor: string;
  logger: ServerLogger;
}): CommandResultMessage {
  const { messageText, stateStore, actor, logger } = options;
  // `messageText` is undefined for a binary frame, which the protocol does not use.
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

  if (parsedMessage.data.type === 'instanceStatus') {
    // PLACEHOLDER (BAJAOVRLAY-12): the shared schema for the renderer's report landed
    // before the server handles it. Until the server work of the same task turns it
    // into a reportInstanceStatus command, it is answered as it was before the schema
    // existed: as a message outside the protocol.
    logger.warn('websocket message refused: instanceStatus is not handled yet');
    return buildErrorCommandResult(null, describeInvalidMessage());
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
