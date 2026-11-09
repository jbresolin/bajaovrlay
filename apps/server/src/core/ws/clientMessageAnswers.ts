import {
  type ClientMessage,
  ClientMessageSchema,
  type ClockProbeAnswerMessage,
  type CommandResultMessage,
  type InstanceStatusMessage,
  type ReportInstanceStatusCommand,
} from '@bajaovrlay/shared';
import { z } from 'zod';

import type { ServerLogger } from '../logger/createLogger.js';
import { describeInvalidMessage, describeUnexpectedServerError } from '../store/commandRefusals.js';
import type { StateStore } from '../store/createStateStore.js';
import { readServerTime } from '../time/serverClock.js';
import { buildErrorCommandResult, buildOkCommandResult } from './serverMessageBuilding.js';

// Used only to echo a requestId from a message that failed the protocol check.
const MessageWithRequestIdSchema = z.object({ requestId: z.string().min(1).max(200) });

/**
 * Handles one client message (a command, a renderer's `instanceStatus`, a page's
 * `clockProbe`) and returns what to send back: the `commandResult`, or for a probe the
 * `clockProbeAnswer`; anything outside the protocol gets INVALID_MESSAGE and a warning.
 * Never throws, so a bad message can never close the socket.
 */
export function answerClientMessage(options: {
  messageText: string | undefined;
  stateStore: StateStore;
  actor: string;
  logger: ServerLogger;
  /** The server clock a probe is answered with; the store's clock, as in startServer. */
  readCurrentTime?: (() => Date) | undefined;
}): CommandResultMessage | ClockProbeAnswerMessage {
  const { messageText, stateStore, actor, logger } = options;
  const readCurrentTime = options.readCurrentTime ?? readServerTime;
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

  const clientMessage: ClientMessage = parsedMessage.data;
  if (clientMessage.type === 'clockProbe') {
    // Read as late as possible: every millisecond between the arrival and this reading
    // is an error in the page's midpoint. No log line: a page probes every ten seconds.
    return {
      type: 'clockProbeAnswer',
      pageSentAtMs: clientMessage.pageSentAtMs,
      serverNowMs: readCurrentTime().getTime(),
    };
  }
  if (clientMessage.type === 'instanceStatus') {
    // A renderer's report is not a command envelope and carries no requestId, but it
    // changes state, so it goes through the same single command path as everything else.
    return applyCommandAndBuildCommandResult({
      commandInput: buildReportInstanceStatusCommand(clientMessage),
      requestId: null,
      stateStore,
      actor,
      logger,
    });
  }
  return applyCommandAndBuildCommandResult({
    commandInput: clientMessage.command,
    requestId: clientMessage.requestId ?? null,
    stateStore,
    actor,
    logger,
  });
}

/**
 * The reportInstanceStatus command for a renderer's `instanceStatus` message: the same
 * instance id, status and detail. A message without a detail gives a command without
 * the key, because the command's schema refuses an empty or undefined one.
 */
function buildReportInstanceStatusCommand(
  instanceStatusMessage: InstanceStatusMessage,
): ReportInstanceStatusCommand {
  const command: ReportInstanceStatusCommand = {
    type: 'reportInstanceStatus',
    instanceId: instanceStatusMessage.instanceId,
    status: instanceStatusMessage.status,
  };
  if (instanceStatusMessage.detail !== undefined) {
    command.detail = instanceStatusMessage.detail;
  }
  return command;
}

/**
 * Runs one command through the store and builds the `commandResult` for its sender:
 * ok, the store's refusal, or UNEXPECTED_SERVER_ERROR when the store threw. The command
 * API's routes call it too (api/v1/commandApiAnswers.ts), so HTTP answers what a
 * WebSocket message would.
 */
export function applyCommandAndBuildCommandResult(options: {
  commandInput: unknown;
  requestId: string | null;
  stateStore: StateStore;
  actor: string;
  logger: ServerLogger;
}): CommandResultMessage {
  const { commandInput, requestId, stateStore, actor, logger } = options;
  try {
    const outcome = stateStore.applyCommand(commandInput, actor);
    if (outcome.ok) {
      return buildOkCommandResult(requestId, outcome.createdItemId);
    }
    return buildErrorCommandResult(requestId, outcome.error);
  } catch (commandError) {
    // Saving failed (for example the disk is full). Memory is unchanged; tell the
    // sender in pt-BR and keep the details in the log.
    logger.error({ err: commandError, request_id: requestId }, 'command failed unexpectedly');
    return buildErrorCommandResult(requestId, describeUnexpectedServerError());
  }
}
