// The two commands the recorder sends, signed `sistema:gravador`: the progress of a
// recording (the lines now in its file) and the stop of a recording it could not write
// or that reached a cap. Both run from a timer, so nothing here may throw.
import type { RecordRecordingProgressCommand, StopRecordingCommand } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { dataSourceRecorderActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';

/**
 * Applies a command as the recorder. applyCommand throws when the database cannot be
 * written, and a refusal means a bug; the server's log is the only place to say so,
 * because this runs from a timer and an error nobody catches would stop the server.
 */
export function applyCommandAsTheRecorder(
  stateStore: StateStore,
  logger: ServerLogger,
  command: RecordRecordingProgressCommand | StopRecordingCommand,
  logFields: Record<string, string>,
): void {
  try {
    const outcome = stateStore.applyCommand(command, dataSourceRecorderActor);
    if (!outcome.ok) {
      logger.error(
        { ...logFields, error: outcome.error },
        `recorder's ${command.type} was refused`,
      );
    }
  } catch (commandError) {
    logger.error(
      {
        ...logFields,
        error: commandError instanceof Error ? commandError.message : String(commandError),
      },
      `recorder's ${command.type} could not be applied`,
    );
  }
}
