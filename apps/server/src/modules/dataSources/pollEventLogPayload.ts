// What a logged recordDataSourcePoll row carries as its payload. The store logs a poll
// only when the source's health changes (decision D11), but such a row used to carry the
// whole command: 60 cars of positions and the standings, tens of kilobytes, kept in the
// eventLog slice and sent to every operator page with each later change. The row is
// there to say that the source failed or recovered, and when; the data itself is in
// the dataSnapshots slice. So the row keeps the source, ok, the moment, the error and
// the names of the shapes, never the shapes. A poll that fails validation is cut down
// further, to its type and sourceId, because nothing in it can be trusted to be a result.
import type { RecordDataSourcePollCommand } from '@bajaovrlay/shared';

/** The payload of a logged poll row: everything in the command except the shapes. */
export type PollEventLogPayload = {
  type: 'recordDataSourcePoll';
  sourceId: string;
  result:
    | { ok: true; receivedAtMs: number; shapeNames: string[] }
    | { ok: false; attemptedAtMs: number; error: string };
};

/**
 * Trims a poll command into the payload of its event-log row: a good poll keeps the
 * names of the shapes it brought (in the order the adapter gave them), a failed one its
 * error and the moment it was tried.
 */
export function trimPollCommandForTheEventLog(
  command: RecordDataSourcePollCommand,
): PollEventLogPayload {
  const pollResult = command.result;
  if (pollResult.ok) {
    return {
      type: command.type,
      sourceId: command.sourceId,
      result: {
        ok: true,
        receivedAtMs: pollResult.receivedAtMs,
        shapeNames: Object.keys(pollResult.shapes),
      },
    };
  }
  return {
    type: command.type,
    sourceId: command.sourceId,
    result: { ok: false, attemptedAtMs: pollResult.attemptedAtMs, error: pollResult.error },
  };
}

/** The payload of the failed row of a poll that did not pass validation. */
export type InvalidPollEventLogPayload = {
  type: 'recordDataSourcePoll';
  sourceId: string | null;
  isResultLeftOut: true;
};

/**
 * Cuts a poll that failed validation down to its type and sourceId (null when that was
 * not text). Such a poll comes only from a malformed client message, but it may still
 * carry 60 cars of shapes, and its row would be sent to every operator page.
 */
export function trimInvalidPollForTheEventLog(
  commandInput: Record<string, unknown>,
): InvalidPollEventLogPayload {
  const sourceIdAsSent = commandInput['sourceId'];
  const sourceId = typeof sourceIdAsSent === 'string' ? sourceIdAsSent : null;
  return { type: 'recordDataSourcePoll', sourceId, isResultLeftOut: true };
}
