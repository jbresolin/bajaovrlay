import type { Recording } from '@bajaovrlay/shared';

/**
 * The recordings the replay form offers: only those that have ended (the server refuses
 * a replay of one still being written), newest first, because the one an operator wants
 * to rehearse with is almost always the one just made (gate 2 on PR #16). The slice
 * itself keeps the server's order; only the form's list is turned round.
 */
export function listRecordingsOfferedForReplay(recordings: Recording[]): Recording[] {
  const endedRecordings = recordings.filter((recording) => recording.endedAtMs !== null);
  const newestFirst = [...endedRecordings].sort(
    (first, second) => second.startedAtMs - first.startedAtMs,
  );
  return newestFirst;
}
