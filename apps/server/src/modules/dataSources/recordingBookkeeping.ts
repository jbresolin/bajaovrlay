// The `recordings` slice as the reducers keep it (decision D10): a recording opens on
// startRecording (counting the data already there as its first snapshot), counts a
// snapshot per good poll, and closes on stop, disable or delete.
// The recorder only mirrors this to disk; nothing here touches a file.
import type { DataSource, Recording } from '@bajaovrlay/shared';

/**
 * The file name of a recording started at a moment: the moment in ISO 8601 with every
 * ':' made '-', because Windows refuses ':' in a file name (decision D10).
 */
export function buildRecordingFileName(startedAtMs: number): string {
  const startedAtIso = new Date(startedAtMs).toISOString();
  return `${startedAtIso.replaceAll(':', '-')}.jsonl`;
}

/**
 * The start moment written in a recording's file name (the reverse of
 * buildRecordingFileName), or undefined for a name that is not exactly such a moment
 * (a file renamed by hand). Checked by building the name again from the moment found.
 */
export function readStartMomentFromRecordingFileName(fileName: string): number | undefined {
  const nameWithoutExtension = fileName.replace(/\.jsonl$/, '');
  const [datePart, timePart] = nameWithoutExtension.split('T');
  if (datePart === undefined || timePart === undefined) {
    return undefined;
  }
  const startedAtIso = `${datePart}T${timePart.replaceAll('-', ':')}`;
  const startedAtMs = Date.parse(startedAtIso);
  if (Number.isNaN(startedAtMs)) {
    return undefined;
  }
  const isTheNameExactlyThatMoment = buildRecordingFileName(startedAtMs) === fileName;
  return isTheNameExactlyThatMoment ? startedAtMs : undefined;
}

/** The entry of a recording of this source starting now, still open and empty. */
export function buildRecordingStartingNow(source: DataSource, nowMs: number): Recording {
  const fileName = buildRecordingFileName(nowMs);
  return {
    id: `${source.id}/${fileName}`,
    sourceId: source.id,
    sourceLabel: source.label,
    fileName,
    startedAtMs: nowMs,
    endedAtMs: null,
    snapshotCount: 0,
  };
}

/**
 * Closes the open recording of a source at this moment. Hands back the very same list
 * when the source has no open recording, so the store sees no change.
 */
export function closeOpenRecordingOfSource(
  recordings: Recording[],
  sourceId: string,
  nowMs: number,
): Recording[] {
  const isAnyRecordingOpen = recordings.some((recording) =>
    isOpenRecordingOfSource(recording, sourceId),
  );
  if (!isAnyRecordingOpen) {
    return recordings;
  }
  return recordings.map((recording) =>
    isOpenRecordingOfSource(recording, sourceId) ? { ...recording, endedAtMs: nowMs } : recording,
  );
}

/** Counts one more snapshot in the open recording of a source (a good poll was accepted). */
export function countSnapshotInOpenRecording(
  recordings: Recording[],
  sourceId: string,
): Recording[] {
  return recordings.map((recording) =>
    isOpenRecordingOfSource(recording, sourceId)
      ? { ...recording, snapshotCount: recording.snapshotCount + 1 }
      : recording,
  );
}

/** Whether a recording is this source's and still being recorded. */
function isOpenRecordingOfSource(recording: Recording, sourceId: string): boolean {
  return recording.sourceId === sourceId && recording.endedAtMs === null;
}
