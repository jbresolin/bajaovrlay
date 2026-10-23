import type { Command } from '@bajaovrlay/shared';

import {
  trimInvalidPollForTheEventLog,
  trimPollCommandForTheEventLog,
} from '../../modules/dataSources/index.js';
import { trimImportForTheEventLog } from '../../modules/entities/index.js';

// What an event-log row stores for a command: its name and its payload, for a valid
// command, an invalid one and a data-source poll (whose shapes are left out). Used by the
// command path in createStateStore.ts.

/**
 * What the event log stores as the payload of an invalid command: what was sent, or a
 * marker when nothing was. event_log.payload is NOT NULL and Drizzle writes a JS null as
 * SQL NULL, so storing null or undefined would make the save throw and lose the row.
 * An invalid data-source poll keeps only its type and sourceId, so a malformed one
 * carrying 60 cars of shapes does not land in the eventLog slice (gate 2 on PR #16).
 */
export function describePayloadAsReceived(commandInput: unknown): unknown {
  if (commandInput === null || commandInput === undefined) {
    return { commandWasMissing: true };
  }
  const isObject = typeof commandInput === 'object';
  const isPoll = readCommandNameAsSent(commandInput) === 'recordDataSourcePoll';
  if (isObject && isPoll) {
    return trimInvalidPollForTheEventLog(commandInput as Record<string, unknown>);
  }
  return commandInput;
}

/**
 * The payload of a validated command's event-log row: the command itself, except for a
 * data-source poll, whose row names its shapes instead of carrying them (gate 2 on
 * PR #16). A logged poll row is rare (decision D11), but each one with a 60-car snapshot
 * was tens of kilobytes in the eventLog slice that every operator page is sent again.
 * An entity import is trimmed to its keys the same way (BAJAOVRLAY-19).
 */
export function buildEventLogPayloadOfCommand(command: Command): unknown {
  if (command.type === 'recordDataSourcePoll') {
    return trimPollCommandForTheEventLog(command);
  }
  // An import keeps its type and keys, not its records, for the same reason
  // (modules/entities/importEventLogPayload.ts).
  if (command.type === 'importEntities') {
    return trimImportForTheEventLog(command);
  }
  return command;
}

/** The `type` of whatever was sent, for the event log; `unknown` when it had none. */
export function readCommandNameAsSent(commandInput: unknown): string {
  const isObjectWithType =
    typeof commandInput === 'object' && commandInput !== null && 'type' in commandInput;
  if (isObjectWithType && typeof commandInput.type === 'string' && commandInput.type !== '') {
    return commandInput.type;
  }
  return 'unknown';
}
